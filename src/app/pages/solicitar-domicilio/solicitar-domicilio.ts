import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { cargarRoutingMachine } from '../../core/lrm-loader';
import { ApiService } from '../../core/api.service';
import { contenidoProhibido } from '../../core/contenido-prohibido';
import { SelectorPuntos, crearMapaCiudad, rutaOsrm } from '../../core/mapa-ciudad';
import { PuntosRutaComponent } from '../../shared/puntos-ruta/puntos-ruta';

declare let window: any;

@Component({
  selector: 'app-solicitar-domicilio',
  standalone: true,
  imports: [CommonModule, FormsModule, PuntosRutaComponent],
  templateUrl: './solicitar-domicilio.html',
  styleUrls: ['./solicitar-domicilio.css']
})
export class SolicitarDomicilio implements OnInit, AfterViewInit, OnDestroy {

  origen: string = 'Buscando tu ubicación...';
  destino: string = '';
  descripcionEncargo: string = '';
  /** Figma "Domicilio 1 · Pedido": ¿Qué es? */
  categorias = [
    { valor: 'comida', label: 'Comida', icon: '🍴' },
    { valor: 'farmacia', label: 'Farmacia', icon: '💊' },
    { valor: 'mercado', label: 'Mercado', icon: '🛒' },
    { valor: 'diligencia', label: 'Diligencia', icon: '📄' }
  ];
  categoria: string = '';
  /** Nombre del sitio donde se recoge ("Droguería La Económica"), opcional. */
  establecimiento: string = '';
  /** ¿Quién paga el pedido en la tienda? true = el domiciliario (y el cliente le devuelve al recibir). */
  pagaDomiciliario: boolean = false;
  valorPedido: number | null = null;
  intentoEnviar: boolean = false;
  tarifaEstimada: number = 0;
  distanciaViaje: number = 0;
  duracionViaje: number = 0;
  buscandoConductor: boolean = false;
  mensajeEstado: string = 'Iniciando búsqueda...';
  conductorInfo: any = null;
  totalConductoresActivos: number = 0;

  // Modal calificación
  mostrarModalFin: boolean = false;
  calificacionSeleccionada: number = 5;
  estrellasArray: number[] = [1, 2, 3, 4, 5];
  private idServicioFinal: number = 0;

  private map!: L.Map;
  private routingControl: any;
  destinoMarker?: L.Marker;
  /** Recogida y entrega marcadas en el mapa (core/mapa-ciudad). */
  puntos!: SelectorPuntos;
  private conductorMarker?: L.Marker;
  private conductoresMarkers: Map<number, L.Marker> = new Map();
  private pollingServicio: any;
  private intervaloRefreshConductores: any;
  userLat: number = 0;
  userLng: number = 0;
  ubicacionEncontrada: boolean = false;
  private transicionFinalizada: boolean = false;
  private apiBase = '/transporte';
  private servicioId: number | null = null;
  private faseRuta: '' | 'recogida' | 'destino' = '';

  // Simulación
  private puntosRuta: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline;

