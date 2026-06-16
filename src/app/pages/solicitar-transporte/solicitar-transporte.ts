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
import { environment } from '../../../environments/environment';

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

  // Modal calificación
  mostrarModalDestino: boolean = false; // reemplaza mostrarModalFin
  calificacionSeleccionada: number = 5;
  estrellasArray: number[] = [1, 2, 3, 4, 5];

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
  private apiBase = `${environment.apiUrl}/transporte`;

  // Simulación
  private puntosRuta: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline; // ✅ Estela verde del recorrido ya hecho

  constructor(private router: Router) {}

  /* ===================== LIFECYCLE ===================== */
  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.cargarScriptLRM().then(() => {
      this.initMap();
      this.obtenerUbicacionReal();
    });
  }

  ngOnDestroy(): void {
    // Limpieza completa al destruir el componente
    this.detenerSimulacion();
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    if (this.intervaloRefreshConductores) clearInterval(this.intervaloRefreshConductores);
    if (this.map) this.map.remove();
  }

  /* ===================== CARGAR LRM ===================== */
  private cargarScriptLRM(): Promise<void> {
    return new Promise((resolve) => {
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

        // ✅ Guardar referencia del interval para limpiarlo en ngOnDestroy
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
          .addTo(this.map).bindPopup(`<b>🏍️ ${c.nombre}</b><br>Disponible`);
        this.conductoresMarkers.set(id, m);
      }
    });
  }

  /* ===================== SOLICITAR VIAJE ===================== */
  async solicitarViaje(): Promise<void> {
    if (!this.origen || !this.destino || !this.ubicacionEncontrada || this.distanciaViaje === 0) return;

    // ✅ Validar que el destino esté seleccionado
    const destLat = this.destinoMarker?.getLatLng().lat;
    const destLng = this.destinoMarker?.getLatLng().lng;
    if (!destLat || !destLng) {
      alert('Por favor selecciona un punto de destino en el mapa.');
      return;
    }

    this.buscandoConductor = true;
    this.transicionFinalizada = false;
    this.mensajeEstado = 'Estamos buscando conductores cerca de ti...';

    const body = {
      usuario_id: parseInt(localStorage.getItem('id') || '1'),
      origen_lat: this.userLat,
      origen_lng: this.userLng,
      destino_lat: destLat,   //  ya validado
      destino_lng: destLng,   //  ya validado
      distancia_km: this.distanciaViaje,
      tarifa: this.tarifaEstimada,
      tipo: 'TRANSPORTE',
      descripcion: ''
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

    // ACEPTADO → simulación conductor hacia usuario
    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && !this.transicionFinalizada) {
      const condLat = s.conductor_lat ?? s.latitud;
      const condLng = s.conductor_lng ?? s.longitud;

      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      this.mensajeEstado = '🛵 ¡Conductor encontrado! En camino hacia ti.';

      if (condLat && condLng) {
        this.iniciarSimulacion(condLat, condLng, this.userLat, this.userLng, '#f59e0b');
      }
    }

    // LLEGÓ AL ORIGEN
    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 ¡Tu conductor ha llegado a recogerte!';
      this.detenerSimulacion();
    }

    // EN VIAJE → simulación usuario hacia destino
    if (s.estado === 'EN_VIAJE' && !this.simulacionActiva) {
      this.mensajeEstado = '🛣️ ¡Viajando al destino!';
      this.buscandoConductor = false;
      const dest = this.destinoMarker?.getLatLng();
      if (dest) {
        this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#16a34a');
      }
    }

    // CANCELADO
    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      alert('🔴 El conductor ha cancelado el viaje.');
      this.router.navigate(['/home-usuario']);
    }

    // FINALIZADO
    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalDestino = true; // ✅ abre el modal bonito
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

    // ✅ Usar fetch directo a OSRM en lugar de W.Routing.osrmv1
    const url = `https://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destinoLng},${destinoLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.length) { this.simulacionActiva = false; return; }

        // Extraer coordenadas [lng, lat] y convertir a L.LatLng
        const coords = data.routes[0].geometry.coordinates;
        this.puntosRuta = coords.map((c: number[]) => L.latLng(c[1], c[0]));

        if (this.puntosRuta.length < 2) { this.simulacionActiva = false; return; }

        // Ocultar línea de LRM
        if (this.routingControl) {
          try { this.routingControl.setWaypoints([]); } catch (e) {}
        }

        // Línea que se va recortando
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
            .addTo(this.map).bindPopup('<b>\ud83d\udef5 Tu conductor</b>');
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

            // Rotación
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
      comentario: 'Calificado desde la App'
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
    this.duracionViaje = 0;
    this.destino = '';
    this.calificacionSeleccionada = 5;
    this.idServicioFinal = 0;

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
    if (!this.conductorInfo?.id) return;
    if (!confirm('¿Estás seguro de que deseas cancelar el viaje?')) return;

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
        alert('Viaje cancelado correctamente.');
        this.router.navigate(['/home-usuario']);
      }
    } catch (e) {
      alert('No se pudo cancelar el viaje en este momento.');
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

  // MÉTODO DE PRUEBA - quítalo después
  probarSimulacion(): void {
    const dest = this.destinoMarker?.getLatLng();
    if (!dest) { alert('Primero selecciona un destino en el mapa'); return; }

    // Simular que el conductor está 500m al norte del usuario
    const condLat = this.userLat + 0.005;
    const condLng = this.userLng + 0.005;

    this.conductorInfo = {
      id: 999,
      estado: 'ACEPTADO',
      conductor_nombre: 'Diego T',
      conductor_lat: condLat,
      conductor_lng: condLng,
      tarifa: 12800
    };

    this.buscandoConductor = false;
    this.transicionFinalizada = false;
    this.mensajeEstado = '🛵 ¡Conductor encontrado! En camino hacia ti.';

    // Fase 1: conductor → usuario
    this.iniciarSimulacion(condLat, condLng, this.userLat, this.userLng, '#f59e0b');

    // Fase 2: después de 15s, simular EN_VIAJE hacia destino
    setTimeout(() => {
      this.detenerSimulacion();
      this.conductorInfo.estado = 'EN_VIAJE';
      this.mensajeEstado = '🛣️ ¡Viajando al destino!';
      this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#16a34a');
    }, 15000);
  }

}