import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** GET /api/admin/resumen-dia */
interface ResumenDia {
  servicios_hoy: number;
  finalizados_hoy: number;
  cancelados_hoy: number;
  cancelados_cliente_hoy: number;
  cancelados_conductor_hoy: number;
  sin_conductor_hoy: number;
  efectivo_hoy: number;
  en_curso: number;
  buscando: number;
  buscando_demorados: number;
  conductores_conectados: number;
  conductores_ocupados: number;
  conductores_pendientes: number;
  documentos_por_vencer: number;
  sos_abiertas: number;
  alertas_viaje_pendientes: number;
  pqrs_abiertas: number;
  calificaciones_bajas_semana: number;
  clientes_activos: number;
  conductores_aprobados: number;
  lluvia_activa: boolean;
  por_hora: { hora: number; total: number }[];
  ultimos_7_dias: { fecha: string; total: number; finalizados: number; perdidos: number }[];
}

/** Cada cuánto se actualiza el resumen (es para detectar problemas rápido). */
const CADA_MS = 30000;

/**
 * Resumen del día: lo que está pasando y lo que hay que atender, con cifras del backend (no se traen todos los
 * servicios a Angular para contarlos). Cada tarjeta lleva a la sección donde se resuelve.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AdminIcoComponent],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['../home-admin.css', './admin-dashboard.css'],
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  @Output() ir = new EventEmitter<string>();

  r: ResumenDia | null = null;
  error = '';
  private reloj?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
    this.reloj = setInterval(() => this.cargar(), CADA_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
  }

  /** Lo que necesita a alguien del equipo, en orden de urgencia. */
  get pendientes(): { texto: string; n: number; seccion: string; tono: 'rojo' | 'naranja' | 'azul' }[] {
    const r = this.r;
    if (!r) return [];
    return [
      { texto: 'alertas SOS abiertas', n: r.sos_abiertas, seccion: 'seguridad', tono: 'rojo' as const },
      { texto: '"¿Todo bien?" sin revisar', n: r.alertas_viaje_pendientes, seccion: 'seguridad', tono: 'rojo' as const },
      { texto: 'pedidos buscan conductor hace más de 2 min', n: r.buscando_demorados, seccion: 'vivo', tono: 'naranja' as const },
      { texto: 'conductores esperan validación', n: r.conductores_pendientes, seccion: 'conductores', tono: 'naranja' as const },
      { texto: 'PQRS abiertas', n: r.pqrs_abiertas, seccion: 'soporte', tono: 'azul' as const },
      { texto: 'documentos por vencer (30 días)', n: r.documentos_por_vencer, seccion: 'conductores', tono: 'azul' as const },
      { texto: 'calificaciones de 1 o 2 estrellas esta semana', n: r.calificaciones_bajas_semana, seccion: 'calificaciones', tono: 'azul' as const },
    ].filter(p => Number(p.n) > 0);
  }

  /** Barras por hora (0 a 23), aunque no haya servicios en alguna. */
  get horas(): { hora: number; total: number; alto: number }[] {
    const max = Math.max(1, ...(this.r?.por_hora ?? []).map(h => Number(h.total)));
    return Array.from({ length: 24 }, (_, hora) => {
      const total = Number(this.r?.por_hora.find(h => h.hora === hora)?.total ?? 0);
      return { hora, total, alto: Math.round((total / max) * 100) };
    });
  }

  get dias(): { etiqueta: string; total: number; finalizados: number; perdidos: number; alto: number }[] {
    const lista = this.r?.ultimos_7_dias ?? [];
    const max = Math.max(1, ...lista.map(d => Number(d.total)));
    return lista.map(d => ({
      etiqueta: new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
      total: Number(d.total),
      finalizados: Number(d.finalizados),
      perdidos: Number(d.perdidos),
      alto: Math.round((Number(d.total) / max) * 100),
    }));
  }

  /** De los servicios de hoy que ya terminaron, cuántos se perdieron (cancelados o sin conductor). */
  get tasaPerdida(): number {
    const r = this.r;
    if (!r) return 0;
    const cerrados = Number(r.finalizados_hoy) + Number(r.cancelados_hoy) + Number(r.sin_conductor_hoy);
    return cerrados ? Math.round(((Number(r.cancelados_hoy) + Number(r.sin_conductor_hoy)) / cerrados) * 100) : 0;
  }

  private async cargar(): Promise<void> {
    try {
      this.r = await this.api.get<ResumenDia>('/admin/resumen-dia');
      this.error = '';
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo cargar el resumen.');
    }
  }
}
