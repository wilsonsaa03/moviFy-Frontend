import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConductorService } from '../../Base_de_datos/conductor.service';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/api.service';
import { cargarRoutingMachine } from '../../core/lrm-loader';
import * as L from 'leaflet';

@Component({
  selector: 'app-home-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home-conductor.html',
  styleUrls: ['./home-conductor.css']
})
export class HomeConductorComponent implements OnInit, OnDestroy {

  // DATOS DEL CONDUCTOR
  nombre: string = 'Conductor';
  foto: string = '';
  conductorId: any = null;
  placa: string = 'Cargando...';
  modelo: string = 'Cargando...';
  telefono: string = '';
  correo: string = '';
  estadoCuenta: string = 'pendiente';
  calificacion: number = 0;
  enLinea: boolean = false;
  notificaciones: number = 0;
  cargando: boolean = true;

  // MAPA Y RASTREO
  mostrarMapa: boolean = false;
  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';
  // MODAL DE ESTADO DE CUENTA
  mostrarModalEstado: boolean = false;
  tituloModalEstado: string = '';
  mensajeModalEstado: string = '';
  mostrarBotonReenviarDocs: boolean = false;
  mapa: any;
  watchId: any;
  markerUsuario: L.Marker | undefined;
  private ultimaLat: number | null = null;
  private ultimaLng: number | null = null;
  private estelaMoto: L.Polyline | undefined;
  private puntosEstela: L.LatLng[] = [];

  iconoMoto = L.icon({
    iconUrl: 'assets/moto-icon.png',
    iconSize: [60, 60],
    iconAnchor: [30, 60],
    popupAnchor: [0, -60]
  });

  // MENUS
  menuAbierto: boolean = false;
  menuNavAbierto: boolean = false;
  sidebarColapsado: boolean = false;

  // ESTADISTICAS
  pollingNotificaciones: any;
  gananciasHoy: number = 0;
  gananciasSemana: number = 0;
  viajesHoy: number = 0;
  viajesTotal: number = 0;
  cancelaciones: number = 0;
  solicitudes: any[] = [];
  historial: any[] = [];

  // VIAJE ACTIVO
  viajeActivo: any = null;
  viajeId: number | null = null;
  routingControl: any = null;
  pollingViajeActivo: any = null;

  // ✅ SIMULACIÓN DE MOVIMIENTO (igual que solicitar-transporte)
  private puntosSimulacion: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline;

