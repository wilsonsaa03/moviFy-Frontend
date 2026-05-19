import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';

@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './restablecer-password.html',
  styleUrl: './restablecer-password.css'
})
export class RestablecerPasswordComponent implements OnInit {

  password        = '';
  confirmar       = '';
  token           = '';
  error           = '';
  cargando        = false;
  exito           = false;
  mostrarPassword  = false;
  mostrarConfirmar = false;

  errores = {
    password:  '',
    confirmar: ''
  };

  constructor(
    private route: ActivatedRoute,
    private usuarioService: UsuarioService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParams['token'] || '';
  }

  restablecer(): void {

    this.errores = { password: '', confirmar: '' };
    this.error = '';

    if (!this.password || this.password.length < 6) {
      this.errores.password = 'La contraseña debe tener mínimo 6 caracteres';
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
      }
    });
  }
}