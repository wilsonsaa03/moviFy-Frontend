import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

declare let window: any;

@Component({
  selector: 'app-solicitar-domicilio',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  private usuarioMarker?: L.Marker;
  private conductorMarker?: L.Marker;
  private conductoresMarkers: Map<number, L.Marker> = new Map();
  private pollingServicio: any;
  private intervaloRefreshConductores: any;
  userLat: number = 0;
  userLng: number = 0;
  ubicacionEncontrada: boolean = false;
  private transicionFinalizada: boolean = false;
  private apiBase = `${environment.apiUrl}/transporte`;

  // Simulación
  private puntosRuta: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline;

  constructor(private router: Router) {}

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
    return new Promise(resolve => {
      if (window.L?.Routing) return resolve();
      if (!document.querySelector('link[href*="leaflet-routing-machine"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  private initMap(): void {
    const container = document.getElementById('map');
    if (!container) { setTimeout(() => this.initMap(), 500); return; }
    if ((container as any)._leaflet_id) (container as any)._leaflet_id = null;
    try {
      this.map = L.map('map', { center: [4.5709, -74.2973], zoom: 5, zoomControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this.map);
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      this.map.on('click', (e: L.LeafletMouseEvent) => this.establecerDestinoEnMapa(e.latlng.lat, e.latlng.lng));
      this.obtenerUbicacionGPS();
    } catch (e) { console.error('Error iniciando mapa:', e); }
  }

  establecerDestinoEnMapa(lat: number, lng: number): void {
    if (!this.ubicacionEncontrada) {
      alert('Espera a que el GPS encuentre tu ubicación.');
      return;
    }
    const iconoPaquete = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/679/679821.png',
      iconSize: [45, 45],
      iconAnchor: [22, 45], popupAnchor: [0, -40]
    });
    if (this.destinoMarker) {
      this.destinoMarker.setLatLng([lat, lng]);
    } else {
      this.destinoMarker = L.marker([lat, lng], { icon: iconoPaquete })
        .addTo(this.map)
        .bindPopup('📦 Entregar paquete aquí')
        .openPopup();
    }
    this.destino = 'Punto de entrega seleccionado';
    this.calcularRutaYTarifa(lat, lng);
  }

  toggleEntregaRapida() {
    this.entregaRapida = !this.entregaRapida;
    if (this.destinoMarker) {
      const pos = this.destinoMarker.getLatLng();
      this.calcularRutaYTarifa(pos.lat, pos.lng);
    }
  }

  private async calcularRutaYTarifa(dLat: number, dLng: number) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${this.userLng},${this.userLat};${dLng},${dLat}?overview=false`;
      const resp = await fetch(url);
      const data = await resp.json();
      const route = data.routes?.[0];
      if (route) {
        const distM = route.distance ?? route.legs?.[0]?.distance;
        const durS  = route.duration ?? route.legs?.[0]?.duration;
        this.distanciaViaje = (distM ?? 0) / 1000;
        this.duracionViaje  = (durS  ?? 0) / 60;
        let calculo = 3500 + (this.distanciaViaje * 1200);
        if (this.entregaRapida) calculo *= 1.20;
        this.tarifaEstimada = Math.ceil(calculo / 100) * 100;
      }
    } catch (e) {
      console.warn('Fallback tarifa por error OSRM:', e);
      this.distanciaViaje = this.map.distance([this.userLat, this.userLng], [dLat, dLng]) / 1000;
      this.tarifaEstimada = this.entregaRapida ? 6000 : 5000;
    }
  }

  private obtenerUbicacionGPS() {
    if (!navigator.geolocation) { this.origen = 'GPS no soportado'; return; }

    const timeoutAviso = setTimeout(() => {
      if (!this.ubicacionEncontrada) this.origen = 'GPS tardando... activa permisos';
    }, 5000);

    navigator.geolocation.getCurrentPosition(
      pos => {
        clearTimeout(timeoutAviso);
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        this.ubicacionEncontrada = true;
        this.origen = 'Ubicación actual';
        this.map.setView([this.userLat, this.userLng], 15);

        const usuarioIcon = L.icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
          iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -35]
        });
        this.usuarioMarker = L.marker([this.userLat, this.userLng], { icon: usuarioIcon })
          .addTo(this.map).bindPopup('📍 Tú estás aquí').openPopup();

        L.circleMarker([this.userLat, this.userLng], {
          color: '#16a34a', radius: 10, fillOpacity: 0.4
        }).addTo(this.map);

        this.obtenerConductoresActivos();

        this.intervaloRefreshConductores = setInterval(() => {
          if (!this.buscandoConductor && !this.simulacionActiva) {
            this.obtenerConductoresActivos();
          }
        }, 8000);
      },
      err => {
        clearTimeout(err as any);
        switch ((err as GeolocationPositionError).code) {
          case 1: this.origen = 'Permiso GPS denegado'; break;
          case 2: this.origen = 'Señal GPS no disponible'; break;
          case 3: this.origen = 'GPS tardó demasiado'; break;
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  private async obtenerConductoresActivos(): Promise<void> {
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

  async solicitarDomicilio() {
    if (this.buscandoConductor) return;
    if (!this.descripcionEncargo) return alert('Describe qué debemos llevar');
    if (!this.destinoMarker) return alert('Por favor, selecciona el destino en el mapa');

    this.buscandoConductor = true;
    this.transicionFinalizada = false;
    this.mensajeEstado = 'Estamos buscando el domiciliario más cercano...';

    const destCoords = this.destinoMarker.getLatLng();
    const body = {
      usuario_id: parseInt(localStorage.getItem('id') || '1'),
      origen_lat: this.userLat, origen_lng: this.userLng,
      destino_lat: destCoords.lat, destino_lng: destCoords.lng,
      distancia_km: this.distanciaViaje,
      tarifa: this.tarifaEstimada,
      tipo: 'DOMICILIO',
      descripcion: this.descripcionEncargo,
      incluir_foto: this.incluirFoto,
      entrega_rapida: this.entregaRapida
    };

    try {
      const resp = await fetch(`${this.apiBase}/solicitar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      this.comenzarPolling(data.id);
    } catch (e) {
      this.buscandoConductor = false;
      alert('Error: ' + (e instanceof Error ? e.message : 'No se pudo contactar con el servidor'));
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
          const resp = await fetch(`${this.apiBase}/servicio/${id}`);
          if (resp.ok) {
            const s = await resp.json();
            this.conductorInfo = s;
            this.procesarEstado(s);
          }
        } catch (e) {
          console.warn('Error en polling de domicilio, reintentando...');
        }
      }, 3000);
    }, 3000);
  }

  private procesarEstado(s: any) {
    // ACEPTADO → simulación conductor → usuario (naranja)
    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && !this.transicionFinalizada) {
      const condLat = s.conductor_lat ?? s.latitud;
      const condLng = s.conductor_lng ?? s.longitud;
      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      this.mensajeEstado = '🛵 Domiciliario en camino a recogerte';
      if (condLat && condLng) {
        this.iniciarSimulacion(condLat, condLng, this.userLat, this.userLng, '#f59e0b');
      }
    }

    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 El domiciliario ha llegado al punto de recogida.';
      this.detenerSimulacion();
    }

    // EN_VIAJE → simulación usuario → destino (verde)
    if ((s.estado === 'PAQUETE_RECOGIDO' || s.estado === 'EN_VIAJE') && !this.simulacionActiva) {
      const dest = this.destinoMarker?.getLatLng();
      this.mensajeEstado = '🛣️ Pedido en camino al destino';
      if (dest) this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#16a34a');
    }

    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      alert('🔴 El domiciliario ha cancelado el pedido.');
      this.router.navigate(['/home-usuario']);
    }

    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalFin = true;
    }
  }

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

        this.lineaSimulacion = L.polyline(this.puntosRuta, { color: colorLinea, weight: 6, opacity: 0.85 }).addTo(this.map);
        this.lineaRecorrida = L.polyline([this.puntosRuta[0]], { color: colorLinea, weight: 3, opacity: 0.35 }).addTo(this.map);
        this.map.fitBounds((this.lineaSimulacion as L.Polyline).getBounds(), { padding: [60, 60] });

        const motoIcon = L.icon({
          iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
          iconSize: [45, 45], iconAnchor: [22, 45]
        });
        if (!this.conductorMarker) {
          this.conductorMarker = L.marker(this.puntosRuta[0], { icon: motoIcon })
            .addTo(this.map).bindPopup('<b>🛵 Tu domiciliario</b>');
        } else {
          this.conductorMarker.setLatLng(this.puntosRuta[0]);
        }

        this.intervaloSimulacion = setInterval(() => {
          if (this.indexSimulacion >= this.puntosRuta.length) { this.detenerSimulacion(); return; }
          const punto = this.puntosRuta[this.indexSimulacion];
          const anterior = this.indexSimulacion > 0 ? this.puntosRuta[this.indexSimulacion - 1] : punto;

          if (this.conductorMarker) {
            this.conductorMarker.setLatLng(punto);
            const angulo = Math.atan2(punto.lng - anterior.lng, punto.lat - anterior.lat) * (180 / Math.PI);
            const el = this.conductorMarker.getElement();
            if (el) {
              el.style.transition = 'transform 0.6s linear';
              el.style.transformOrigin = 'center center';
              const base = el.style.transform.split(' rotate')[0];
              el.style.transform = `${base} rotate(${angulo}deg)`;
            }
            const restantes = this.puntosRuta.slice(this.indexSimulacion);
            if (restantes.length > 1 && this.lineaSimulacion) this.lineaSimulacion.setLatLngs(restantes);
            const recorridos = this.puntosRuta.slice(0, this.indexSimulacion + 1);
            if (recorridos.length > 1 && this.lineaRecorrida) this.lineaRecorrida.setLatLngs(recorridos);
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
    await fetch(`${this.apiBase}/calificar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        servicio_id: servicioId,
        usuario_id: parseInt(localStorage.getItem('id') || '1'),
        puntos: parseInt(puntos) || 5,
        comentario: 'Domicilio finalizado'
      })
    });
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

    if (this.destinoMarker) { this.map.removeLayer(this.destinoMarker); this.destinoMarker = undefined; }
    if (this.conductorMarker) { this.map.removeLayer(this.conductorMarker); this.conductorMarker = undefined; }

    this.router.navigate(['/home-usuario']);
  }

  volver() { this.router.navigate(['/home-usuario']); }
}