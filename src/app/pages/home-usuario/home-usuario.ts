import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-usuario.html',
  styleUrls: ['./home-usuario.css']
})
export class HomeUsuarioComponent implements OnInit {

  nombre = '';
  foto = '';
  menuAbierto = false;

  historial = [
    {
      icono: '🛵',
      destino: 'Viaje a Centro Comercial',
      fecha: '12 May, 2024',
      hora: '10:30 AM',
      estado: 'Completado',
      statusClass: 'completado',
      precio: 12500          // ← agregado
    },
    {
      icono: '📦',
      destino: 'Encomienda #12345',
      fecha: '11 May, 2024',
      hora: '04:15 PM',
      estado: 'En camino',
      statusClass: 'en-camino',
      precio: 8000           // ← agregado
    },
    {
      icono: '🛵',
      destino: 'Domicilio a Casa',
      fecha: '10 May, 2024',
      hora: '08:45 PM',
      estado: 'Cancelado',
      statusClass: 'cancelado',
      precio: 0              // ← agregado
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Usuario';
    this.foto   = localStorage.getItem('foto')   || '';
  }

  // Abre/cierra el menú hamburguesa del sidebar (mobile)
  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  // Abre/cierra el dropdown del perfil en el navbar  ← agregado
  toggleMenuPerfil(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  verPerfil(): void {
    this.menuAbierto = false;
    this.router.navigate(['/perfil-conductor']);
  }

  editarPerfil(): void {
    this.menuAbierto = false;
    this.router.navigate(['/perfil-conductor']);
  }

  configuracion(): void {
    this.menuAbierto = false;
    this.router.navigate(['/perfil-conductor']);
  }

  solicitarServicio(tipo: string): void {
    if (tipo === 'transporte')  this.router.navigate(['/solicitar-transporte']);
    else if (tipo === 'domicilio')  this.router.navigate(['/solicitar-domicilio']);
    else if (tipo === 'encomienda') this.router.navigate(['/solicitar-encomienda']);
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}