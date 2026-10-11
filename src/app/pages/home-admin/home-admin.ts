import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-home-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home-admin.html',
  styleUrls: ['./home-admin.css']
})
export class HomeAdminComponent implements OnInit {

  // NAV
  nombre = '';
  foto = '';
  notificaciones = 0;

  // SECCIONES
  seccionActiva = 'dashboard';

  // CONDUCTORES
  conductores: any[] = [];
  filtroConductor = 'todos';
  conductorSeleccionado: any = null;
  mostrarModal = false;
  motivoRechazo = '';
  procesandoConductor = false;

  // MODAL DE DETALLE / DOCUMENTOS
  mostrarModalDocumentos = false;
  conductorDetalle: any = null;
  cargandoDetalle = false;

  // USUARIOS
  usuarios: any[] = [];
  cargandoUsuarios = false;
  errorUsuarios = '';

  // SERVICIOS
  servicios: any[] = [];

  // STATS DASHBOARD
  totalUsuarios = 0;
  totalConductores = 0;
  totalServicios = 0;
  totalGanancias = 0;
  conductoresPendientes = 0;

  // STATS REPORTES
  transportesMes = 0;
  domiciliosMes = 0;
  encomiendaMes = 0;
  calificacionPromedio = 0;
  porcentajeTransporte = 0;
  porcentajeDomicilio = 0;
  porcentajeEncomienda = 0;

  cargando = true;

  /** URLs locales (blob:) de los documentos: se descargan con el token del admin. */
  docUrls: Record<string, string> = {};
  docTipos: Record<string, string> = {};

