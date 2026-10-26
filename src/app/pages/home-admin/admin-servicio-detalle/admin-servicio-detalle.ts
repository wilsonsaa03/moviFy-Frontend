import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** GET /api/servicios/{id} visto por el personal (v_servicios_api + conductor y vehículo). */
interface DetalleServicio {
  id: number;
  tipo_servicio: 'transporte' | 'domicilio' | 'encomienda';
  tipo_vehiculo: 'moto' | 'taxi';
  estado_codigo: string;
  estado_nombre: string;
  usuario_nombre: string;
  usuario_telefono?: string | null;
  pasajero_nombre?: string | null;
  pasajero_telefono?: string | null;
  conductor_nombre?: string | null;
  conductor_telefono?: string | null;
  conductor_placa?: string | null;
  conductor_modelo?: string | null;
  conductor_color?: string | null;
  origen: string;
  origen_referencia?: string | null;
  destino: string;
  parada?: string | null;
  descripcion?: string | null;
  distancia_km?: number | null;
  duracion_estimada_min?: number | null;
  tarifa: number;
  valor_sugerido?: number | null;
  aumentos_tarifa?: number | null;
  pasajeros?: number | null;
  necesita_casco?: boolean | null;
  lleva_equipaje?: boolean | null;
  lleva_mascota?: boolean | null;
  motivo_cancelacion?: string | null;
  detalle_cancelacion?: string | null;
  fecha_solicitud: string;
  destino_cambiado_en?: string | null;
}

interface Cambio {
  creado_en: string;
  estado_nombre: string;
  actor_rol: string | null;
  motivo: string | null;
}

interface Mensaje {
  id: number;
  remitente_id: number;
  contenido: string;
  creado_en: string;
}

/** Motivos de cancelación del personal (motivos_cancelacion, actor admin). */
const MOTIVOS_ADMIN = [
  { id: 20, texto: 'Cancelado por soporte' },
  { id: 21, texto: 'Alerta de seguridad' },
];
const ACTIVOS = ['buscando', 'asignado', 'en_origen', 'en_curso'];
const QUIEN: Record<string, string> = { cliente: 'Cliente', conductor: 'Conductor', admin: 'Administración', soporte: 'Soporte', sistema: 'Sistema' };

/**
 * Detalle de un servicio para administración y soporte: quién lo pidió (y para quién), quién lo lleva con su
 * vehículo, el recorrido con la parada, lo que pidió el pasajero, la línea de tiempo (historial_estados), el chat
 * del viaje y, si sigue activo, cancelarlo con motivo. Todo lo consulta con los mismos endpoints de la app: el
 * backend ya deja ver al personal (y no a nadie más).
 */
@Component({
  selector: 'app-admin-servicio-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-servicio-detalle.html',
  styleUrls: ['../home-admin.css', './admin-servicio-detalle.css'],
})
export class AdminServicioDetalleComponent implements OnChanges {
  @Input() servicioId: number | null = null;
  @Input() puedeCancelar = true;
  @Output() cerrar = new EventEmitter<void>();
  /** Se canceló: el panel recarga la lista y muestra el aviso. */
  @Output() cambio = new EventEmitter<string>();

  s: DetalleServicio | null = null;
  cambios: Cambio[] = [];
  mensajes: Mensaje[] = [];
  cargando = false;
  error = '';

  cancelando = false;
  motivoId = MOTIVOS_ADMIN[0].id;
  detalle = '';
  enviando = false;
  readonly motivos = MOTIVOS_ADMIN;

  constructor(private api: ApiService) {}

  ngOnChanges(): void {
    if (this.servicioId) this.cargar(this.servicioId);
  }

  get activo(): boolean {
    return !!this.s && ACTIVOS.includes(this.s.estado_codigo);
  }

  /** "Casco · 3 pasajeros · Equipaje" */
  get preferencias(): string {
    const s = this.s;
    if (!s) return '';
    return [
      s.necesita_casco ? 'Casco para el pasajero' : '',
      Number(s.pasajeros) > 1 ? `${s.pasajeros} pasajeros` : '',
      s.lleva_equipaje ? 'Equipaje' : '',
      s.lleva_mascota ? 'Mascota' : '',
    ].filter(Boolean).join(' · ');
  }

  /** Lo que ofreció de más el pasajero sobre lo cotizado (inDrive). */
  get ofrecioDeMas(): number {
    const s = this.s;
    return s && s.valor_sugerido != null ? Math.max(0, Number(s.tarifa) - Number(s.valor_sugerido)) : 0;
  }

  quien(c: Cambio): string {
    return c.actor_rol ? QUIEN[c.actor_rol] ?? c.actor_rol : 'Sistema';
  }

  /** En el chat, a la izquierda el cliente y a la derecha el conductor. */
  esDelConductor(m: Mensaje): boolean {
    return !!this.s && m.remitente_id !== this.clienteId;
  }

  private clienteId = 0;

  /** Reasignar: solo con conductor asignado o en la recogida (un viaje en curso no se reasigna). */
  get puedeReasignar(): boolean {
    return !!this.s && ['asignado', 'en_origen'].includes(this.s.estado_codigo);
  }

  reasignando = false;
  motivoReasignar = '';

  async reasignar(): Promise<void> {
    if (!this.s || this.enviando) return;
    if (this.motivoReasignar.trim().length < 5) {
      this.error = 'Escribe por qué se reasigna (por ejemplo: el conductor no avanza ni contesta).';
      return;
    }
    this.enviando = true;
    this.error = '';
    try {
      const r = await this.api.post<{ message: string }>(`/admin/servicios/${this.s.id}/reasignar`, { motivo: this.motivoReasignar.trim() });
      this.reasignando = false;
      this.motivoReasignar = '';
      this.cambio.emit(r.message);
      await this.cargar(this.s.id);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo reasignar el servicio.');
    } finally {
      this.enviando = false;
    }
  }

  async cancelar(): Promise<void> {
    if (!this.s || this.enviando) return;
    if (this.detalle.trim().length < 5) {
      this.error = 'Escribe por qué se cancela (lo verá el equipo en la auditoría).';
      return;
    }
    this.enviando = true;
    this.error = '';
    try {
      await this.api.post(`/admin/servicios/${this.s.id}/cancelar`, { motivo_id: this.motivoId, motivo: this.detalle.trim() });
      this.cancelando = false;
      this.cambio.emit(`Servicio #${this.s.id} cancelado. Al cliente le llegó el aviso.`);
      await this.cargar(this.s.id);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo cancelar el servicio.');
    } finally {
      this.enviando = false;
    }
  }

  private async cargar(id: number): Promise<void> {
    this.cargando = true;
    this.error = '';
    this.cancelando = false;
    this.detalle = '';
    try {
      const [s, cambios, mensajes] = await Promise.all([
        this.api.get<DetalleServicio & { cliente_id?: number }>(`/servicios/${id}`),
        this.api.get<Cambio[]>(`/servicios/${id}/historial`).catch(() => []),
        this.api.get<Mensaje[]>(`/servicios/${id}/mensajes`).catch(() => []),
      ]);
      this.s = s;
      this.clienteId = Number(s.cliente_id) || 0;
      this.cambios = cambios;
      this.mensajes = mensajes;
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo cargar el servicio.');
    } finally {
      this.cargando = false;
    }
  }
}
