import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';
import { AdminUsuariosComponent } from '../admin-usuarios/admin-usuarios';

interface Permiso {
  codigo: string;
  modulo: string;
  accion: string;
  descripcion: string;
  es_sensible: boolean;
}

/** Cómo se llama cada módulo en pantalla. */
const MODULOS: Record<string, string> = {
  admin_conductores: 'Conductores', admin_usuarios: 'Usuarios', admin_servicios: 'Solicitudes', admin_sos: 'Seguridad (SOS)',
  admin_pqrs: 'Soporte (PQRS)', tarifas: 'Tarifas', reportes: 'Reportes', configuracion: 'Configuración',
  seguridad: 'Equipo y permisos', auditoria: 'Auditoría', catalogos: 'Datos básicos',
};

/**
 * Equipo interno y permisos: quién es admin o soporte (la lista de usuarios filtrada por equipo), agregar a alguien
 * que ya tiene cuenta y la matriz de qué puede hacer cada rol. Los permisos de soporte se ajustan aquí (por
 * ejemplo, dejarlo exportar reportes); los del admin son fijos para no dejar la plataforma sin quien la administre.
 * Los cambios aplican cuando la persona vuelve a iniciar sesión (los permisos van en su token).
 */
@Component({
  selector: 'app-admin-equipo',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent, AdminUsuariosComponent],
  templateUrl: './admin-equipo.html',
  styleUrls: ['../home-admin.css', '../admin-catalogos/admin-catalogos.css', './admin-equipo.css'],
})
export class AdminEquipoComponent implements OnInit {
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();
  @Output() abrirServicio = new EventEmitter<number>();

  identificador = '';
  rol: 'soporte' | 'admin' = 'soporte';
  agregando = false;
  errorAgregar = '';
  /** Se incrementa para volver a montar la lista del equipo después de agregar a alguien. */
  version = 0;

  permisos: Permiso[] = [];
  asignados = new Set<string>();
  editables: string[] = [];
  errorPermisos = '';
  guardando: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargarPermisos();
  }

  get modulos(): { nombre: string; permisos: Permiso[] }[] {
    const grupos = new Map<string, Permiso[]>();
    for (const p of this.permisos) grupos.set(p.modulo, [...(grupos.get(p.modulo) ?? []), p]);
    return [...grupos.entries()].map(([m, permisos]) => ({ nombre: MODULOS[m] ?? m, permisos }));
  }

  tiene(rol: string, permiso: string): boolean {
    return this.asignados.has(`${rol}|${permiso}`);
  }

  async agregar(): Promise<void> {
    if (this.agregando) return;
    if (this.identificador.trim().length < 5) {
      this.errorAgregar = 'Escribe el celular o el correo con el que la persona se registró.';
      return;
    }
    this.agregando = true;
    this.errorAgregar = '';
    try {
      const r = await this.api.post<{ message: string }>('/admin/equipo', { identificador: this.identificador.trim(), rol: this.rol });
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      this.identificador = '';
      this.version++;
    } catch (err) {
      this.errorAgregar = ApiService.mensaje(err, 'No se pudo agregar al equipo.');
    } finally {
      this.agregando = false;
    }
  }

  async alternar(rol: string, p: Permiso): Promise<void> {
    if (!this.editables.includes(rol) || this.guardando) return;
    const activo = !this.tiene(rol, p.codigo);
    if (activo && p.es_sensible && !confirm(`"${p.descripcion}" es un permiso sensible. ¿Dárselo a ${rol}?`)) return;
    this.guardando = p.codigo;
    try {
      const r = await this.api.put<{ message: string }>('/admin/permisos', { rol, permiso: p.codigo, activo });
      if (activo) this.asignados.add(`${rol}|${p.codigo}`);
      else this.asignados.delete(`${rol}|${p.codigo}`);
      this.aviso.emit({ tipo: 'ok', texto: r.message });
    } catch (err) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(err, 'No se pudo cambiar el permiso.') });
    } finally {
      this.guardando = null;
    }
  }

  private async cargarPermisos(): Promise<void> {
    try {
      const r = await this.api.get<{ permisos: Permiso[]; asignados: { rol: string; permiso: string }[]; editables: string[] }>('/admin/permisos');
      this.permisos = r.permisos;
      this.asignados = new Set(r.asignados.map(a => `${a.rol}|${a.permiso}`));
      this.editables = r.editables;
    } catch (err) {
      this.errorPermisos = ApiService.mensaje(err, 'No se pudieron cargar los permisos.');
    }
  }
}
