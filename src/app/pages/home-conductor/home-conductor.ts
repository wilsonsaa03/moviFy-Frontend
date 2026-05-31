import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConductorService } from '../../Base_de_datos/conductor.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-home-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home-conductor.html',
  styleUrls: ['./home-conductor.css']
})
export class HomeConductorComponent implements OnInit, OnDestroy {

  // =========================
  // DATOS DEL CONDUCTOR
  // =========================
  nombre: string = 'Conductor';
  foto: string = '';
  conductorId: any = null;
  placa: string = 'Cargando...'; // Valor inicial para el usuario
  modelo: string = 'Cargando...';
  telefono: string = '';
  correo: string = '';
  estadoCuenta: string = 'pendiente';
  calificacion: number = 4.8;
  enLinea: boolean = false;
  notificaciones: number = 0;

  // ==========================================
  // MAPA, RASTREO Y ALERTAS
  // ==========================================
  mostrarMapa: boolean = false;
  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';
  mapa: any;
  
  watchId: any;           
  markerUsuario: L.Marker | undefined; 
  // ✅ Seguimiento para rotación
  private ultimaLat: number | null = null;
  private ultimaLng: number | null = null;
  // ✅ Variables para la estela
  private estelaMoto: L.Polyline | undefined;
  private puntosEstela: L.LatLng[] = [];
  
  iconoMoto = L.icon({
    iconUrl: 'assets/moto-icon.png',
    iconSize: [60, 60],
    iconAnchor: [30, 60],
    popupAnchor: [0, -60]
  });

  // =========================
  // MENUS INTERACTIVOS
  // =========================
  menuAbierto: boolean = false;
  menuNavAbierto: boolean = false;
  sidebarColapsado: boolean = false;

  // =========================
  pollingNotificaciones: any;
  // ESTADISTICAS
  // =========================
  gananciasHoy: number = 0;
  gananciasSemana: number = 0;
  viajesHoy: number = 0;
  viajesTotal: number = 0;
  cancelaciones: number = 0; // ✅ Nueva métrica

  solicitudes: any[] = [];
  historial: any[] = [];

  // =========================
  // VARIABLES NUEVAS — agregar junto a las demás
  // =========================
  viajeActivo: any = null;
  viajeId: number | null = null;
  routingControl: any = null; // Routing control para el conductor
  pollingViajeActivo: any = null;

  constructor(
    private router: Router,
    private conductorService: ConductorService
  ) {}

  ngOnInit(): void {
    const correoSession = localStorage.getItem('correo');
    
    // Redirigir al login si no hay sesión
    if (!correoSession) {
      this.router.navigate(['/login']);
      return;
    }

    // CARGAR PERFIL DESDE EL SERVICIO
    this.conductorService.obtenerPerfil(correoSession).subscribe({
      next: (data: any) => {
        console.log("Datos recibidos:", data); // Para depuración
        
        // Mapeo de datos con operadores OR para asegurar que nada quede vacío
        this.nombre   = data.nombre || 'Nombre no disponible';
        this.foto     = data.foto || '';
        this.correo   = data.correo || correoSession;
        this.conductorId = data.conductor_id || data.id;
        console.log("✅ Conductor cargado con ID:", this.conductorId);
        this.telefono = data.telefono || 'N/A';
        
        // CORRECCIÓN: Nombres de campos comunes en DB
        this.placa    = data.placa || data.placa_vehiculo || 'No registrada';
        this.modelo   = data.modelo || data.modelo_vehiculo || 'No registrado';
        
        this.estadoCuenta = data.estado || 'pendiente';
        this.gananciasHoy = Number(data.gananciasHoy) || 0;
        this.gananciasSemana = Number(data.gananciasSemana) || 0;
        this.viajesHoy = Number(data.viajesHoy) || 0;
        this.viajesTotal = Number(data.viajesTotal) || 0;
        this.cancelaciones = Number(data.cancelaciones) || 0; // ✅ Carga desde el perfil
        this.historial = data.historial || [];
      },
      error: (err: any) => { 
        console.error("Error al cargar perfil:", err);
        this.placa = "Error de conexión";
        this.modelo = "Intente más tarde";
      }
    });
  }

