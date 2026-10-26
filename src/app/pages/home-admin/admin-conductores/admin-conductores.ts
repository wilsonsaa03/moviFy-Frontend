import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

/** Fila de GET /api/admin/conductores/buscar (teléfono y documento parciales). */
interface ConductorFila {
  conductor_id: number;
  nombre: string;
  telefono: string | null;
  documento: string | null;
  placa: string | null;
  tipo_vehiculo: 'moto' | 'taxi' | null;
  modelo: string | null;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido';
  estado_nombre: string;
  en_linea: boolean;
  motivo_estado: string | null;
  calificacion: number | null;
  total_servicios: number;
  total_cancelaciones: number;
  documentos_por_revisar: number;
  documentos_por_vencer: number;
}

const ESPERA_MS = 350;

/**
 * Lista de conductores con filtros en la base: estado de validación, moto o taxi, conectado o no, y búsqueda por
 * nombre, placa o celular. Cédula y celular se ven parciales; el expediente completo se abre con "Revisar", que es
 * donde se aprueba, rechaza, suspende o reactiva (nunca desde la lista, sin ver los documentos).
 */
@Component({
  selector: 'app-admin-conductores',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-conductores.html',
  styleUrls: ['../home-admin.css', './admin-conductores.css'],
})
export class AdminConductoresComponent implements OnInit, OnChanges {
  /** Cambia cuando el expediente aprueba, rechaza o suspende: se recarga la lista. */
  @Input() recargar = 0;
  @Input() estadoInicial = '';
  @Output() revisar = new EventEmitter<number>();

  estado = '';
  tipo = '';
  conectado = '';
  q = '';
  pagina = 0;
  readonly tamano = 20;
  items: ConductorFila[] = [];
  total = 0;
  conteos: Partial<Record<string, number>> = {};
  cargando = false;
  error = '';
  readonly estados = [
    { id: '', nombre: 'Todos', clave: 'todos' },
    { id: 'pendiente', nombre: 'Por validar', clave: 'pendiente' },
    { id: 'aprobado', nombre: 'Aprobados', clave: 'aprobado' },
    { id: 'rechazado', nombre: 'Rechazados', clave: 'rechazado' },
    { id: 'suspendido', nombre: 'Suspendidos', clave: 'suspendido' },
  ];
  private espera?: ReturnType<typeof setTimeout>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.estado = this.estadoInicial;
    this.cargar();
  }

  ngOnChanges(): void {
    if (this.items.length) this.cargar();
  }

  get paginas(): number {
    return Math.max(1, Math.ceil(this.total / this.tamano));
  }

  elegirEstado(e: string): void {
    this.estado = e;
    this.filtrar();
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

  tasa(c: ConductorFila): number {
    const cerrados = Number(c.total_servicios) + Number(c.total_cancelaciones);
    return cerrados ? Math.round((Number(c.total_cancelaciones) / cerrados) * 100) : 0;
  }

  inicial(n: string): string {
    return (n || '?').trim().charAt(0).toUpperCase();
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const r = await this.api.get<{ items: ConductorFila[]; total: number; conteos: Record<string, number> }>('/admin/conductores/buscar', {
        estado: this.estado || null,
        tipo_vehiculo: this.tipo || null,
        conectado: this.conectado === '' ? null : this.conectado === 'si',
        q: this.q.trim() || null,
        pagina: this.pagina,
        tamano: this.tamano,
      });
      this.items = r.items;
      this.total = Number(r.total);
      this.conteos = r.conteos;
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar los conductores.');
    } finally {
      this.cargando = false;
    }
  }
}
