import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';

import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';
import { AuthLayoutComponent, EtiquetaAuth } from '../../shared/auth-layout/auth-layout';

@Component({
  selector: 'app-registro-admin',
  standalone: true,
  imports: [FormsModule, RouterModule, AuthLayoutComponent],
  templateUrl: './registro-admin.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./registro-admin.css'],
})
export class RegistroAdminComponent implements OnInit {
  /** Solo en modo desarrollo (SMS_CONSOLA=true en el backend): el código de administrador para registrarse. */
  codigoDesarrollo: string | null = null;
  datos = {
    nombre: '',
    correo: '',
    password: '',
    codigoAdmin: '',
    rol: 'admin',
  };
  confirmar = '';
  error = '';
  exito = '';
  cargando = false;
  mostrarPassword = false;
  mostrarConfirmar = false;

  /** Lo que hace un administrador (se muestra al lado izquierdo de la pantalla). */
  readonly etiquetasAdmin: EtiquetaAuth[] = [
    { texto: 'Validar conductores', color: '#02AAB4' },
    { texto: 'Supervisar solicitudes', color: '#FE7B13' },
    { texto: 'Gestionar tarifas', color: '#FFC93C' },
    { texto: 'Reportes', color: '#5FD3D9' },
  ];

  constructor(
    private usuarioService: UsuarioService,
    private router: Router,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    this.api
      .get<{ codigoDesarrollo?: string }>('/auth/registro-admin/pista')
      .then((r) => (this.codigoDesarrollo = r?.codigoDesarrollo || null))
      .catch(() => undefined); // backend sin modo desarrollo o sin conexión: no se muestra nada
  }

  registrar() {
    this.error = '';

    if (
      !this.datos.nombre ||
      !this.datos.correo ||
      !this.datos.password ||
      !this.datos.codigoAdmin
    ) {
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
      },
    });
  }
}
