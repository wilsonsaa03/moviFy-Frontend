import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** Fila de GET /api/admin/usuarios/buscar (teléfono y correo parciales). */
interface UsuarioFila {
  id: number;
  nombre: string;
  telefono: string | null;
  correo: string | null;
  telefono_verificado: boolean;
  estado: 'activo' | 'bloqueado' | 'inactivo';
  motivo_bloqueo: string | null;
  calificacion_promedio: number | null;
  creado_en: string;
  ultimo_acceso: string | null;
  foto: string | null;
  roles: string;
  registrado_como: string | null;
  servicios_pedidos: number;
}

/** GET /api/admin/usuarios/{id}: el perfil completo. */
interface UsuarioDetalle extends Omit<UsuarioFila, 'servicios_pedidos'> {
  nombres: string;
  apellidos: string | null;
  total_calificaciones: number;
  es_conductor: boolean;
  actividad: { pedidos: number; finalizados: number; cancelados_por_el: number; pagado: number };
  servicios: { id: number; tipo_servicio: string; tipo_vehiculo: string; estado_codigo: string; estado_nombre: string; solicitado_en: string; tarifa: number; como: string; origen: string; destino: string }[];
  calificaciones: { servicio_id: number; puntuacion: number; comentario: string | null; creado_en: string; de: string }[];
  pqrs: { id: number; tipo: string; asunto: string; estado: string; creado_en: string }[];
  reportes_en_contra: { id: number; tipo: string; asunto: string; estado: string; creado_en: string; reporta: string }[];
  historial_estado: { accion: string; detalle: Record<string, unknown> | string | null; creado_en: string; por: string | null }[];
}

const ROLES = ['cliente', 'conductor', 'soporte', 'admin'];
const NOMBRE_ROL: Record<string, string> = { cliente: 'Cliente', conductor: 'Conductor', soporte: 'Soporte', admin: 'Admin', aspirante: 'Aspirante' };
const ESPERA_MS = 350;

/**
 * Clientes y usuarios: buscar (nombre, correo o celular), filtrar por rol y estado, ver el perfil con su actividad,
 * calificaciones, PQRS y reportes en su contra, y bloquear (siempre con motivo) o reactivar. Los datos personales
 * se ven parciales en la lista y completos solo al abrir el perfil. Aquí no se editan datos personales: eso lo
 * hace la propia persona desde su perfil.
 */
@Component({
  selector: 'app-admin-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-usuarios.html',
  styleUrls: ['../home-admin.css', './admin-usuarios.css'],
})
export class AdminUsuariosComponent implements OnInit {
  @Input() soloLectura = false;
  /** Rol con el que abre la lista (desde "Equipo" se abre con "equipo"). */
  @Input() rolInicial = '';
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();
  @Output() abrirServicio = new EventEmitter<number>();

  q = '';
  rol = '';
  estado = '';
  pagina = 0;
  readonly tamano = 20;
  items: UsuarioFila[] = [];
  total = 0;
  cargando = false;
  error = '';

