import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';
import { AdminEmailDirective } from '../../Directivas/admin-email.directive';

@Component({
  selector: 'app-registro-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminEmailDirective],
  templateUrl: './registro-admin.html',
  styleUrls: ['./registro-admin.css']
})
export class RegistroAdminComponent {
  datos = {
    nombre: '',
    correo: '',
    password: '',
    codigoAdmin: '',
    rol: 'admin'
  };
  confirmar = '';
  error = '';
  exito = '';
  cargando = false;
  mostrarPassword = false;
  mostrarConfirmar = false;

  constructor(private usuarioService: UsuarioService, private router: Router) {}

  registrar() {
    this.error = '';

    if (!this.datos.nombre || !this.datos.correo || !this.datos.password || !this.datos.codigoAdmin) {
      this.error = 'Por favor, completa todos los campos.';
      return;
    }

    if (this.datos.password !== this.confirmar) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;

    this.usuarioService.registroAdmin(this.datos).subscribe({
      next: () => {
        this.exito = '¡Registro exitoso! Redirigiendo...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err: any) => {
        this.cargando = false;
        this.error = err.error?.error || 'Error al registrar administrador.';
      }
    });
  }
}