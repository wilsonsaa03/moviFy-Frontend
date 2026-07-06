import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';
import { environment } from '../../../environments/environment';

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

  constructor(private router: Router, private usuarioService: UsuarioService) {}

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
    fetch(`${environment.apiUrl}/transporte/admin/conductores`)
      .then(res => res.json())
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

    fetch(`${environment.apiUrl}/transporte/admin/conductor/${c.conductor_id}/detalle`)
      .then(res => res.json())
      .then(data => {
        this.conductorDetalle = data;
        this.cargandoDetalle = false;
      })
      .catch(err => {
        console.error('Error cargando detalle del conductor:', err);
        this.cargandoDetalle = false;
      });
  }

  cerrarModalDocumentos() {
    this.mostrarModalDocumentos = false;
    this.conductorDetalle = null;
  }

  urlDocumento(nombreArchivo: string): string {
    if (!nombreArchivo) return '';
    return `${environment.apiUrl}/conductor/documento/${nombreArchivo}`;
  }

  esImagen(nombreArchivo: string): boolean {
    if (!nombreArchivo) return false;
    const ext = nombreArchivo.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '');
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
    const adminId = localStorage.getItem('id') || '0';
    try {
      const resp = await fetch(`${environment.apiUrl}/transporte/admin/conductor/${conductorId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: nuevoEstado,
          motivo_rechazo: nuevoEstado === 'rechazado' ? this.motivoRechazo : '',
          admin_id: adminId
        })
      });
      if (resp.ok) {
        alert(`Conductor ${nuevoEstado} con éxito.`);
        this.cerrarModal();
        this.cargarDatos();
      }
    } catch (err) {
      console.error('Error al actualizar:', err);
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
    fetch(`${environment.apiUrl}/transporte/admin/servicios`)
      .then(res => res.json())
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
      const resp = await fetch(`${environment.apiUrl}/auth/usuarios/${id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });

      if (resp.ok) {
        // Actualizamos localmente para no recargar todo
        const user = this.usuarios.find(user => user.id === id);
        if (user) user.estado = nuevoEstado;
        
        alert(`Usuario actualizado a: ${nuevoEstado}`);
      } else {
        const err = await resp.json();
        alert('Error: ' + (err.error || 'No se pudo actualizar'));
      }
    } catch (err) {
      console.error('Error:', err);
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