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

  // MENU DESPLEGABLE
  menuAbierto = false;

  historial = [
    {
      icono: '🏍️',
      destino: 'Centro Comercial Unicentro',
      fecha: '20 may, 8:30 AM',
      tipo: 'Transporte',
      precio: '$8.500'
    },
    {
      icono: '🛵',
      destino: 'Restaurante El Punto',
      fecha: '18 may, 1:15 PM',
      tipo: 'Domicilio',
      precio: '$6.200'
    },
    {
      icono: '📦',
      destino: 'Universidad Nacional',
      fecha: '16 may, 10:20 AM',
      tipo: 'Encomienda',
      precio: '$7.800'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {

    this.nombre = localStorage.getItem('nombre') || 'Usuario';

    this.foto = localStorage.getItem('foto') || '';

  }

  // ABRIR / CERRAR MENU
  toggleMenu(): void {

    this.menuAbierto = !this.menuAbierto;

  }

  // IR A PERFIL
  verPerfil(): void {

    this.router.navigate(['/perfil']);

  }

  // EDITAR PERFIL
  editarPerfil(): void {

    this.router.navigate(['/editar-perfil']);

  }

  // CONFIGURACION
  configuracion(): void {

    this.router.navigate(['/configuracion']);

  }

  solicitarServicio(tipo: string): void {

    this.router.navigate(['/solicitar', tipo]);

  }

  cerrarSesion(): void {

    localStorage.clear();

    this.router.navigate(['/login']);

  }

}