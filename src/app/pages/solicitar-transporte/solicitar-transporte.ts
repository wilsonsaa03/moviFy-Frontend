import {
  Component,
  OnInit,
  AfterViewInit
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

export class SolicitarTransporte
  implements OnInit, AfterViewInit {

  /* =========================
     VARIABLES
  ========================= */

  origen: string = 'Buscando tu ubicación...';

  destino: string = '';

  tarifaEstimada: number = 0;

  distanciaViaje: number = 0;

  duracionViaje: number = 0;

  buscandoConductor: boolean = false;

  mensajeEstado: string = 'Iniciando búsqueda...';

  conductorInfo: any = null;

  totalConductoresActivos: number = 0;

  private map!: L.Map;

  private usuarioMarker?: L.Marker;

  private destinoMarker?: L.Marker;

  private conductorMarker?: L.Marker;

  userLat: number = 0;

  private userLng: number = 0;

  private transicionFinalizada: boolean = false;

  private ubicacionEncontrada: boolean = false;

  private routingControl: any;

  private conductoresMarkers: Map<number, L.Marker> = new Map();

  private pollingServicio: any;

  private apiBase = `${environment.apiUrl}/transporte`;

  constructor(private router: Router) {}

  /* =========================
     INIT
  ========================= */

  ngOnInit(): void {}

  ngAfterViewInit(): void {

    // Cargar LRM dinámicamente y esperar
    this.cargarScriptLRM().then(() => {

      this.initMap();

      this.obtenerUbicacionReal();
    });
  }

  /* =========================
     CARGAR SCRIPT LRM
  ========================= */

  private cargarScriptLRM(): Promise<void> {

    return new Promise((resolve) => {

      // Si ya está cargado, resolver inmediatamente
      if (
        window.L &&
        window.L.Routing
      ) {
        resolve();
        return;
      }

      // CSS de LRM
      const link =
        document.createElement('link');

      link.rel = 'stylesheet';

      link.href =
        'https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css';

      document.head.appendChild(link);

      // JS de LRM
      const script =
        document.createElement('script');

      script.src =
        'https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.js';

      script.onload = () => {
        resolve();
      };

      script.onerror = () => {
        console.error(
          'Error cargando Leaflet Routing Machine'
        );
        resolve(); // Resolver igual para no bloquear
      };

      document.head.appendChild(script);
    });
  }

  /* =========================
     MAPA
  ========================= */

  private initMap(): void {

    const vistaEspera: [number, number] = [
      4.5709,
      -74.2973
    ];

    this.map = L.map('map', {
      center: vistaEspera,
      zoom: 5,
      zoomControl: false
    });

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '© OpenStreetMap'
      }
    ).addTo(this.map);

    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    /* =========================
       LEAFLET ROUTING MACHINE
    ========================= */

    try {

      this.routingControl =
        window.L.Routing.control({

          waypoints: [],

          router: window.L.Routing.osrmv1({
            language: 'es',
            profile: 'driving'
          }),

          lineOptions: {
            styles: [
              {
                color: '#7c4dff',
                weight: 6,
                opacity: 0.9
              }
            ]
          },

          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          routeWhileDragging: false,
          show: false,
          createMarker: () => null

        }).addTo(this.map);

      /* =========================
         CUANDO SE ENCUENTRE RUTA
      ========================= */

      this.routingControl.on(
        'routesfound',
        (e: any) => {

          const summary =
            e.routes[0].summary;

          this.distanciaViaje =
            summary.totalDistance / 1000;

          this.duracionViaje =
            summary.totalTime / 60;

          this.calcularTarifaReal();
        }
      );

      /* =========================
         ERROR DE RUTA
      ========================= */

      this.routingControl.on(
        'routingerror',
        () => {

          this.distanciaViaje = 0;
          this.tarifaEstimada = 0;

          alert(
            'No se pudo calcular la ruta. Intenta con otro punto.'
          );
        }
      );

    } catch (err) {

      console.error(
        'Error iniciando Routing Machine:',
        err
      );
    }

    /* =========================
       CLICK EN MAPA
    ========================= */

    this.map.on(
      'click',
      (e: L.LeafletMouseEvent) => {

        this.establecerDestinoEnMapa(
          e.latlng.lat,
          e.latlng.lng
        );
      }
    );
  }

  /* =========================
     GPS DEL DISPOSITIVO
  ========================= */

  private obtenerUbicacionReal(): void {

    if (!navigator.geolocation) {

      this.origen =
        'Tu dispositivo no tiene GPS';

      alert(
        'Tu navegador no soporta geolocalización.'
      );

      return;
    }

    // Timeout visual para el usuario
    const timeoutAviso = setTimeout(() => {

      if (!this.ubicacionEncontrada) {

        this.origen =
          'GPS tardando... activa permisos';
      }

    }, 5000);

    navigator.geolocation.getCurrentPosition(

      // ÉXITO
      (position) => {

        clearTimeout(timeoutAviso);

        this.userLat =
          position.coords.latitude;

        this.userLng =
          position.coords.longitude;

        this.ubicacionEncontrada = true;

        const miUbicacion: [number, number] = [
          this.userLat,
          this.userLng
        ];

        this.map.setView(miUbicacion, 16);

        this.origen = 'Mi ubicación actual';

        /* =========================
           ICONO USUARIO
        ========================= */

        const usuarioIcon = L.icon({
          iconUrl:
            'https://cdn-icons-png.flaticon.com/512/684/684908.png',
          iconSize: [42, 42],
          iconAnchor: [21, 42],
          popupAnchor: [0, -35]
        });

        this.usuarioMarker = L.marker(
          miUbicacion,
          { icon: usuarioIcon }
        )
          .addTo(this.map)
          .bindPopup('📍 Tú estás aquí')
          .openPopup();

        // Añadir círculo estético en tu ubicación
        L.circleMarker(miUbicacion, { color: '#7c4dff', radius: 10, fillOpacity: 0.5 }).addTo(this.map);

        this.obtenerConductoresReales();

        // Refrescar conductores cercanos cada 8 segundos para ver movimiento real
        setInterval(() => {
          if (!this.buscandoConductor) this.obtenerConductoresReales();
        }, 8000);
      },

      // ERROR
      (error) => {

        clearTimeout(timeoutAviso);

        console.error('Error GPS:', error);

        // Mensajes según el tipo de error
        switch (error.code) {

          case error.PERMISSION_DENIED:
            this.origen =
              'Permiso GPS denegado';
            alert(
              '❌ Bloqueaste el GPS.\n\nPara activarlo:\n• Chrome: clic en el candado 🔒 en la barra de direcciones → Ubicación → Permitir\n• Luego recarga la página.'
            );
            break;

          case error.POSITION_UNAVAILABLE:
            this.origen =
              'Señal GPS no disponible';
            alert(
              '📡 No se pudo obtener señal GPS. Verifica que el GPS de tu dispositivo esté activado.'
            );
            break;

          case error.TIMEOUT:
            this.origen =
              'GPS tardó demasiado';
            alert(
              '⏱️ El GPS tardó demasiado. Recarga la página e intenta de nuevo.'
            );
            break;
        }
      },

      // OPCIONES — maximumAge:0 fuerza lectura fresca
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  }

  /* =========================
     DESTINO EN MAPA
  ========================= */

  establecerDestinoEnMapa(
    lat: number,
    lon: number
  ): void {

    if (!this.ubicacionEncontrada) {

      alert(
        'Espera a que el GPS encuentre tu ubicación.'
      );

      return;
    }

    const destinoIcon = L.icon({
      iconUrl:
        'https://cdn-icons-png.flaticon.com/512/2776/2776067.png',
      iconSize: [42, 42],
      iconAnchor: [21, 42],
      popupAnchor: [0, -35]
    });

    if (this.destinoMarker) {

      this.destinoMarker.setLatLng([lat, lon]);

    } else {

      this.destinoMarker = L.marker(
        [lat, lon],
        { icon: destinoIcon }
      )
        .addTo(this.map)
        .bindPopup('🏁 Punto destino')
        .openPopup();
    }

    /* =========================
       RUTA REAL POR CALLES
    ========================= */

    if (this.routingControl) {

      this.routingControl.setWaypoints([
        window.L.latLng(
          this.userLat,
          this.userLng
        ),
        window.L.latLng(lat, lon)
      ]);
    }

    this.destino = 'Destino seleccionado';

    this.map.setView([lat, lon], 14);
  }

  /* =========================
     CALCULAR TARIFA
  ========================= */

  private calcularTarifaReal(): void {

    if (!this.distanciaViaje) return;
    
    // PARÁMETROS DE COSTO BASE
    const cargoBasico = 2500;
    const precioPorKm = 1200;
    const precioPorMinuto = 150;

    let calculo = cargoBasico + 
                  (this.distanciaViaje * precioPorKm) + 
                  (this.duracionViaje * precioPorMinuto);

    // LÓGICA DE TARIFA DINÁMICA (Hora del día)
    const ahora = new Date();
    const hora = ahora.getHours();
    let factorDinamico = 1.0;

    // Horas Pico (7:00-9:00 y 17:00-19:00) -> +40%
    if ((hora >= 7 && hora <= 9) || (hora >= 17 && hora <= 19)) {
      factorDinamico = 1.4;
    } 
    // Horario Nocturno (22:00-05:00) -> +20%
    else if (hora >= 22 || hora <= 5) {
      factorDinamico = 1.2;
    }

    calculo *= factorDinamico;

    // Redondeo a la centena superior
    calculo = Math.ceil(calculo / 100) * 100;

    // Tarifa mínima de 4.500
    this.tarifaEstimada = calculo < 4500 ? 4500 : calculo;
  }

  /* =========================
     BÚSQUEDA MANUAL
  ========================= */

  async buscarDireccionManual(): Promise<void> {

    if (!this.ubicacionEncontrada) {

      alert(
        'Espera a que el GPS te ubique antes de buscar.'
      );

      return;
    }

    if (
      !this.destino ||
      this.destino.length < 3 ||
      this.destino === 'Destino seleccionado'
    ) return;

    try {

      const query =
        `${this.destino}, Colombia`;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );

      const data = await response.json();

      if (data && data.length > 0) {

        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        this.establecerDestinoEnMapa(lat, lon);

      } else {

        alert('No se encontró la dirección.');
      }

    } catch (error) {

      console.error('Error en búsqueda:', error);

      alert(
        'Ocurrió un error buscando la dirección.'
      );
    }
  }

  /* =========================
     API: CONDUCTORES REALES
  ========================= */

  private async obtenerConductoresReales(): Promise<void> {
    try {
      const resp = await fetch(`${this.apiBase}/conductores-activos`);
      const conductores = await resp.json();
      this.totalConductoresActivos = conductores.length;
      this.dibujarConductoresEnMapa(conductores);
    } catch (e) {
      console.error("Error cargando conductores:", e);
    }
  }

  private dibujarConductoresEnMapa(conductores: any[]): void {
    const motoIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
      iconSize: [35, 35],
      iconAnchor: [17, 35],
      popupAnchor: [0, -30]
    });

    conductores.forEach(c => {
      const id = c.conductor_id || c.id;
      if (this.conductoresMarkers.has(id)) {
          // Si ya existe, solo actualizamos su posición suavemente
          this.conductoresMarkers.get(id)!.setLatLng([c.latitud, c.longitud]);
      } else {
          // Si es nuevo, lo creamos
          const m = L.marker([c.latitud, c.longitud], { icon: motoIcon })
            .addTo(this.map)
            .bindPopup(`<b>🏍️ ${c.nombre}</b><br>Disponible`);
          this.conductoresMarkers.set(id, m);
      }
    });
  }

  /* =========================
     VOLVER
  ========================= */

  volver(): void {

    this.router.navigate(['/home-usuario']);
  }

  /* =========================
     SOLICITAR VIAJE
  ========================= */

  async solicitarViaje(): Promise<void> {
    if (
      !this.origen ||
      !this.destino ||
      !this.ubicacionEncontrada ||
      this.distanciaViaje === 0
    ) return;

    this.buscandoConductor = true;
    this.transicionFinalizada = false; // Resetear el flag para permitir que el radar se cierre
    this.mensajeEstado = 'Estamos buscando conductores cerca de ti...';
    const idUsuario = localStorage.getItem('id') || '1'; // Intenta obtener el ID real
    
    const body = {
      usuario_id: parseInt(idUsuario), 
      origen_lat: this.userLat,
      origen_lng: this.userLng,
      destino_lat: this.destinoMarker?.getLatLng().lat,
      destino_lng: this.destinoMarker?.getLatLng().lng,
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
      
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(errorText);
      }

      const data = await resp.json();
      this.comenzarPollingServicio(data.id);
    } catch (e) {
      console.error("Error al solicitar viaje:", e);
      this.buscandoConductor = false;
      alert("Error: " + (e instanceof Error ? e.message : "No se pudo contactar con el servidor"));
    }
  }

  private comenzarPollingServicio(id: number): void {
    // ✅ Esperar 3 segundos antes del primer poll para que el backend procese
    setTimeout(() => {
      this.pollingServicio = setInterval(async () => {
        try {
          const resp = await fetch(`${this.apiBase}/servicio/${id}`);
          if (!resp.ok) {
            console.warn(`Polling pausado: servidor respondió ${resp.status}`);
            return; // ✅ No lanzar error, simplemente esperar el siguiente ciclo
          }
          const servicio = await resp.json();
          this.conductorInfo = servicio;
          console.log("🔄 Estado recibido:", servicio.estado);
          this.procesarEstadoServicio(servicio);
        } catch(e) {
          console.warn('Error de red en polling, reintentando...');
          // ✅ No hace nada, el setInterval reintenta solo
        }
      }, 3000); // ✅ Subir de 2000 a 3000ms para reducir colisiones con el backend
    }, 3000);
  }

  private procesarEstadoServicio(s: any): void {
    console.log("⚙️ Procesando estado del servicio:", s.estado); // Log para depuración
    const W = (window as any).L;

    // ACEPTADO → dibujar ruta conductor hacia el usuario
    if (s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') {
      const condLat = s.conductor_lat ?? s.latitud;
      const condLng = s.conductor_lng ?? s.longitud;

      // Cerrar el radar SIEMPRE que llegue estado ACEPTADO
      if (this.buscandoConductor && !this.transicionFinalizada) {
        this.transicionFinalizada = true;
        this.mensajeEstado = '¡Conductor encontrado! En camino hacia ti.';
        this.buscandoConductor = false; // ✅ Sin setTimeout, cierre inmediato

        if (condLat && condLng) {
          const points: any[] = [
            [condLat, condLng],
            [this.userLat, this.userLng]
          ];

          if (this.destinoMarker) {
            points.push(this.destinoMarker.getLatLng());
          }

          const bounds = L.latLngBounds(points);
          this.map.fitBounds(bounds, { padding: [50, 50] });
        }
      }

      // Solo dibujar ruta si las coordenadas son válidas
      if (condLat && condLng) {
        // Actualizar marcador del conductor
        this.actualizarPosicionConductor(s);
        
        // Mejora UX: Auto-ajustar el mapa para ver a ambos
        const bounds = L.latLngBounds([
          [this.userLat, this.userLng],
          [condLat, condLng]
        ]);
        
        // Solo ajustar si la transición inicial terminó y no estamos en zoom manual
        if (this.transicionFinalizada) {
          this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
        }

        if (this.routingControl && W?.Routing) {
          try { // ✅ try/catch para que un fallo aquí no rompa el polling
            this.routingControl.setWaypoints([
              W.latLng(condLat, condLng),
              W.latLng(this.userLat, this.userLng)
            ]);
            if (this.routingControl.options?.lineOptions) {
              this.routingControl.options.lineOptions.styles =
                [{ color: '#f59e0b', weight: 6, opacity: 0.9 }];
            }
          } catch(e) {
            console.warn('Error dibujando ruta conductor→usuario:', e);
          }
        }
      }
    }

    // ETAPA 2: El conductor llegó al punto
    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 ¡Tu conductor ha llegado!';
    }

    if (s.estado === 'PAQUETE_RECOGIDO') {
      this.mensajeEstado = '📦 Paquete recogido. En ruta al destino.';
    }

    // ETAPA 3: Viaje en curso al destino
    if (s.estado === 'EN_VIAJE') {
      this.mensajeEstado = '🛣️ Viajando al destino...';
      this.buscandoConductor = false;
      this.transicionFinalizada = true;
      const condLat = s.conductor_lat ?? s.latitud;
      const condLng = s.conductor_lng ?? s.longitud;
      const dest = this.destinoMarker?.getLatLng();

      if (this.routingControl && dest && W?.Routing) {
        this.routingControl.setWaypoints([
          W.latLng(condLat ?? this.userLat, condLng ?? this.userLng),
          W.latLng(dest.lat, dest.lng)
        ]);
        // Ruta verde hacia destino
        if (this.routingControl.options?.lineOptions) {
          this.routingControl.options.lineOptions.styles =
            [{ color: '#16a34a', weight: 6, opacity: 0.9 }];
        }
      }
      this.actualizarPosicionConductor(s);
    }

    // VIAJE CANCELADO (Detectado mediante polling cuando el conductor cancela)
    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      alert('🔴 Lo sentimos, el conductor ha cancelado el viaje. Por favor, intenta solicitar uno nuevo.');
      this.router.navigate(['/home-usuario']);
    }

    // FINALIZADO
    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      const idServicio = s.id;
      this.conductorInfo = null; // ✅ Resetear info del conductor
      this.buscandoConductor = false;
      this.transicionFinalizada = true;
      
      // Lógica de calificación simple (se puede mejorar con un modal de estrellas)
      const estrellas = prompt("🎉 ¡Has llegado! Califique el servicio (1-5 estrellas):", "5");
      if (estrellas) {
        this.enviarCalificacion(idServicio, estrellas);
      }
      
      this.router.navigate(['/home-usuario']);
    }
  }

  private async enviarCalificacion(servicioId: number, puntos: string) {
    const usuarioId = localStorage.getItem('id') || '1';
    const body = {
      servicio_id: servicioId,
      usuario_id: parseInt(usuarioId),
      puntos: parseInt(puntos) || 5,
      comentario: 'Calificado desde la App'
    };

    await fetch(`${this.apiBase}/calificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  private actualizarPosicionConductor(s: any): void {
    // ✅ Validar que existan coordenadas antes de continuar
    const lat = s.conductor_lat ?? s.latitud;
    const lng = s.conductor_lng ?? s.longitud;
    
    if (lat == null || lng == null) {
      console.warn('⚠️ Sin coordenadas del conductor aún, esperando...');
      return;
    }

    const motoIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
      iconSize: [45, 45],
      iconAnchor: [22, 45]
    });

    if (this.conductorMarker) {
      this.conductorMarker.setLatLng([lat, lng]);
    } else {
      this.conductorMarker = L.marker([lat, lng], { icon: motoIcon })
        .addTo(this.map)
        .bindPopup(`<b>Tu conductor: ${s.conductor_nombre}</b>`)
        .openPopup();
    }

    // Mejora UX: Mostrar ETA en el mensaje de estado si hay ruta calculada
    if (this.duracionViaje > 0 && (s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO')) {
      const minutos = Math.round(this.duracionViaje);
      this.mensajeEstado = minutos > 1 
        ? `¡Conductor encontrado! En camino hacia ti. Llega en unos ${minutos} min.` 
        : '¡Tu conductor está a la vuelta de la esquina!';
    }

    // ✅ Usar lat/lng validados en lugar de s.latitud directamente
    const distAlUsuario = this.map.distance([lat, lng], [this.userLat, this.userLng]);
    if (distAlUsuario < 50) {
      const dest = this.destinoMarker?.getLatLng();
      if (dest && this.routingControl) {
        this.routingControl.setWaypoints([
          L.latLng(this.userLat, this.userLng),
          L.latLng(dest.lat, dest.lng)
        ]);
      }
    }
  }

  /* =========================
     MENSAJE RÁPIDO A CONDUCTOR
  ========================= */
  enviarMensajeConductor(): void {
    if (this.conductorInfo && this.conductorInfo.conductor_telefono) {
      const telefonoConductor = this.conductorInfo.conductor_telefono;
      const mensaje = encodeURIComponent(`Hola ${this.conductorInfo.conductor_nombre}, soy ${this.conductorInfo.usuario_nombre ?? 'tu pasajero'}. Estoy esperando en ${this.origen}.`);
      window.open(`https://wa.me/${telefonoConductor}?text=${mensaje}`, '_blank');
    } else {
      alert('No se encontró el número de teléfono del conductor.');
    }
  }


  /* =========================
     CANCELAR VIAJE
  ========================= */

  async cancelarViaje(): Promise<void> {

    if (!this.conductorInfo || !this.conductorInfo.id) return;

    const confirmar = confirm('¿Estás seguro de que deseas cancelar el viaje?');

    if (!confirmar) return;

    try {

      const resp = await fetch(`${this.apiBase}/servicio/${this.conductorInfo.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'CANCELADO'
        })
      });

      if (resp.ok) {

        clearInterval(this.pollingServicio);
        this.buscandoConductor = false;
        this.conductorInfo = null;
        this.transicionFinalizada = false;

        alert('Viaje cancelado correctamente.');
        this.router.navigate(['/home-usuario']);
      }

    } catch (e) {
      console.error("Error al cancelar viaje:", e);
      alert('No se pudo cancelar el viaje en este momento.');
    }
  }

  /* =========================
     HELPERS DE INTERFAZ
  ========================= */

  getProgresoPorcentaje(estado: string): number {
    const pasos: { [key: string]: number } = {
      'PENDIENTE': 10,
      'ACEPTADO': 30,
      'EN_CAMINO_AL_USUARIO': 50,
      'LLEGO_AL_ORIGEN': 70,
      'EN_VIAJE': 90,
      'FINALIZADO': 100
    };
    return pasos[estado] || 0;
  }

  esPasoActivo(paso: string): boolean {
    if (!this.conductorInfo) return false;
    const porcentaje = this.getProgresoPorcentaje(this.conductorInfo.estado);
    
    switch (paso) {
      case 'solicitado': return porcentaje >= 10;
      case 'encamino':   return porcentaje >= 30;
      case 'enviaje':    return porcentaje >= 90;
      case 'finalizado': return porcentaje === 100;
      default: return false;
    }
  }

  getEstadoColorClass(estado: string): string {
    switch (estado) {
      case 'PENDIENTE': return 'text-warning';
      case 'ACEPTADO':
      case 'EN_CAMINO_AL_USUARIO':
      case 'LLEGO_AL_ORIGEN': return 'text-info';
      case 'EN_CAMINO':
      case 'EN_VIAJE': return 'text-accent';
      case 'FINALIZADO': return 'text-success';
      case 'CANCELADO':
      case 'RECHAZADO': return 'text-danger';
      default: return 'text-muted';
    }
  }

  getFriendlyEstado(estado: string): string {
    if (!estado) return 'Procesando...';
    return estado.charAt(0) + estado.slice(1).toLowerCase().replace(/_/g, ' ');
  }
}