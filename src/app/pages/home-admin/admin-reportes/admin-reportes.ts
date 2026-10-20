import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

/** Una fila de GET /api/admin/pqrs (tabla tickets_soporte + datos del viaje). */
export interface ReporteAdmin {
  id: number;
  tipo: string;
  prioridad: 'baja' | 'media' | 'alta' | 'urgente';
  estado: 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado';
  estado_nombre: string;
  estado_color: string;
  asunto: string;
  descripcion: string;
  respuesta: string | null;
  creado_en: string;
  resuelto_en: string | null;
  fecha_limite_respuesta: string;
  dias_restantes: number;
  vencida: boolean;
  usuario_id: number;
  reporta_nombre: string;
  reporta_telefono: string | null;
  reporta_rol: 'cliente' | 'conductor' | null;
  servicio_id: number | null;
  tipo_servicio: string | null;
  origen_direccion: string | null;
  destino_direccion: string | null;
  servicio_fecha: string | null;
  reportado_id: number | null;
  reportado_nombre: string | null;
  reportado_telefono: string | null;
  reportado_estado: string | null;
  asignado_nombre: string | null;
}

const TIPOS: Record<string, string> = {
  queja: 'Queja',
  incidente_seguridad: 'Seguridad',
  reclamo: 'Reclamo',
  cobro_indebido: 'Cobro indebido',
  objeto_olvidado: 'Objeto olvidado',
  peticion: 'Petición',
  sugerencia: 'Sugerencia',
};

/**
 * Sección "Quejas y reportes" del panel web del administrador.
 * Muestra los reportes que los usuarios hacen desde la app (PQRS ligadas a un viaje)
 * y permite tomarlos, responderlos y, si hace falta, bloquear a la persona reportada.
 * Solo la ven admin y soporte: la ruta /admin usa rolGuard y el backend exige admin_pqrs.ver.
 */
@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reportes.html',
  styleUrls: ['./admin-reportes.css'],
})
export class AdminReportesComponent implements OnInit {
  /** Avisa al panel cuántos reportes siguen abiertos (para el número del menú). */
  @Output() pendientes = new EventEmitter<number>();

  reportes: ReporteAdmin[] = [];
  filtro: 'abiertos' | 'todos' = 'abiertos';
  soloUrgentes = false;
  cargando = false;
  error = '';

  seleccionado: ReporteAdmin | null = null;
  respuesta = '';
  guardando = false;
  errorModal = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      this.reportes = await this.api.get<ReporteAdmin[]>('/admin/pqrs', { filtro: this.filtro });
      this.pendientes.emit(this.reportes.filter(r => this.estaAbierto(r)).length);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar los reportes.');
    } finally {
      this.cargando = false;
    }
  }

  cambiarFiltro(f: 'abiertos' | 'todos'): void {
    if (this.filtro === f) return;
    this.filtro = f;
    this.cargar();
  }

  get visibles(): ReporteAdmin[] {
    return this.soloUrgentes ? this.reportes.filter(r => r.prioridad === 'urgente') : this.reportes;
  }

  get totalUrgentes(): number {
    return this.reportes.filter(r => r.prioridad === 'urgente' && this.estaAbierto(r)).length;
  }

  get totalVencidos(): number {
    return this.reportes.filter(r => r.vencida).length;
  }

  // ─── Detalle ───────────────────────────────────
  abrir(r: ReporteAdmin): void {
    this.seleccionado = r;
    this.respuesta = r.respuesta || '';
    this.errorModal = '';
  }

  cerrar(): void {
    this.seleccionado = null;
    this.respuesta = '';
    this.errorModal = '';
  }

  /** abierto → en_proceso: el caso queda asignado a quien lo toma. */
  async tomar(r: ReporteAdmin): Promise<void> {
    await this.actualizar(r, { estado: 'en_proceso' }, 'Caso tomado.');
  }

  /** → resuelto con respuesta (la BD exige respuesta para resolver). El backend avisa al usuario en la app. */
  async responder(r: ReporteAdmin): Promise<void> {
    const texto = this.respuesta.trim();
    if (texto.length < 10) {
      this.errorModal = 'Escribe una respuesta de al menos 10 caracteres para el usuario.';
      return;
    }
    await this.actualizar(r, { estado: 'resuelto', respuesta: texto }, 'Respuesta enviada al usuario.');
  }

  async cambiarPrioridad(r: ReporteAdmin, prioridad: string): Promise<void> {
    await this.actualizar(r, { prioridad }, '', false);
  }

  /** Decisión manual del administrador, separada de responder: bloquear por un solo reporte es delicado. */
  async bloquearReportado(r: ReporteAdmin): Promise<void> {
    if (!r.reportado_id) return;
    const ok = confirm(`¿Bloquear a ${r.reportado_nombre}? No podrá usar MoviFY hasta que lo actives de nuevo en Usuarios.`);
    if (!ok) return;
    this.guardando = true;
    try {
      await this.api.patch(`/auth/usuarios/${r.reportado_id}/estado`, { estado: 'bloqueado' });
      r.reportado_estado = 'bloqueado';
    } catch (err) {
      this.errorModal = ApiService.mensaje(err, 'No se pudo bloquear al usuario.');
    } finally {
      this.guardando = false;
    }
  }

  private async actualizar(r: ReporteAdmin, cuerpo: Record<string, string>, aviso: string, cerrarAlFinal = true): Promise<void> {
    if (this.guardando) return;
    this.guardando = true;
    this.errorModal = '';
    try {
      await this.api.patch(`/admin/pqrs/${r.id}`, cuerpo);
      if (aviso) alert(aviso);
      if (cerrarAlFinal) this.cerrar();
      await this.cargar();
      if (!cerrarAlFinal) this.seleccionado = this.reportes.find(x => x.id === r.id) || null;
    } catch (err) {
      this.errorModal = ApiService.mensaje(err, 'No se pudo actualizar el reporte.');
    } finally {
      this.guardando = false;
    }
  }

  // ─── Ayudas para la vista ──────────────────────
  estaAbierto(r: ReporteAdmin): boolean {
    return r.estado === 'abierto' || r.estado === 'en_proceso';
  }

  tipoTexto(tipo: string): string {
    return TIPOS[tipo] || tipo;
  }

  rolTexto(rol: string | null): string {
    return rol === 'conductor' ? 'Conductor' : rol === 'cliente' ? 'Pasajero' : '';
  }

  plazo(r: ReporteAdmin): string {
    if (!this.estaAbierto(r)) return '—';
    if (r.vencida) return `Vencido hace ${Math.abs(r.dias_restantes)} d`;
    return r.dias_restantes === 0 ? 'Vence hoy' : `${r.dias_restantes} d`;
  }

  fecha(f: string | null): string {
    if (!f) return '—';
    return new Date(f).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
  }
}
