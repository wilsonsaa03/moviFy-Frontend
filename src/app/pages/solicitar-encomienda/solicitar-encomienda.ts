import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { cargarRoutingMachine } from '../../core/lrm-loader';
import { ApiService } from '../../core/api.service';

declare let window: any;

@Component({
  selector: 'app-solicitar-encomienda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './solicitar-encomienda.html',
  styleUrls: ['./solicitar-encomienda.css']
})
export class SolicitarEncomienda implements OnInit, AfterViewInit, OnDestroy {

  /* ===================== VARIABLES PÚBLICAS ===================== */
  origen: string = 'Detectando ubicación...';
  nombreRemitente: string = '';
  telefonoRemitente: string = '';
  nombreDestinatario: string = '';
  telefonoDestinatario: string = '';
  descripcion: string = '';
  tipoPaquete: string = 'documento';
  pesoAproximado: string = '2';
  metodoPago: string = 'efectivo';
  fotoSeleccionada: string = '';
  tarifaEstimada: number = 0;
  distanciaViaje: number = 0;
  tiempoEstimado: number = 0;
  buscandoConductor: boolean = false;
  mensajeEstado: string = '';
  conductorInfo: any = null;
  totalConductoresActivos: number = 0;
  ubicacionEncontrada: boolean = false;
  userLat: number = 0;
  userLng: number = 0;

  // Modal calificación
  mostrarModalDestino: boolean = false;
  calificacionSeleccionada: number = 5;
  estrellasArray: number[] = [1, 2, 3, 4, 5];

  tiposPaquete = [
    { valor: 'documento',     label: 'Documentos',   icon: '📄' },
    { valor: 'caja-pequeña',  label: 'Caja pequeña', icon: '📦' },
    { valor: 'caja-mediana',  label: 'Caja mediana', icon: '🗃️' },
    { valor: 'caja-grande',   label: 'Caja grande',  icon: '📫' }
  ];

  metodosPago = [
    { valor: 'efectivo',  label: 'Efectivo',   icon: '💵' },
    { valor: 'tarjeta',   label: 'Tarjeta',    icon: '💳' },
    { valor: 'nequi',     label: 'Nequi',      icon: '📱' },
    { valor: 'daviplata', label: 'Daviplata',  icon: '🟣' }
  ];

  /* ===================== VARIABLES PRIVADAS ===================== */
  private idServicioFinal: number = 0;
  private map!: L.Map;
  private usuarioMarker?: L.Marker;
  destinoMarker?: L.Marker;
  private conductorMarker?: L.Marker;
  private routingControl: any;
  private pollingServicio: any;
  private intervaloRefreshConductores: any;
  private transicionFinalizada: boolean = false;
  private conductoresMarkers: Map<number, L.Marker> = new Map();
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

