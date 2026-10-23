import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { cargarRoutingMachine } from '../../core/lrm-loader';
import { ApiService } from '../../core/api.service';
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
  tarifaEstimada: number = 0;
  distanciaViaje: number = 0;
  duracionViaje: number = 0;
  buscandoConductor: boolean = false;
  mensajeEstado: string = 'Iniciando búsqueda...';
  conductorInfo: any = null;
  incluirFoto: boolean = false;
  entregaRapida: boolean = false;
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

  toggleEntregaRapida() {
    this.entregaRapida = !this.entregaRapida;
    if (this.puntos?.origen && this.puntos.destino) this.calcularRutaYTarifa();
  }

  /** Dibuja la ruta por calles (OSRM) entre recogida y entrega y calcula distancia y tarifa estimada. */
  private async calcularRutaYTarifa() {
    const o = this.puntos.origen!;
    const d = this.puntos.destino!;
    const ruta = await rutaOsrm(o, d);
    if (ruta) {
      this.puntos.mostrarRuta(ruta.puntos, '#16a34a');
      this.distanciaViaje = ruta.km;
      this.duracionViaje = ruta.min;
      let calculo = 3500 + (this.distanciaViaje * 1200);
      if (this.entregaRapida) calculo *= 1.20;
      this.tarifaEstimada = Math.ceil(calculo / 100) * 100;
    } else {
      // Sin OSRM: línea recta como respaldo
      this.puntos.mostrarRuta([o, d], '#16a34a');
      this.distanciaViaje = this.map.distance(o, d) / 1000;
      this.tarifaEstimada = this.entregaRapida ? 6000 : 5000;
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
    if (!this.descripcionEncargo) return alert('Describe qué debemos llevar');
    if (!this.ubicacionEncontrada) return alert('Marca el punto de recogida en el mapa o escribe la dirección');
    if (!this.destinoMarker) return alert('Por favor, selecciona el destino en el mapa');

    this.buscandoConductor = true;
    this.transicionFinalizada = false;
    this.mensajeEstado = 'Estamos buscando el domiciliario más cercano...';

    const destCoords = this.destinoMarker.getLatLng();
    const body = {
      origen_lat: this.userLat, origen_lng: this.userLng,
      destino_lat: destCoords.lat, destino_lng: destCoords.lng,
      tipo: 'DOMICILIO',
      descripcion: this.descripcionEncargo,
      entrega_rapida: this.entregaRapida
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
    this.calificacionSeleccionada = 5;
    this.idServicioFinal = 0;

    this.puntos?.quitarDestino();
    this.destinoMarker = undefined;
    if (this.conductorMarker) { this.map.removeLayer(this.conductorMarker); this.conductorMarker = undefined; }

    this.router.navigate(['/home-usuario']);
  }

  volver() { this.router.navigate(['/home-usuario']); }
}