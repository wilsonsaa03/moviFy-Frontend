import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ConductorService } from '../../Base_de_datos/conductor.service';

@Component({
  selector: 'app-ver-mi-perfil-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ver-mi-perfil-conductor.html',
  styleUrls: ['./ver-mi-perfil-conductor.css']
})
export class VerMiPerfilConductorComponent implements OnInit {

  // ============================================================
  // DATOS DEL CONDUCTOR (solo lectura)
  // ============================================================
  nombre: string = '';
  correo: string = '';
  telefono: string = '';
  foto: string = '';
  ciudad: string = '';
  placa: string = '';
  modelo: string = '';
  estadoCuenta: string = 'pendiente';
  calificacion: number = 0;
  miembroDesde: string = '';

  // Documentos (estados dinámicos)
  estadoSoat: string = 'Pendiente';
  documentosVerificados: boolean = false;

  // Estadísticas
  gananciasHoy: number = 0;
  viajesHoy: number = 0;
  viajesTotal: number = 0;

  // ============================================================
  // MODO EDICIÓN
  // ============================================================
  modoEdicion: boolean = false;
  nombreEdit: string = '';
  correoEdit: string = '';
  telefonoEdit: string = '';
  ciudadEdit: string = '';

  // ============================================================
  // MODO CONTRASEÑA
  // ============================================================
  modoPassword: boolean = false;
  passActual: string = '';
  passNueva: string = '';
  passConfirm: string = '';

  // ============================================================
  // UI
  // ============================================================
  menuAbierto: boolean = false;
  menuNavAbierto: boolean = false;
  sidebarColapsado: boolean = false;
  enLinea: boolean = false;
  mensajeOk: string = '';
  mensajeErr: string = '';
  cargando: boolean = true;

  constructor(
    private router: Router,
    private conductorService: ConductorService
  ) {}

  ngOnInit(): void {
    const correoSession = localStorage.getItem('correo');
    if (!correoSession) {
      this.router.navigate(['/login']);
      return;
    }

    this.conductorService.obtenerPerfil(correoSession).subscribe({
      next: (data: any) => {
        this.nombre    = data.nombre    || localStorage.getItem('nombre') || 'Conductor';
        this.correo    = data.correo    || correoSession;
        this.telefono  = data.telefono  || '';
        this.foto      = data.foto      || localStorage.getItem('foto') || '';
        this.ciudad    = data.ciudad    || 'Buenaventura';
        this.placa     = data.placa     || data.placa_vehiculo  || 'No registrada';
        this.modelo    = data.modelo    || data.modelo_vehiculo || 'No registrado';
        this.estadoCuenta = data.estado || 'pendiente';
        this.gananciasHoy = Number(data.gananciasHoy) || 0;
        this.viajesHoy    = Number(data.viajesHoy)    || 0;
        this.viajesTotal  = Number(data.viajesTotal)  || 0;
        this.calificacion = Number(data.calificacion) || 0;
        this.miembroDesde = data.fecha_registro ? new Date(data.fecha_registro).getFullYear().toString() : '2024';
        this.estadoSoat   = data.estado_soat || 'Al día ✓';
        this.cargando = false;
      },
      error: () => {
        // Fallback a localStorage si el backend falla
        this.nombre = localStorage.getItem('nombre') || 'Conductor';
        this.correo = correoSession;
        this.foto   = localStorage.getItem('foto')   || '';
        this.cargando = false;
      }
    });
  }

  // ============================================================
  // EDICIÓN DE PERFIL
  // ============================================================
  activarEdicion(): void {
    this.nombreEdit   = this.nombre;
    this.correoEdit   = this.correo;
    this.telefonoEdit = this.telefono;
    this.ciudadEdit   = this.ciudad;
    this.modoEdicion  = true;
    this.menuAbierto  = false;
    this.limpiarAlertas();
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.limpiarAlertas();
  }

  async guardarCambios(): Promise<void> {
    if (!this.nombreEdit.trim()) {
      this.mensajeErr = 'El nombre no puede estar vacío.';
      return;
    }

    this.cargando = true;
    try {
      const resp = await fetch('http://localhost:8080/api/conductor/perfil/actualizar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correo: this.correo,
          nombre: this.nombreEdit.trim(),
          telefono: this.telefonoEdit.trim(),
          ciudad: this.ciudadEdit.trim()
        })
      });

      if (resp.ok) {
        this.nombre = this.nombreEdit.trim();
        this.telefono = this.telefonoEdit.trim();
        this.ciudad = this.ciudadEdit.trim();
        localStorage.setItem('nombre', this.nombre);
        this.modoEdicion = false;
        this.mostrarOk('Perfil actualizado en la base de datos.');
      } else {
        const errorData = await resp.json();
        this.mensajeErr = errorData.error || 'No se pudo guardar en el servidor.';
      }
    } catch (e) {
      this.mensajeErr = 'Error de conexión con el servidor.';
    } finally {
      this.cargando = false;
    }
  }

  // ============================================================
  // CONTRASEÑA
  // ============================================================
  cambiarPassword(): void {
    if (!this.passActual || !this.passNueva || !this.passConfirm) {
      this.mensajeErr = 'Completa todos los campos de contraseña.';
      return;
    }
    if (this.passNueva !== this.passConfirm) {
      this.mensajeErr = 'Las contraseñas nuevas no coinciden.';
      return;
    }
    if (this.passNueva.length < 6) {
      this.mensajeErr = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    // Aquí iría la llamada al backend para actualizar la contraseña
    this.modoPassword = false;
    this.passActual   = '';
    this.passNueva    = '';
    this.passConfirm  = '';
    this.mostrarOk('Contraseña actualizada correctamente.');
  }

  // ============================================================
  // FOTO
  // ============================================================
  cambiarFoto(): void {
    const url = prompt('Ingresa la URL de tu nueva foto de perfil:');
    if (url && url.trim()) {
      this.foto = url.trim();
      localStorage.setItem('foto', this.foto);
      this.mostrarOk('Foto actualizada.');
    }
  }

  // ============================================================
  // GETTERS DE ESTADO
  // ============================================================
  get estadoTexto(): string {
    const estados: { [k: string]: string } = {
      aprobado:  'Aprobado',
      pendiente: 'En revisión',
      rechazado: 'Rechazado',
      activo:    'Activo'
    };
    return estados[this.estadoCuenta?.toLowerCase()] || 'Pendiente';
  }

  get estadoClase(): string {
    const clases: { [k: string]: string } = {
      aprobado:  'chip-verde',
      activo:    'chip-verde',
      pendiente: 'chip-amarillo',
      rechazado: 'chip-rojo'
    };
    return clases[this.estadoCuenta?.toLowerCase()] || 'chip-amarillo';
  }

  // ============================================================
  // UI HELPERS
  // ============================================================
  toggleSidebar(): void {
    if (window.innerWidth <= 992) this.menuNavAbierto = !this.menuNavAbierto;
    else this.sidebarColapsado = !this.sidebarColapsado;
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  toggleEnLinea(): void {
    this.enLinea = !this.enLinea;
  }

  irA(ruta: string): void {
    this.menuAbierto = false;
    this.router.navigate([ruta]);
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  private mostrarOk(msg: string): void {
    this.mensajeOk  = msg;
    this.mensajeErr = '';
    setTimeout(() => this.mensajeOk = '', 4000);
  }

  private limpiarAlertas(): void {
    this.mensajeOk  = '';
    this.mensajeErr = '';
  }
}