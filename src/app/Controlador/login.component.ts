import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { UsuarioService } from '../Base_de_datos/usuario.service';
import { AdminEmailDirective } from '../Directivas/admin-email.directive';
import { Usuario } from '../Modelo/usuario.model';

declare const google: any;
declare const FB: any;

@Component({
  selector: 'app-login',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdminEmailDirective
  ],

  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})

export class LoginComponent implements OnInit {

  usuario: Usuario = {
    correo: '',
    password: '',
    rol: ''
  };

  error = '';

  mostrarPassword = false;

  errores = {
    correo: '',
    password: ''
  };

  constructor(
    private usuarioService: UsuarioService,
    private router: Router
  ) {}

  ngOnInit(): void {

    this.initGoogle();

    this.initFacebook();

  }

  // =========================
  // GOOGLE LOGIN
  // =========================

  private initGoogle(): void {

    const waitForGoogle = () => {

      if (
        typeof google !== 'undefined' &&
        google?.accounts?.id
      ) {

        google.accounts.id.initialize({

          client_id:
            '613651963678-99u5b1boql9q6fj65l0kairjh8ptdk4h.apps.googleusercontent.com',

          callback: (response: any) =>
            this.handleGoogleResponse(response)

        });

        google.accounts.id.renderButton(
          document.getElementById('google-btn'),
          {
            theme: 'outline',
            size: 'large',
            width: '100',
            text: 'signin_with'
          }
        );

      } else {

        setTimeout(waitForGoogle, 300);

      }
    };

    waitForGoogle();
  }

  handleGoogleResponse(response: any): void {

    const payload = JSON.parse(
      atob(response.credential.split('.')[1])
    );

    this.usuarioService.loginGoogle({

      nombre: payload.name,

      correo: payload.email,

      googleId: payload.sub,

      foto: payload.picture,

      token: response.credential

    }).subscribe({

      next: (res: any) => {

        this.handleLoginExitoso(res);

      },

      error: () => {

        this.error =
          'Error al iniciar sesión con Google';

      }

    });

  }

  // =========================
  // FACEBOOK LOGIN
  // =========================

  private initFacebook(): void {

    if (document.getElementById('facebook-jssdk')) {
      return;
    }

    const script = document.createElement('script');

    script.id = 'facebook-jssdk';

    script.src =
      'https://connect.facebook.net/es_LA/sdk.js';

    script.async = true;

    script.defer = true;

    document.body.appendChild(script);

    (window as any).fbAsyncInit = () => {

      FB.init({

        appId: '2001620540429850',

        cookie: true,

        xfbml: true,

        version: 'v19.0'

      });

    };

  }

  loginFacebook(): void {

    // VALIDAR HTTPS

    if (location.protocol !== 'https:') {

      this.error =
        'Facebook Login requiere HTTPS. Usa Google o inicia sesión normalmente en localhost.';

      return;
    }

    // VALIDAR SDK

    if (typeof FB === 'undefined') {

      this.error =
        'El servicio de Facebook no está disponible.';

      return;
    }

    FB.login(

      (loginResponse: any) => {

        if (loginResponse.authResponse) {

          FB.api(

            '/me',

            {
              fields: 'name,email,picture'
            },

            (userData: any) => {

              this.usuarioService.loginFacebook({

                nombre: userData.name,

                correo: userData.email || '',

                facebookId: userData.id,

                foto:
                  userData.picture?.data?.url || ''

              }).subscribe({

                next: (res: any) => {

                  this.handleLoginExitoso(res);

                },

                error: () => {

                  this.error =
                    'Error al iniciar sesión con Facebook';

                }

              });

            }

          );

        } else {

          this.error =
            'Inicio de sesión con Facebook cancelado';

        }

      },

      {
        scope: 'public_profile,email'
      }

    );

  }

  // =========================
  // LOGIN NORMAL
  // =========================

  validarCampos(): boolean {

    this.errores = {
      correo: '',
      password: ''
    };

    let valido = true;

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // VALIDAR CORREO

    if (
      !this.usuario.correo ||
      !emailRegex.test(this.usuario.correo)
    ) {

      this.errores.correo =
        'Ingresa un correo válido';

      valido = false;
    }

    // VALIDAR PASSWORD

    if (
      !this.usuario.password ||
      this.usuario.password.length < 6
    ) {

      this.errores.password =
        'La contraseña debe tener mínimo 6 caracteres';

      valido = false;
    }

    return valido;
  }

  onLogin(): void {

    if (!this.validarCampos()) {
      return;
    }

    this.error = '';

    this.usuarioService.login(this.usuario)
      .subscribe({

        next: (res: any) => {

          this.handleLoginExitoso(res);

        },

        error: (err: any) => {

          const msg =
            err.error?.error || '';

          if (msg.includes('no encontrado')) {

            this.errores.correo =
              'No existe una cuenta con este correo';

          } else if (msg.includes('incorrecta')) {

            this.errores.password =
              'Contraseña incorrecta';

          } else {

            this.error =
              'Error al iniciar sesión. Intenta de nuevo.';
          }

        }

      });

  }

  // =========================
  // LOGIN EXITOSO
  // =========================

  private handleLoginExitoso(res: any): void {
    const id = res.id?.toString()
             || res.user?.id?.toString()
             || res.usuario?.id?.toString()
             || res.userId?.toString()
             || '';

    localStorage.setItem('token',    res.token || '');
    localStorage.setItem('id',       id);
    localStorage.setItem('rol',      res.rol   || '');
    localStorage.setItem('nombre',   res.nombre || '');
    localStorage.setItem('foto',     res.foto   || '');
    localStorage.setItem('correo',   res.correo || this.usuario.correo || '');
    localStorage.setItem('telefono', res.telefono || '');

    // Navegar según rol (el backend usa 'cliente', no 'usuario')
    const rol = res.rol || '';
    if (rol === 'admin') {
      this.router.navigate(['/admin']);
    } else if (rol === 'conductor') {
      this.router.navigate(['/conductor']);
    } else {
      // cliente u otro rol van al home
      this.router.navigate(['/home-usuario']);
    }
  }
}