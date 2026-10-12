import { Component, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { UsuarioService } from '../Base_de_datos/usuario.service';
import { Usuario } from '../Modelo/usuario.model';
import { SesionService } from '../core/sesion.service';
import { ApiService } from '../core/api.service';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  usuario: Usuario = { correo: '', password: '', rol: '' };
  error = '';
  mostrarPassword = false;
  errores = { correo: '', password: '' };

  constructor(
    private usuarioService: UsuarioService,
    private sesion: SesionService,
    private router: Router,
    private route: ActivatedRoute,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    if (this.route.snapshot.queryParams['expirada']) {
      this.error = 'Tu sesión expiró. Inicia sesión de nuevo.';
    }
    this.initGoogle();
  }

  // =========================
  // GOOGLE
  // =========================

  private initGoogle(): void {
    let intentos = 0;
    const esperar = () => {
      if (typeof google !== 'undefined' && google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: '613651963678-99u5b1boql9q6fj65l0kairjh8ptdk4h.apps.googleusercontent.com',
          callback: (response: any) => this.zone.run(() => this.handleGoogleResponse(response))
        });
        google.accounts.id.renderButton(document.getElementById('google-btn'), {
          theme: 'outline', size: 'large', width: '100', text: 'signin_with'
        });
      } else if (intentos++ < 40) {
        setTimeout(esperar, 300);
      }
    };
    esperar();
  }

  /** Solo se envía el id_token: el backend lo verifica con Google y saca de ahí el correo. */
  handleGoogleResponse(response: any): void {
    this.error = '';
    this.usuarioService.loginGoogle({ token: response.credential }).subscribe({
      next: (res: any) => this.handleLoginExitoso(res),
      error: (err: any) => this.error = ApiService.mensaje(err, 'Error al iniciar sesión con Google')
    });
  }

  // =========================
  // CORREO Y CONTRASEÑA
  // =========================

  validarCampos(): boolean {
    this.errores = { correo: '', password: '' };
    let valido = true;
    if (!this.usuario.correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.usuario.correo)) {
      this.errores.correo = 'Ingresa un correo válido';
      valido = false;
    }
    if (!this.usuario.password) {
      this.errores.password = 'Ingresa tu contraseña';
      valido = false;
    }
    return valido;
  }

  onLogin(): void {
    if (!this.validarCampos()) return;
    this.error = '';
    this.usuarioService.login({ correo: this.usuario.correo.trim(), password: this.usuario.password })
      .subscribe({
        next: (res: any) => this.handleLoginExitoso(res),
        error: (err: any) => {
          if (err.status === 0) {
            this.error = 'No hay conexión con el servidor. Intenta de nuevo.';
          } else {
            // 401: correo o clave incorrectos · 403: cuenta en revisión, rechazada o bloqueada
            this.error = ApiService.mensaje(err, 'Error al iniciar sesión. Intenta de nuevo.');
          }
        }
      });
  }

  private handleLoginExitoso(res: any): void {
    this.sesion.guardar(res, this.usuario.correo);
    this.router.navigate([this.sesion.rutaInicio()]);
  }
}
