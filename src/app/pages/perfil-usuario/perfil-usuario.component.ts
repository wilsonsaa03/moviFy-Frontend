import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

import {
  UsuarioService,
  Usuario
} from '../../Base_de_datos/usuario.service';

@Component({
  selector: 'app-perfil-usuario',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterModule
  ],

  templateUrl: './perfil-usuario.component.html',

  styleUrl: './perfil-usuario.component.css'
})

export class PerfilUsuarioComponent implements OnInit {

  nombre = '';
  foto = '';
  correo = '';
  telefono = '';

  mensaje = '';
  error = '';

  cargando = false;

  constructor(
    private router: Router,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit(): void {

    this.cargarPerfil();
  }

  cargarPerfil(): void {

    this.cargando = true;

    this.usuarioService.obtenerPerfil().subscribe({

      next: (usuario: Usuario) => {

        this.nombre = usuario.nombre;
        this.correo = usuario.correo;
        this.telefono = usuario.telefono;

        this.foto =
          localStorage.getItem('foto') || '';

        this.cargando = false;
      },

      error: () => {

        this.error = 'Error al cargar el perfil';

        this.cargando = false;
      }
    });
  }

  guardarCambios(): void {

    if (
      !this.nombre ||
      !this.correo ||
      !this.telefono
    ) {

      this.error = 'Completa todos los campos';
      return;
    }

    const usuarioActualizado: Usuario = {

      nombre: this.nombre,
      correo: this.correo,
      telefono: this.telefono
    };

    this.usuarioService.actualizarPerfil(
      usuarioActualizado
    ).subscribe({

      next: () => {

        localStorage.setItem(
          'foto',
          this.foto
        );

        this.mensaje =
          'Perfil actualizado correctamente';

        this.error = '';

        alert('💾 Cambios guardados con éxito');
      },

      error: () => {

        this.error =
          'No se pudo actualizar el perfil';

        this.mensaje = '';
      }
    });
  }
}