  ngOnDestroy(): void {
    this.pararRastreo();
    // Limpiar el mapa de la memoria si existe
    if (this.mapa) {
      if (this.pollingViajeActivo) clearInterval(this.pollingViajeActivo); // Limpiar polling de viaje
      this.mapa.remove();
    }
  }

  // =========================
  // LOGICA DE INTERFAZ
  // =========================
  toggleSidebar(): void {
    if (window.innerWidth <= 992) {
      this.menuNavAbierto = !this.menuNavAbierto;
    } else {
      this.sidebarColapsado = !this.sidebarColapsado;
    }
  }

  toggleMapa(): void {
    this.mostrarMapa = !this.mostrarMapa;
    if (this.mostrarMapa) {
      // Pequeño delay para asegurar que el div #map exista en el DOM
      setTimeout(() => this.iniciarMapaBase(), 150);
    } else {
      this.pararRastreo();
    }
  }

  iniciarMapaBase(): void {
    // Si ya hay una instancia, invalidar tamaño para corregir tiles grises
    if (this.mapa) {
      this.mapa.invalidateSize();
      return;
    }

    try {
      this.mapa = L.map('map').setView([3.8821, -77.0253], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.mapa);
      
      if (this.enLinea) this.iniciarRastreoRealTime();
    } catch (e) {
      console.error("Error inicializando Leaflet:", e);
    }
  }

  toggleMapaActivo(): void {
    this.enLinea = !this.enLinea;
    this.mostrarAlerta = true;
    
    if (this.enLinea) {
      this.mensajeAlerta = '🟢 Ahora estás disponible para recibir servicios';
      this.iniciarPollingNotificaciones();
      this.iniciarRastreoRealTime();

      // Notificar al backend que el conductor está en línea
      if (this.conductorId) {
        fetch('http://localhost:8080/api/transporte/activar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conductor_id: this.conductorId })
        }).catch(err => console.error("Error al activar disponibilidad:", err));
      }

    } else {
      this.mensajeAlerta = '🔴 Has dejado de estar disponible. Rastreo apagado';
      this.pararPollingNotificaciones();
      this.pararRastreo();
    }

