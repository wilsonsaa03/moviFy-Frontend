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

  private map!: L.Map;
  private routingControl: any;
  destinoMarker?: L.Marker;
  private conductorMarker?: L.Marker;
  private pollingServicio: any;
  userLat: number = 0;
  userLng: number = 0;
  ubicacionEncontrada: boolean = false;
  private transicionFinalizada: boolean = false;
  private ultimaLat: number | null = null;
  private ultimaLng: number | null = null;
  // ✅ Variables para la estela y rastro
  private estelaMoto: L.Polyline | undefined;
  private puntosEstela: L.LatLng[] = [];
  private apiBase = `${environment.apiUrl}/transporte`;

  constructor(private router: Router) {}

  ngOnInit(): void {}
  ngOnDestroy(): void {
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    this.limpiarEstela();
    if (this.map) {
      this.map.remove(); // ✅ Limpia el contenedor para la próxima vez
    }
  }

  ngAfterViewInit(): void {
    this.cargarLRM().then(() => {
      // ✅ Agregamos un pequeño retraso para asegurar que el DOM esté listo
      setTimeout(() => this.initMap(), 150);
    });
  }

  private cargarLRM(): Promise<void> {
    return new Promise(resolve => {
      if (window.L?.Routing) return resolve();

      // ✅ Cargamos el CSS que faltaba para que las rutas se vean bien
      if (!document.querySelector('link[href*="leaflet-routing-machine"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
        document.head.appendChild(link);
      }

      const script = document.createElement('script');
      // ✅ Usamos una versión específica en lugar de @latest para mayor estabilidad
      script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js';
      script.onload = () => resolve();
      script.onerror = () => {
        console.error('Error: El script de rutas fue bloqueado por el navegador.');
        resolve(); // Resolvemos igual para intentar cargar el mapa base
      };
      document.head.appendChild(script);
    });
  }

  private initMap(): void {
    const container = document.getElementById('map');
    if (!container) {
      console.log('Esperando al contenedor del mapa...');
      setTimeout(() => this.initMap(), 500);
      return;
    }

    // ✅ Destruir instancia previa de Leaflet si existe
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    try {
      this.map = L.map('map').setView([3.88, -77.02], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);

      // ✅ Inicializar Routing Machine
      const W = (window as any).L;
      if (W?.Routing) {
        this.routingControl = W.Routing.control({
          waypoints: [],
          router: W.Routing.osrmv1({ language: 'es', profile: 'driving' }),
          lineOptions: {
            styles: [{ color: '#16a34a', weight: 6, opacity: 0.9 }]
          },
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          show: false,
          createMarker: () => null
        }).addTo(this.map);
      }

      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.establecerDestinoEnMapa(e.latlng.lat, e.latlng.lng);
      });

      this.obtenerUbicacionGPS();
    } catch (e) {
      console.error('Error iniciando mapa:', e);
    }
  }

  establecerDestinoEnMapa(lat: number, lng: number): void {
    if (!this.ubicacionEncontrada) return;

    // Creamos el icono del paquete
    const iconoPaquete = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/679/679821.png', // Icono de caja/paquete
      iconSize: [45, 45],
      iconAnchor: [22, 45],
      popupAnchor: [0, -40]
    });

    if (this.destinoMarker) {
      this.destinoMarker.setLatLng([lat, lng]);
    } else {
      this.destinoMarker = L.marker([lat, lng], { icon: iconoPaquete })
        .addTo(this.map)
        .bindPopup('📦 Entregar paquete aquí')
        .openPopup();
    }

    // Dibujar ruta inicial si tenemos el GPS
    if (this.ubicacionEncontrada && this.routingControl) {
      this.routingControl.setWaypoints([
        L.latLng(this.userLat, this.userLng),
        L.latLng(lat, lng)
      ]);
    }

    this.destino = 'Punto de entrega seleccionado';
    this.calcularRutaYTarifa(lat, lng);
  }

  private async calcularRutaYTarifa(dLat: number, dLng: number) {
    try {
      const url = `http://router.project-osrm.org/route/v1/driving/${this.userLng},${this.userLat};${dLng},${dLat}?overview=false`;
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        this.distanciaViaje = route.distance / 1000;
        this.duracionViaje = route.duration / 60;
        
        // Lógica de precio: $3500 base + $1200 por km
        let calculo = 3500 + (this.distanciaViaje * 1200);
        this.tarifaEstimada = Math.ceil(calculo / 100) * 100; // Redondear a centenas
      }
    } catch (e) {
      console.warn("No se pudo calcular la ruta exacta, usando estimación lineal.");
      this.distanciaViaje = this.map.distance([this.userLat, this.userLng], [dLat, dLng]) / 1000;
      this.tarifaEstimada = 5000; 
    }
  }

  private obtenerUbicacionGPS() {
    if (!navigator.geolocation) {
      this.origen = "GPS no soportado";
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        this.userLat = pos.coords.latitude;
        this.userLng = pos.coords.longitude;
        this.ubicacionEncontrada = true;
        this.origen = "Ubicación actual";
        this.map.setView([this.userLat, this.userLng], 15);
        L.marker([this.userLat, this.userLng]).addTo(this.map).bindPopup('Recoger aquí').openPopup();
      },
      err => {
        console.error("Error GPS:", err);
        this.origen = "Ubicación no disponible";
        alert("Por favor, habilita los permisos de ubicación para usar MoviFY Domicilios.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async solicitarDomicilio() {
    if (!this.descripcionEncargo) return alert('Describe qué debemos llevar');
    if (!this.destinoMarker) return alert('Por favor, selecciona el destino en el mapa');
    this.buscandoConductor = true;
    this.mensajeEstado = 'Estamos buscando el domiciliario más cercano...';
    
    const destCoords = this.destinoMarker.getLatLng();
    const body = {
      usuario_id: localStorage.getItem('id') || 1,
      origen_lat: this.userLat, origen_lng: this.userLng,
      destino_lat: destCoords.lat, destino_lng: destCoords.lng,
      distancia_km: this.distanciaViaje,
      tarifa: this.tarifaEstimada,
      tipo: 'DOMICILIO', descripcion: this.descripcionEncargo
    };

    const resp = await fetch(`${this.apiBase}/solicitar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    this.comenzarPolling(data.id);
  }

  enviarMensajeConductor(): void {
    if (this.conductorInfo && this.conductorInfo.conductor_telefono) {
      const tel = this.conductorInfo.conductor_telefono;
      const msg = encodeURIComponent(`Hola, soy tu cliente de MoviFY. Mi pedido es: ${this.descripcionEncargo}`);
      window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
    } else {
      alert('Información del conductor no disponible aún.');
    }
  }

  private comenzarPolling(id: number) {
    this.pollingServicio = setInterval(async () => {
      try {
        const resp = await fetch(`${this.apiBase}/servicio/${id}`);
        if (resp.ok) {
          const s = await resp.json();
          this.conductorInfo = s;
          this.procesarEstado(s);
        }
      } catch (e) {
        console.warn('Error en polling de domicilio');
      }
    }, 3000);
  }

  private procesarEstado(s: any) {
    const W = (window as any).L;
    
    // ETAPA 1: ACEPTADO / EN CAMINO AL ORIGEN
    if (s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') {
      
      if (!this.transicionFinalizada) {
        this.transicionFinalizada = true;
        this.buscandoConductor = false;
        
        // Ajustar vista para ver conductor y origen
        if (s.conductor_lat && this.userLat) {
          const bounds = L.latLngBounds([
            [s.conductor_lat, s.conductor_lng],
            [this.userLat, this.userLng]
          ]);
          this.map.fitBounds(bounds, { padding: [50, 50] });
        }
      }
      
      this.actualizarMensajeConETA(s, this.userLat, this.userLng, '🛵 Domiciliario en camino');
      this.actualizarPosicionConductor(s);
      
      // Actualizar ruta: Conductor -> Recogida (Usuario)
      if (this.routingControl && s.conductor_lat) {
        this.routingControl.setWaypoints([
          W.latLng(s.conductor_lat, s.conductor_lng),
          W.latLng(this.userLat, this.userLng)
        ]);
      }
    }

    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 El domiciliario ha llegado al punto de recogida.';
      this.actualizarPosicionConductor(s);
    }

    // ETAPA 2: PAQUETE RECOGIDO / EN VIAJE AL DESTINO
    if (s.estado === 'PAQUETE_RECOGIDO' || s.estado === 'EN_VIAJE') {
      const dest = this.destinoMarker?.getLatLng();
      this.actualizarMensajeConETA(s, dest?.lat, dest?.lng, '🛣️ Pedido en camino');
      this.actualizarPosicionConductor(s);

      // Actualizar ruta: Conductor -> Destino
      if (this.routingControl && dest && s.conductor_lat) {
        this.routingControl.setWaypoints([
          W.latLng(s.conductor_lat, s.conductor_lng),
          W.latLng(dest.lat, dest.lng)
        ]);
        // Cambiar color a verde para indicar que ya lleva el paquete
        this.routingControl.options.lineOptions.styles = [{ color: '#22c55e', weight: 6 }];
      }
    }

    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      alert('🎉 ¡Tu entrega ha sido finalizada con éxito!');
      this.router.navigate(['/home-usuario']);
    }
  }

  private actualizarMensajeConETA(s: any, targetLat?: number, targetLng?: number, prefijo: string = ''): void {
    const lat = s.conductor_lat ?? s.latitud;
    const lng = s.conductor_lng ?? s.longitud;

    if (lat && lng && targetLat && targetLng) {
      const metros = this.map.distance([lat, lng], [targetLat, targetLng]);
      // Estimación simple: 25km/h promedio en ciudad (~416 metros por minuto)
      const minutos = Math.round(metros / 416);
      
      if (minutos > 1) {
        this.mensajeEstado = `${prefijo}. Llega en ${minutos} min.`;
      } else if (metros < 100) {
        this.mensajeEstado = `📍 ¡El domiciliario está afuera!`;
      } else {
        this.mensajeEstado = `${prefijo}. ¡Está muy cerca!`;
      }
    } else {
      this.mensajeEstado = prefijo;
    }
  }

  private actualizarPosicionConductor(s: any): void {
    const lat = s.conductor_lat ?? s.latitud;
    const lng = s.conductor_lng ?? s.longitud;
    
    if (lat == null || lng == null) return;

    const motoIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
      iconSize: [45, 45],
      iconAnchor: [22, 45]
    });

    if (this.conductorMarker) {
      this.aplicarRotacionMarcador(lat, lng);
      this.actualizarEstela(lat, lng);
      this.conductorMarker.setLatLng([lat, lng]);
    } else {
      this.conductorMarker = L.marker([lat, lng], { icon: motoIcon })
        .addTo(this.map)
        .bindPopup(`<b>Domiciliario: ${s.conductor_nombre}</b>`)
        .openPopup();
    }

    // Seguir al conductor con la cámara suavemente si el usuario no está moviendo el mapa
    // this.map.panTo([lat, lng]);
  }

  private aplicarRotacionMarcador(nuevaLat: number, nuevaLng: number) {
    if (!this.conductorMarker || this.ultimaLat === null || this.ultimaLng === null) {
      this.ultimaLat = nuevaLat;
      this.ultimaLng = nuevaLng;
      return;
    }

    // Calcular ángulo en grados (0 es Norte/Arriba)
    const angulo = Math.atan2(nuevaLng - this.ultimaLng, nuevaLat - this.ultimaLat) * (180 / Math.PI);

    const el = this.conductorMarker.getElement();
    if (el) {
      el.style.transition = 'transform 0.5s ease'; // Rotación fluida
      el.style.transformOrigin = 'center center';
      // Leaflet usa 'transform' para posicionar el marcador. Preservamos la posición (translate) y agregamos la rotación.
      const transformBase = el.style.transform.split(' rotate')[0];
      el.style.transform = `${transformBase} rotate(${angulo}deg)`;
    }

    this.ultimaLat = nuevaLat;
    this.ultimaLng = nuevaLng;
  }

  // ✅ MÉTODO PARA EL RASTRO (ESTELA)
  private actualizarEstela(lat: number, lng: number) {
    if (!this.map) return;
    
    const nuevoPunto = L.latLng(lat, lng);
    this.puntosEstela.push(nuevoPunto);

    if (this.estelaMoto) {
      this.estelaMoto.setLatLngs(this.puntosEstela);
    } else {
      this.estelaMoto = L.polyline(this.puntosEstela, {
        color: '#16a34a', // Verde MoviFY
        weight: 4,
        opacity: 0.5,
        dashArray: '10, 10',
        lineCap: 'round'
      }).addTo(this.map);
    }
  }

  private limpiarEstela() {
    if (this.estelaMoto && this.map) this.map.removeLayer(this.estelaMoto);
    this.estelaMoto = undefined;
    this.puntosEstela = [];
  }

  esPasoActivo(paso: string): boolean {
    if (!this.conductorInfo) return paso === 'PENDIENTE';
    const actual = this.getProgresoPorcentaje(this.conductorInfo.estado);
    const evaluado = this.getProgresoPorcentaje(paso);
    return actual >= evaluado;
  }

  getProgresoPorcentaje(estado: string): number {
    const p: any = { 'PENDIENTE': 10, 'ACEPTADO': 30, 'PAQUETE_RECOGIDO': 70, 'FINALIZADO': 100 };
    return p[estado] || 0;
  }

  volver() { this.router.navigate(['/home-usuario']); }
}