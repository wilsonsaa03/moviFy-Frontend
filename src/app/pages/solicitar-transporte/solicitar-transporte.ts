import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import * as L from 'leaflet';
import { cargarRoutingMachine } from '../../core/lrm-loader';
import { ApiService } from '../../core/api.service';

declare let window: any;

@Component({
  selector: 'app-solicitar-transporte',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitar-transporte.html',
  styleUrls: ['./solicitar-transporte.css']
})
export class SolicitarTransporte implements OnInit, AfterViewInit, OnDestroy {

  /* ===================== VARIABLES PÚBLICAS ===================== */
  origen: string = 'Buscando tu ubicación...';
  destino: string = '';
  tarifaEstimada: number = 0;
  distanciaViaje: number = 0;
  duracionViaje: number = 0;
  buscandoConductor: boolean = false;
  mensajeEstado: string = 'Iniciando búsqueda...';
  conductorInfo: any = null;
  totalConductoresActivos: number = 0;
  userLat: number = 0;

  // Simulación automática — contador visible en pantalla
  segundosBuscando: number = 0;
  readonly TIMEOUT_BUSQUEDA_SEG = 15; // segundos antes de simular conductor

  // Modal calificación
  mostrarModalDestino: boolean = false;
  calificacionSeleccionada: number = 5;
  estrellasArray: number[] = [1, 2, 3, 4, 5];

  // Estado visual al llegar al origen
  conductorEnOrigen: boolean = false;

  /* ===================== VARIABLES PRIVADAS ===================== */
  private idServicioFinal: number = 0;
  private map!: L.Map;
  private usuarioMarker?: L.Marker;
  private destinoMarker?: L.Marker;
  private conductorMarker?: L.Marker;
  private userLng: number = 0;
  private transicionFinalizada: boolean = false;
  private ubicacionEncontrada: boolean = false;
  private routingControl: any;
  private conductoresMarkers: Map<number, L.Marker> = new Map();
  private pollingServicio: any;
  private intervaloRefreshConductores: any;
  private apiBase = '/transporte';
  /** id real del servicio en el backend (se usa para cancelar aunque aún no haya conductor). */
  private servicioId: number | null = null;

  // Simulación de movimiento
  private puntosRuta: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline;

  // Timeout y contador búsqueda automática
  private timeoutBusqueda: any = null;
  private intervaloCuentaBuscando: any = null;

  constructor(private router: Router, private api: ApiService) {}

