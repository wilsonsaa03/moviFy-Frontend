import { AfterViewInit, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import * as L from 'leaflet';
import { ApiService } from '../../core/api.service';
import { crearMapaCiudad, rutaOsrm } from '../../core/mapa-ciudad';

/** GET /api/publico/viajes/{token}: sin celulares ni apellidos; la ubicación solo con el viaje activo. */
interface ViajeCompartido {
  estado_codigo: 'buscando' | 'asignado' | 'en_origen' | 'en_curso' | 'finalizado' | 'cancelado' | 'expirado';
  estado_nombre: string;
  tipo_vehiculo: 'moto' | 'taxi';
  viajero: string;
  conductor?: string;
  placa?: string;
  modelo?: string;
  color?: string;
  origen: string;
  destino: string;
  destino_barrio?: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  parada?: string;
  parada_lat?: number;
  parada_lng?: number;
  duracion_estimada_min?: number;
  iniciado_en?: string;
  finalizado_en?: string;
  conductor_lat?: number;
  conductor_lng?: number;
  ubicacion_en?: string;
}

/** Cada cuánto se actualiza la posición del vehículo. */
const CADA_MS = 5000;
/** Se vuelve a pedir la ruta solo si el vehículo se movió más de esto (metros). */
const RECALCULAR_M = 120;

const SVG_MOTO = '<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5l4-6h5l4 6M14.5 10.5l-1.5-4h3"/>';
const SVG_TAXI = '<path d="M5 17h14v-4l-2-5H7l-2 5v4zM9 5h6v3M5 13h14"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>';

/**
 * Seguir un viaje en vivo (/seguir/:token). La abre la familia desde el enlace que comparte el pasajero
 * en la app ("Compartir mi viaje en vivo"): sin cuenta, solo lectura. Muestra el vehículo moviéndose,
 * la ruta, quién conduce (primer nombre), placa, modelo y color, y la hora estimada de llegada.
 * El enlace vence solo (horas_enlace_compartido).
 */
@Component({
  selector: 'app-seguir-viaje',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './seguir-viaje.html',
  styleUrl: './seguir-viaje.css'
})
export class SeguirViajeComponent implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly ruta = inject(ActivatedRoute);

  readonly v = signal<ViajeCompartido | null>(null);
  readonly error = signal<'' | 'vencido' | 'no-existe' | 'red'>('');
  readonly minutos = signal<number | null>(null);
  readonly actualizado = signal<Date | null>(null);

  private token = '';
  private mapa?: L.Map;
  private capa?: L.LayerGroup;
  private vehiculo?: L.Marker;
  private sondeo?: ReturnType<typeof setInterval>;
  private ultimaRuta: { lat: number; lng: number; estado: string } | null = null;
  private encuadrado = false;

  readonly activo = computed(() => ['asignado', 'en_origen', 'en_curso'].includes(this.v()?.estado_codigo ?? ''));
  readonly enViaje = computed(() => this.v()?.estado_codigo === 'en_curso');
  /** "Ana va en moto hacia Muelle turístico" */
  readonly titulo = computed(() => {
    const v = this.v();
    if (!v) return 'Cargando el viaje…';
    const en = v.tipo_vehiculo === 'moto' ? 'en moto' : 'en taxi';
    switch (v.estado_codigo) {
      case 'buscando':
        return `${v.viajero} está pidiendo ${v.tipo_vehiculo === 'moto' ? 'una moto' : 'un taxi'}`;
      case 'asignado':
        return `${v.conductor ?? 'El conductor'} va por ${v.viajero}`;
      case 'en_origen':
        return `${v.conductor ?? 'El conductor'} ya llegó por ${v.viajero}`;
      case 'en_curso':
        return `${v.viajero} va ${en} hacia ${v.destino}`;
      case 'finalizado':
        return `${v.viajero} llegó a ${v.destino}`;
      default:
        return 'Este viaje fue cancelado';
    }
  });
  readonly llegada = computed(() => {
    const m = this.minutos();
    if (m === null || !this.enViaje()) return null;
    return new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(new Date(Date.now() + m * 60000));
  });
  readonly horaActualizado = computed(() => {
    const d = this.actualizado();
    return d ? new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(d) : '';
  });

  ngAfterViewInit(): void {
    this.token = this.ruta.snapshot.paramMap.get('token') ?? '';
    this.mapa = crearMapaCiudad('mapa-seguir');
    this.capa = L.layerGroup().addTo(this.mapa);
    this.cargar();
    this.sondeo = setInterval(() => this.cargar(), CADA_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondeo);
    this.mapa?.remove();
  }

  private async cargar(): Promise<void> {
    try {
      const v = await this.api.get<ViajeCompartido>(`/publico/viajes/${encodeURIComponent(this.token)}`);
      this.v.set(v);
      this.error.set('');
      this.actualizado.set(new Date());
      if (!['buscando', 'asignado', 'en_origen', 'en_curso'].includes(v.estado_codigo)) clearInterval(this.sondeo);
      await this.pintar(v);
    } catch (e) {
      const status = e instanceof HttpErrorResponse ? e.status : 0;
      if (status === 410 || status === 404) {
        clearInterval(this.sondeo);
        this.error.set(status === 410 ? 'vencido' : 'no-existe');
      } else {
        this.error.set('red'); // sin conexión: se sigue intentando
      }
    }
  }

  private async pintar(v: ViajeCompartido): Promise<void> {
    if (!this.mapa || !this.capa) return;
    const origen = L.latLng(v.origen_lat, v.origen_lng);
    const destino = L.latLng(v.destino_lat, v.destino_lng);
    const parada = v.parada_lat != null && v.parada_lng != null ? L.latLng(v.parada_lat, v.parada_lng) : null;
    const coche = v.conductor_lat != null && v.conductor_lng != null ? L.latLng(v.conductor_lat, v.conductor_lng) : null;

    // Vehículo: se mueve sin redibujar todo
    if (coche) {
      if (this.vehiculo) this.vehiculo.setLatLng(coche);
      else this.vehiculo = L.marker(coche, { icon: iconoVehiculo(v.tipo_vehiculo), zIndexOffset: 1000, keyboard: false }).addTo(this.mapa);
    } else {
      this.vehiculo?.remove();
      this.vehiculo = undefined;
    }

    // Ruta: del vehículo a la recogida (antes de subir) o al destino (en el viaje)
    const meta = this.enViaje() || !coche ? destino : origen;
    const desde = coche ?? origen;
    const u = this.ultimaRuta;
    const moverse = !u || u.estado !== v.estado_codigo || desde.distanceTo(L.latLng(u.lat, u.lng)) > RECALCULAR_M;
    if (moverse) {
      this.ultimaRuta = { lat: desde.lat, lng: desde.lng, estado: v.estado_codigo };
      const r = await rutaOsrm(desde, meta);
      this.capa.clearLayers();
      const linea = r?.puntos ?? [desde, meta];
      L.polyline(linea, { color: '#03274d', weight: 9, opacity: 0.95, lineCap: 'round', interactive: false }).addTo(this.capa);
      L.polyline(linea, { color: '#fe7b13', weight: 5, lineCap: 'round', interactive: false }).addTo(this.capa);
      L.marker(origen, { icon: punto('origen'), keyboard: false, interactive: false }).addTo(this.capa);
      if (parada) L.marker(parada, { icon: punto('parada'), keyboard: false, interactive: false }).addTo(this.capa);
      L.marker(destino, { icon: punto('destino'), keyboard: false, interactive: false }).addTo(this.capa);
      this.minutos.set(r ? Math.max(1, Math.round(r.min)) : null);
      if (!this.encuadrado || u?.estado !== v.estado_codigo) {
        const caja = L.latLngBounds([origen, destino, ...(parada ? [parada] : []), ...(coche ? [coche] : [])]);
        this.mapa.fitBounds(caja, { padding: [40, 40], maxZoom: 16 });
        this.encuadrado = true;
      }
    }
  }
}

function iconoVehiculo(tipo: 'moto' | 'taxi'): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="sv-vehiculo"><svg viewBox="0 0 24 24" aria-hidden="true">${tipo === 'taxi' ? SVG_TAXI : SVG_MOTO}</svg></span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
}

function punto(tipo: 'origen' | 'destino' | 'parada'): L.DivIcon {
  return L.divIcon({ className: '', html: `<span class="sv-punto ${tipo}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
}
