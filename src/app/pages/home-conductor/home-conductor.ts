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

  // DATOS DEL CONDUCTOR
  nombre: string = 'Conductor';
  foto: string = '';
  conductorId: any = null;
  placa: string = 'Cargando...';
  modelo: string = 'Cargando...';
  telefono: string = '';
  correo: string = '';
  estadoCuenta: string = 'pendiente';
  calificacion: number = 4.8;
  enLinea: boolean = false;
  notificaciones: number = 0;

  // MAPA Y RASTREO
  mostrarMapa: boolean = false;
  mostrarAlerta: boolean = false;
  mensajeAlerta: string = '';
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
    private conductorService: ConductorService
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
        this.gananciasHoy = Number(data.gananciasHoy) || 0;
        this.gananciasSemana = Number(data.gananciasSemana) || 0;
        this.viajesHoy = Number(data.viajesHoy) || 0;
        this.viajesTotal = Number(data.viajesTotal) || 0;
        this.cancelaciones = Number(data.cancelaciones) || 0;
        this.historial = data.historial || [];
      },
      error: (err: any) => {
        console.error('Error al cargar perfil:', err);
        this.placa = 'Error de conexión';
        this.modelo = 'Intente más tarde';
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

        // Mover marcador de moto al inicio de la ruta
        if (this.markerUsuario) {
          this.markerUsuario.setLatLng(this.puntosSimulacion[0]);
        } else {
          this.markerUsuario = L.marker(this.puntosSimulacion[0], { icon: this.iconoMoto })
            .addTo(this.mapa).bindPopup('<b>🛵 Tu posición</b>');
        }

        // Mover punto a punto
        this.intervaloSimulacion = setInterval(() => {
          if (this.indexSimulacion >= this.puntosSimulacion.length) {
            this.detenerSimulacionConductor();
            return;
          }

          const punto = this.puntosSimulacion[this.indexSimulacion];
          const anterior = this.indexSimulacion > 0
            ? this.puntosSimulacion[this.indexSimulacion - 1] : punto;

          if (this.markerUsuario) {
            this.markerUsuario.setLatLng(punto);

            // Rotación
            const angulo = Math.atan2(
              punto.lng - anterior.lng,
              punto.lat - anterior.lat
            ) * (180 / Math.PI);
            const el = this.markerUsuario.getElement();
            if (el) {
              el.style.transition = 'transform 0.6s linear';
              el.style.transformOrigin = 'center center';
              const base = el.style.transform.split(' rotate')[0];
              el.style.transform = `${base} rotate(${angulo}deg)`;
            }

            // Recortar línea restante
            const restantes = this.puntosSimulacion.slice(this.indexSimulacion);
            if (restantes.length > 1 && this.lineaSimulacion) {
              this.lineaSimulacion.setLatLngs(restantes);
            }

            // Crecer estela
            const recorridos = this.puntosSimulacion.slice(0, this.indexSimulacion + 1);
            if (recorridos.length > 1 && this.lineaRecorrida) {
              this.lineaRecorrida.setLatLngs(recorridos);
            }

            // ✅ Enviar posición al backend para que el usuario la vea
            if (this.conductorId && this.enLinea) {
              fetch('http://localhost:8080/api/transporte/ubicacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conductor_id: this.conductorId, lat: punto.lat, lng: punto.lng })
              }).catch(() => {});
            }

            // Zoom progresivo
            const progreso = this.indexSimulacion / this.puntosSimulacion.length;
            const zoomObjetivo = progreso < 0.3 ? 15 : progreso < 0.7 ? 16 : 17;
            if (Math.abs(this.mapa.getZoom() - zoomObjetivo) >= 1) {
              this.mapa.setView(punto, zoomObjetivo, { animate: true, duration: 1 });
            } else {
              this.mapa.panTo(punto, { animate: true, duration: 0.6 });
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
    this.enLinea = !this.enLinea;
    this.mostrarAlerta = true;
    if (this.enLinea) {
      this.mensajeAlerta = '🟢 Ahora estás disponible para recibir servicios';
      this.iniciarPollingNotificaciones();
      this.iniciarRastreoRealTime();
      if (this.conductorId) {
        fetch('http://localhost:8080/api/transporte/activar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conductor_id: this.conductorId })
        }).catch(err => console.error('Error al activar disponibilidad:', err));
      }
    } else {
      this.mensajeAlerta = '🔴 Has dejado de estar disponible';
      this.pararPollingNotificaciones();
      this.pararRastreo();
    }
    setTimeout(() => this.mostrarAlerta = false, 3000);
  }

  iniciarPollingNotificaciones() {
    this.pollingNotificaciones = setInterval(() => {
      if (!this.conductorId || !this.enLinea) return;
      fetch(`http://localhost:8080/api/transporte/solicitudes-pendientes/${this.conductorId}`)
        .then(res => {
          if (res.status === 403) {
            this.mensajeAlerta = '⚠️ Cuenta suspendida';
            this.mostrarAlerta = true;
            this.enLinea = false;
            this.pararPollingNotificaciones();
            throw new Error('Sancionado');
          }
          if (!res.ok) throw new Error(`Error: ${res.status}`);
          return res.json();
        })
        .then(solicitudes => {
          if (solicitudes) {
            this.solicitudes = solicitudes;
            this.notificaciones = solicitudes.length;
          }
        })
        .catch(() => { this.notificaciones = 0; });
    }, 2000);
  }

  responderASolicitud(servicioId: number, nuevoEstado: string) {
    this.pararPollingNotificaciones();
    const solicitudLocal = this.solicitudes.find(s => s.servicio_id === servicioId);

    fetch(`http://localhost:8080/api/transporte/servicio/${servicioId}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado, conductor_id: this.conductorId })
    })
    .then(res => { if (!res.ok) throw new Error('Error'); return res.json(); })
    .then(() => {
      if (nuevoEstado === 'ACEPTADO') {
        this.viajeId = servicioId;
        this.viajeActivo = { ...solicitudLocal, estado: 'ACEPTADO' };
        this.solicitudes = [];
        this.notificaciones = 0;
        if (!this.mostrarMapa) {
          this.mostrarMapa = true;
          setTimeout(() => { this.iniciarMapaBase(); this.iniciarRutaViaje(servicioId); }, 300);
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
        .then(res => { if (!res.ok) throw new Error('Error'); return res.json(); })
        .then(servicio => {
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

  iniciarPollingViaje(servicioId: number) {
    this.pollingViajeActivo = setInterval(() => {
      fetch(`http://localhost:8080/api/transporte/servicio/${servicioId}`)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(servicio => {
          this.viajeActivo = servicio;

          // ✅ EN_VIAJE: iniciar simulación conductor → destino (verde)
          if ((servicio.estado === 'EN_VIAJE' || servicio.estado === 'EN_CAMINO') && !this.simulacionActiva) {
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
            clearInterval(this.pollingViajeActivo);
            this.detenerSimulacionConductor();
            this.viajeActivo = null;
            this.viajeId = null;
            this.limpiarEstela();
          }
        })
        .catch(() => console.warn('Polling de viaje pausado'));
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