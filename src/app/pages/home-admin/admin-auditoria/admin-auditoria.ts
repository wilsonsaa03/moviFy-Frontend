import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** auditoria_admin + nombre de quien lo hizo. */
interface Accion {
  id: number;
  admin_nombre: string | null;
  accion: string;
  entidad: string;
  entidad_id: number;
  detalle: Record<string, unknown> | string | null;
  creado_en: string;
}

/** auditoria_cambios (triggers de la base). */
interface CambioBd {
  id: number;
  tabla: string;
  operacion: 'I' | 'U' | 'D';
  registro_id: string;
  datos_antes: Record<string, unknown> | string | null;
  datos_despues: Record<string, unknown> | string | null;
  usuario_nombre: string | null;
  actor_rol: string | null;
  creado_en: string;
}

/** v_accesos_sospechosos: 10 o más intentos fallidos desde la misma IP en la última hora. */
interface AccesoSospechoso {
  ip_origen: string;
  intentos_fallidos: number;
  cuentas_distintas: number;
  desde: string;
  hasta: string;
}

/** Cómo se lee cada acción en español. */
const ACCIONES: Record<string, string> = {
  configuracion: 'Cambió un parámetro',
  tarifa_nueva: 'Activó una tarifa nueva',
  alerta_viaje_revisada: 'Revisó un "¿Todo bien?"',
  sos_en_atencion: 'Tomó una alerta SOS',
  sos_atendida: 'Cerró una alerta SOS',
  sos_falsa_alarma: 'Marcó SOS como falsa alarma',
  pqrs_en_proceso: 'Tomó una PQRS',
  pqrs_resuelto: 'Respondió una PQRS',
  pqrs_cerrado: 'Cerró una PQRS',
  pqrs_: 'Cambió la prioridad de una PQRS',
};
const OPERACION: Record<string, string> = { I: 'Creó', U: 'Cambió', D: 'Borró' };
/** Columnas que no aportan al leer un cambio. */
const RUIDO = new Set(['actualizado_en', 'creado_en', 'estado_ambito']);

/**
 * Auditoría: quién del equipo hizo qué (aprobar conductores, bloquear, tarifas, parámetros, SOS, PQRS), los cambios
 * sensibles que registra la base sola (roles, estados, tarifas, vehículos) y las IP con muchos intentos fallidos de
 * inicio de sesión en la última hora (posible ataque de fuerza bruta). Solo el admin la ve.
 */
@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-auditoria.html',
  styleUrls: ['../home-admin.css', './admin-auditoria.css'],
})
export class AdminAuditoriaComponent implements OnInit {
  pestana: 'acciones' | 'cambios' | 'accesos' = 'acciones';
  acciones: Accion[] = [];
  cambios: CambioBd[] = [];
  accesos: AccesoSospechoso[] = [];
  busqueda = '';
  cargando = false;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get accionesVisibles(): Accion[] {
    const q = this.busqueda.trim().toLowerCase();
    return q ? this.acciones.filter(a => `${a.admin_nombre} ${a.accion} ${a.entidad} ${this.texto(a.detalle)}`.toLowerCase().includes(q)) : this.acciones;
  }

  get cambiosVisibles(): CambioBd[] {
    const q = this.busqueda.trim().toLowerCase();
    return q ? this.cambios.filter(c => `${c.tabla} ${c.registro_id} ${c.usuario_nombre}`.toLowerCase().includes(q)) : this.cambios;
  }

  accion(a: Accion): string {
    return ACCIONES[a.accion] ?? a.accion.replace(/_/g, ' ');
  }

  operacion(c: CambioBd): string {
    return OPERACION[c.operacion] ?? c.operacion;
  }

  /** Detalle JSON en una línea legible: "clave: radio_busqueda_km · valor: 6". */
  texto(d: unknown): string {
    const o = this.objeto(d);
    return o ? Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
  }

  /** Lo que cambió en un UPDATE: "estado: pendiente → aprobado". En INSERT/DELETE, las columnas principales. */
  diferencias(c: CambioBd): string[] {
    const antes = this.objeto(c.datos_antes) ?? {};
    const despues = this.objeto(c.datos_despues) ?? {};
    if (c.operacion === 'U') {
      return Object.keys(despues)
        .filter(k => !RUIDO.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
        .map(k => `${k}: ${this.corto(antes[k])} → ${this.corto(despues[k])}`);
    }
    const fuente = c.operacion === 'D' ? antes : despues;
    return Object.entries(fuente).filter(([k, v]) => !RUIDO.has(k) && v != null).slice(0, 6).map(([k, v]) => `${k}: ${this.corto(v)}`);
  }

  private corto(v: unknown): string {
    if (v == null) return '—';
    const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return t.length > 40 ? t.slice(0, 40) + '…' : t;
  }

  private objeto(d: unknown): Record<string, unknown> | null {
    if (!d) return null;
    if (typeof d === 'string') {
      try {
        return JSON.parse(d);
      } catch {
        return null;
      }
    }
    return d as Record<string, unknown>;
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const r = await this.api.get<{ acciones: Accion[]; cambios: CambioBd[]; accesos_sospechosos: AccesoSospechoso[] }>('/admin/auditoria');
      this.acciones = r.acciones;
      this.cambios = r.cambios;
      this.accesos = r.accesos_sospechosos;
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo cargar la auditoría.');
    } finally {
      this.cargando = false;
    }
  }
}
