import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';

@Component({
  selector: 'app-registro-usuario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro-usuario.html',
  styleUrl: './registro-usuario.css'
})
export class RegistroUsuario {
  datos = { nombre: '', correo: '', password: '', telefono: '', rol: 'cliente' };
  confirmar = '';
  error = '';
  exito = '';
  cargando = false;

  constructor(private usuarioService: UsuarioService, private router: Router) {}

  registrar() {
    if (this.datos.password !== this.confirmar) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }
    this.cargando = true;
    this.error = '';
    this.usuarioService.registro(this.datos).subscribe({
      next: () => {
        this.exito = '¡Registro exitoso! Redirigiendo...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.cargando = false;
        this.error = err.error?.error || 'Error al registrar';
      }
    });
  }
}