  constructor(private router: Router, private api: ApiService) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.detenerSimulacion();
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    if (this.intervaloRefreshConductores) clearInterval(this.intervaloRefreshConductores);
    if (this.map) this.map.remove();
  }

  ngAfterViewInit(): void {
    this.cargarLRM().then(() => setTimeout(() => this.initMap(), 150));
  }

  private cargarLRM(): Promise<void> {
    return cargarRoutingMachine();
  }

  private initMap(): void {
    const container = document.getElementById('map');
    if (!container) { setTimeout(() => this.initMap(), 500); return; }
    if ((container as any)._leaflet_id) (container as any)._leaflet_id = null;
    try {
      // Abre en Buenaventura aunque el GPS no responda
      this.map = crearMapaCiudad('map');
      // Recogida y entrega: tocando el mapa, escribiendo la dirección o con el GPS
      this.puntos = new SelectorPuntos(
        this.map,
        {
          origen: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -35] }),
          destino: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/679/679821.png', iconSize: [45, 45], iconAnchor: [22, 45], popupAnchor: [0, -40] })
        },
        { origen: '📍 Punto de recogida', destino: '📦 Entregar paquete aquí' },
        () => this.alCambiarPuntos(),
        () => this.puedeEditarPuntos
      );
      this.puntos.iniciar();
    } catch (e) { console.error('Error iniciando mapa:', e); }
  }

  /** Mientras se busca domiciliario o hay un pedido en curso, los puntos ya no se mueven. */
  get puedeEditarPuntos(): boolean {
    return !this.buscandoConductor && !this.conductorInfo;
  }

  private alCambiarPuntos(): void {
    const p = this.puntos;
    if (p.origen) {
      this.userLat = p.origen.lat;
      this.userLng = p.origen.lng;
      this.origen = p.textoOrigen;
      if (!this.ubicacionEncontrada) {
        this.ubicacionEncontrada = true;
        this.obtenerConductoresActivos();
        this.intervaloRefreshConductores = setInterval(() => {
          if (!this.buscandoConductor && !this.simulacionActiva) this.obtenerConductoresActivos();
        }, 8000);
      }
    }
    this.destino = p.destino ? p.textoDestino : '';
    this.destinoMarker = p.marcador('destino');
    if (p.origen && p.destino) this.calcularRutaYTarifa();
  }

  /** Dibuja la ruta por calles (OSRM) y pide al backend la tarifa de domicilio (la misma con la que se cobra). */
  private async calcularRutaYTarifa() {
    const o = this.puntos.origen!;
    const d = this.puntos.destino!;
    const ruta = await rutaOsrm(o, d);
    if (ruta) {
      this.puntos.mostrarRuta(ruta.puntos, '#16a34a');
      this.distanciaViaje = ruta.km;
      this.duracionViaje = ruta.min;
    } else {
      // Sin OSRM: línea recta como respaldo
      this.puntos.mostrarRuta([o, d], '#16a34a');
      this.distanciaViaje = this.map.distance(o, d) / 1000;
    }
    try {
      const c = await this.api.get('/tarifas/cotizar', {
        tipo_servicio: 'domicilio', tipo_vehiculo: 'moto',
        origen_lat: o.lat, origen_lng: o.lng, destino_lat: d.lat, destino_lng: d.lng
      });
      this.tarifaEstimada = Number(c.opciones?.[0]?.valor_estimado) || 0;
      if (c.duracion_min) this.duracionViaje = Number(c.duracion_min);
    } catch {
      this.tarifaEstimada = 0;
    }
  }

  /** Lo que se paga al recibir: domicilio + (si el domiciliario compra) el valor aproximado del pedido. */
  get totalAlRecibir(): number {
    return this.tarifaEstimada + (this.pagaDomiciliario ? Number(this.valorPedido) || 0 : 0);
  }

  get prohibido(): string | null {
    return contenidoProhibido(this.descripcionEncargo) ?? contenidoProhibido(this.establecimiento);
  }

  /** Lo que falta para poder pedir, en el orden de la pantalla. Vacío = listo. */
  get faltantes(): { campo: string; texto: string }[] {
    const f: { campo: string; texto: string }[] = [];
    if (!this.ubicacionEncontrada) f.push({ campo: 'recogida', texto: 'dónde recogemos el pedido' });
    if (!this.destinoMarker) f.push({ campo: 'entrega', texto: 'a dónde lo llevamos' });
    if (!this.descripcionEncargo.trim()) f.push({ campo: 'descripcion', texto: 'qué hay que llevar' });
    else if (this.prohibido) f.push({ campo: 'descripcion', texto: `quitar lo que no podemos llevar (${this.prohibido})` });
    if (this.pagaDomiciliario && !(Number(this.valorPedido) > 0)) {
      f.push({ campo: 'valor', texto: 'cuánto cuesta más o menos el pedido' });
    }
    return f;
  }

  invalido(campo: string): boolean {
    return this.intentoEnviar && this.faltantes.some(f => f.campo === campo);
  }

  get mensajeFaltantes(): string {
    const t = this.faltantes.map(f => f.texto);
    if (!t.length) return '';
    const lista = t.length === 1 ? t[0] : `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`;
    return `Para pedir tu domicilio falta ${lista}.`;
  }

  /** Pendiente o aceptado: el cliente todavía puede cancelar. */
  get puedeCancelar(): boolean {
    const e = this.conductorInfo?.estado;
    return this.buscandoConductor || e === 'PENDIENTE' || e === 'ACEPTADO' || e === 'EN_CAMINO_AL_USUARIO';
  }

  async cancelarDomicilio(): Promise<void> {
    const id = this.servicioId ?? this.conductorInfo?.id;
    if (!id) return;
    if (!confirm('¿Cancelar el domicilio? Dejaremos de buscar domiciliario.')) return;
    try {
      await this.api.post(`/servicios/${id}/estado`, { estado: 'cancelado' });
      if (this.pollingServicio) clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.buscandoConductor = false;
      this.conductorInfo = null;
      this.servicioId = null;
      this.router.navigate(['/home-usuario']);
    } catch (e) {
      alert(ApiService.mensaje(e, 'No se pudo cancelar el domicilio en este momento.'));
    }
  }

  private async obtenerConductoresActivos(): Promise<void> {
    try {
      const conductores = await this.api.get<any[]>(`${this.apiBase}/conductores-activos`);
      this.totalConductoresActivos = conductores.length;
      this.dibujarConductoresEnMapa(conductores);
    } catch (e) {
      console.error('Error cargando conductores:', e);
    }
  }

  private dibujarConductoresEnMapa(conductores: any[]): void {
    const motoIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
      iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -30]
    });
    conductores.forEach(c => {
      const id = c.conductor_id || c.id;
      if (this.conductoresMarkers.has(id)) {
        this.conductoresMarkers.get(id)!.setLatLng([c.latitud, c.longitud]);
      } else {
        const m = L.marker([c.latitud, c.longitud], { icon: motoIcon })
          .addTo(this.map).bindPopup('<b>🛵 Domiciliario disponible</b>');
        this.conductoresMarkers.set(id, m);
      }
    });
  }

  async solicitarDomicilio() {
    if (this.buscandoConductor) return;
    if (this.faltantes.length) {
      // No se crea nada: se dice qué falta y se lleva al primer campo pendiente
      this.intentoEnviar = true;
      document.querySelector<HTMLElement>(`[data-campo="${this.faltantes[0].campo}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    this.buscandoConductor = true;
    this.transicionFinalizada = false;
    this.mensajeEstado = 'Estamos buscando el domiciliario más cercano...';

    const destCoords = this.destinoMarker!.getLatLng();
    const body = {
      origen_lat: this.userLat, origen_lng: this.userLng,
      destino_lat: destCoords.lat, destino_lng: destCoords.lng,
      origen: this.puntos.textoOrigen,
      destino: this.puntos.textoDestino,
      tipo: 'DOMICILIO',
      tipo_vehiculo: 'moto',
      metodo_pago: 'efectivo',
      descripcion: this.descripcionEncargo.trim(),
      establecimiento: this.establecimiento.trim() || null,
      categoria: this.categoria || null,
      requiere_compra: this.pagaDomiciliario,
      valor_productos_aprox: this.pagaDomiciliario ? Number(this.valorPedido) : null
    };

    try {
      // El servidor calcula distancia y tarifa y toma el usuario del token
      const data = await this.api.post(`${this.apiBase}/solicitar`, body);
      this.servicioId = data.id;
      if (data.tarifa) this.tarifaEstimada = Number(data.tarifa);
      if (data.conductores_notificados === 0) {
        this.mensajeEstado = 'No hay domiciliarios en línea en este momento. Seguimos buscando...';
      }
      this.comenzarPolling(data.id);
    } catch (e) {
      this.buscandoConductor = false;
      alert(ApiService.mensaje(e, 'No se pudo contactar con el servidor'));
    }
  }

  enviarMensajeConductor(): void {
    if (this.conductorInfo?.conductor_telefono) {
      const msg = encodeURIComponent(`Hola, soy tu cliente de MoviFY. Mi pedido es: ${this.descripcionEncargo}`);
      window.open(`https://wa.me/${this.conductorInfo.conductor_telefono}?text=${msg}`, '_blank');
    } else { alert('Información del conductor no disponible aún.'); }
  }

  private comenzarPolling(id: number) {
    // Delay igual que transporte para dar tiempo al backend
    setTimeout(() => {
      this.pollingServicio = setInterval(async () => {
        try {
          const s = await this.api.get(`${this.apiBase}/servicio/${id}`);
          this.conductorInfo = s;
          this.procesarEstado(s);
        } catch (e) {
          console.warn('Error en polling de domicilio, reintentando...');
        }
      }, 3000);
    }, 3000);
  }

  private procesarEstado(s: any) {
    const enCurso = ['ACEPTADO', 'EN_CAMINO_AL_USUARIO', 'LLEGO_AL_ORIGEN', 'EN_CAMINO', 'EN_VIAJE', 'PAQUETE_RECOGIDO'];
    if (enCurso.includes(s.estado)) {
      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      // Posición GPS real del domiciliario (ya no se anima una moto ficticia)
      if (s.conductor_lat != null && s.conductor_lng != null) {
        this.moverConductor(Number(s.conductor_lat), Number(s.conductor_lng));
      }
    }

    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && this.faseRuta !== 'recogida') {
      this.faseRuta = 'recogida';
      this.mensajeEstado = '🛵 Domiciliario en camino a recogerte';
      if (s.conductor_lat != null) {
        this.iniciarSimulacion(Number(s.conductor_lat), Number(s.conductor_lng), this.userLat, this.userLng, '#f59e0b');
      }
    }

    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 El domiciliario ha llegado al punto de recogida.';
    }

    if (['PAQUETE_RECOGIDO', 'EN_VIAJE', 'EN_CAMINO'].includes(s.estado) && this.faseRuta !== 'destino') {
      this.faseRuta = 'destino';
      const dest = this.destinoMarker?.getLatLng();
      this.mensajeEstado = '🛣️ Pedido en camino al destino';
      if (dest) this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#16a34a');
    }

    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      alert('🔴 El pedido fue cancelado.');
      this.router.navigate(['/home-usuario']);
    }

    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalFin = true;
    }
  }

  private moverConductor(lat: number, lng: number): void {
    if (!this.map) return;
    if (!this.conductorMarker) {
      const motoIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
        iconSize: [45, 45], iconAnchor: [22, 45]
      });
      this.conductorMarker = L.marker([lat, lng], { icon: motoIcon }).addTo(this.map).bindPopup('<b>🛵 Tu domiciliario</b>');
    } else {
      this.conductorMarker.setLatLng([lat, lng]);
    }
  }

  /** Dibuja la ruta por calles entre dos puntos (OSRM). */
  public iniciarSimulacion(
    origenLat: number, origenLng: number,
    destinoLat: number, destinoLng: number,
    colorLinea: string
  ): void {
    this.detenerSimulacion();
    this.puntos?.mostrarRuta(null); // la ruta del servicio reemplaza a la propuesta
    this.simulacionActiva = true;
    this.indexSimulacion = 0;

    const url = `https://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destinoLng},${destinoLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.length) { this.simulacionActiva = false; return; }
        const coords = data.routes[0].geometry.coordinates;
        this.puntosRuta = coords.map((c: number[]) => L.latLng(c[1], c[0]));
        if (this.puntosRuta.length < 2) { this.simulacionActiva = false; return; }

        this.lineaSimulacion = L.polyline(this.puntosRuta, { color: colorLinea, weight: 6, opacity: 0.85 }).addTo(this.map);
        this.lineaRecorrida = L.polyline([this.puntosRuta[0]], { color: colorLinea, weight: 3, opacity: 0.35 }).addTo(this.map);
        this.map.fitBounds((this.lineaSimulacion as L.Polyline).getBounds(), { padding: [60, 60] });

        this.simulacionActiva = false;
      })
      .catch(e => { console.error('Error ruta OSRM:', e); this.simulacionActiva = false; });
  }

  public detenerSimulacion(): void {
    if (this.intervaloSimulacion) { clearInterval(this.intervaloSimulacion); this.intervaloSimulacion = null; }
    if (this.lineaSimulacion) { try { this.map.removeLayer(this.lineaSimulacion); } catch (e) {} this.lineaSimulacion = undefined; }
    if (this.lineaRecorrida) { try { this.map.removeLayer(this.lineaRecorrida); } catch (e) {} this.lineaRecorrida = undefined; }
    this.simulacionActiva = false;
    this.indexSimulacion = 0;
    this.puntosRuta = [];
  }

  private async enviarCalificacion(servicioId: number, puntos: string) {
    if (!servicioId) return;
    try {
      await this.api.post(`${this.apiBase}/calificar`, {
        servicio_id: servicioId,
        puntos: Math.min(5, Math.max(1, parseInt(puntos) || 5)),
        comentario: 'Domicilio finalizado'
      });
    } catch (e) {
      alert(ApiService.mensaje(e, 'No se pudo guardar la calificación.'));
    }
  }

  esPasoActivo(paso: string): boolean {
    if (!this.conductorInfo) return paso === 'PENDIENTE';
    const actual = this.getProgresoPorcentaje(this.conductorInfo.estado);
    const evaluado = this.getProgresoPorcentaje(paso);
    return actual >= evaluado;
  }

  getProgresoPorcentaje(estado: string): number {
    const p: any = {
      'PENDIENTE': 10,
      'ACEPTADO': 30,
      'EN_CAMINO_AL_USUARIO': 40,
      'LLEGO_AL_ORIGEN': 50,
      'PAQUETE_RECOGIDO': 70,
      'EN_VIAJE': 85,
      'EN_CAMINO': 85,
      'FINALIZADO': 100
    };
    return p[estado] || 0;
  }

  seleccionarEstrella(n: number): void { this.calificacionSeleccionada = n; }

  async confirmarCalificacion(): Promise<void> {
    await this.enviarCalificacion(this.idServicioFinal, String(this.calificacionSeleccionada));
    this.mostrarModalFin = false;
    this.reiniciarComponente();
  }

  saltarCalificacion(): void {
    this.mostrarModalFin = false;
    this.reiniciarComponente();
  }

  private reiniciarComponente(): void {
    this.detenerSimulacion();
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    if (this.intervaloRefreshConductores) clearInterval(this.intervaloRefreshConductores);

    this.conductorInfo = null;
    this.buscandoConductor = false;
    this.transicionFinalizada = false;
    this.mensajeEstado = '';
    this.tarifaEstimada = 0;
    this.distanciaViaje = 0;
    this.descripcionEncargo = '';
    this.establecimiento = '';
    this.categoria = '';
    this.pagaDomiciliario = false;
    this.valorPedido = null;
    this.intentoEnviar = false;
    this.servicioId = null;
    this.calificacionSeleccionada = 5;
    this.idServicioFinal = 0;

    this.puntos?.quitarDestino();
    this.destinoMarker = undefined;
    if (this.conductorMarker) { this.map.removeLayer(this.conductorMarker); this.conductorMarker = undefined; }

    this.router.navigate(['/home-usuario']);
  }

  volver() { this.router.navigate(['/home-usuario']); }
}