  constructor(
    private router: Router,
    private conductorService: ConductorService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    const correoSession = localStorage.getItem('correo');
    if (!correoSession) { this.router.navigate(['/login']); return; }

    this.conductorService.obtenerPerfil(correoSession).subscribe({
      next: (data: any) => {
        this.nombre = data.nombre || 'Nombre no disponible';
        this.foto = data.foto || '';
        this.correo = data.correo || correoSession;
        this.conductorId = data.conductor_id || data.id;
        this.telefono = data.telefono || 'N/A';
        this.placa = data.placa || data.placa_vehiculo || 'No registrada';
        this.modelo = data.modelo || data.modelo_vehiculo || 'No registrado';
        this.estadoCuenta = data.estado || 'pendiente';
        this.calificacion = Number(data.calificacion) || 0;
        this.gananciasHoy = Number(data.gananciasHoy) || 0;
        this.gananciasSemana = Number(data.gananciasSemana) || 0;
        this.viajesHoy = Number(data.viajesHoy) || 0;
        this.viajesTotal = Number(data.viajesTotal) || 0;
        this.cancelaciones = Number(data.cancelaciones) || 0;
        this.historial = data.historial || [];
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error al cargar perfil:', err);
        this.placa = 'Error de conexión';
        this.modelo = 'Intente más tarde';
        this.cargando = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.pararRastreo();
    this.detenerSimulacionConductor();
    if (this.pollingViajeActivo) clearInterval(this.pollingViajeActivo);
    if (this.pollingNotificaciones) clearInterval(this.pollingNotificaciones);
    if (this.mapa) this.mapa.remove();
  }

  // ===================== SIMULACIÓN CONDUCTOR =====================

  private iniciarSimulacionConductor(
    origenLat: number, origenLng: number,
    destinoLat: number, destinoLng: number,
    colorLinea: string
  ): void {
    this.detenerSimulacionConductor();
    this.simulacionActiva = true;
    this.indexSimulacion = 0;

    // ✅ Mismo sistema que solicitar-transporte: fetch directo a OSRM
    const url = `https://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destinoLng},${destinoLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.length) { this.simulacionActiva = false; return; }

        const coords = data.routes[0].geometry.coordinates;
        this.puntosSimulacion = coords.map((c: number[]) => L.latLng(c[1], c[0]));

        if (this.puntosSimulacion.length < 2) { this.simulacionActiva = false; return; }

        // Quitar routing control de LRM para no duplicar líneas
        if (this.routingControl && this.mapa) {
          try { this.mapa.removeControl(this.routingControl); this.routingControl = null; } catch (e) {}
        }

        // Línea que se va recortando
        this.lineaSimulacion = L.polyline(this.puntosSimulacion, {
          color: colorLinea, weight: 6, opacity: 0.85
        }).addTo(this.mapa);

        // Estela del recorrido ya hecho
        this.lineaRecorrida = L.polyline([this.puntosSimulacion[0]], {
          color: colorLinea, weight: 3, opacity: 0.35
        }).addTo(this.mapa);

        // Ajustar cámara para ver toda la ruta
        this.mapa.fitBounds((this.lineaSimulacion as L.Polyline).getBounds(), { padding: [60, 60] });

        // La moto se mueve con el GPS real (watchPosition); ya no se envían posiciones simuladas
        this.simulacionActiva = false;
      })
      .catch(e => {
        console.error('Error obteniendo ruta OSRM:', e);
        this.simulacionActiva = false;
      });
  }

  private detenerSimulacionConductor(): void {
    if (this.intervaloSimulacion) {
      clearInterval(this.intervaloSimulacion);
      this.intervaloSimulacion = null;
    }
    if (this.lineaSimulacion && this.mapa) {
      try { this.mapa.removeLayer(this.lineaSimulacion); } catch (e) {}
      this.lineaSimulacion = undefined;
    }
    if (this.lineaRecorrida && this.mapa) {
      try { this.mapa.removeLayer(this.lineaRecorrida); } catch (e) {}
      this.lineaRecorrida = undefined;
    }
    this.simulacionActiva = false;
    this.indexSimulacion = 0;
    this.puntosSimulacion = [];
  }

  // ===================== INTERFAZ =====================

  toggleSidebar(): void {
    if (window.innerWidth <= 992) this.menuNavAbierto = !this.menuNavAbierto;
    else this.sidebarColapsado = !this.sidebarColapsado;
  }

  toggleMapa(): void {
    if (!this.mostrarMapa && !this.puedeActivarse()) {
      return; // Bloqueado: conductor no aprobado
    }
    this.mostrarMapa = !this.mostrarMapa;
    if (this.mostrarMapa) setTimeout(() => this.iniciarMapaBase(), 150);
    else this.pararRastreo();
  }

  iniciarMapaBase(): void {
    if (this.mapa) { this.mapa.invalidateSize(); return; }
    try {
      this.mapa = L.map('map').setView([3.8821, -77.0253], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(this.mapa);
      if (this.enLinea) this.iniciarRastreoRealTime();
    } catch (e) { console.error('Error inicializando Leaflet:', e); }
  }

  toggleMapaActivo(): void {
    if (!this.enLinea && !this.puedeActivarse()) {
      return; // Bloqueado: conductor no aprobado
    }
    this.enLinea = !this.enLinea;
    this.mostrarAlerta = true;
    if (this.enLinea) {
      this.mensajeAlerta = '🟢 Ahora estás disponible para recibir servicios';
      this.iniciarPollingNotificaciones();
      this.iniciarRastreoRealTime();
      this.api.post('/transporte/activar', { activo: true })
        .catch(err => {
          this.enLinea = false;
          this.pararPollingNotificaciones();
          this.mensajeAlerta = '⚠️ ' + ApiService.mensaje(err, 'No se pudo activar tu disponibilidad');
        });
    } else {
      this.mensajeAlerta = '🔴 Has dejado de estar disponible';
      this.pararPollingNotificaciones();
      this.pararRastreo();
      // Antes el conductor quedaba "en línea" en la BD aunque se desconectara
      this.api.post('/transporte/activar', { activo: false }).catch(() => {});
    }
    setTimeout(() => this.mostrarAlerta = false, 3000);
  }

  iniciarPollingNotificaciones() {
    this.pararPollingNotificaciones();
    this.pollingNotificaciones = setInterval(() => {
      if (!this.conductorId || !this.enLinea || this.viajeId) return;
      this.api.get<any[]>(`/transporte/solicitudes-pendientes/${this.conductorId}`)
        .then(solicitudes => {
          this.solicitudes = solicitudes || [];
          this.notificaciones = this.solicitudes.length;
        })
        .catch(err => {
          if (err?.status === 403) {
            this.mensajeAlerta = '⚠️ ' + (err.error?.message || 'Cuenta suspendida temporalmente');
            this.mostrarAlerta = true;
            this.enLinea = false;
            this.pararPollingNotificaciones();
          }
          this.notificaciones = 0;
        });
    }, 2000);
  }

  responderASolicitud(servicioId: number, nuevoEstado: string) {
    const solicitudLocal = this.solicitudes.find(s => s.servicio_id === servicioId);

    this.api.patch(`/transporte/servicio/${servicioId}/estado`, { estado: nuevoEstado })
      .then(() => {
        if (nuevoEstado === 'ACEPTADO') {
          // Con viaje activo no se buscan más solicitudes; se retoma al finalizar o cancelar
          this.pararPollingNotificaciones();
          this.viajeId = servicioId;
          this.viajeActivo = { ...solicitudLocal, estado: 'ACEPTADO' };
          this.notificaciones = 0;
          if (!this.mostrarMapa) {
            this.mostrarMapa = true;
            setTimeout(() => { this.iniciarMapaBase(); this.iniciarRutaViaje(servicioId); }, 300);
          } else {
            this.iniciarRutaViaje(servicioId);
          }
        } else {
          // RECHAZADO: solo se quita de la lista; el polling sigue (antes se detenía y no llegaban más)
          this.solicitudes = this.solicitudes.filter(s => s.servicio_id !== servicioId);
          this.notificaciones = this.solicitudes.length;
        }
      })
      .catch(err => {
        // 409: otro conductor la tomó primero
        this.solicitudes = this.solicitudes.filter(s => s.servicio_id !== servicioId);
        this.notificaciones = this.solicitudes.length;
        this.mensajeAlerta = ApiService.mensaje(err, 'No se pudo responder la solicitud');
        this.mostrarAlerta = true;
        setTimeout(() => this.mostrarAlerta = false, 3000);
      });
  }

  /** Qué ruta está dibujada, para no pedirla a OSRM en cada consulta. */
  private faseRutaConductor: '' | 'recogida' | 'destino' = '';

  /** Al terminar o cancelar un viaje se vuelve a escuchar solicitudes si sigue en línea. */
  private terminarViajeActivo(mensaje: string) {
    this.faseRutaConductor = '';
    if (this.pollingViajeActivo) clearInterval(this.pollingViajeActivo);
    this.pollingViajeActivo = null;
    this.detenerSimulacionConductor();
    this.viajeActivo = null;
    this.viajeId = null;
    if (this.routingControl && this.mapa) {
      try { this.mapa.removeControl(this.routingControl); } catch (e) {}
      this.routingControl = null;
    }
    this.limpiarEstela();
    this.mensajeAlerta = mensaje;
    this.mostrarAlerta = true;
    setTimeout(() => this.mostrarAlerta = false, 4000);
    if (this.enLinea) this.iniciarPollingNotificaciones();
  }

  iniciarRutaViaje(servicioId: number) {
    this.cargarLRM().then(() => {
      this.api.get(`/transporte/servicio/${servicioId}`)
        .then((servicio: any) => {
          this.viajeActivo = servicio;
          // ✅ Iniciar simulación conductor → usuario (naranja)
          navigator.geolocation.getCurrentPosition(pos => {
            this.iniciarSimulacionConductor(
              pos.coords.latitude, pos.coords.longitude,
              servicio.origen_lat, servicio.origen_lng,
              '#f59e0b'
            );
            // Marcador destino del usuario
            const iconUsuario = L.icon({
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
              iconSize: [38, 38], iconAnchor: [19, 38]
            });
            L.marker([servicio.origen_lat, servicio.origen_lng], { icon: iconUsuario })
              .addTo(this.mapa).bindPopup('📍 Recoger aquí').openPopup();
          });
          this.iniciarPollingViaje(servicioId);
        })
        .catch(err => console.warn('No se pudo cargar la ruta:', err));
    });
  }

  cargarLRM(): Promise<void> {
    return cargarRoutingMachine();
  }

  iniciarPollingViaje(servicioId: number) {
    this.pollingViajeActivo = setInterval(() => {
      this.api.get(`/transporte/servicio/${servicioId}`)
        .then((servicio: any) => {
          this.viajeActivo = servicio;

          // ✅ EN_VIAJE: iniciar simulación conductor → destino (verde)
          if (['EN_VIAJE', 'EN_CAMINO', 'PAQUETE_RECOGIDO'].includes(servicio.estado) && this.faseRutaConductor !== 'destino') {
            this.faseRutaConductor = 'destino';
            this.detenerSimulacionConductor();
            const posActual = this.markerUsuario?.getLatLng();
            const origenLat = posActual?.lat ?? servicio.origen_lat;
            const origenLng = posActual?.lng ?? servicio.origen_lng;
            this.iniciarSimulacionConductor(
              origenLat, origenLng,
              servicio.destino_lat, servicio.destino_lng,
              '#16a34a'
            );
          }

          if (servicio.estado === 'FINALIZADO') {
            this.terminarViajeActivo('✅ Viaje finalizado');
          }
          if (servicio.estado === 'CANCELADO') {
            this.terminarViajeActivo('🔴 El cliente canceló el servicio');
          }
        })
        .catch(() => console.warn('Polling de viaje pausado'));
    }, 3000);
  }

  finalizarViaje() {
    if (!this.viajeId) return;
    this.api.patch(`/transporte/servicio/${this.viajeId}/estado`, { estado: 'FINALIZADO' })
      .then(() => this.terminarViajeActivo('✅ Viaje finalizado correctamente'))
      .catch(err => alert(ApiService.mensaje(err, 'No se pudo finalizar el viaje')));
  }

  cancelarViaje() {
    if (!this.viajeId) return;
    const confirmar = confirm('¿Estás seguro de que deseas cancelar este viaje? Entendemos que pueden surgir imprevistos.');
    if (!confirmar) return;

    this.api.patch(`/transporte/servicio/${this.viajeId}/estado`, { estado: 'CANCELADO' })
      .then(() => this.terminarViajeActivo('🔴 Has cancelado el viaje.'))
      // 409 si el viaje ya arrancó: en ese caso solo soporte puede cancelarlo
      .catch(err => alert(ApiService.mensaje(err, 'No se pudo cancelar el viaje')));
  }

  llegueAlUsuario() {
    if (!this.viajeId) return;
    this.api.patch(`/transporte/servicio/${this.viajeId}/estado`, { estado: 'EN_CAMINO' })
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
      .catch(err => alert(ApiService.mensaje(err, 'No se pudo actualizar el viaje')));
  }

  paqueteRecogido() {
    if (!this.viajeId) return;
    this.api.patch(`/transporte/servicio/${this.viajeId}/estado`, { estado: 'PAQUETE_RECOGIDO' })
      .then(() => {
        this.mensajeAlerta = '📦 Paquete marcado como recogido';
        this.mostrarAlerta = true;
      })
      .catch(err => alert(ApiService.mensaje(err, 'No se pudo actualizar el viaje')));
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

  //  MÉTODO PARA ACTUALIZAR EL RASTRO (ESTELA)
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
      this.api.post('/transporte/ubicacion', { lat, lng: lon }).catch(() => {});
    });

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        if (this.mapa) this.mapa.panTo([lat, lon]);

        // El GPS real se envía siempre que esté en línea, también durante el viaje
        // (antes se cortaba con viaje activo y el cliente veía una posición simulada)
        if (this.conductorId && this.enLinea) {
          this.api.post('/transporte/ubicacion', { lat, lng: lon })
            .catch(err => console.warn('Error guardando ubicación:', err));
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
    // Solo en modo demo se envía una posición inventada al backend
    if (environment.demoSimulacion && this.enLinea && this.conductorId) {
      this.api.post('/transporte/ubicacion', { lat: nuevaLat, lng: nuevaLng }).catch(() => {});
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

  /**
   * Verifica si el conductor puede activarse. Si no puede, muestra el modal
   * explicando la razón y retorna false.
   */
  private puedeActivarse(): boolean {
    const estado = (this.estadoCuenta || '').toLowerCase();

    if (estado === 'aprobado') {
      return true;
    }

    this.mostrarBotonReenviarDocs = false;

    if (estado === 'rechazado') {
      this.tituloModalEstado = 'Documentación rechazada';
      this.mensajeModalEstado = 'Tu documentación fue revisada y no cumple con los requisitos necesarios. Debes reenviar tus documentos actualizados para poder activarte y recibir viajes.';
      this.mostrarBotonReenviarDocs = true;
    } else {
      this.tituloModalEstado = 'Cuenta en revisión';
      this.mensajeModalEstado = 'Tu cuenta aún está siendo revisada por nuestro equipo. Te notificaremos apenas sea aprobada. Este proceso puede tardar hasta 24-48 horas hábiles.';
    }

    this.mostrarModalEstado = true;
    return false;
  }

  cerrarModalEstado(): void {
    this.mostrarModalEstado = false;
  }

  irAReenviarDocumentos(): void {
    this.mostrarModalEstado = false;
    // No hay pantalla de reenvío todavía: se abre un correo a soporte con los datos del conductor
    const asunto = encodeURIComponent('Reenvío de documentos - conductor ' + (this.correo || ''));
    window.location.href = `mailto:movify2.app@gmail.com?subject=${asunto}`;
  }

  // =========================
  // NAVEGACIÓN Y SESIÓN
  // =========================
  toggleMenu(): void { this.menuAbierto = !this.menuAbierto; }
  verPerfil(): void { this.menuAbierto = false; this.router.navigate(['/perfil-conductor']); }
  editarPerfil(): void { this.menuAbierto = false; this.router.navigate(['/perfil-conductor']); }
  configuracion(): void { this.menuAbierto = false; this.router.navigate(['/perfil-conductor']); }

  cerrarSesion(): void {
    this.pararRastreo();
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}