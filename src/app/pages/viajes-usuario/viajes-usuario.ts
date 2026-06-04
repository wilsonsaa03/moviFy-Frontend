import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-viajes-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './viajes-usuario.html',
  styleUrls: ['./viajes-usuario.css']
})
export class ViajesUsuarioComponent implements OnInit {

  nombre = '';
  menuAbierto = false;
  sidebarVisible = false;
  filtroActivo = 'todos';

  // Stats del mes
  stats = {
    viajes: 18,
    gastado: 245000,
    enCurso: 1,
    favoritos: 4
  };

  // Servicio en curso
  servicioEnCurso = {
    origen: 'Casa',
    origenDir: 'Calle 45 #23-10',
    destino: 'Centro Comercial Cacique',
    destinoDir: 'Carrera 33 #45-67',
    conductorNombre: 'Juan Pérez',
    conductorFoto: '',
    conductorRating: 4.9,
    tiempoRestante: 8
  };

  // Lista de viajes
  viajes = [
    {
      id: 1,
      tipo: 'transporte',
      tipoLabel: 'Transporte',
      tipoColor: 'green',
      icono: '🚗',
      origen: 'Barrio El Jardín',
      destino: 'Universidad Industrial',
      fecha: '01 Jun 2026',
      hora: '3:45 PM',
      pago: 'Visa •••• 4567',
      precio: 12500,
      estado: 'Completado',
      estadoClass: 'completado',
      accionLabel: 'Repetir viaje',
      accionClass: 'btn-repetir'
    },
    {
      id: 2,
      tipo: 'domicilio',
      tipoLabel: 'Domicilio',
      tipoColor: 'orange',
      icono: '🛵',
      origen: 'Restaurante La Fogata',
      destino: 'Burger Clásica + Papas + Gaseosa',
      fecha: '01 Jun 2026',
      hora: '1:15 PM',
      pago: 'Nequi',
      precio: 18000,
      estado: 'Entregado',
      estadoClass: 'entregado',
      accionLabel: 'Ver detalle',
      accionClass: 'btn-detalle-orange'
    },
    {
      id: 3,
      tipo: 'encomienda',
      tipoLabel: 'Encomienda',
      tipoColor: 'purple',
      icono: '📦',
      origen: 'Documentos importantes',
      destino: 'Sobre manila mediano',
      fecha: '31 May 2026',
      hora: '11:20 AM',
      pago: 'Visa •••• 4567',
      precio: 9000,
      estado: 'Entregado',
      estadoClass: 'entregado',
      accionLabel: 'Ver comprobante',
      accionClass: 'btn-detalle-purple'
    },
    {
      id: 4,
      tipo: 'transporte',
      tipoLabel: 'Transporte',
      tipoColor: 'green',
      icono: '🚗',
      origen: 'Casa',
      destino: 'Centro Comercial Cacique',
      fecha: '30 May 2026',
      hora: '6:30 PM',
      pago: 'Efectivo',
      precio: 0,
      estado: 'Cancelado',
      estadoClass: 'cancelado',
      accionLabel: 'Ver detalle',
      accionClass: 'btn-detalle-outline'
    }
  ];

  get viajesFiltrados() {
    if (this.filtroActivo === 'todos') return this.viajes;
    return this.viajes.filter(v => v.tipo === this.filtroActivo);
  }

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Usuario';
  }

  toggleMenu(): void {
    this.sidebarVisible = !this.sidebarVisible;
  }

  toggleMenuPerfil(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  setFiltro(filtro: string): void {
    this.filtroActivo = filtro;
  }

  verSeguimiento(): void {
    // navegar a mapa/seguimiento
  }

  solicitarDeNuevo(): void {
    this.router.navigate(['/solicitar-transporte']);
  }

  exportar(): void {
    // lógica de exportar
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}