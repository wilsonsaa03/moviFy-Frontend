import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-conductor.html',
  styleUrls: ['./home-conductor.css']
})
export class HomeConductorComponent implements OnInit {

  // ── DATOS DEL CONDUCTOR ───────────────────────────
  nombre       = '';
  foto         = '';
  placa        = '';
  modelo       = '';
  estadoCuenta = 'pendiente';
  calificacion = 4.8;
  enLinea      = false;
  notificaciones = 3;

  // ── ESTADÍSTICAS ──────────────────────────────────
  gananciasHoy       = 45000;
  gananciasSemana    = 280000;
  viajesHoy          = 6;
  viajesTotal        = 143;
  transportesSemanales = 12;
  domiciliosSemanales  = 8;
  encomiendaSemanales  = 4;

  // ── SERVICIO ACTIVO ───────────────────────────────
  servicioActivo: any = null;

  // ── SOLICITUDES DISPONIBLES ───────────────────────
  solicitudes = [
    {
      id: 1,
      tipo: 'Transporte',
      icono: '🏍️',
      destino: 'Centro Comercial Unicentro',
      distancia: '2.3 km',
      tiempo: '8 min',
      precio: 8500,
      cliente: 'María López',
      telefono: '3001234567',
      origen: 'Calle 45 #20-10'
    },
    {
      id: 2,
      tipo: 'Domicilio',
      icono: '🛵',
      destino: 'Restaurante El Punto',
      distancia: '1.1 km',
      tiempo: '4 min',
      precio: 6200,
      cliente: 'Carlos Ruiz',
      telefono: '3107654321',
      origen: 'Av. 6N #28-45'
    },
    {
      id: 3,
      tipo: 'Encomienda',
      icono: '📦',
      destino: 'Universidad del Valle',
      distancia: '3.8 km',
      tiempo: '12 min',
      precio: 9000,
      cliente: 'Ana Martínez',
      telefono: '3159876543',
      origen: 'Cra 1 #13-100'
    }
  ];

  // ── HISTORIAL ─────────────────────────────────────
  historial = [
    {
      icono: '🏍️',
      destino: 'Centro Comercial Chipichape',
      fecha: '20 may, 9:30 AM',
      tipo: 'Transporte',
      precio: 7800,
      calificacion: 5
    },
    {
      icono: '🛵',
      destino: 'Restaurante La Hacienda',
      fecha: '20 may, 11:15 AM',
      tipo: 'Domicilio',
      precio: 5500,
      calificacion: 5
    },
    {
      icono: '📦',
      destino: 'Clínica Valle del Lili',
      fecha: '19 may, 3:20 PM',
      tipo: 'Encomienda',
      precio: 8200,
      calificacion: 4
    },
    {
      icono: '🏍️',
      destino: 'Aeropuerto Alfonso Bonilla',
      fecha: '19 may, 6:00 PM',
      tipo: 'Transporte',
      precio: 15000,
      calificacion: 5
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Conductor';
    this.foto   = localStorage.getItem('foto')   || '';
  }

  // ── TOGGLE ESTADO ─────────────────────────────────
  toggleEstado(): void {
    this.enLinea = !this.enLinea;
  }

  // ── NOTIFICACIONES ────────────────────────────────
  toggleNotificaciones(): void {
    this.notificaciones = 0;
  }

  // ── ACEPTAR SOLICITUD ─────────────────────────────
  aceptarSolicitud(solicitud: any): void {
    this.servicioActivo = solicitud;
    this.solicitudes = this.solicitudes.filter(s => s.id !== solicitud.id);
  }

  // ── RECHAZAR SOLICITUD ────────────────────────────
  rechazarSolicitud(solicitud: any): void {
    this.solicitudes = this.solicitudes.filter(s => s.id !== solicitud.id);
  }

  // ── COMPLETAR SERVICIO ────────────────────────────
  completarServicio(): void {
    if (!this.servicioActivo) return;
    this.gananciasHoy += this.servicioActivo.precio;
    this.viajesHoy++;
    this.historial.unshift({
      icono: this.servicioActivo.icono,
      destino: this.servicioActivo.destino,
      fecha: 'Ahora',
      tipo: this.servicioActivo.tipo,
      precio: this.servicioActivo.precio,
      calificacion: 5
    });
    this.servicioActivo = null;
  }

  // ── CANCELAR SERVICIO ─────────────────────────────
  cancelarServicio(): void {
    this.servicioActivo = null;
  }

  // ── CERRAR SESIÓN ─────────────────────────────────
  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}