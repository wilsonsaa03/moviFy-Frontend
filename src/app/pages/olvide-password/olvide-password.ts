import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';

@Component({
  selector: 'app-olvide-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './olvide-password.html',
  styleUrl: './olvide-password.css'
})
export class OlvidePasswordComponent {

  correo   = '';
  error    = '';
  cargando = false;
  paso     = 1;

  constructor(private usuarioService: UsuarioService) {}

  enviarEnlace(): void {

    this.error = '';

    if (!this.correo) {
      this.error = 'Ingresa tu correo electrónico';
      return;
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(this.correo)) {
      this.error = 'Ingresa un correo válido';
      return;
    }

    this.cargando = true;

    this.usuarioService.olvideClave(this.correo).subscribe({
      next: () => {
        this.cargando = false;
        this.paso = 2;
      },
      error: (err: any) => {
        this.cargando = false;
        this.error = err.error?.error || 'Error al enviar el correo';
      }
    });
  }
}