  detalle: UsuarioDetalle | null = null;
  cargandoDetalle = false;
  bloqueando = false;
  motivo = '';
  guardando = false;
  errorDetalle = '';
  readonly roles = ROLES;
  private espera?: ReturnType<typeof setTimeout>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.rol = this.rolInicial;
    this.cargar();
  }

  get paginas(): number {
    return Math.max(1, Math.ceil(this.total / this.tamano));
  }

  filtrar(): void {
    this.pagina = 0;
    this.cargar();
  }

  escribir(): void {
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.filtrar(), ESPERA_MS);
  }

  ir(p: number): void {
    if (p < 0 || p >= this.paginas) return;
    this.pagina = p;
    this.cargar();
  }

  /** "cliente,conductor" → ["Cliente", "Conductor"]; sin roles y registrado como conductor = aspirante. */
  rolesDe(u: { roles: string; registrado_como: string | null }): string[] {
    const r = (u.roles || '').split(',').filter(Boolean);
    if (!r.length && u.registrado_como === 'conductor') return ['aspirante'];
    return r;
  }

  nombreRol(r: string): string {
    return NOMBRE_ROL[r] ?? r;
  }

  inicial(n: string): string {
    return (n || '?').trim().charAt(0).toUpperCase();
  }

  tieneRol(r: string): boolean {
    return (this.detalle?.roles || '').split(',').includes(r);
  }

  /** "usuario_bloqueado" → "Bloqueado"; detalle JSON → "motivo: …". */
  accion(a: string): string {
    return a.replace(/^usuario_/, '').replace(/^rol_/, 'rol ').replace(/_/g, ' ');
  }

  texto(d: unknown): string {
    let o = d;
    if (typeof d === 'string') {
      try {
        o = JSON.parse(d);
      } catch {
        return d;
      }
    }
    return o && typeof o === 'object' ? Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
  }

  async abrir(u: UsuarioFila): Promise<void> {
    this.cargandoDetalle = true;
    this.detalle = null;
    this.bloqueando = false;
    this.motivo = '';
    this.errorDetalle = '';
    try {
      this.detalle = await this.api.get<UsuarioDetalle>(`/admin/usuarios/${u.id}`);
    } catch (err) {
      this.errorDetalle = ApiService.mensaje(err, 'No se pudo abrir el perfil.');
    } finally {
      this.cargandoDetalle = false;
    }
  }

  cerrar(): void {
    this.detalle = null;
    this.errorDetalle = '';
    this.cargandoDetalle = false;
  }

  async bloquear(): Promise<void> {
    if (!this.detalle || this.guardando) return;
    if (this.motivo.trim().length < 5) {
      this.errorDetalle = 'Escribe el motivo del bloqueo (al menos 5 letras): queda en el historial de la cuenta.';
      return;
    }
    await this.cambiarEstado('bloqueado', this.motivo.trim(), `${this.detalle.nombre} quedó bloqueado. Se cerraron sus sesiones.`);
  }

  async activar(): Promise<void> {
    if (!this.detalle) return;
    await this.cambiarEstado('activo', null, `${this.detalle.nombre} quedó activo de nuevo.`);
  }

  async alternarRol(r: string): Promise<void> {
    const d = this.detalle;
    if (!d || this.guardando) return;
    const quitar = this.tieneRol(r);
    this.guardando = true;
    this.errorDetalle = '';
    try {
      if (quitar) await this.api.delete(`/admin/usuarios/${d.id}/roles/${r}`);
      else await this.api.post(`/admin/usuarios/${d.id}/roles`, { rol: r });
      const lista = (d.roles || '').split(',').filter(Boolean).filter(x => x !== r);
      d.roles = (quitar ? lista : [...lista, r]).sort().join(',');
      this.aviso.emit({ tipo: 'ok', texto: `${d.nombre}: rol ${this.nombreRol(r)} ${quitar ? 'quitado' : 'asignado'}. Aplica al volver a iniciar sesión.` });
      this.cargar();
    } catch (err) {
      this.errorDetalle = ApiService.mensaje(err, 'No se pudo cambiar el rol.');
    } finally {
      this.guardando = false;
    }
  }

  private async cambiarEstado(estado: string, motivo: string | null, ok: string): Promise<void> {
    const d = this.detalle!;
    this.guardando = true;
    this.errorDetalle = '';
    try {
      await this.api.patch(`/auth/usuarios/${d.id}/estado`, { estado, motivo });
      this.aviso.emit({ tipo: 'ok', texto: ok });
      this.bloqueando = false;
      this.motivo = '';
      await this.abrir({ id: d.id } as UsuarioFila);
      this.cargar();
    } catch (err) {
      this.errorDetalle = ApiService.mensaje(err, 'No se pudo cambiar el estado.');
    } finally {
      this.guardando = false;
    }
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const r = await this.api.get<{ items: UsuarioFila[]; total: number }>('/admin/usuarios/buscar', {
        q: this.q.trim() || null, rol: this.rol || null, estado: this.estado || null, pagina: this.pagina, tamano: this.tamano,
      });
      this.items = r.items;
      this.total = Number(r.total);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar los usuarios.');
    } finally {
      this.cargando = false;
    }
  }
}
