import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** Fila de GET /api/admin/documentos/por-vencer (v_documentos_por_vencer: vencen en 30 días o ya vencieron). */
interface DocumentoPorVencer {
  conductor_id: number;
  nombres: string;
  telefono: string | null;
  tipo_documento: string;
  fecha_vencimiento: string;
  dias_restantes: number;
}

const NOMBRES: Record<string, string> = {
  licencia_conduccion: 'Licencia de conducción',
  soat: 'SOAT',
  tecnomecanica: 'Revisión técnico-mecánica',
  tarjeta_control: 'Tarjeta de control',
  tarjeta_operacion: 'Tarjeta de operación',
};

/**
 * Documentos que vencen en los próximos 30 días (o ya vencieron). Un conductor con SOAT o licencia vencidos queda
 * suspendido solo en la noche (tarea diaria): aquí soporte lo ve antes y lo llama para que suba el nuevo.
 */
@Component({
  selector: 'app-admin-documentos-vencer',
  standalone: true,
  imports: [CommonModule, AdminIcoComponent],
  template: `
    <section class="adm-card">
      <div class="adm-card-head">
        <div>
          <h2>Documentos por vencer</h2>
          <p class="adm-card-sub">Próximos 30 días. Al vencer, el conductor queda suspendido solo esa noche.</p>
        </div>
        <span class="adm-pill-num" [class.dv-alerta]="vencidos > 0">{{ documentos.length }}</span>
      </div>
      @if (error) { <p class="adm-error" role="alert">{{ error }}</p> }
      <ul class="adm-lista">
        @for (d of documentos; track d.conductor_id + d.tipo_documento) {
          <li class="adm-lista-item">
            <span class="adm-tipo-ico" [class.dv-mal]="d.dias_restantes < 0" [class.dv-pronto]="d.dias_restantes >= 0 && d.dias_restantes <= 7"><adm-ico n="documento" /></span>
            <span class="adm-lista-txt">
              <span class="adm-lista-nombre">{{ d.nombres }} · {{ nombre(d.tipo_documento) }}</span>
              <span class="adm-lista-sub">{{ cuando(d) }} ({{ d.fecha_vencimiento | date:'d MMM y' }})</span>
            </span>
            @if (d.telefono) { <a class="adm-btn-ico" [href]="'tel:' + d.telefono" [attr.aria-label]="'Llamar a ' + d.nombres"><adm-ico n="telefono" /></a> }
            <button type="button" class="adm-btn adm-btn-borde" (click)="verConductor.emit(d.conductor_id)">Ver</button>
          </li>
        } @empty {
          <li class="adm-vacio-ok"><adm-ico n="check" /> Ningún documento vence en los próximos 30 días.</li>
        }
      </ul>
    </section>
  `,
  styleUrls: ['../home-admin.css'],
  styles: `
    .dv-alerta { background: var(--rojo-fondo); color: var(--rojo-texto); }
    .dv-mal { background: var(--rojo-fondo); color: var(--rojo-texto); padding: 7px; }
    .dv-pronto { background: var(--naranja-fondo); color: var(--naranja-texto); padding: 7px; }
    .adm-tipo-ico { padding: 7px; background: var(--gris-fondo); }
  `,
})
export class AdminDocumentosVencerComponent implements OnInit {
  @Output() verConductor = new EventEmitter<number>();
  documentos: DocumentoPorVencer[] = [];
  error = '';

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.documentos = await this.api.get<DocumentoPorVencer[]>('/admin/documentos/por-vencer');
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar los documentos por vencer.');
    }
  }

  get vencidos(): number {
    return this.documentos.filter(d => d.dias_restantes < 0).length;
  }

  nombre(tipo: string): string {
    return NOMBRES[tipo] ?? tipo.replace(/_/g, ' ');
  }

  cuando(d: DocumentoPorVencer): string {
    if (d.dias_restantes < 0) return `Venció hace ${-d.dias_restantes} ${d.dias_restantes === -1 ? 'día' : 'días'}`;
    if (d.dias_restantes === 0) return 'Vence hoy';
    return `Vence en ${d.dias_restantes} ${d.dias_restantes === 1 ? 'día' : 'días'}`;
  }
}
