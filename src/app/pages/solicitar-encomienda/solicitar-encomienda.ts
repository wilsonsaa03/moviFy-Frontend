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

  mostrarModalFin: boolean = false;
  calificacionSeleccionada: number = 5;
  estrellasArray: number[] = [1, 2, 3, 4, 5];
  private idServicioFinal: number = 0;

  // ✅ SIMULACIÓN
  private puntosRuta: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline;

  tiposPaquete = [
    { valor: 'documento', label: 'Documentos', icon: '📄' },
    { valor: 'caja-pequeña', label: 'Caja pequeña', icon: '📦' },
    { valor: 'caja-mediana', label: 'Caja mediana', icon: '🗃️' },
    { valor: 'caja-grande', label: 'Caja grande', icon: '📫' }
  ];

  metodosPago = [
    { valor: 'efectivo', label: 'Efectivo', icon: '💵' },
    { valor: 'tarjeta', label: 'Tarjeta', icon: '💳' },
    { valor: 'nequi', label: 'Nequi', icon: '📱' },
    { valor: 'daviplata', label: 'Daviplata', icon: '🟣' }
  ];

  private map!: L.Map;
  private routingControl: any;
  destinoMarker?: L.Marker;
  private conductorMarker?: L.Marker;
  private pollingServicio: any;
  ubicacionEncontrada: boolean = false;
  userLat: number = 0;
  userLng: number = 0;
  private transicionFinalizada: boolean = false;
  private apiBase = `${environment.apiUrl}/transporte`;

  constructor(private router: Router) {}
  ngOnInit(): void {}

  ngOnDestroy(): void {
    this.detenerSimulacion();
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    if (this.map) this.map.remove();
  }

  ngAfterViewInit(): void {
    this.cargarLRM().then(() => setTimeout(() => this.initMap(), 150));
  }

  private cargarLRM(): Promise<void> {
    return new Promise(resolve => {
      if (window.L?.Routing) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  private initMap(): void {
    const container = document.getElementById('map');
    if (!container) { setTimeout(() => this.initMap(), 400); return; }
    if ((container as any)._leaflet_id) (container as any)._leaflet_id = null;

    try {
      this.map = L.map('map').setView([3.88, -77.02], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.establecerDestino(e.latlng.lat, e.latlng.lng);
      });

      this.obtenerGPS();
    } catch (e) { console.error('Error mapa:', e); }
  }

  private obtenerGPS(): void {
    navigator.geolocation.getCurrentPosition(pos => {
      this.userLat = pos.coords.latitude;
      this.userLng = pos.coords.longitude;
      this.ubicacionEncontrada = true;
      this.origen = 'Ubicación actual';
      this.map.setView([this.userLat, this.userLng], 15);

      const iconUsuario = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        iconSize: [38, 38], iconAnchor: [19, 38]
      });
      L.marker([this.userLat, this.userLng], { icon: iconUsuario })
        .addTo(this.map).bindPopup('📍 Recogida aquí').openPopup();
      L.circleMarker([this.userLat, this.userLng], { color: '#f97316', radius: 10, fillOpacity: 0.3 }).addTo(this.map);
    }, () => { this.origen = 'GPS no disponible'; });
  }

  establecerDestino(lat: number, lng: number): void {
    if (!this.ubicacionEncontrada) return;
    const icon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/679/679821.png',
      iconSize: [42, 42], iconAnchor: [21, 42]
    });
    if (this.destinoMarker) this.destinoMarker.setLatLng([lat, lng]);
    else this.destinoMarker = L.marker([lat, lng], { icon }).addTo(this.map)
      .bindPopup('📦 Entregar aquí').openPopup();
    this.calcularRutaYTarifa(lat, lng);
  }

  private async calcularRutaYTarifa(dLat: number, dLng: number) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${this.userLng},${this.userLat};${dLng},${dLat}?overview=false`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.routes?.[0]) {
        const s = data.routes[0];
        this.distanciaViaje = s.distance / 1000;
        this.tiempoEstimado = Math.round(s.duration / 60);
        const base = 4000;
        const porKm = 1500;
        const porPeso = parseInt(this.pesoAproximado) * 200;
        let total = base + (this.distanciaViaje * porKm) + porPeso;
        this.tarifaEstimada = Math.ceil(total / 100) * 100;
      }
    } catch (e) {
      this.distanciaViaje = this.map.distance([this.userLat, this.userLng], [dLat, dLng]) / 1000;
      this.tarifaEstimada = 6000;
    }
  }

  onFotoChange(event: any): void {
    const file = event.target.files[0];
    if (file) this.fotoSeleccionada = file.name;
  }

  puedeEnviar(): boolean {
    return !!(this.ubicacionEncontrada && this.destinoMarker &&
      this.nombreRemitente && this.nombreDestinatario && this.descripcion);
  }

  async solicitarEncomienda(): Promise<void> {
    if (!this.puedeEnviar()) return;
    this.buscandoConductor = true;
    const dest = this.destinoMarker!.getLatLng();
    const body = {
      usuario_id: parseInt(localStorage.getItem('id') || '1'),
      origen_lat: this.userLat, origen_lng: this.userLng,
      destino_lat: dest.lat, destino_lng: dest.lng,
      distancia_km: this.distanciaViaje, tarifa: this.tarifaEstimada,
      tipo: 'ENCOMIENDA',
      descripcion: `${this.tipoPaquete} | ${this.pesoAproximado}kg | Para: ${this.nombreDestinatario} (${this.telefonoDestinatario}) | ${this.descripcion}`
    };
    try {
      const resp = await fetch(`${this.apiBase}/solicitar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      this.comenzarPolling(data.id);
    } catch (e) {
      this.buscandoConductor = false;
      alert('Error al enviar solicitud. Verifica tu conexión.');
    }
  }

  private comenzarPolling(id: number): void {
    setTimeout(() => {
      this.pollingServicio = setInterval(async () => {
        try {
          const resp = await fetch(`${this.apiBase}/servicio/${id}`);
          if (!resp.ok) return;
          const s = await resp.json();
          this.conductorInfo = s;
          this.procesarEstado(s);
        } catch (e) { console.warn('Polling pausado'); }
      }, 3000);
    }, 3000);
  }

  private procesarEstado(s: any): void {
    // ACEPTADO → simulación conductor → usuario (naranja)
    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && !this.transicionFinalizada) {
      const condLat = s.conductor_lat ?? s.latitud;
      const condLng = s.conductor_lng ?? s.longitud;
      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      this.mensajeEstado = '🛵 Conductor en camino a recoger el paquete';
      if (condLat && condLng) {
        this.iniciarSimulacion(condLat, condLng, this.userLat, this.userLng, '#f59e0b');
      }
    }

    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 Conductor llegó al punto de recogida';
      this.detenerSimulacion();
    }

    // PAQUETE_RECOGIDO / EN_VIAJE → simulación usuario → destino (naranja MoviFY)
    if ((s.estado === 'PAQUETE_RECOGIDO' || s.estado === 'EN_VIAJE') && !this.simulacionActiva) {
      const dest = this.destinoMarker?.getLatLng();
      this.mensajeEstado = '📦 Paquete recogido, en camino al destino';
      if (dest) this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#f97316');
    }

    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalFin = true;
    }
  }

  // ✅ SIMULACIÓN
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
            .addTo(this.map).bindPopup('<b>🛵 Tu conductor</b>');
        } else { this.conductorMarker.setLatLng(this.puntosRuta[0]); }

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
            } else { this.map.panTo(punto, { animate: true, duration: 0.6 }); }
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
    const usuarioId = localStorage.getItem('id') || '1';
    const body = {
      servicio_id: servicioId,
      usuario_id: parseInt(usuarioId),
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
    this.mostrarModalFin = false;
    this.reiniciarComponente();
  }

  saltarCalificacion(): void { 
    this.mostrarModalFin = false; 
    this.reiniciarComponente();
  }

  private reiniciarComponente(): void {
    // 1. Limpiar polling
    if (this.pollingServicio) clearInterval(this.pollingServicio);

    // 2. Resetear todas las variables
    this.conductorInfo = null;
    this.buscandoConductor = false;
    this.transicionFinalizada = false;
    this.mensajeEstado = '';
    this.tarifaEstimada = 0;
    this.distanciaViaje = 0;
    this.descripcion = '';
    this.nombreRemitente = '';
    this.nombreDestinatario = '';
    this.calificacionSeleccionada = 5;
    this.idServicioFinal = 0;

    // 3. Limpiar marcadores del mapa
    if (this.destinoMarker) {
      this.map.removeLayer(this.destinoMarker);
      this.destinoMarker = undefined;
    }
    if (this.conductorMarker) {
      this.map.removeLayer(this.conductorMarker);
      this.conductorMarker = undefined;
    }
    // 4. Limpiar ruta del mapa
    if (this.routingControl) {
      this.routingControl.setWaypoints([]);
    }

    // 5. Redirigir al home
    this.router.navigate(['/home-usuario']);
  }

  esPasoActivo(paso: string): boolean {
    if (!this.conductorInfo) return paso === 'PENDIENTE';
    const map: any = { PENDIENTE: 10, ACEPTADO: 30, EN_CAMINO_AL_USUARIO: 40, LLEGO_AL_ORIGEN: 50, PAQUETE_RECOGIDO: 70, EN_VIAJE: 85, FINALIZADO: 100 };
    return (map[this.conductorInfo.estado] || 0) >= (map[paso] || 0);
  }

  enviarMensaje(): void {
    if (this.conductorInfo?.conductor_telefono) {
      window.open(`https://wa.me/${this.conductorInfo.conductor_telefono}`, '_blank');
    }
  }

  volver(): void { this.router.navigate(['/home-usuario']); }
}