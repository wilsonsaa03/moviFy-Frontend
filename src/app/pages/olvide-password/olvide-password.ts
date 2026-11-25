import { Component, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';
import { AuthLayoutComponent } from '../../shared/auth-layout/auth-layout';

@Component({
  selector: 'app-olvide-password',
  standalone: true,
  imports: [FormsModule, RouterModule, AuthLayoutComponent],
  templateUrl: './olvide-password.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './olvide-password.css',
})
export class OlvidePasswordComponent {
  correo = '';
  error = '';
  cargando = false;
  paso = 1;
  /** Solo en modo desarrollo (SMS_CONSOLA=true en el backend): el enlace que iría en el correo. */
  enlaceDesarrollo: string | null = null;

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
      next: (res: any) => {
        this.cargando = false;
        const enlace: unknown = res?.enlaceDesarrollo;
        // Solo rutas internas de la propia web (nunca otro sitio)
        this.enlaceDesarrollo = typeof enlace === 'string' && enlace.startsWith('/restablecer-password?') ? enlace : null;
        this.paso = 2;
      },
      error: (err: any) => {
        this.cargando = false;
        this.error = err.error?.error || 'Error al enviar el correo';
      },
    });
  }
}
