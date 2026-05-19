import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';

@Component({
  selector: 'app-registro-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './registro-conductor.html',
  styleUrl: './registro-conductor.css'
})
export class RegistroConductor {

  datos = {
    nombre: '',
    correo: '',
    password: '',
    telefono: '',
    rol: 'conductor'
  };

  confirmar        = '';
  placa            = '';
  modelo           = '';
  error            = '';
  exito            = '';
  cargando         = false;
  mostrarPassword  = false;
  mostrarConfirmar = false;

  // ── ERRORES DE CAMPOS ─────────────────────────────
  errores = {
    nombre:    '',
    correo:    '',
    password:  '',
    confirmar: '',
    telefono:  '',
    placa:     '',
    modelo:    ''
  };

  // ── DOCUMENTOS ────────────────────────────────────
  archivoLicencia: File | null = null;
  archivoSoat:     File | null = null;
  archivoTarjeta:  File | null = null;
  archivoCedula:   File | null = null;

  errorLicencia = '';
  errorSoat     = '';
  errorTarjeta  = '';
  errorCedula   = '';

  readonly TIPOS_VALIDOS = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf'
  ];

  readonly TAMANO_MAX_MB = 5;

  constructor(
    private usuarioService: UsuarioService,
    private router: Router
  ) {}

  // =========================
  // VALIDAR CAMPOS
  // =========================

  private validarCampos(): boolean {

    this.errores = {
      nombre: '',
      correo: '',
      password: '',
      confirmar: '',
      telefono: '',
      placa: '',
      modelo: ''
    };

    let valido = true;

    // NOMBRE
    if (!this.datos.nombre.trim()) {

      this.errores.nombre =
        'El nombre es obligatorio';

      valido = false;

    } else if (this.datos.nombre.trim().length < 3) {

      this.errores.nombre =
        'El nombre debe tener mínimo 3 caracteres';

      valido = false;
    }

    // CORREO
    const regexCorreo =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!this.datos.correo) {

      this.errores.correo =
        'El correo es obligatorio';

      valido = false;

    } else if (!regexCorreo.test(this.datos.correo)) {

      this.errores.correo =
        'Ingresa un correo válido';

      valido = false;
    }

    // TELÉFONO
    const regexTelefono =
      /^[0-9]{10,}$/;

    if (!this.datos.telefono) {

      this.errores.telefono =
        'El teléfono es obligatorio';

      valido = false;

    } else if (!regexTelefono.test(this.datos.telefono)) {

      this.errores.telefono =
        'El teléfono debe tener mínimo 10 dígitos y solo números';

      valido = false;
    }

    // PASSWORD
    if (!this.datos.password) {

      this.errores.password =
        'La contraseña es obligatoria';

      valido = false;

    } else if (this.datos.password.length < 6) {

      this.errores.password =
        'La contraseña debe tener mínimo 6 caracteres';

      valido = false;
    }

    // CONFIRMAR
    if (!this.confirmar) {

      this.errores.confirmar =
        'Confirma tu contraseña';

      valido = false;

    } else if (this.datos.password !== this.confirmar) {

      this.errores.confirmar =
        'Las contraseñas no coinciden';

      valido = false;
    }

    // PLACA
    const regexPlaca =
      /^[A-Za-z]{3}[0-9]{2}[A-Za-z]$/;

    if (!this.placa) {

      this.errores.placa =
        'La placa es obligatoria';

      valido = false;

    } else if (!regexPlaca.test(this.placa)) {

      this.errores.placa =
        'Formato inválido. Ej: ABC12D';

      valido = false;
    }

    // MODELO
    if (!this.modelo.trim()) {

      this.errores.modelo =
        'El modelo es obligatorio';

      valido = false;
    }

    return valido;
  }

  // =========================
  // VALIDAR DOCUMENTOS
  // =========================

  private validarDocumentos(): boolean {

    let valido = true;

    if (!this.archivoLicencia) {

      this.errorLicencia =
        'La licencia de conducción es obligatoria';

      valido = false;
    }

    if (!this.archivoSoat) {

      this.errorSoat =
        'El SOAT es obligatorio';

      valido = false;
    }

    if (!this.archivoTarjeta) {

      this.errorTarjeta =
        'La tarjeta de propiedad es obligatoria';

      valido = false;
    }

    if (!this.archivoCedula) {

      this.errorCedula =
        'La cédula es obligatoria';

      valido = false;
    }

    return valido;
  }

  // =========================
  // VALIDAR ARCHIVOS
  // =========================

  validarArchivo(
    archivo: File,
    campo: 'licencia' | 'soat' | 'tarjeta' | 'cedula'
  ): boolean {

    const maxBytes =
      this.TAMANO_MAX_MB * 1024 * 1024;

    if (!this.TIPOS_VALIDOS.includes(archivo.type)) {

      this.asignarError(
        campo,
        'Solo se permiten archivos JPG, PNG o PDF'
      );

      return false;
    }

    if (archivo.size > maxBytes) {

      this.asignarError(
        campo,
        `El archivo no puede superar ${this.TAMANO_MAX_MB}MB`
      );

      return false;
    }

    this.asignarError(campo, '');

    return true;
  }

  private asignarError(
    campo: string,
    msg: string
  ): void {

    if (campo === 'licencia')
      this.errorLicencia = msg;

    if (campo === 'soat')
      this.errorSoat = msg;

    if (campo === 'tarjeta')
      this.errorTarjeta = msg;

    if (campo === 'cedula')
      this.errorCedula = msg;
  }

  // =========================
  // SELECCIONAR ARCHIVOS
  // =========================

  seleccionarLicencia(event: any): void {

    const archivo = event.target.files[0];

    if (!archivo) return;

    if (this.validarArchivo(archivo, 'licencia')) {

      this.archivoLicencia = archivo;

    } else {

      this.archivoLicencia = null;
      event.target.value = '';
    }
  }

  seleccionarSoat(event: any): void {

    const archivo = event.target.files[0];

    if (!archivo) return;

    if (this.validarArchivo(archivo, 'soat')) {

      this.archivoSoat = archivo;

    } else {

      this.archivoSoat = null;
      event.target.value = '';
    }
  }

  seleccionarTarjeta(event: any): void {

    const archivo = event.target.files[0];

    if (!archivo) return;

    if (this.validarArchivo(archivo, 'tarjeta')) {

      this.archivoTarjeta = archivo;

    } else {

      this.archivoTarjeta = null;
      event.target.value = '';
    }
  }

  seleccionarCedula(event: any): void {

    const archivo = event.target.files[0];

    if (!archivo) return;

    if (this.validarArchivo(archivo, 'cedula')) {

      this.archivoCedula = archivo;

    } else {

      this.archivoCedula = null;
      event.target.value = '';
    }
  }

  // =========================
  // NOMBRE CORTO
  // =========================

  nombreArchivo(
    archivo: File | null
  ): string {

    if (!archivo) return '';

    return archivo.name.length > 28
      ? archivo.name.substring(0, 25) + '...'
      : archivo.name;
  }

  // =========================
  // REGISTRAR
  // =========================

  registrar(): void {

    this.error = '';

    const camposValidos =
      this.validarCampos();

    const documentosValidos =
      this.validarDocumentos();

    if (!camposValidos || !documentosValidos)
      return;

    const form = new FormData();

    // DATOS USUARIO
    form.append(
      'nombre',
      this.datos.nombre
    );

    form.append(
      'correo',
      this.datos.correo
    );

    form.append(
      'password',
      this.datos.password
    );

    form.append(
      'telefono',
      this.datos.telefono
    );

    // VEHÍCULO
    form.append(
      'placa',
      this.placa.toUpperCase()
    );

    form.append(
      'modelo',
      this.modelo
    );

    // DOCUMENTOS
    form.append(
      'licencia',
      this.archivoLicencia!
    );

    form.append(
      'soat',
      this.archivoSoat!
    );

    // ESTE ERA EL ERROR
    form.append(
      'tarjetaPropiedad',
      this.archivoTarjeta!
    );

    form.append(
      'cedula',
      this.archivoCedula!
    );

    this.cargando = true;

    this.usuarioService
      .registroConductor(form)
      .subscribe({

        next: (res: any) => {

          this.cargando = false;

          this.exito =
            '¡Registro exitoso! Tu cuenta está en revisión.';

          localStorage.setItem(
            'token',
            res.token
          );

          localStorage.setItem(
            'rol',
            res.rol
          );

          localStorage.setItem(
            'nombre',
            res.nombre
          );

          setTimeout(() => {

            this.router.navigate([
              '/conductor'
            ]);

          }, 2000);

        },

        error: (err: any) => {

          this.cargando = false;

          console.error(err);

          this.error =
            err.error?.error ||
            'Error al registrar';

        }

      });

  }

}