  /* ===================== LIFECYCLE ===================== */
  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.cargarScriptLRM().then(() => {
      this.initMap();
      this.obtenerUbicacionReal();
    });
  }

  ngOnDestroy(): void {
    this.detenerSimulacion();
    this._limpiarTimersBusqueda();
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    if (this.intervaloRefreshConductores) clearInterval(this.intervaloRefreshConductores);
    if (this.map) this.map.remove();
  }

  /* ===================== CARGAR LRM ===================== */
  private cargarScriptLRM(): Promise<void> {
    return cargarRoutingMachine();
  }

  /* ===================== MAPA ===================== */
  private initMap(): void {
    const container = document.getElementById('map');
    if (!container) { setTimeout(() => this.initMap(), 300); return; }
    if ((container as any)._leaflet_id) (container as any)._leaflet_id = null;

    this.map = L.map('map', { center: [4.5709, -74.2973], zoom: 5, zoomControl: false });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    try {
      this.routingControl = window.L.Routing.control({
        waypoints: [],
        router: window.L.Routing.osrmv1({ language: 'es', profile: 'driving' }),
        lineOptions: { styles: [{ color: '#7c4dff', weight: 6, opacity: 0.9 }] },
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        routeWhileDragging: false,
        show: false,
        createMarker: () => null
      }).addTo(this.map);

      this.routingControl.on('routesfound', (e: any) => {
        const summary = e.routes[0].summary;
        this.distanciaViaje = summary.totalDistance / 1000;
        this.duracionViaje = summary.totalTime / 60;
        this.calcularTarifaReal();
      });

      this.routingControl.on('routingerror', () => {
        this.distanciaViaje = 0;
        this.tarifaEstimada = 0;
        alert('No se pudo calcular la ruta. Intenta con otro punto.');
      });
    } catch (err) {
      console.error('Error iniciando Routing Machine:', err);
    }

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.establecerDestinoEnMapa(e.latlng.lat, e.latlng.lng);
    });
  }

  /* ===================== GPS ===================== */
  private obtenerUbicacionReal(): void {
    if (!navigator.geolocation) {
      this.origen = 'Tu dispositivo no tiene GPS';
      return;
    }

    const timeoutAviso = setTimeout(() => {
      if (!this.ubicacionEncontrada) this.origen = 'GPS tardando... activa permisos';
    }, 5000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutAviso);
        this.userLat = position.coords.latitude;
        this.userLng = position.coords.longitude;
        this.ubicacionEncontrada = true;
        this.origen = 'Mi ubicación actual';

        const miUbicacion: [number, number] = [this.userLat, this.userLng];
        this.map.setView(miUbicacion, 16);

        const usuarioIcon = L.icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
          iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -35]
        });

        this.usuarioMarker = L.marker(miUbicacion, { icon: usuarioIcon })
          .addTo(this.map).bindPopup('📍 Tú estás aquí').openPopup();

        L.circleMarker(miUbicacion, { color: '#7c4dff', radius: 10, fillOpacity: 0.5 }).addTo(this.map);

        this.obtenerConductoresReales();

        this.intervaloRefreshConductores = setInterval(() => {
          if (!this.buscandoConductor && !this.simulacionActiva) {
            this.obtenerConductoresReales();
          }
        }, 8000);
      },
      (error) => {
        clearTimeout(timeoutAviso);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            this.origen = 'Permiso GPS denegado';
            alert('❌ Bloqueaste el GPS. Actívalo en el candado 🔒 de la barra de direcciones.');
            break;
          case error.POSITION_UNAVAILABLE:
            this.origen = 'Señal GPS no disponible';
            break;
          case error.TIMEOUT:
            this.origen = 'GPS tardó demasiado';
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  /* ===================== DESTINO EN MAPA ===================== */
  establecerDestinoEnMapa(lat: number, lon: number): void {
    if (!this.ubicacionEncontrada) {
      alert('Espera a que el GPS encuentre tu ubicación.');
      return;
    }

    const destinoIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/2776/2776067.png',
      iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -35]
    });

    if (this.destinoMarker) {
      this.destinoMarker.setLatLng([lat, lon]);
    } else {
      this.destinoMarker = L.marker([lat, lon], { icon: destinoIcon })
        .addTo(this.map).bindPopup('🏁 Punto destino').openPopup();
    }

    if (this.routingControl) {
      this.routingControl.setWaypoints([
        window.L.latLng(this.userLat, this.userLng),
        window.L.latLng(lat, lon)
      ]);
    }

    this.destino = 'Destino seleccionado';
    this.map.setView([lat, lon], 14);
  }

  /* ===================== TARIFA ===================== */
  private calcularTarifaReal(): void {
    if (!this.distanciaViaje) return;

    let calculo = 2500 + (this.distanciaViaje * 1200) + (this.duracionViaje * 150);

    const hora = new Date().getHours();
    if ((hora >= 7 && hora <= 9) || (hora >= 17 && hora <= 19)) calculo *= 1.4;
    else if (hora >= 22 || hora <= 5) calculo *= 1.2;

    calculo = Math.ceil(calculo / 100) * 100;
    this.tarifaEstimada = calculo < 4500 ? 4500 : calculo;
  }

  /* ===================== BÚSQUEDA MANUAL ===================== */
  async buscarDireccionManual(): Promise<void> {
    if (!this.ubicacionEncontrada) { alert('Espera a que el GPS te ubique.'); return; }
    if (!this.destino || this.destino.length < 3 || this.destino === 'Destino seleccionado') return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.destino + ', Colombia')}`
      );
      const data = await response.json();
      if (data?.length > 0) {
        this.establecerDestinoEnMapa(parseFloat(data[0].lat), parseFloat(data[0].lon));
      } else {
        alert('No se encontró la dirección.');
      }
    } catch (error) {
      alert('Ocurrió un error buscando la dirección.');
    }
  }

  /* ===================== CONDUCTORES ACTIVOS ===================== */
  private async obtenerConductoresReales(): Promise<void> {
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
          .addTo(this.map).bindPopup('<b>🏍️ Conductor disponible</b>');
        this.conductoresMarkers.set(id, m);
      }
    });
  }

  /* ===================== SOLICITAR VIAJE ===================== */
  async solicitarViaje(): Promise<void> {
    if (!this.origen || !this.destino || !this.ubicacionEncontrada || this.distanciaViaje === 0) return;

    const destLat = this.destinoMarker?.getLatLng().lat;
    const destLng = this.destinoMarker?.getLatLng().lng;
    if (!destLat || !destLng) {
      alert('Por favor selecciona un punto de destino en el mapa.');
      return;
    }

    this.buscandoConductor = true;
    this.transicionFinalizada = false;
    this.conductorEnOrigen = false;
    this.mensajeEstado = 'Estamos buscando conductores cerca de ti...';
    this.segundosBuscando = 0;

    // ── Contador visual de segundos ──
    this.intervaloCuentaBuscando = setInterval(() => {
      this.segundosBuscando++;
    }, 1000);

    // Sin conductores simulados: si nadie acepta, se sigue buscando y el usuario puede cancelar
    this.timeoutBusqueda = setTimeout(() => {
      if (this.buscandoConductor && !this.transicionFinalizada) {
        this.mensajeEstado = 'Seguimos buscando un conductor disponible. Puedes esperar o cancelar.';
      }
    }, this.TIMEOUT_BUSQUEDA_SEG * 1000);

    // usuario_id, distancia y tarifa ya no se envían: el servidor los toma del token y los calcula
    const body = {
      origen_lat: this.userLat,
      origen_lng: this.userLng,
      destino_lat: destLat,
      destino_lng: destLng,
      origen: this.origen,
      destino: this.destino,
      tipo: 'TRANSPORTE',
      descripcion: ''
    };

    try {
      const data = await this.api.post(`${this.apiBase}/solicitar`, body);
      this.servicioId = data.id;
      if (data.tarifa) this.tarifaEstimada = Number(data.tarifa);
      if (data.conductores_notificados === 0) {
        this.mensajeEstado = 'No hay conductores en línea en este momento. Seguimos buscando...';
      }
      this.comenzarPollingServicio(data.id);
    } catch (e) {
      this._limpiarTimersBusqueda();
      this.buscandoConductor = false;
      alert(ApiService.mensaje(e, 'No pudimos crear tu solicitud. Revisa tu conexión e intenta de nuevo.'));
    }
  }

  /* ─── Limpia timers de búsqueda ─── */
  private _limpiarTimersBusqueda(): void {
    if (this.timeoutBusqueda) { clearTimeout(this.timeoutBusqueda); this.timeoutBusqueda = null; }
    if (this.intervaloCuentaBuscando) { clearInterval(this.intervaloCuentaBuscando); this.intervaloCuentaBuscando = null; }
    this.segundosBuscando = 0;
  }

  /* ===================== POLLING ===================== */
  private comenzarPollingServicio(id: number): void {
    setTimeout(() => {
      this.pollingServicio = setInterval(async () => {
        try {
          const servicio = await this.api.get(`${this.apiBase}/servicio/${id}`);
          this.conductorInfo = servicio;
          this.procesarEstadoServicio(servicio);
        } catch (e) {
          console.warn('Error de red en polling, reintentando...');
        }
      }, 3000);
    }, 3000);
  }

  /* ===================== PROCESAR ESTADOS (siempre con datos reales del backend) ===================== */
  private procesarEstadoServicio(s: any): void {
    const enCurso = ['ACEPTADO', 'EN_CAMINO_AL_USUARIO', 'LLEGO_AL_ORIGEN', 'EN_CAMINO', 'EN_VIAJE', 'PAQUETE_RECOGIDO'];

    if (enCurso.includes(s.estado)) {
      this._limpiarTimersBusqueda();
      this.buscandoConductor = false;
      this.transicionFinalizada = true;
      // La moto del mapa es la posición GPS real que reporta el conductor
      if (s.conductor_lat != null && s.conductor_lng != null) {
        this.moverConductor(Number(s.conductor_lat), Number(s.conductor_lng));
      }
    }

    if (s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') {
      this.conductorEnOrigen = false;
      this.mensajeEstado = '🛵 ¡Conductor encontrado! En camino hacia ti.';
      if (this.faseRuta !== 'recogida' && s.conductor_lat != null) {
        this.faseRuta = 'recogida';
        this.iniciarSimulacion(Number(s.conductor_lat), Number(s.conductor_lng), this.userLat, this.userLng, '#f59e0b');
      }
    }

    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 ¡Tu conductor ha llegado a recogerte!';
      this.conductorEnOrigen = true;
    }

    if (['EN_CAMINO', 'EN_VIAJE', 'PAQUETE_RECOGIDO'].includes(s.estado)) {
      this.mensajeEstado = '🛣️ ¡Viajando al destino!';
      this.conductorEnOrigen = false;
      const dest = this.destinoMarker?.getLatLng();
      if (this.faseRuta !== 'destino' && dest) {
        this.faseRuta = 'destino';
        this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#16a34a');
      }
    }

    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      this._limpiarTimersBusqueda();
      this.detenerSimulacion();
      alert('🔴 El servicio fue cancelado.');
      this.router.navigate(['/home-usuario']);
    }

    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this._limpiarTimersBusqueda();
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalDestino = true;
    }
  }

  /** Fase de ruta dibujada para no redibujarla en cada consulta. */
  private faseRuta: '' | 'recogida' | 'destino' = '';

  private moverConductor(lat: number, lng: number): void {
    if (!this.map) return;
    if (!this.conductorMarker) {
      const motoIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
        iconSize: [45, 45], iconAnchor: [22, 45]
      });
      this.conductorMarker = L.marker([lat, lng], { icon: motoIcon }).addTo(this.map).bindPopup('<b>🛵 Tu conductor</b>');
    } else {
      this.conductorMarker.setLatLng([lat, lng]);
    }
  }

  /* ===================== SIMULACIÓN DE MOVIMIENTO ===================== */
  /**
   * Dibuja la ruta por calles (OSRM) entre dos puntos. Ya no anima una moto ficticia:
   * la posición del conductor viene de su GPS real.
   * @param colorLinea  Color de la polilínea en el mapa
   */
  public iniciarSimulacion(
    origenLat: number, origenLng: number,
    destinoLat: number, destinoLng: number,
    colorLinea: string
  ): void {
    this.detenerSimulacion();
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

        // Ocultar línea de LRM
        if (this.routingControl) {
          try { this.routingControl.setWaypoints([]); } catch (e) {}
        }

        // Línea que se va recortando (pendiente)
        this.lineaSimulacion = L.polyline(this.puntosRuta, {
          color: colorLinea, weight: 6, opacity: 0.85
        }).addTo(this.map);

        // Estela del recorrido ya hecho
        this.lineaRecorrida = L.polyline([this.puntosRuta[0]], {
          color: colorLinea, weight: 3, opacity: 0.35
        }).addTo(this.map);

        this.map.fitBounds((this.lineaSimulacion as L.Polyline).getBounds(), { padding: [60, 60] });

        // La posición de la moto la actualiza moverConductor() con el GPS real
        this.simulacionActiva = false;
      })
      .catch(e => {
        console.error('Error obteniendo ruta OSRM:', e);
        this.simulacionActiva = false;
      });
  }

  public detenerSimulacion(): void {
    if (this.intervaloSimulacion) {
      clearInterval(this.intervaloSimulacion);
      this.intervaloSimulacion = null;
    }
    if (this.lineaSimulacion) {
      try { this.map.removeLayer(this.lineaSimulacion); } catch (e) {}
      this.lineaSimulacion = undefined;
    }
    if (this.lineaRecorrida) {
      try { this.map.removeLayer(this.lineaRecorrida); } catch (e) {}
      this.lineaRecorrida = undefined;
    }
    this.simulacionActiva = false;
    this.indexSimulacion = 0;
    this.puntosRuta = [];
  }

  /* ===================== CALIFICACIÓN ===================== */
  private async enviarCalificacion(servicioId: number, puntos: string): Promise<void> {
    if (!servicioId) return;
    try {
      await this.api.post(`${this.apiBase}/calificar`, {
        servicio_id: servicioId,
        puntos: Math.min(5, Math.max(1, parseInt(puntos) || 5)),
        comentario: 'Calificado desde la App'
      });
    } catch (e) {
      alert(ApiService.mensaje(e, 'No se pudo guardar la calificación.'));
    }
  }

  seleccionarEstrella(n: number): void { this.calificacionSeleccionada = n; }

  async confirmarCalificacion(): Promise<void> {
    await this.enviarCalificacion(this.idServicioFinal, String(this.calificacionSeleccionada));
    this.mostrarModalDestino = false;
    this.reiniciarComponente();
  }

  saltarCalificacion(): void {
    this.mostrarModalDestino = false;
    this.reiniciarComponente();
  }

  /* ===================== REINICIAR ===================== */
  private reiniciarComponente(): void {
    this.detenerSimulacion();
    this._limpiarTimersBusqueda();
    if (this.pollingServicio) clearInterval(this.pollingServicio);

    this.conductorInfo = null;
    this.buscandoConductor = false;
    this.transicionFinalizada = false;
    this.servicioId = null;
    this.faseRuta = '';
    this.conductorEnOrigen = false;
    this.mensajeEstado = '';
    this.tarifaEstimada = 0;
    this.distanciaViaje = 0;
    this.duracionViaje = 0;
    this.destino = '';
    this.calificacionSeleccionada = 5;
    this.idServicioFinal = 0;
    this.segundosBuscando = 0;

    if (this.destinoMarker) { this.map.removeLayer(this.destinoMarker); this.destinoMarker = undefined; }
    if (this.conductorMarker) { this.map.removeLayer(this.conductorMarker); this.conductorMarker = undefined; }
    if (this.routingControl) { try { this.routingControl.setWaypoints([]); } catch (e) {} }

    this.router.navigate(['/home-usuario']);
  }

  /* ===================== ACCIONES ===================== */
  enviarMensajeConductor(): void {
    if (this.conductorInfo?.conductor_telefono) {
      const msg = encodeURIComponent(
        `Hola ${this.conductorInfo.conductor_nombre}, soy ${this.conductorInfo.usuario_nombre ?? 'tu pasajero'}. Estoy esperando en ${this.origen}.`
      );
      window.open(`https://wa.me/${this.conductorInfo.conductor_telefono}?text=${msg}`, '_blank');
    } else {
      alert('No se encontró el número de teléfono del conductor.');
    }
  }

  async cancelarViaje(): Promise<void> {
    if (!confirm('¿Estás seguro de que deseas cancelar el viaje?')) return;
    const id = this.servicioId ?? this.conductorInfo?.id;

    if (!id) {
      // La solicitud todavía no llegó al servidor
      this._limpiarTimersBusqueda();
      this.buscandoConductor = false;
      this.router.navigate(['/home-usuario']);
      return;
    }

    try {
      await this.api.patch(`${this.apiBase}/servicio/${id}/estado`, { estado: 'CANCELADO' });
      clearInterval(this.pollingServicio);
      this._limpiarTimersBusqueda();
      this.detenerSimulacion();
      this.buscandoConductor = false;
      this.conductorInfo = null;
      this.servicioId = null;
      this.transicionFinalizada = false;
      alert('Viaje cancelado correctamente.');
      this.router.navigate(['/home-usuario']);
    } catch (e) {
      alert(ApiService.mensaje(e, 'No se pudo cancelar el viaje en este momento.'));
    }
  }

  volver(): void { this.router.navigate(['/home-usuario']); }

  /* ===================== HELPERS UI ===================== */
  getProgresoPorcentaje(estado: string): number {
    const pasos: { [key: string]: number } = {
      'PENDIENTE': 10, 'ACEPTADO': 30, 'EN_CAMINO_AL_USUARIO': 50,
      'LLEGO_AL_ORIGEN': 70, 'EN_VIAJE': 90, 'FINALIZADO': 100
    };
    return pasos[estado] || 0;
  }

  esPasoActivo(paso: string): boolean {
    if (!this.conductorInfo) return false;
    const p = this.getProgresoPorcentaje(this.conductorInfo.estado);
    switch (paso) {
      case 'solicitado': return p >= 10;
      case 'encamino':   return p >= 30;
      case 'enviaje':    return p >= 90;
      case 'finalizado': return p === 100;
      default: return false;
    }
  }

  getFriendlyEstado(estado: string): string {
    if (!estado) return 'Procesando...';
    return estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  getEstadoColorClass(estado: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'text-warning';
      case 'ACEPTADO': case 'EN_CAMINO_AL_USUARIO': case 'LLEGO_AL_ORIGEN': return 'text-info';
      case 'EN_CAMINO': case 'EN_VIAJE': return 'text-accent';
      case 'FINALIZADO': return 'text-success';
      case 'CANCELADO': case 'RECHAZADO': return 'text-danger';
      default: return 'text-muted';
    }
  }
}