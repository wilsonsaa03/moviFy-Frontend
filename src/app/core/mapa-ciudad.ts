import * as L from 'leaflet';

/** Centro de Buenaventura: con esto abren todos los mapas (el mismo de home-conductor y de la app). */
export const BUENAVENTURA: L.LatLngTuple = [3.8821, -77.0253];
export const ZOOM_CIUDAD = 14;

/** Caja de búsqueda (oeste, norte, este, sur): Buenaventura y sus alrededores, dentro de la cobertura del backend. */
const CAJA = [-77.16, 3.98, -76.9, 3.76];
const NOMINATIM = 'https://nominatim.openstreetmap.org';

export type TipoPunto = 'origen' | 'destino';

export interface LugarEncontrado {
  lat: number;
  lng: number;
  nombre: string;
}

/** Mapa de Leaflet con los mosaicos de OpenStreetMap, centrado en Buenaventura (aunque el GPS no responda). */
export function crearMapaCiudad(contenedor: string | HTMLElement): L.Map {
  const mapa = L.map(contenedor, { center: BUENAVENTURA, zoom: ZOOM_CIUDAD, zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapa);
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);
  return mapa;
}

/** Busca una dirección o lugar SOLO en Buenaventura (no salta a otra ciudad con el mismo nombre de calle). */
export async function buscarEnBuenaventura(texto: string): Promise<LugarEncontrado | null> {
  const q = texto.trim();
  if (q.length < 3) return null;
  const url = `${NOMINATIM}/search?format=jsonv2&limit=1&accept-language=es&countrycodes=co&bounded=1`
    + `&viewbox=${CAJA.join(',')}&q=${encodeURIComponent(q)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Nominatim ' + resp.status);
  const r = (await resp.json())[0];
  return r ? { lat: Number(r.lat), lng: Number(r.lon), nombre: String(r.display_name).split(',').slice(0, 2).join(',').trim() } : null;
}

export interface RutaOsrm {
  puntos: L.LatLng[];
  km: number;
  min: number;
}

/** Ruta por calles entre dos puntos (OSRM público). null si el servicio no responde. */
export async function rutaOsrm(o: L.LatLng, d: L.LatLng): Promise<RutaOsrm | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const r = (await resp.json()).routes?.[0];
    if (!r) return null;
    return {
      puntos: r.geometry.coordinates.map((c: number[]) => L.latLng(c[1], c[0])),
      km: r.distance / 1000,
      min: r.duration / 60
    };
  } catch {
    return null;
  }
}

/** Nombre corto de un punto tocado en el mapa ("Calle 5, El Cristal"); null si no se sabe. */
export async function nombreDelPunto(lat: number, lng: number): Promise<string | null> {
  try {
    const resp = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=17&accept-language=es&lat=${lat}&lon=${lng}`);
    if (!resp.ok) return null;
    const r = await resp.json();
    const a = r.address ?? {};
    const calle = a.road ?? a.pedestrian ?? a.footway ?? a.amenity;
    const barrio = a.neighbourhood ?? a.suburb ?? a.quarter;
    return [calle, barrio].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

/**
 * Recogida (origen) y destino sobre un mapa: se marcan tocando el mapa, escribiendo la dirección
 * o, para la recogida, con el GPS. Tocar el mapa marca el punto "activo"; al marcar la recogida
 * pasa solo al destino. Cada cambio avisa con `alCambiar` para recalcular ruta y tarifa.
 */
export class SelectorPuntos {
  activo: TipoPunto = 'origen';
  textoOrigen = 'Buscando tu ubicación...';
  textoDestino = '';
  origen: L.LatLng | null = null;
  destino: L.LatLng | null = null;
  /** Mensaje para el usuario (dirección no encontrada, GPS bloqueado...). */
  aviso = '';
  buscando: TipoPunto | null = null;

  private readonly marcadores: Partial<Record<TipoPunto, L.Marker>> = {};

  constructor(
    private readonly mapa: L.Map,
    private readonly iconos: Record<TipoPunto, L.Icon>,
    private readonly textos: Record<TipoPunto, string>,
    private readonly alCambiar: (tipo: TipoPunto) => void,
    /** false mientras hay un servicio en curso: ya no se pueden mover los puntos. */
    private readonly editable: () => boolean = () => true,
  ) {}

  /** Activa el toque en el mapa y pide el GPS para la recogida. */
  iniciar(): void {
    this.mapa.on('click', (e: L.LeafletMouseEvent) => {
      if (this.editable()) this.marcar(this.activo, e.latlng.lat, e.latlng.lng);
    });
    this.usarGps();
  }