  constructor(private router: Router, private usuarioService: UsuarioService, private api: ApiService) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Admin';
    this.foto = localStorage.getItem('foto') || '';
    this.cargarDatos();
    this.cargarUsuarios();
    this.cargarServicios();
  }

  // ─── CONDUCTORES ───────────────────────────────
  cargarDatos() {
    this.cargando = true;
    this.api.get<any[]>('/transporte/admin/conductores')
      .then(data => {
        this.conductores = data;
        this.totalConductores = data.filter((c: any) => c.estado === 'aprobado').length;
        this.conductoresPendientes = data.filter((c: any) => c.estado === 'pendiente').length;
        this.cargando = false;
      })
      .catch(err => {
        console.error('Error:', err);
        this.cargando = false;
      });
  }

  conductoresFiltrados(): any[] {
    if (this.filtroConductor === 'todos') return this.conductores;
    return this.conductores.filter(c => c.estado === this.filtroConductor);
  }

  aprobarConductor(c: any) { this.cambiarEstado(c.conductor_id, 'aprobado'); }
  rechazarConductor(c: any) { this.conductorSeleccionado = c; this.mostrarModal = true; }
  bloquearConductor(c: any) { this.cambiarEstado(c.conductor_id, 'suspendido'); }

  verDocumentos(c: any) {
    this.mostrarModalDocumentos = true;
    this.cargandoDetalle = true;
    this.conductorDetalle = null;

    this.liberarDocumentos();

    this.api.get(`/transporte/admin/conductor/${c.conductor_id}/detalle`)
      .then((data: any) => {
        this.conductorDetalle = data;
        this.cargandoDetalle = false;
        for (const campo of ['licencia', 'soat', 'tarjeta_propiedad', 'cedula']) {
          if (data[campo]) this.cargarDocumento(campo, data[campo]);
        }
      })
      .catch(err => {
        console.error('Error cargando detalle del conductor:', err);
        this.cargandoDetalle = false;
      });
  }

  cerrarModalDocumentos() {
    this.mostrarModalDocumentos = false;
    this.conductorDetalle = null;
    this.liberarDocumentos();
  }

  /**
   * Los documentos ya no se abren con un enlace directo al backend: exigen el JWT del admin.
   * Se descargan como Blob y se muestran con una URL local; el servidor valida el tipo real
   * del archivo, así que un HTML disfrazado nunca se ejecuta en el dominio de MoviFY.
   */
  private cargarDocumento(campo: string, nombreArchivo: string) {
    this.api.blob(`/conductor/documento/${encodeURIComponent(nombreArchivo)}`)
      .then(blob => {
        this.docTipos[campo] = blob.type;
        this.docUrls[campo] = URL.createObjectURL(blob);
      })
      .catch(() => { this.docUrls[campo] = ''; });
  }

  private liberarDocumentos() {
    Object.values(this.docUrls).forEach(u => u && URL.revokeObjectURL(u));
    this.docUrls = {};
    this.docTipos = {};
  }

  esImagen(campo: string): boolean {
    return (this.docTipos[campo] || '').startsWith('image/');
  }

  abrirDocumento(campo: string) {
    const url = this.docUrls[campo];
    if (url) window.open(url, '_blank', 'noopener');
  }

  aprobarDesdeModal(c: any) {
    this.aprobarConductor(c);
    this.cerrarModalDocumentos();
  }

  rechazarDesdeModal(c: any) {
    this.cerrarModalDocumentos();
    this.rechazarConductor(c);
  }

  async cambiarEstado(conductorId: number, nuevoEstado: string) {
    if (nuevoEstado === 'rechazado' && !this.motivoRechazo) {
      alert('Por favor ingrese un motivo de rechazo.');
      return;
    }

    if (this.procesandoConductor) return;
    this.procesandoConductor = true;
    try {
      await this.api.patch(`/transporte/admin/conductor/${conductorId}/estado`, {
        estado: nuevoEstado,
        motivo_rechazo: nuevoEstado === 'rechazado' ? this.motivoRechazo : ''
      });
      alert(`Conductor ${nuevoEstado} con éxito.`);
      this.cerrarModal();
      this.cargarDatos();
    } catch (err) {
      alert(ApiService.mensaje(err, 'No se pudo actualizar el conductor.'));
    } finally {
      this.procesandoConductor = false;
    }
  }

  // ─── USUARIOS ──────────────────────────────────
  cargarUsuarios() {
    this.cargandoUsuarios = true;
    this.errorUsuarios = '';
    this.usuarioService.obtenerTodos().subscribe({
      next: (data: any[]) => {
        this.usuarios = data;
        this.totalUsuarios = data.length;
        this.cargandoUsuarios = false;
      },
      error: (err: any) => {
        console.error('Error cargando usuarios:', err);
        this.errorUsuarios = 'No se pudieron cargar los usuarios.';
        this.cargandoUsuarios = false;
      }
    });
  }

  cargarServicios() {
    this.api.get<any[]>('/transporte/admin/servicios')
      .then((data: any[]) => {
        this.servicios = data.map(s => ({
          icono: s.tipo === 'TRANSPORTE' ? '🏍️' : s.tipo === 'DOMICILIO' ? '🛵' : '📦',
          tipo: s.tipo,
          destino: s.destino_direccion || `${s.destino_lat?.toFixed(4)}, ${s.destino_lng?.toFixed(4)}`,
          conductor: s.conductor_nombre || 'Sin asignar',
          cliente: s.usuario_nombre || 'Desconocido',
          precio: s.tarifa || 0,
          estado: s.estado?.toLowerCase() || 'pendiente'
        }));

        // Stats para reportes
        const hoy = new Date();
        const mesActual = data.filter(s => new Date(s.fecha_solicitud).getMonth() === hoy.getMonth());
        this.totalServicios = data.filter(s => new Date(s.fecha_solicitud).toDateString() === hoy.toDateString()).length;
        this.totalGanancias = data.filter(s => s.estado === 'FINALIZADO').reduce((acc, s) => acc + (s.tarifa || 0), 0);
        this.transportesMes = mesActual.filter(s => s.tipo === 'TRANSPORTE').length;
        this.domiciliosMes = mesActual.filter(s => s.tipo === 'DOMICILIO').length;
        this.encomiendaMes = mesActual.filter(s => s.tipo === 'ENCOMIENDA').length;

        const total = this.transportesMes + this.domiciliosMes + this.encomiendaMes || 1;
        this.porcentajeTransporte = Math.round((this.transportesMes / total) * 100);
        this.porcentajeDomicilio = Math.round((this.domiciliosMes / total) * 100);
        this.porcentajeEncomienda = Math.round((this.encomiendaMes / total) * 100);
      })
      .catch(err => console.error('Error cargando servicios:', err));
  }

  bloquearUsuario(u: any) {
    if (confirm(`¿Estás seguro de bloquear al usuario ${u.nombre}?`)) {
      this.cambiarEstadoUsuario(u.id, 'bloqueado');
    }
  }

  activarUsuario(u: any) {
    this.cambiarEstadoUsuario(u.id, 'activo');
  }

  private async cambiarEstadoUsuario(id: number, nuevoEstado: string) {
    try {
      await this.api.patch(`/auth/usuarios/${id}/estado`, { estado: nuevoEstado });
      const user = this.usuarios.find(user => user.id === id);
      if (user) user.estado = nuevoEstado;
      alert(`Usuario actualizado a: ${nuevoEstado}`);
    } catch (err) {
      alert('Error: ' + ApiService.mensaje(err, 'No se pudo actualizar'));
    }
  }

  // ─── SESIÓN ────────────────────────────────────
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.conductorSeleccionado = null;
    this.motivoRechazo = '';
  }

  getEstadoClass(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'aprobado': return 'status-approved';
      case 'rechazado': return 'status-rejected';
      case 'suspendido': return 'status-suspended';
      default: return 'status-pending';
    }
  }

  getFriendlyDate(fecha: string): string {
    if (!fecha) return 'Pendiente';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }
}