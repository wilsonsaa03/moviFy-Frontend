import {
  Component,
  ElementRef,
  NgZone,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { UsuarioService } from '../Base_de_datos/usuario.service';
import { Usuario } from '../Modelo/usuario.model';
import { SesionService } from '../core/sesion.service';
import { ApiService } from '../core/api.service';
import { AuthLayoutComponent } from '../shared/auth-layout/auth-layout';
import { cargarGoogleLogin } from '../core/cargar-script';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule, AuthLayoutComponent],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  usuario: Usuario = { correo: '', password: '', rol: '' };
  error = '';
  mostrarPassword = false;
  errores = { correo: '', password: '' };
  /** Evita enviar el formulario dos veces mientras el servidor responde. */
  cargando = false;

  /** Paso 2 del equipo (admin/soporte): el backend pide el código que mandó por SMS o correo. */
  desafio: string | null = null;
  canal: 'sms' | 'correo' = 'sms';
  destino = '';
  codigo = '';
  errorCodigo = '';
  /** Solo en modo desarrollo (SMS_CONSOLA=true en el backend): el código viene en la respuesta. */
  codigoDesarrollo: string | null = null;
  @ViewChild('campoCodigo') campoCodigo?: ElementRef<HTMLInputElement>;

  constructor(
    private usuarioService: UsuarioService,
    private sesion: SesionService,
    private router: Router,
    private route: ActivatedRoute,
    private zone: NgZone,
    private api: ApiService,
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

  /** El script de Google se descarga solo aquí (antes iba en index.html y cargaba en todas las páginas). */
  private initGoogle(): void {
    cargarGoogleLogin()
      .then(() => {
        if (typeof google === 'undefined' || !google?.accounts?.id) return;
        google.accounts.id.initialize({
          client_id: '613651963678-99u5b1boql9q6fj65l0kairjh8ptdk4h.apps.googleusercontent.com',
          callback: (response: any) => this.zone.run(() => this.handleGoogleResponse(response)),
        });
        google.accounts.id.renderButton(document.getElementById('google-btn'), {
          theme: 'outline',
          size: 'large',
          width: '100',
          text: 'signin_with',
        });
      })
      .catch(() => undefined); // sin internet hacia Google: queda el login con correo
  }

  /** Solo se envía el id_token: el backend lo verifica con Google y saca de ahí el correo. */
  handleGoogleResponse(response: any): void {
    this.error = '';
    this.usuarioService.loginGoogle({ token: response.credential }).subscribe({
      next: (res: any) => this.handleLoginExitoso(res),
      error: (err: any) =>
        (this.error = ApiService.mensaje(err, 'Error al iniciar sesión con Google')),
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
    if (this.cargando || !this.validarCampos()) return;
    this.error = '';
    this.cargando = true;
    this.usuarioService
      .login({ correo: this.usuario.correo.trim(), password: this.usuario.password })
      .subscribe({
        next: (res: any) => this.handleLoginExitoso(res),
        error: (err: any) => {
          this.cargando = false;
          if (err.status === 0) {
            this.error = 'No hay conexión con el servidor. Intenta de nuevo.';
          } else {
            // 401: correo o clave incorrectos · 403: cuenta en revisión, rechazada o bloqueada
            this.error = ApiService.mensaje(err, 'Error al iniciar sesión. Intenta de nuevo.');
          }
        },
      });
  }

  // =========================
  // SEGUNDO FACTOR (admin y soporte)
  // =========================

  soloNumeros(v: string): string {
    return (v || '').replace(/\D/g, '').slice(0, 6);
  }

  verificarCodigo(): void {
    if (this.cargando || !this.desafio) return;
    this.errorCodigo = '';
    if (!/^\d{6}$/.test(this.codigo)) {
      this.errorCodigo = 'El código tiene 6 números.';
      return;
    }
    this.cargando = true;
    this.api
      .post('/auth/login-verificar', { desafio: this.desafio, codigo: this.codigo })
      .then((res) => this.handleLoginExitoso(res))
      .catch((err) => {
        this.cargando = false;
        this.codigo = '';
        // 401: el desafío venció o ya se usó → hay que volver a poner la contraseña
        if (err?.status === 401 || err?.status === 429) {
          this.volverAlInicio();
          this.error = ApiService.mensaje(err, 'Vuelve a iniciar sesión.');
        } else {
          this.errorCodigo = ApiService.mensaje(err, 'Ese código no es correcto.');
        }
      });
  }

  volverAlInicio(evento?: Event): void {
    evento?.preventDefault();
    this.desafio = null;
    this.codigo = '';
    this.errorCodigo = '';
    this.codigoDesarrollo = null;
    this.usuario.password = '';
  }

  private handleLoginExitoso(res: any): void {
    this.cargando = false;
    if (res?.segundoFactor) {
      this.desafio = res.desafio;
      this.canal = res.canal === 'correo' ? 'correo' : 'sms';
      this.destino = res.destino || '';
      this.codigoDesarrollo = res.codigoDesarrollo || null;
      this.codigo = '';
      setTimeout(() => this.campoCodigo?.nativeElement.focus());
      return;
    }
    this.sesion.guardar(res, this.usuario.correo);
    this.router.navigate([this.sesion.rutaInicio()]);
  }
}
