import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConductorService } from '../../Base_de_datos/conductor.service';

@Component({
  selector: 'app-home-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home-conductor.html',
  styleUrls: ['./home-conductor.css']
})
export class HomeConductorComponent implements OnInit {

  // =========================
  // DATOS DEL CONDUCTOR
  // =========================
  nombre       = '';
  foto         = '';
  placa        = '';
  modelo       = '';
  telefono     = '';
  correo       = '';
  estadoCuenta = 'pendiente';
  calificacion = 4.8;
  enLinea      = false;
  notificaciones = 0;

  // =========================
  // MAPA Y ALERTAS
  // =========================
  mostrarMapa   = false;
  mostrarAlerta = false;
  mensajeAlerta = '';

  // =========================
  // MENUS INTERACTIVOS
  // =========================
  menuAbierto      = false; // Dropdown de perfil superior derecho
  menuNavAbierto   = false; // Menú móvil desplegable
  sidebarColapsado = false; // Nueva variable: controla si se encoge la barra lateral izquierda

  // =========================
  // ESTADISTICAS
  // =========================
  gananciasHoy    = 0;
  gananciasSemana = 0;
  viajesHoy       = 0;
  viajesTotal     = 0;

  servicioActivo: any = null;
  solicitudes: any[] = [];
  historial: any[] = [];

  constructor(
    private router: Router,
    private conductorService: ConductorService
  ) {}

  ngOnInit(): void {
    const correo = localStorage.getItem('correo');
    if (!correo) {
      console.log('No hay correo guardado');
      return;
    }

    this.conductorService.obtenerPerfil(correo).subscribe({
      next: (data: any) => {
        this.nombre   = data.nombre || '';
        this.foto     = data.foto || '';
        this.correo   = data.correo || '';
        this.telefono = data.telefono || '';
        this.placa    = data.placa || '';
        this.modelo   = data.modelo || '';
        this.estadoCuenta = data.estado || 'pendiente';

        this.gananciasHoy = data.gananciasHoy || 0;
        this.gananciasSemana = data.gananciasSemana || 0;
        this.viajesHoy = data.viajesHoy || 0;
        this.viajesTotal = data.viajesTotal || 0;

        this.solicitudes = data.solicitudes || [];
        this.historial = data.historial || [];
      },
      error: (err: any) => { console.log(err); }
    });
  }

  // MÉTODO NUEVO: Controla la visibilidad y colapso de la barra lateral izquierda
  toggleSidebar(): void {
    if (window.innerWidth <= 992) {
      // En dispositivos móviles actúa abriendo/cerrando el menú flotante
      this.menuNavAbierto = !this.menuNavAbierto;
    } else {
      // En computadoras colapsa el texto dejando visibles solo los iconos
      this.sidebarColapsado = !this.sidebarColapsado;
    }
  }

  toggleMapa(): void {
    this.mostrarMapa = !this.mostrarMapa;
  }

  toggleMapaActivo(): void {
    this.enLinea = !this.enLinea;
    this.mostrarAlerta = true;
    this.mensajeAlerta = this.enLinea 
      ? '🟢 Ahora estás disponible y visible para los usuarios' 
      : '🔴 Mapa desactivado. Ya no apareces disponible';

    setTimeout(() => { this.mostrarAlerta = false; }, 4000);
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  verPerfil(): void {
    this.menuAbierto = false;
    this.router.navigate(['/perfil-conductor']);
  }

  editarPerfil(): void {
    this.menuAbierto = false;
    this.router.navigate(['/editar-perfil']);
  }

  configuracion(): void {
    this.menuAbierto = false;
    this.router.navigate(['/configuracion']);
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}