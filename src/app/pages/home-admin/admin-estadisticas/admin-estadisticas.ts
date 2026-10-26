import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** GET /api/admin/reportes */
interface Reporte {
  desde: string;
  hasta: string;
  totales: {
    solicitudes: number; finalizados: number; cancelados: number; sin_conductor: number; tasa_perdida: number | null;
    cancelados_cliente: number; cancelados_conductor: number; cancelados_personal: number;
    min_aceptacion: number | null; min_aceptacion_mediana: number | null; min_llegada: number | null; min_viaje: number | null;
    efectivo: number; ticket_promedio: number | null;
  };
  por_tipo: { tipo_servicio: string; tipo_vehiculo: string; total: number; finalizados: number; perdidos: number }[];
  por_dia: { fecha: string; total: number; finalizados: number }[];
  por_hora: { hora: number; total: number }[];
  motivos_cancelacion: { descripcion: string; actor: string; total: number }[];
  top_conductores: { conductor_id: number; nombre: string; placa: string | null; tipo_vehiculo: string | null; finalizados: number; cobrado: number; calificacion: number | null }[];
}

/** "AAAA-MM-DD" de hoy en el computador del admin. */
function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Reportes y estadísticas de un periodo (30 días por defecto): solicitudes por tipo, día y hora, tasa de
 * cancelación y quién cancela, tiempos (aceptación, llegada, viaje), motivos y conductores más activos. Todo se
 * calcula en la base. Exporta los servicios del periodo a CSV para abrirlo en Excel.
 */
@Component({
  selector: 'app-admin-estadisticas',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-estadisticas.html',
  styleUrls: ['../home-admin.css', './admin-estadisticas.css'],
})
export class AdminEstadisticasComponent implements OnInit {
  /** Soporte ve los reportes pero no exporta (reportes.exportar es solo del admin). */
  @Input() puedeExportar = true;
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();

  desde = '';
  hasta = hoy();
  r: Reporte | null = null;
  cargando = false;
  exportando = false;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    this.desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.cargar();
  }

  rapido(dias: number): void {
    const d = new Date();
    d.setDate(d.getDate() - (dias - 1));
    this.desde = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.hasta = hoy();
    this.cargar();
  }

  nombreTipo(t: { tipo_servicio: string; tipo_vehiculo: string }): string {
    if (t.tipo_servicio === 'transporte') return t.tipo_vehiculo === 'moto' ? 'Viaje en moto' : 'Viaje en taxi';
    return (t.tipo_servicio === 'domicilio' ? 'Domicilio' : 'Encomienda') + ` (${t.tipo_vehiculo})`;
  }

  /** Barras de 0 a 100 respecto al máximo de la lista. */
  alto(v: number, lista: { total: number }[]): number {
    const max = Math.max(1, ...lista.map(x => Number(x.total)));
    return Math.round((Number(v) / max) * 100);
  }

  get horas(): { hora: number; total: number }[] {
    return Array.from({ length: 24 }, (_, hora) => ({ hora, total: Number(this.r?.por_hora.find(h => h.hora === hora)?.total ?? 0) }));
  }

  get horaPico(): number | null {
    const h = [...(this.r?.por_hora ?? [])].sort((a, b) => Number(b.total) - Number(a.total))[0];
    return h ? h.hora : null;
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      this.r = await this.api.get<Reporte>('/admin/reportes', { desde: this.desde, hasta: this.hasta });
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo calcular el reporte.');
    } finally {
      this.cargando = false;
    }
  }

  /** Descarga el CSV con el token del admin (un enlace directo no lleva la sesión). */
  async exportar(): Promise<void> {
    if (this.exportando) return;
    this.exportando = true;
    try {
      const blob = await this.api.blob(`/admin/reportes/servicios.csv?desde=${this.desde}&hasta=${this.hasta}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `movify-servicios-${this.desde}-a-${this.hasta}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.aviso.emit({ tipo: 'ok', texto: 'Listo: el archivo se abre en Excel. La descarga quedó en la auditoría.' });
    } catch (err) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(err, 'No se pudo exportar.') });
    } finally {
      this.exportando = false;
    }
  }
}