  /* ===================== LIFECYCLE ===================== */
  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.cargarLRM().then(() => {
      this.initMap();
      this.obtenerUbicacionReal();
    });
  }

  ngOnDestroy(): void {
    this.detenerSimulacion();
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    if (this.intervaloRefreshConductores) clearInterval(this.intervaloRefreshConductores);
    if (this.map) this.map.remove();
  }

  /* ===================== CARGAR LRM ===================== */
  private cargarLRM(): Promise<void> {
    return cargarRoutingMachine();
  }

  /* ===================== MAPA ===================== */
  private initMap(): void {
    const container = document.getElementById('map');
    if (!container) { setTimeout(() => this.initMap(), 300); return; }
    if ((container as any)._leaflet_id) (container as any)._leaflet_id = null;

    this.map = L.map('map', { center: [4.5709, -74.2973], zoom: 5, zoomControl: false }).setView([4.5709, -74.2973], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.establecerDestino(e.latlng.lat, e.latlng.lng);
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
          .addTo(this.map).bindPopup('📍 Punto de recogida').openPopup();

        L.circleMarker(miUbicacion, { color: '#f97316', radius: 10, fillOpacity: 0.4 }).addTo(this.map);

        // Cargar conductores activos al obtener ubicación
        this.obtenerConductoresReales();

        // Refrescar conductores cada 8 segundos (igual que transporte)
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
          .addTo(this.map).bindPopup('<b>🛵 Conductor disponible</b>');
        this.conductoresMarkers.set(id, m);
      }
    });
  }

  /* ===================== DESTINO EN MAPA ===================== */
  establecerDestino(lat: number, lng: number): void {
    if (!this.ubicacionEncontrada) {
      alert('Espera a que el GPS encuentre tu ubicación.');
      return;
    }

    const icon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/679/679821.png',
      iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -35]
    });

    if (this.destinoMarker) {
      this.destinoMarker.setLatLng([lat, lng]);
    } else {
      this.destinoMarker = L.marker([lat, lng], { icon })
        .addTo(this.map).bindPopup('📦 Entregar aquí').openPopup();
    }

    this.calcularRutaYTarifa(lat, lng);
  }

  /* ===================== RUTA Y TARIFA ===================== */
  private async calcularRutaYTarifa(dLat: number, dLng: number): Promise<void> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${this.userLng},${this.userLat};${dLng},${dLat}?overview=false`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.routes?.[0]) {
        const s = data.routes[0];
        this.distanciaViaje = s.distance / 1000;
        this.tiempoEstimado = Math.round(s.duration / 60);

        // Tarifa encomienda: base + km + peso
        const base = 4000;
        const porKm = 1500;
        const porPeso = parseInt(this.pesoAproximado) * 200;
        let total = base + (this.distanciaViaje * porKm) + porPeso;

        // Recargo hora pico (igual que transporte)
        const hora = new Date().getHours();
        if ((hora >= 7 && hora <= 9) || (hora >= 17 && hora <= 19)) total *= 1.3;
        else if (hora >= 22 || hora <= 5) total *= 1.15;

        this.tarifaEstimada = Math.ceil(total / 100) * 100;
        if (this.tarifaEstimada < 5000) this.tarifaEstimada = 5000;
      }
    } catch (e) {
      this.distanciaViaje = this.map.distance([this.userLat, this.userLng], [dLat, dLng]) / 1000;
      this.tarifaEstimada = 6000;
    }
  }

  /* ===================== VALIDACIÓN FORMULARIO ===================== */
  onFotoChange(event: any): void {
    const file = event.target.files[0];
    if (file) this.fotoSeleccionada = file.name;
  }

  puedeEnviar(): boolean {
    return !!(
      this.ubicacionEncontrada &&
      this.destinoMarker &&
      this.nombreRemitente &&
      this.nombreDestinatario &&
      this.descripcion
    );
  }

  /* ===================== SOLICITAR ENCOMIENDA ===================== */
  async solicitarEncomienda(): Promise<void> {
    if (!this.puedeEnviar()) return;

    this.buscandoConductor = true;
    this.transicionFinalizada = false;
    this.mensajeEstado = 'Buscando conductores disponibles...';

    const dest = this.destinoMarker!.getLatLng();
    const body = {
      origen_lat: this.userLat,
      origen_lng: this.userLng,
      destino_lat: dest.lat,
      destino_lng: dest.lng,
      tipo: 'ENCOMIENDA',
      descripcion: this.descripcion,
      // Columnas propias de la encomienda (antes todo iba pegado en la descripción)
      nombre_remitente: this.nombreRemitente,
      telefono_remitente: this.telefonoRemitente,
      nombre_destinatario: this.nombreDestinatario,
      telefono_destinatario: this.telefonoDestinatario,
      tipo_paquete: this.tipoPaquete,
      peso_kg: String(this.pesoAproximado ?? '').slice(0, 10)
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
      this.buscandoConductor = false;
      alert(ApiService.mensaje(e, 'No se pudo contactar con el servidor'));
    }
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

  /* ===================== PROCESAR ESTADOS (datos reales del backend) ===================== */
  private procesarEstadoServicio(s: any): void {
    const enCurso = ['ACEPTADO', 'EN_CAMINO_AL_USUARIO', 'LLEGO_AL_ORIGEN', 'EN_CAMINO', 'EN_VIAJE', 'PAQUETE_RECOGIDO'];
    if (enCurso.includes(s.estado)) {
      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      if (s.conductor_lat != null && s.conductor_lng != null) {
        this.moverConductor(Number(s.conductor_lat), Number(s.conductor_lng));
      }
    }

    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && this.faseRuta !== 'recogida') {
      this.faseRuta = 'recogida';
      this.mensajeEstado = '🛵 ¡Conductor encontrado! En camino a recoger el paquete.';
      if (s.conductor_lat != null) {
        this.iniciarSimulacion(Number(s.conductor_lat), Number(s.conductor_lng), this.userLat, this.userLng, '#f59e0b');
      }
    }

    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 ¡El conductor llegó al punto de recogida!';
    }

    if (['PAQUETE_RECOGIDO', 'EN_VIAJE', 'EN_CAMINO'].includes(s.estado) && this.faseRuta !== 'destino') {
      this.faseRuta = 'destino';
      this.mensajeEstado = '📦 Paquete recogido — en camino al destino.';
      const dest = this.destinoMarker?.getLatLng();
      if (dest) this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#f97316');
    }

    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      alert('🔴 El servicio fue cancelado.');
      this.router.navigate(['/home-usuario']);
    }

    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalDestino = true;
    }
  }

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

        // Línea de ruta restante
        this.lineaSimulacion = L.polyline(this.puntosRuta, {
          color: colorLinea, weight: 6, opacity: 0.85
        }).addTo(this.map);

        // Estela del recorrido ya hecho
        this.lineaRecorrida = L.polyline([this.puntosRuta[0]], {
          color: colorLinea, weight: 3, opacity: 0.35
        }).addTo(this.map);

        // Ajustar cámara
        this.map.fitBounds((this.lineaSimulacion as L.Polyline).getBounds(), { padding: [60, 60] });

        // La moto la ubica moverConductor() con el GPS real del conductor
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
        comentario: 'Calificado desde Encomiendas'
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
    if (this.pollingServicio) clearInterval(this.pollingServicio);

    this.conductorInfo = null;
    this.buscandoConductor = false;
    this.transicionFinalizada = false;
    this.mensajeEstado = '';
    this.tarifaEstimada = 0;
    this.distanciaViaje = 0;
    this.tiempoEstimado = 0;
    this.descripcion = '';
    this.nombreRemitente = '';
    this.telefonoRemitente = '';
    this.nombreDestinatario = '';
    this.telefonoDestinatario = '';
    this.fotoSeleccionada = '';
    this.calificacionSeleccionada = 5;
    this.idServicioFinal = 0;
    this.servicioId = null;
    this.faseRuta = '';

    if (this.destinoMarker) { this.map.removeLayer(this.destinoMarker); this.destinoMarker = undefined; }
    if (this.conductorMarker) { this.map.removeLayer(this.conductorMarker); this.conductorMarker = undefined; }

    this.router.navigate(['/home-usuario']);
  }

  /* ===================== ACCIONES ===================== */
  enviarMensaje(): void {
    if (this.conductorInfo?.conductor_telefono) {
      const msg = encodeURIComponent(
        `Hola ${this.conductorInfo.conductor_nombre}, soy ${this.conductorInfo.usuario_nombre ?? 'el remitente'}. Estoy esperando en ${this.origen}.`
      );
      window.open(`https://wa.me/${this.conductorInfo.conductor_telefono}?text=${msg}`, '_blank');
    } else {
      alert('No se encontró el número de teléfono del conductor.');
    }
  }

  async cancelarServicio(): Promise<void> {
    const id = this.servicioId ?? this.conductorInfo?.id;
    if (!id) return;
    if (!confirm('¿Estás seguro de que deseas cancelar el servicio?')) return;

    try {
      await this.api.patch(`${this.apiBase}/servicio/${id}/estado`, { estado: 'CANCELADO' });
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.buscandoConductor = false;
      this.conductorInfo = null;
      this.servicioId = null;
      this.transicionFinalizada = false;
      alert('Servicio cancelado correctamente.');
      this.router.navigate(['/home-usuario']);
    } catch (e) {
      alert(ApiService.mensaje(e, 'No se pudo cancelar el servicio en este momento.'));
    }
  }

  volver(): void { this.router.navigate(['/home-usuario']); }

  /* ===================== HELPERS UI ===================== */
  getProgresoPorcentaje(estado: string): number {
    const pasos: { [key: string]: number } = {
      'PENDIENTE': 10,
      'ACEPTADO': 25,
      'EN_CAMINO_AL_USUARIO': 40,
      'LLEGO_AL_ORIGEN': 55,
      'PAQUETE_RECOGIDO': 70,
      'EN_VIAJE': 85,
      'FINALIZADO': 100
    };
    return pasos[estado] || 0;
  }

  esPasoActivo(paso: string): boolean {
    if (!this.conductorInfo) return paso === 'PENDIENTE';
    const p = this.getProgresoPorcentaje(this.conductorInfo.estado);
    const umbrales: { [key: string]: number } = {
      'PENDIENTE': 10,
      'ACEPTADO': 25,
      'PAQUETE_RECOGIDO': 70,
      'FINALIZADO': 100
    };
    return p >= (umbrales[paso] || 0);
  }


}
