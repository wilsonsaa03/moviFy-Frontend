import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

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
  private apiBase = `${environment.apiUrl}/transporte`;

  // Simulación
  private puntosRuta: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline;

  constructor(private router: Router) {}

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
    return new Promise(resolve => {
      if (window.L?.Routing) { resolve(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
      script.onload = () => resolve();
      script.onerror = () => { console.error('Error cargando LRM'); resolve(); };
      document.head.appendChild(script);
    });
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
      const resp = await fetch(`${this.apiBase}/conductores-activos`);
      const conductores = await resp.json();
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
          .addTo(this.map).bindPopup(`<b>🛵 ${c.nombre}</b><br>Disponible`);
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
      usuario_id: parseInt(localStorage.getItem('id') || '1'),
      origen_lat: this.userLat,
      origen_lng: this.userLng,
      destino_lat: dest.lat,
      destino_lng: dest.lng,
      distancia_km: this.distanciaViaje,
      tarifa: this.tarifaEstimada,
      tipo: 'ENCOMIENDA',
      descripcion: `${this.tipoPaquete} | ${this.pesoAproximado}kg | Para: ${this.nombreDestinatario} (${this.telefonoDestinatario}) | ${this.descripcion}`
    };

    try {
      const resp = await fetch(`${this.apiBase}/solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      this.comenzarPollingServicio(data.id);
    } catch (e) {
      this.buscandoConductor = false;
      alert('Error: ' + (e instanceof Error ? e.message : 'No se pudo contactar con el servidor'));
    }
  }

  /* ===================== POLLING ===================== */
  private comenzarPollingServicio(id: number): void {
    setTimeout(() => {
      this.pollingServicio = setInterval(async () => {
        try {
          const resp = await fetch(`${this.apiBase}/servicio/${id}`);
          if (!resp.ok) return;
          const servicio = await resp.json();
          this.conductorInfo = servicio;
          this.procesarEstadoServicio(servicio);
        } catch (e) {
          console.warn('Error de red en polling, reintentando...');
        }
      }, 3000);
    }, 3000);
  }

  /* ===================== PROCESAR ESTADOS ===================== */
  private procesarEstadoServicio(s: any): void {

    // ACEPTADO → simulación conductor hacia punto de recogida (naranja)
    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && !this.transicionFinalizada) {
      const condLat = s.conductor_lat ?? s.latitud;
      const condLng = s.conductor_lng ?? s.longitud;

      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      this.mensajeEstado = '🛵 ¡Conductor encontrado! En camino a recoger el paquete.';

      if (condLat && condLng) {
        this.iniciarSimulacion(condLat, condLng, this.userLat, this.userLng, '#f59e0b');
      }
    }

    // LLEGÓ AL ORIGEN → conductor en punto de recogida
    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 ¡El conductor llegó al punto de recogida!';
      this.detenerSimulacion();
    }

    // PAQUETE RECOGIDO / EN_VIAJE → simulación hacia destino (naranja MoviFY)
    if ((s.estado === 'PAQUETE_RECOGIDO' || s.estado === 'EN_VIAJE') && !this.simulacionActiva) {
      this.mensajeEstado = '📦 Paquete recogido — en camino al destino.';
      this.buscandoConductor = false;
      const dest = this.destinoMarker?.getLatLng();
      if (dest) {
        this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#f97316');
      }
    }

    // CANCELADO
    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      alert('🔴 El conductor ha cancelado el servicio.');
      this.router.navigate(['/home-usuario']);
    }

    // FINALIZADO → mostrar modal de calificación
    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalDestino = true;
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

        // Marcador moto
        const motoIcon = L.icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
          iconSize: [45, 45], iconAnchor: [22, 45]
        });

        if (!this.conductorMarker) {
          this.conductorMarker = L.marker(this.puntosRuta[0], { icon: motoIcon })
            .addTo(this.map).bindPopup('<b>🛵 Tu conductor</b>');
        } else {
          this.conductorMarker.setLatLng(this.puntosRuta[0]);
        }

        // Mover punto a punto
        this.intervaloSimulacion = setInterval(() => {
          if (this.indexSimulacion >= this.puntosRuta.length) {
            this.detenerSimulacion();
            return;
          }

          const punto = this.puntosRuta[this.indexSimulacion];
          const anterior = this.indexSimulacion > 0
            ? this.puntosRuta[this.indexSimulacion - 1] : punto;

          if (this.conductorMarker) {
            this.conductorMarker.setLatLng(punto);

            // Rotación del ícono según dirección
            const angulo = Math.atan2(
              punto.lng - anterior.lng,
              punto.lat - anterior.lat
            ) * (180 / Math.PI);
            const el = this.conductorMarker.getElement();
            if (el) {
              el.style.transition = 'transform 0.6s linear';
              el.style.transformOrigin = 'center center';
              const base = el.style.transform.split(' rotate')[0];
              el.style.transform = `${base} rotate(${angulo}deg)`;
            }

            // Recortar línea restante
            const restantes = this.puntosRuta.slice(this.indexSimulacion);
            if (restantes.length > 1 && this.lineaSimulacion) {
              this.lineaSimulacion.setLatLngs(restantes);
            }

            // Crecer estela
            const recorridos = this.puntosRuta.slice(0, this.indexSimulacion + 1);
            if (recorridos.length > 1 && this.lineaRecorrida) {
              this.lineaRecorrida.setLatLngs(recorridos);
            }

            // Zoom progresivo
            const progreso = this.indexSimulacion / this.puntosRuta.length;
            const zoomObjetivo = progreso < 0.3 ? 15 : progreso < 0.7 ? 16 : 17;
            if (Math.abs(this.map.getZoom() - zoomObjetivo) >= 1) {
              this.map.setView(punto, zoomObjetivo, { animate: true, duration: 1 });
            } else {
              this.map.panTo(punto, { animate: true, duration: 0.6 });
            }
          }
          this.indexSimulacion++;
        }, 700);
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
    const body = {
      servicio_id: servicioId,
      usuario_id: parseInt(localStorage.getItem('id') || '1'),
      puntos: parseInt(puntos) || 5,
      comentario: 'Calificado desde Encomiendas'
    };
    await fetch(`${this.apiBase}/calificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
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
    if (!this.conductorInfo?.id) return;
    if (!confirm('¿Estás seguro de que deseas cancelar el servicio?')) return;

    try {
      const resp = await fetch(`${this.apiBase}/servicio/${this.conductorInfo.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'CANCELADO' })
      });
      if (resp.ok) {
        clearInterval(this.pollingServicio);
        this.detenerSimulacion();
        this.buscandoConductor = false;
        this.conductorInfo = null;
        this.transicionFinalizada = false;
        alert('Servicio cancelado correctamente.');
        this.router.navigate(['/home-usuario']);
      }
    } catch (e) {
      alert('No se pudo cancelar el servicio en este momento.');
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

  /* ===================== PRUEBA SIMULACIÓN ===================== */
  probarSimulacion(): void {
    const dest = this.destinoMarker?.getLatLng();
    if (!dest) { alert('Primero selecciona un destino en el mapa'); return; }

    const condLat = this.userLat + 0.005;
    const condLng = this.userLng + 0.005;

    this.conductorInfo = {
      id: 999,
      estado: 'ACEPTADO',
      conductor_nombre: 'Diego T',
      conductor_lat: condLat,
      conductor_lng: condLng,
      tarifa: this.tarifaEstimada || 8500,
      conductor_foto: null
    };

    this.buscandoConductor = false;
    this.transicionFinalizada = false;
    this.mensajeEstado = '🛵 ¡Conductor encontrado! En camino a recoger el paquete.';

    // Fase 1: conductor → punto de recogida (amarillo)
    this.iniciarSimulacion(condLat, condLng, this.userLat, this.userLng, '#f59e0b');

    // Fase 2: después de 15s, simular recogida y viaje al destino
    setTimeout(() => {
      this.detenerSimulacion();
      this.conductorInfo.estado = 'PAQUETE_RECOGIDO';
      this.mensajeEstado = '📦 Paquete recogido — en camino al destino.';
      this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#f97316');
    }, 15000);
  }
}