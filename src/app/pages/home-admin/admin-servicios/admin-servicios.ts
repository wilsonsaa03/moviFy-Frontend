import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

/** Fila de GET /api/admin/servicios/buscar */
interface Solicitud {
  id: number;
  tipo_servicio: 'transporte' | 'domicilio' | 'encomienda';
  tipo_vehiculo: 'moto' | 'taxi';
  estado_codigo: string;
  estado_nombre: string;
  solicitado_en: string;
  tarifa: number;
  cliente_nombre: string;
  conductor_nombre: string | null;
  placa: string | null;
  origen: string;
  destino: string;
  motivo_cancelacion: string | null;
  minutos: number;
}

/** Lo que se elige en "Servicio": combina tipo de servicio y vehículo como lo piensa el equipo. */
const SERVICIOS: Record<string, { tipo_servicio?: string; tipo_vehiculo?: string }> = {
  todos: {},
  moto: { tipo_servicio: 'transporte', tipo_vehiculo: 'moto' },
  taxi: { tipo_servicio: 'transporte', tipo_vehiculo: 'taxi' },
  domicilio: { tipo_servicio: 'domicilio' },
  encomienda: { tipo_servicio: 'encomienda' },
};
/** Espera tras la última tecla antes de buscar. */
const ESPERA_MS = 350;

/**
 * Supervisión de solicitudes: filtros por servicio (moto, taxi, domicilio, encomienda), estado, fechas y texto
 * (número, cliente, conductor, placa o dirección), todo filtrado y paginado en la base. Tocar una fila abre el
 * detalle con la línea de tiempo, el chat y las acciones controladas (cancelar o reasignar, siempre con motivo).
 */
@Component({
  selector: 'app-admin-servicios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-servicios.html',
  styleUrls: ['../home-admin.css', './admin-servicios.css'],
})
export class AdminServiciosComponent implements OnInit, OnChanges {
  /** Cambia cuando el panel cancela o reasigna algo: la lista se recarga. */
  @Input() recargar = 0;
  @Output() abrir = new EventEmitter<number>();

  servicio = 'todos';
  estado = '';
  desde = '';
  hasta = '';
  q = '';
  pagina = 0;
  readonly tamano = 20;

  items: Solicitud[] = [];
  total = 0;
  cargando = false;
  error = '';
  private espera?: ReturnType<typeof setTimeout>;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnChanges(): void {
    if (this.items.length) this.cargar();
  }

  get paginas(): number {
    return Math.max(1, Math.ceil(this.total / this.tamano));
  }

  /** Cualquier filtro vuelve a la primera página. */
  filtrar(): void {
    this.pagina = 0;
    this.cargar();
  }

  escribir(): void {
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.filtrar(), ESPERA_MS);
  }

  limpiar(): void {
    this.servicio = 'todos';
    this.estado = '';
    this.desde = '';
    this.hasta = '';
    this.q = '';
    this.filtrar();
  }

  ir(p: number): void {
    if (p < 0 || p >= this.paginas) return;
    this.pagina = p;
    this.cargar();
  }

  nombreServicio(s: Solicitud): string {
    if (s.tipo_servicio === 'transporte') return s.tipo_vehiculo === 'moto' ? 'Moto' : 'Taxi';
    return s.tipo_servicio === 'domicilio' ? 'Domicilio' : 'Encomienda';
  }

  icono(s: Solicitud): string {
    return s.tipo_servicio === 'transporte' ? 'vivo' : s.tipo_servicio === 'domicilio' ? 'soporte' : 'documento';
  }

  atascado(s: Solicitud): boolean {
    return s.estado_codigo === 'buscando' ? s.minutos >= 2 : ['asignado', 'en_origen'].includes(s.estado_codigo) && s.minutos >= 30;
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const r = await this.api.get<{ items: Solicitud[]; total: number }>('/admin/servicios/buscar', {
        ...SERVICIOS[this.servicio],
        estado: this.estado || null,
        desde: this.desde || null,
        hasta: this.hasta || null,
        q: this.q.trim() || null,
        pagina: this.pagina,
        tamano: this.tamano,
      });
      this.items = r.items;
      this.total = Number(r.total);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar las solicitudes.');
    } finally {
      this.cargando = false;
    }
  }
}