  marcador(tipo: TipoPunto): L.Marker | undefined {
    return this.marcadores[tipo];
  }

  /** Pone (o mueve) el marcador. Sin nombre, lo busca en OpenStreetMap para mostrarlo en el campo. */
  marcar(tipo: TipoPunto, lat: number, lng: number, nombre?: string): void {
    const punto = L.latLng(lat, lng);
    const m = this.marcadores[tipo];
    if (m) {
      m.setLatLng(punto);
    } else {
      this.marcadores[tipo] = L.marker(punto, { icon: this.iconos[tipo] }).addTo(this.mapa).bindPopup(this.textos[tipo]);
    }
    if (tipo === 'origen') this.origen = punto;
    else this.destino = punto;
    this.aviso = '';
    this.ponerTexto(tipo, nombre ?? 'Punto marcado en el mapa');
    if (!nombre) {
      nombreDelPunto(lat, lng).then((n) => {
        const actual = tipo === 'origen' ? this.origen : this.destino;
        if (n && actual?.equals(punto)) {
          this.ponerTexto(tipo, n);
          this.alCambiar(tipo);
        }
      });
    }
    if (tipo === 'origen' && !this.destino) this.activo = 'destino';
    this.alCambiar(tipo);
  }

  /** Busca lo escrito en el campo (Enter o al salir del campo). */
  buscar(tipo: TipoPunto): Promise<void> {
    return this.buscarSiCambio(tipo, tipo === 'origen' ? this.textoOrigen : this.textoDestino);
  }

  usarGps(): void {
    if (!navigator.geolocation) {
      this.sinGps('Tu navegador no tiene GPS.');
      return;
    }
    this.textoOrigen = 'Buscando tu ubicación...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.marcar('origen', pos.coords.latitude, pos.coords.longitude, 'Mi ubicación actual');
        this.mapa.setView([pos.coords.latitude, pos.coords.longitude], 16);
      },
      (err) => this.sinGps(err.code === err.PERMISSION_DENIED ? 'No diste permiso de ubicación.' : 'No pudimos leer tu GPS.'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  /** Línea de la ruta propuesta entre recogida y destino (null la quita). Encuadra los dos puntos. */
  mostrarRuta(puntos: L.LatLng[] | null, color = '#16a34a'): void {
    this.lineaRuta?.remove();
    this.lineaRuta = undefined;
    if (!puntos || puntos.length < 2) return;
    this.lineaRuta = L.polyline(puntos, { color, weight: 6, opacity: 0.85 }).addTo(this.mapa);
    this.mapa.fitBounds(this.lineaRuta.getBounds(), { padding: [60, 60] });
  }

  private lineaRuta?: L.Polyline;

  quitarDestino(): void {
    this.mostrarRuta(null);
    this.marcadores.destino?.remove();
    delete this.marcadores.destino;
    this.destino = null;
    this.textoDestino = '';
    this.activo = this.origen ? 'destino' : 'origen';
  }

  /** Último texto buscado por campo, para no repetir la búsqueda al salir del campo sin cambios. */
  private readonly ultimaBusqueda: Partial<Record<TipoPunto, string>> = {};

  private async buscarSiCambio(tipo: TipoPunto, texto: string): Promise<void> {
    const q = texto.trim();
    if (!this.editable() || q.length < 3 || this.ultimaBusqueda[tipo] === q || this.buscando) return;
    this.ultimaBusqueda[tipo] = q;
    this.buscando = tipo;
    try {
      const lugar = await buscarEnBuenaventura(q);
      if (!lugar) {
        this.aviso = `No encontramos "${q}" en Buenaventura. Prueba con otra dirección o toca el mapa.`;
        return;
      }
      this.marcar(tipo, lugar.lat, lugar.lng, lugar.nombre);
      this.mapa.setView([lugar.lat, lugar.lng], 16);
    } catch {
      this.aviso = 'No pudimos buscar la dirección. Revisa tu conexión o toca el mapa.';
      delete this.ultimaBusqueda[tipo];
    } finally {
      this.buscando = null;
    }
  }

  private ponerTexto(tipo: TipoPunto, texto: string): void {
    if (tipo === 'origen') this.textoOrigen = texto;
    else this.textoDestino = texto;
    this.ultimaBusqueda[tipo] = texto.trim();
  }

  private sinGps(motivo: string): void {
    if (this.origen) return;
    this.textoOrigen = '';
    this.activo = 'origen';
    this.aviso = `${motivo} Toca el mapa o escribe la dirección de recogida.`;
  }
}
