import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';

@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './restablecer-password.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './restablecer-password.css',
})
export class RestablecerPasswordComponent implements OnInit {
  password = '';
  confirmar = '';
  token = '';
  error = '';
  cargando = false;
  exito = false;
  mostrarPassword = false;
  mostrarConfirmar = false;

  errores = {
    password: '',
    confirmar: '',
  };

  constructor(
    private route: ActivatedRoute,
    private usuarioService: UsuarioService,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';
    // El token es una llave de un solo uso: se saca de la barra de direcciones y del historial apenas se lee
    // (así no queda a la vista, en capturas de pantalla ni en el historial de un computador compartido)
    if (this.token && typeof history !== 'undefined')
      history.replaceState(null, '', location.pathname);
  }

  restablecer(): void {
    this.errores = { password: '', confirmar: '' };
    this.error = '';

    if (!this.password || this.password.length < 8) {
      this.errores.password = 'La contraseña debe tener mínimo 8 caracteres';
      return;
    }

    if (this.password !== this.confirmar) {
      this.errores.confirmar = 'Las contraseñas no coinciden';
      return;
    }

    if (!this.token) {
      this.error = 'Token inválido o expirado';
      return;
    }

    this.cargando = true;

    this.usuarioService.restablecerClave(this.token, this.password).subscribe({
      next: () => {
        this.cargando = false;
        this.exito = true;
      },
      error: (err: any) => {
        this.cargando = false;
        this.error = err.error?.error || 'El enlace expiró o es inválido';
      },
    });
  }
}
