import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home-usuario',
  standalone: true,
  imports: [CommonModule],
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
      statusClass: 'completado'
    },
    {
      icono: '📦',
      destino: 'Encomienda #12345',
      fecha: '11 May, 2024',
      hora: '04:15 PM',
      estado: 'En camino',
      statusClass: 'en-camino'
    },
    {
      icono: '🛵',
      destino: 'Domicilio a Casa',
      fecha: '10 May, 2024',
      hora: '08:45 PM',
      estado: 'Cancelado',
      statusClass: 'cancelado'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Usuario';
    this.foto = localStorage.getItem('foto') || '';
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  verPerfil(): void {
    this.router.navigate(['/perfil-usuario']); // Ajustado a tu ruta de app.routes.ts
  }

  editarPerfil(): void {
    this.router.navigate(['/editar-perfil']);
  }

  configuracion(): void {
    this.router.navigate(['/configuracion']);
  }

  // ==========================================
  // FUNCIÓN ACTUALIZADA
  // ==========================================
  solicitarServicio(tipo: string): void {
    if (tipo === 'transporte') {
      // Navega a la ruta exacta que pusimos en app.routes.ts
      this.router.navigate(['/solicitar-transporte']);
    } else if (tipo === 'domicilio') {
      this.router.navigate(['/solicitar-domicilio']);
    } else {
      // Por ahora, los otros siguen igual o puedes crearles sus rutas luego
      this.router.navigate(['/solicitar', tipo]);
    }
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}