    setTimeout(() => this.mostrarAlerta = false, 3000);
  }

  iniciarPollingNotificaciones() {
    this.pollingNotificaciones = setInterval(() => {
      // Registro temporal para confirmar que el ID y el estado son correctos durante el polling
      console.log("🔄 Polling activo | conductorId:", this.conductorId, "| enLinea:", this.enLinea);

      if (!this.conductorId || !this.enLinea) return;

      fetch(`http://localhost:8080/api/transporte/solicitudes-pendientes/${this.conductorId}`)
        .then(res => {
          if (res.status === 403) {
            this.mensajeAlerta = '⚠️ Cuenta suspendida: Tasa de cancelación superior al 20%';
            this.mostrarAlerta = true;
            this.enLinea = false; // Lo forzamos a estar fuera de línea visualmente
            this.pararPollingNotificaciones();
            throw new Error('Sancionado por cancelaciones');
          }
          if (!res.ok) throw new Error(`Error servidor: ${res.status}`);
          return res.json();
        })
        .then(solicitudes => {
          if (solicitudes) {
            if (solicitudes.length > 0) {
              console.log("📩 Notificaciones actualizadas:", solicitudes);
            }
            this.solicitudes = solicitudes;
            this.notificaciones = this.solicitudes.length;
          }
        })
        .catch(err => {
          console.warn("⚠️ Servidor no disponible temporalmente...");
          this.notificaciones = 0;
        });
    }, 2000); // Consulta cada 2 segundos para reaccionar a la simulación de 10s
  }

  responderASolicitud(servicioId: number, nuevoEstado: string) {
    // ✅ DETENER el polling INMEDIATAMENTE para evitar doble envío
    this.pararPollingNotificaciones();

    // Buscamos los datos locales de la solicitud para mostrar el panel de inmediato
    const solicitudLocal = this.solicitudes.find(s => s.servicio_id === servicioId);

    fetch(`http://localhost:8080/api/transporte/servicio/${servicioId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado, conductor_id: this.conductorId })
    })
    .then(res => {
      if (!res.ok) throw new Error('Error al actualizar estado');
      return res.json();
    })
    .then(() => {
      if (nuevoEstado === 'ACEPTADO') {
        this.viajeId = servicioId;
        // Inicializamos viajeActivo con datos locales para que el panel aparezca YA
        this.viajeActivo = { ...solicitudLocal, estado: 'ACEPTADO' };
        this.solicitudes = [];
        this.notificaciones = 0;

        // Asegurar que el mapa esté visible
        if (!this.mostrarMapa) {
          this.mostrarMapa = true;
          setTimeout(() => {
            this.iniciarMapaBase();
            this.iniciarRutaViaje(servicioId);
          }, 300);
        } else {
          this.iniciarRutaViaje(servicioId);
        }
      } else {
        this.solicitudes = this.solicitudes.filter(s => s.servicio_id !== servicioId);
        this.notificaciones = this.solicitudes.length;
      }
    })
    .catch(err => console.error('Error respondiendo solicitud:', err));
  }

  iniciarRutaViaje(servicioId: number) {
    this.cargarLRM().then(() => {
      fetch(`http://localhost:8080/api/transporte/servicio/${servicioId}`)
        .then(res => {
          if (!res.ok) throw new Error('Error al consultar servicio');
          return res.json();
        })
        .then(servicio => {
          this.viajeActivo = servicio;
          this.dibujarRutaConductorAUsuario(servicio);
          this.iniciarPollingViaje(servicioId);
        })
        .catch(err => console.warn('No se pudo cargar la ruta del viaje:', err));
    });
  }

  cargarLRM(): Promise<void> {
    return new Promise(resolve => {
      if ((window as any).L?.Routing) { resolve(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet-routing-machine@latest/dist/leaflet-routing-machine.js';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  dibujarRutaConductorAUsuario(servicio: any) {
    if (!this.mapa) return;
    const W = (window as any).L;
    if (!W?.Routing) return;

    navigator.geolocation.getCurrentPosition(pos => {
      const condLat = pos.coords.latitude;
      const condLng = pos.coords.longitude;

      if (this.routingControl) {
        this.mapa.removeControl(this.routingControl);
      }

      this.routingControl = W.Routing.control({
        waypoints: [
          W.latLng(condLat, condLng),
          W.latLng(servicio.origen_lat, servicio.origen_lng)
        ],
        router: W.Routing.osrmv1({ language: 'es', profile: 'driving' }),
        lineOptions: { styles: [{ color: '#f59e0b', weight: 6, opacity: 0.9 }] },
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        show: false,
        createMarker: () => null
      }).addTo(this.mapa);

      const iconUsuario = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        iconSize: [38, 38], iconAnchor: [19, 38]
      });
      L.marker([servicio.origen_lat, servicio.origen_lng], { icon: iconUsuario })
        .addTo(this.mapa)
        .bindPopup('📍 Recoger aquí')
        .openPopup();
    });
  }

  iniciarPollingViaje(servicioId: number) {
    this.pollingViajeActivo = setInterval(() => {
      fetch(`http://localhost:8080/api/transporte/servicio/${servicioId}`)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(servicio => {
          this.viajeActivo = servicio;
          const W = (window as any).L;

          // ✅ SIMULACIÓN: Mover el marcador de la moto según las coordenadas del backend
          const cLat = servicio.conductor_lat ?? servicio.latitud;
          const cLng = servicio.conductor_lng ?? servicio.longitud;
          
          if (cLat && cLng && this.mapa && this.markerUsuario) {
            this.aplicarRotacionMarcador(cLat, cLng);
            this.markerUsuario.setLatLng([cLat, cLng]);
            // Hacer que la cámara siga a la moto si está en simulación
            this.mapa.panTo([cLat, cLng]);
          }

          // ✅ Actualizar la ruta visual (waypoints)
          if (this.routingControl) {
            const esHaciaDestino = servicio.estado === 'EN_VIAJE' || servicio.estado === 'EN_CAMINO';
            this.routingControl.setWaypoints([
              W.latLng(cLat, cLng),
              W.latLng(esHaciaDestino ? servicio.destino_lat : servicio.origen_lat, 
                         esHaciaDestino ? servicio.destino_lng : servicio.origen_lng)
            ]);

            // Cambiar color: Naranja (buscando usuario), Verde (con pasajero)
            const colorRuta = esHaciaDestino ? '#16a34a' : '#f59e0b';
            this.routingControl.options.lineOptions.styles = [{ color: colorRuta, weight: 6, opacity: 0.9 }];
          }

          if (servicio.estado === 'FINALIZADO') {
            clearInterval(this.pollingViajeActivo);
            this.viajeActivo = null;
            this.viajeId = null;
            if (this.routingControl) {
              this.mapa.removeControl(this.routingControl);
              this.routingControl = null;
            }
            this.limpiarEstela();
          }
        })
        .catch(err => console.warn("Polling de viaje pausado por error del servidor"));
    }, 3000);
  }

  finalizarViaje() {
    if (!this.viajeId) return;
    fetch(`http://localhost:8080/api/transporte/servicio/${this.viajeId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'FINALIZADO', conductor_id: this.conductorId })
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(() => {
      clearInterval(this.pollingViajeActivo);
      this.viajeActivo = null;
      this.viajeId = null;
      if (this.routingControl) {
        this.mapa.removeControl(this.routingControl);
        this.routingControl = null;
      }
      this.limpiarEstela();
      this.mensajeAlerta = '✅ Viaje finalizado correctamente';
      this.mostrarAlerta = true;
      setTimeout(() => this.mostrarAlerta = false, 4000);
    })
    .catch(err => console.error("Error al finalizar viaje:", err));
  }

  cancelarViaje() {
    if (!this.viajeId) return;

    const confirmar = confirm('¿Estás seguro de que deseas cancelar este viaje? Entendemos que pueden surgir imprevistos.');
    if (!confirmar) return;

    fetch(`http://localhost:8080/api/transporte/servicio/${this.viajeId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'CANCELADO', conductor_id: this.conductorId })
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(() => {
      // Detener el polling del viaje actual
      clearInterval(this.pollingViajeActivo);
      this.viajeActivo = null;
      this.viajeId = null;
      
      if (this.routingControl) {
        this.mapa.removeControl(this.routingControl);
        this.routingControl = null;
      }
      this.limpiarEstela();

      this.mensajeAlerta = '🔴 Has cancelado el viaje.';
      this.mostrarAlerta = true;

      // ✅ IMPORTANTE: Reiniciar el polling de notificaciones para recibir nuevos viajes
      if (this.enLinea) this.iniciarPollingNotificaciones();

      setTimeout(() => this.mostrarAlerta = false, 4000);
    })
    .catch(err => console.error("Error al cancelar viaje:", err));
  }

  llegueAlUsuario() {
    if (!this.viajeId) return;
    fetch(`http://localhost:8080/api/transporte/servicio/${this.viajeId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'EN_CAMINO', conductor_id: this.conductorId })
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
    .then(() => {
      const W = (window as any).L;
      if (this.routingControl && this.viajeActivo) {
        navigator.geolocation.getCurrentPosition(pos => {
          this.routingControl.setWaypoints([
            W.latLng(pos.coords.latitude, pos.coords.longitude),
            W.latLng(this.viajeActivo.destino_lat, this.viajeActivo.destino_lng)
          ]);
        });
      }
    })
    .catch(err => console.error("Error al marcar llegada:", err));
  }

  paqueteRecogido() {
    if (!this.viajeId) return;
    fetch(`http://localhost:8080/api/transporte/servicio/${this.viajeId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'PAQUETE_RECOGIDO', conductor_id: this.conductorId })
    })
    .then(res => {
      if (res.ok) {
        this.mensajeAlerta = '📦 Paquete marcado como recogido';
        this.mostrarAlerta = true;
      }
    });
  }

  pararPollingNotificaciones() {
    if (this.pollingNotificaciones) clearInterval(this.pollingNotificaciones);
    this.solicitudes = [];
  }

  // ✅ MÉTODO PARA ROTAR EL ICONO SEGÚN EL MOVIMIENTO
  private aplicarRotacionMarcador(nuevaLat: number, nuevaLng: number) {
    if (!this.markerUsuario || this.ultimaLat === null || this.ultimaLng === null) {
      this.ultimaLat = nuevaLat;
      this.ultimaLng = nuevaLng;
      return;
    }

    // Calcular ángulo: Math.atan2(deltaLng, deltaLat) devuelve el ángulo en radianes
    // 0 es Norte, 90 es Este, etc.
    const angulo = Math.atan2(nuevaLng - this.ultimaLng, nuevaLat - this.ultimaLat) * (180 / Math.PI);

    const el = this.markerUsuario.getElement();
    if (el) {
      el.style.transition = 'transform 0.5s ease'; // Rotación suave
      el.style.transformOrigin = 'center center';
      // Preservamos el translate que Leaflet usa para posicionar y añadimos la rotación
      const transformBase = el.style.transform.split(' rotate')[0];
      el.style.transform = `${transformBase} rotate(${angulo}deg)`;
    }

    this.ultimaLat = nuevaLat;
    this.ultimaLng = nuevaLng;
  }

  // ✅ MÉTODO PARA ACTUALIZAR EL RASTRO (ESTELA)
  private actualizarEstela(lat: number, lng: number) {
    if (!this.mapa) return;
    
    const nuevoPunto = L.latLng(lat, lng);
    this.puntosEstela.push(nuevoPunto);

    if (this.estelaMoto) {
      this.estelaMoto.setLatLngs(this.puntosEstela);
    } else {
      this.estelaMoto = L.polyline(this.puntosEstela, {
        color: '#22c55e', // Verde neón
        weight: 3,
        opacity: 0.6,
        dashArray: '5, 10', // Efecto de línea punteada
        lineCap: 'round'
      }).addTo(this.mapa);
    }
  }

  private limpiarEstela() {
    if (this.estelaMoto && this.mapa) {
      this.mapa.removeLayer(this.estelaMoto);
    }
    this.estelaMoto = undefined;
    this.puntosEstela = [];
  }

  iniciarRastreoRealTime() {
    if (!navigator.geolocation) return;

    this.pararRastreo(); // Limpiar rastreos previos

    // ENVIAR UBICACIÓN INMEDIATA PARA SER ENCONTRADO POR EL BACKEND
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      fetch('http://localhost:8080/api/transporte/ubicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: this.conductorId, lat, lng: lon })
      }).then(() => console.log("📍 Ubicación inicial enviada"));
    });

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        if (this.mapa) this.mapa.panTo([lat, lon]);

        // ✅ Solo enviar ubicación GPS si NO hay una simulación/viaje activo
        if (this.conductorId && this.enLinea && !this.viajeId) {
          fetch('http://localhost:8080/api/transporte/ubicacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conductor_id: this.conductorId, lat: lat, lng: lon })
          }).catch(err => console.warn("Error guardando ubicación en DB:", err));
        }

        if (this.markerUsuario) {
          this.aplicarRotacionMarcador(lat, lon);
          this.actualizarEstela(lat, lon);
          this.markerUsuario.setLatLng([lat, lon]);
        } else {
          this.markerUsuario = L.marker([lat, lon], { icon: this.iconoMoto })
            .addTo(this.mapa)
            .bindPopup('<b>Tu ubicación</b>')
            .openPopup();
        }
      },
      (err) => console.warn("Error GPS:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }

  pararRastreo() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.markerUsuario && this.mapa) {
      this.mapa.removeLayer(this.markerUsuario);
      this.markerUsuario = undefined;
    }
    this.limpiarEstela();
    // Limpiar routing control si existe
    if (this.routingControl && this.mapa) {
      this.mapa.removeControl(this.routingControl);
      this.routingControl = null;
    }
  }

  /**
   * 🧪 SIMULACIÓN MANUAL: Mueve al conductor en el mapa sin depender de movimiento real.
   * Útil para probar la sincronización visual y el centrado del mapa.
   */
  simularUbicacionManual(): void {
    if (!this.mapa) {
      alert('Primero debes mostrar el mapa.');
      return;
    }

    // Coordenada base: la del marcador actual o el centro por defecto (Buenaventura)
    const currentLat = this.markerUsuario ? this.markerUsuario.getLatLng().lat : 3.8821;
    const currentLng = this.markerUsuario ? this.markerUsuario.getLatLng().lng : -77.0253;

    // Generar un desplazamiento aleatorio de aprox 50-100 metros
    const nuevaLat = currentLat + (Math.random() - 0.5) * 0.0015;
    const nuevaLng = currentLng + (Math.random() - 0.5) * 0.0015;

    console.log(`🧪 Saltando a: ${nuevaLat.toFixed(5)}, ${nuevaLng.toFixed(5)}`);

    // Actualizar marcador local
    if (this.markerUsuario) {
      this.aplicarRotacionMarcador(nuevaLat, nuevaLng);
      this.markerUsuario.setLatLng([nuevaLat, nuevaLng]);
    } else {
      this.markerUsuario = L.marker([nuevaLat, nuevaLng], { icon: this.iconoMoto })
        .addTo(this.mapa)
        .bindPopup('<b>📍 Ubicación de Prueba</b>')
        .openPopup();
    }

    // Centrar cámara
    this.mapa.panTo([nuevaLat, nuevaLng]);

    // Opcional: Si el conductor está "En línea", enviamos esta posición al backend
    // para que el pasajero vea el movimiento en su pantalla de solicitud.
    if (this.enLinea && this.conductorId) {
      fetch('http://localhost:8080/api/transporte/ubicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: this.conductorId, lat: nuevaLat, lng: nuevaLng })
      }).catch(err => console.warn("Sync de simulación falló:", err));
    }
  }

  // ✅ Ayudante para mostrar alerta visual si la tasa de cancelación es alta
  getTasaCancelacionClass(): string {
    if (this.viajesTotal === 0) return 'text-success';
    const tasa = (this.cancelaciones / this.viajesTotal) * 100;
    if (tasa > 15) return 'text-danger animate-pulse'; // Más del 15% es crítico
    if (tasa > 5) return 'text-warning';
    return 'text-success';
  }

  // =========================
  // HELPERS DE ESTADO
  // =========================
  getBadgeClass(estado: string): string {
    const classes: { [key: string]: string } = {
      'PENDIENTE': 'status-pending',
      'ACEPTADO': 'status-accepted',
      'EN_CAMINO_AL_USUARIO': 'status-traveling',
      'LLEGO_AL_ORIGEN': 'status-arrived',
      'EN_CAMINO': 'status-active',
      'EN_VIAJE': 'status-active',
      'FINALIZADO': 'status-finished',
      'RECHAZADO': 'status-error',
      'CANCELADO': 'status-error'
    };
    return classes[estado] || 'status-default';
  }

  getFriendlyEstado(estado: string): string {
    return estado.replace(/_/g, ' ');
  }

  // =========================
  // NAVEGACIÓN Y SESIÓN
  // =========================
  toggleMenu(): void { this.menuAbierto = !this.menuAbierto; }
  verPerfil(): void { this.menuAbierto = false; this.router.navigate(['/perfil-conductor']); }
  editarPerfil(): void { this.menuAbierto = false; this.router.navigate(['/editar-perfil']); }
  configuracion(): void { this.menuAbierto = false; this.router.navigate(['/configuracion']); }

  cerrarSesion(): void {
    this.pararRastreo();
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}