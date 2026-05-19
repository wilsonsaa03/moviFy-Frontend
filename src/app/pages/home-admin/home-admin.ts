import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-admin.html',
  styleUrls: ['./home-admin.css']
})
export class HomeAdminComponent implements OnInit {

  // ── DATOS ADMIN ───────────────────────────────────
  nombre       = '';
  foto         = '';
  notificaciones = 5;
  seccionActiva  = 'dashboard';
  filtroConductor = 'todos';

  // ── ESTADÍSTICAS GLOBALES ─────────────────────────
  totalUsuarios   = 248;
  totalConductores = 34;
  totalServicios  = 87;
  totalGanancias  = 4850000;

  // ── REPORTES ──────────────────────────────────────
  transportesMes      = 312;
  domiciliosMes       = 198;
  encomiendaMes       = 94;
  calificacionPromedio = 4.7;
  porcentajeTransporte = 52;
  porcentajeDomicilio  = 33;
  porcentajeEncomienda = 15;

  // ── CONDUCTORES ───────────────────────────────────
  conductores = [
    { id: 1, nombre: 'Carlos Pérez',   correo: 'carlos@mail.com', placa: 'ABC12D', viajes: 45, calificacion: 4.9, estado: 'pendiente' },
    { id: 2, nombre: 'Luis Ramírez',   correo: 'luis@mail.com',   placa: 'XYZ34F', viajes: 120, calificacion: 4.7, estado: 'pendiente' },
    { id: 3, nombre: 'Pedro Gómez',    correo: 'pedro@mail.com',  placa: 'DEF56G', viajes: 88, calificacion: 4.8, estado: 'aprobado' },
    { id: 4, nombre: 'Juan Torres',    correo: 'juan@mail.com',   placa: 'GHI78H', viajes: 33, calificacion: 4.5, estado: 'aprobado' },
    { id: 5, nombre: 'Mario Salcedo',  correo: 'mario@mail.com',  placa: 'JKL90I', viajes: 0,  calificacion: 0,   estado: 'rechazado' }
  ];

  // ── USUARIOS ──────────────────────────────────────
  usuarios = [
    { id: 1, nombre: 'María López',    correo: 'maria@mail.com',  telefono: '3001234567', servicios: 12, estado: 'activo' },
    { id: 2, nombre: 'Ana Martínez',   correo: 'ana@mail.com',    telefono: '3107654321', servicios: 8,  estado: 'activo' },
    { id: 3, nombre: 'Sofía Castro',   correo: 'sofia@mail.com',  telefono: '3159876543', servicios: 3,  estado: 'activo' },
    { id: 4, nombre: 'Diego Herrera',  correo: 'diego@mail.com',  telefono: '3201112233', servicios: 0,  estado: 'inactivo' }
  ];

  // ── SERVICIOS ─────────────────────────────────────
  servicios = [
    { icono: '🏍️', tipo: 'Transporte',  destino: 'C.C. Unicentro',     conductor: 'Pedro Gómez',  cliente: 'María López',  precio: 8500,  fecha: '20 may, 9:00 AM', estado: 'completado' },
    { icono: '🛵',  tipo: 'Domicilio',   destino: 'Rest. El Punto',      conductor: 'Juan Torres',  cliente: 'Ana Martínez', precio: 6200,  fecha: '20 may, 10:15 AM', estado: 'completado' },
    { icono: '📦',  tipo: 'Encomienda',  destino: 'Universidad del Valle',conductor: 'Pedro Gómez', cliente: 'Sofía Castro', precio: 9000,  fecha: '20 may, 11:30 AM', estado: 'en curso' },
    { icono: '🏍️', tipo: 'Transporte',  destino: 'Aeropuerto Bonilla',  conductor: 'Juan Torres',  cliente: 'Diego Herrera',precio: 15000, fecha: '20 may, 12:00 PM', estado: 'completado' },
    { icono: '🛵',  tipo: 'Domicilio',   destino: 'Clínica Valle del Lili',conductor: 'Pedro Gómez',cliente: 'María López',  precio: 7500,  fecha: '20 may, 1:00 PM',  estado: 'cancelado' }
  ];

  get conductoresPendientes(): number {
    return this.conductores.filter(c => c.estado === 'pendiente').length;
  }

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Admin';
    this.foto   = localStorage.getItem('foto')   || '';
  }

  // ── FILTRAR CONDUCTORES ───────────────────────────
  conductoresFiltrados(): any[] {
    if (this.filtroConductor === 'todos') return this.conductores;
    return this.conductores.filter(c => c.estado === this.filtroConductor);
  }

  // ── APROBAR CONDUCTOR ─────────────────────────────
  aprobarConductor(conductor: any): void {
    conductor.estado = 'aprobado';
    this.totalConductores++;
  }

  // ── RECHAZAR CONDUCTOR ────────────────────────────
  rechazarConductor(conductor: any): void {
    conductor.estado = 'rechazado';
  }

  // ── BLOQUEAR CONDUCTOR ────────────────────────────
  bloquearConductor(conductor: any): void {
    conductor.estado = 'rechazado';
    this.totalConductores--;
  }

  // ── BLOQUEAR USUARIO ──────────────────────────────
  bloquearUsuario(usuario: any): void {
    usuario.estado = 'inactivo';
  }

  // ── ACTIVAR USUARIO ───────────────────────────────
  activarUsuario(usuario: any): void {
    usuario.estado = 'activo';
  }

  // ── CERRAR SESIÓN ─────────────────────────────────
  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}