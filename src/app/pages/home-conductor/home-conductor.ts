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
  // ESTADISTICAS
  // =========================
  gananciasHoy: number = 0;
  gananciasSemana: number = 0;
  viajesHoy: number = 0;
  viajesTotal: number = 0;

  solicitudes: any[] = [];
  historial: any[] = [];

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
        this.telefono = data.telefono || 'N/A';
        
        // CORRECCIÓN: Nombres de campos comunes en DB
        this.placa    = data.placa || data.placa_vehiculo || 'No registrada';
        this.modelo   = data.modelo || data.modelo_vehiculo || 'No registrado';
        
        this.estadoCuenta = data.estado || 'pendiente';
        this.gananciasHoy = Number(data.gananciasHoy) || 0;
        this.gananciasSemana = Number(data.gananciasSemana) || 0;
        this.viajesHoy = Number(data.viajesHoy) || 0;
        this.viajesTotal = Number(data.viajesTotal) || 0;
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
      if (this.mapa) this.iniciarRastreoRealTime();
    } else {
      this.mensajeAlerta = '🔴 Has dejado de estar disponible. Rastreo apagado';
      this.pararRastreo();
    }

    setTimeout(() => this.mostrarAlerta = false, 3000);
  }

  iniciarRastreoRealTime() {
    if (!navigator.geolocation || !this.mapa) return;

    this.pararRastreo(); // Limpiar rastreos previos

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        this.mapa.panTo([lat, lon]);

        if (this.markerUsuario) {
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