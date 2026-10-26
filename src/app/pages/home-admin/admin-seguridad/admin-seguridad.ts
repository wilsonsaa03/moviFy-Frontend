import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** GET /api/admin/sos */
interface AlertaSos {
  id: number;
  servicio_id: number | null;
  lat: number | null;
  lng: number | null;
  estado: 'abierta' | 'en_atencion' | 'atendida' | 'falsa_alarma';
  notas: string | null;
  creado_en: string;
  atendida_en: string | null;
  usuario_nombre: string;
  telefono: string | null;
  rol: 'cliente' | 'conductor' | null;
  tipo_vehiculo: string | null;
  placa: string | null;
  conductor_nombre: string | null;
  conductor_telefono: string | null;
  atendida_por_nombre: string | null;
}

/** GET /api/admin/alertas-viaje */
interface AlertaViaje {
  id: number;
  servicio_id: number;
  tipo: 'desvio' | 'detenido';
  respuesta: 'estoy_bien' | 'sos' | 'sin_respuesta';
  lat: number | null;
  lng: number | null;
  creado_en: string;
  revisada_en: string | null;
  notas: string | null;
  usuario_nombre: string;
  usuario_telefono: string | null;
  tipo_vehiculo: string;
  servicio_estado: string;
  origen: string;
  destino: string;
  conductor_nombre: string | null;
  conductor_telefono: string | null;
  placa: string | null;
  revisada_por_nombre: string | null;
}

const ESTADO_SOS: Record<string, string> = {
  abierta: 'Abierta',
  en_atencion: 'En atención',
  atendida: 'Atendida',
  falsa_alarma: 'Falsa alarma',
};
/** Cada cuánto se revisa si llegó una alerta nueva. */
const CADA_MS = 15000;

/**
 * Seguridad: las alertas SOS (botón rojo de la app) y los "¿Todo bien?" (desvío o parada larga) que el pasajero
 * no respondió o en los que pidió ayuda. Para cada una: llamar en un toque al pasajero y al conductor, ver el
 * punto en el mapa, abrir el viaje, y dejar escrito qué se hizo (queda en la auditoría).
 */
@Component({
  selector: 'app-admin-seguridad',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-seguridad.html',
  styleUrls: ['../home-admin.css', './admin-seguridad.css'],
})
export class AdminSeguridadComponent implements OnInit, OnDestroy {
  @Input() soloLectura = false;
  @Output() abrirServicio = new EventEmitter<number>();
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();
  /** Para el número del menú lateral. */
  @Output() pendientes = new EventEmitter<number>();

  pestana: 'sos' | 'alertas' = 'sos';
  soloAbiertas = true;
  sos: AlertaSos[] = [];
  alertas: AlertaViaje[] = [];
  cargando = false;
  /** Error de una acción (atender, revisar). */
  error = '';
  errorSos = '';
  errorAlertas = '';
  private cargoSos = false;
  private cargoAlertas = false;

  /** Alerta en la que se está escribiendo la nota (id con prefijo para no confundir SOS y alertas). */
  editando: string | null = null;
  notas = '';
  guardando = false;

  private sondeo?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
    this.sondeo = setInterval(() => this.cargar(true), CADA_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondeo);
  }

  get sosAbiertas(): number {
    return this.sos.filter(a => a.estado === 'abierta' || a.estado === 'en_atencion').length;
  }

  get alertasPendientes(): number {
    return this.alertas.filter(a => a.respuesta !== 'estoy_bien' && !a.revisada_en).length;
  }

  get sosVisibles(): AlertaSos[] {
    return this.soloAbiertas ? this.sos.filter(a => a.estado === 'abierta' || a.estado === 'en_atencion') : this.sos;
  }

  get alertasVisibles(): AlertaViaje[] {
    return this.soloAbiertas ? this.alertas.filter(a => a.respuesta !== 'estoy_bien' && !a.revisada_en) : this.alertas;
  }

  estadoSos(e: string): string {
    return ESTADO_SOS[e] ?? e;
  }

  /** "Hace 4 min" (lo que importa en una emergencia es cuánto lleva esperando). */
  hace(f: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(f).getTime()) / 60000));
    if (min < 1) return 'Hace un momento';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.floor(min / 60);
    return h < 24 ? `Hace ${h} h ${min % 60} min` : new Date(f).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  mapa(lat: number | null, lng: number | null): string | null {
    return lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  }

  empezarNota(clave: string, actual: string | null): void {
    this.editando = clave;
    this.notas = actual ?? '';
    this.error = '';
  }

  async cambiarSos(a: AlertaSos, estado: 'en_atencion' | 'atendida' | 'falsa_alarma'): Promise<void> {
    if (estado !== 'en_atencion' && this.notas.trim().length < 5) {
      this.error = 'Escribe qué se hizo (al menos 5 letras): queda en el registro de la alerta.';
      return;
    }
    await this.guardar(`/admin/sos/${a.id}`, { estado, notas: this.notas.trim() || null },
      estado === 'en_atencion' ? 'Tomaste la alerta SOS.' : 'Alerta SOS cerrada.');
  }

  async revisar(a: AlertaViaje): Promise<void> {
    if (this.notas.trim().length < 5) {
      this.error = 'Escribe qué se hizo (por ejemplo: "Llamamos al pasajero, iba bien por un trancón").';
      return;
    }
    await this.guardar(`/admin/alertas-viaje/${a.id}`, { notas: this.notas.trim() }, 'Alerta revisada.');
  }

  private async guardar(ruta: string, cuerpo: object, ok: string): Promise<void> {
    if (this.guardando) return;
    this.guardando = true;
    this.error = '';
    try {
      await this.api.patch(ruta, cuerpo);
      this.editando = null;
      this.notas = '';
      this.aviso.emit({ tipo: 'ok', texto: ok });
      await this.cargar(true);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo guardar.');
    } finally {
      this.guardando = false;
    }
  }

  /**
   * Cada lista se carga por su lado: si una falla, la otra igual se ve (en seguridad no se puede quedar todo en
   * blanco por un error). Mientras una no haya cargado bien, no se dice "no hay alertas".
   */
  async cargar(silencioso = false): Promise<void> {
    if (!silencioso) this.cargando = true;
    const [sos, alertas] = await Promise.allSettled([
      this.api.get<AlertaSos[]>('/admin/sos'),
      this.api.get<AlertaViaje[]>('/admin/alertas-viaje'),
    ]);
    if (sos.status === 'fulfilled') {
      this.sos = sos.value;
      this.errorSos = '';
    } else {
      this.errorSos = ApiService.mensaje(sos.reason, 'No se pudieron cargar las alertas SOS.');
    }
    if (alertas.status === 'fulfilled') {
      this.alertas = alertas.value;
      this.errorAlertas = '';
    } else {
      this.errorAlertas = ApiService.mensaje(alertas.reason, 'No se pudieron cargar los "¿Todo bien?".');
    }
    this.cargoSos ||= sos.status === 'fulfilled';
    this.cargoAlertas ||= alertas.status === 'fulfilled';
    this.pendientes.emit(this.sosAbiertas + this.alertasPendientes);
    this.cargando = false;
  }

  /** Error de la pestaña que se está viendo. */
  get errorCarga(): string {
    return this.pestana === 'sos' ? this.errorSos : this.errorAlertas;
  }

  /** Solo se dice "no hay alertas" si la lista cargó bien al menos una vez. */
  get cargoPestana(): boolean {
    return this.pestana === 'sos' ? this.cargoSos : this.cargoAlertas;
  }
}
