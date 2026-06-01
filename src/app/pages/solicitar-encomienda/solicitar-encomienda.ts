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
  private pollingServicio: any;
  ubicacionEncontrada: boolean = false;
  userLat: number = 0;
  userLng: number = 0;
  private transicionFinalizada: boolean = false;
  private apiBase = `${environment.apiUrl}/transporte`;

  constructor(private router: Router) {}
  ngOnInit(): void {}

  ngOnDestroy(): void {
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

      const W = (window as any).L;
      if (W?.Routing) {
        this.routingControl = W.Routing.control({
          waypoints: [],
          router: W.Routing.osrmv1({ language: 'es', profile: 'driving' }),
          lineOptions: { styles: [{ color: '#f97316', weight: 5, opacity: 0.9 }] },
          addWaypoints: false, draggableWaypoints: false,
          fitSelectedRoutes: true, show: false, createMarker: () => null
        }).addTo(this.map);

        this.routingControl.on('routesfound', (e: any) => {
          const s = e.routes[0].summary;
          this.distanciaViaje = s.totalDistance / 1000;
          this.tiempoEstimado = Math.round(s.totalTime / 60);
          this.calcularTarifa();
        });
      }

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

    if (this.routingControl) {
      this.routingControl.setWaypoints([L.latLng(this.userLat, this.userLng), L.latLng(lat, lng)]);
    }
  }

  private calcularTarifa(): void {
    const base = 4000;
    const porKm = 1500;
    const porPeso = parseInt(this.pesoAproximado) * 200;
    let total = base + (this.distanciaViaje * porKm) + porPeso;
    this.tarifaEstimada = Math.ceil(total / 100) * 100;
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
    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && !this.transicionFinalizada) {
      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      this.mensajeEstado = '🛵 Conductor en camino a recoger el paquete';
    }
    if (s.estado === 'LLEGO_AL_ORIGEN') this.mensajeEstado = '📍 Conductor llegó al punto de recogida';
    if (s.estado === 'PAQUETE_RECOGIDO' || s.estado === 'EN_VIAJE') this.mensajeEstado = '📦 Paquete recogido, en camino al destino';
    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      alert('🎉 ¡Encomienda entregada exitosamente!');
      this.router.navigate(['/home-usuario']);
    }
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