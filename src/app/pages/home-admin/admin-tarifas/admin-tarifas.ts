import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** Fila de GET /api/admin/tarifas (tabla tarifas). */
interface Tarifa {
  id: number;
  tipo_servicio: 'transporte' | 'domicilio' | 'encomienda';
  tipo_vehiculo: 'moto' | 'taxi';
  tarifa_base: number;
  valor_km: number;
  valor_minuto: number;
  tarifa_minima: number;
  recargo_nocturno_pct: number;
  recargo_lluvia_pct: number;
  vigente_desde: string;
  activo: boolean;
  creado_en: string;
}

interface Combinacion {
  clave: string;
  servicio: Tarifa['tipo_servicio'];
  vehiculo: Tarifa['tipo_vehiculo'];
  nombre: string;
  activa: Tarifa | null;
  historial: Tarifa[];
}

/** Combinaciones permitidas (servicio_vehiculo_permitido): el domicilio solo va en moto. */
const COMBINACIONES: { servicio: Tarifa['tipo_servicio']; vehiculo: Tarifa['tipo_vehiculo']; nombre: string }[] = [
  { servicio: 'transporte', vehiculo: 'moto', nombre: 'Viaje en moto' },
  { servicio: 'transporte', vehiculo: 'taxi', nombre: 'Viaje en taxi' },
  { servicio: 'domicilio', vehiculo: 'moto', nombre: 'Domicilio' },
  { servicio: 'encomienda', vehiculo: 'moto', nombre: 'Encomienda en moto' },
  { servicio: 'encomienda', vehiculo: 'taxi', nombre: 'Encomienda en taxi' },
];

/** Viaje de ejemplo para que el admin vea el precio final (lo típico en Buenaventura). */
const EJEMPLO_KM = 3;
const EJEMPLO_MIN = 10;

/**
 * Tarifas: la activa de cada servicio y vehículo, con un viaje de ejemplo de día y de noche para ver el precio
 * real antes de guardar. Una tarifa no se edita (la base lo impide): guardar crea una nueva y desactiva la anterior,
 * así cada servicio conserva la tarifa con la que se cobró. Soporte la ve pero no la cambia.
 */
@Component({
  selector: 'app-admin-tarifas',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-tarifas.html',
  styleUrls: ['../home-admin.css', '../admin-catalogos/admin-catalogos.css', './admin-tarifas.css'],
})
export class AdminTarifasComponent implements OnInit {
  @Input() soloLectura = false;
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();

  combinaciones: Combinacion[] = [];
  cargando = false;
  error = '';
  readonly ejemploKm = EJEMPLO_KM;
  readonly ejemploMin = EJEMPLO_MIN;

  /** Combinación que se está editando y los valores del formulario. */
  editando: Combinacion | null = null;
  form = { tarifa_base: 0, valor_km: 0, valor_minuto: 0, tarifa_minima: 0, recargo_nocturno_pct: 0, recargo_lluvia_pct: 0 };
  /** Recargo por lluvia prendido ahora (configuracion_sistema.lluvia_activa). */
  lluvia = false;
  cambiandoLluvia = false;
  errorForm = '';
  guardando = false;
  historialAbierto: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
    this.api.get<{ lluvia_activa: boolean }>('/admin/resumen-dia').then(r => (this.lluvia = !!r.lluvia_activa)).catch(() => undefined);
  }

  /** "Está lloviendo": prende o apaga el recargo por lluvia de todas las tarifas (queda en la auditoría). */
  async alternarLluvia(): Promise<void> {
    if (this.cambiandoLluvia) return;
    const prender = !this.lluvia;
    if (prender && !confirm('¿Prender el recargo por lluvia? Desde ya, los servicios nuevos cuestan más según el % de lluvia de cada tarifa.')) return;
    this.cambiandoLluvia = true;
    try {
      await this.api.put('/admin/configuracion/lluvia_activa', { valor: prender ? '1' : '0' });
      this.lluvia = prender;
      this.aviso.emit({ tipo: 'ok', texto: prender ? 'Recargo por lluvia prendido. Apágalo cuando escampe.' : 'Recargo por lluvia apagado.' });
    } catch (err) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(err, 'No se pudo cambiar el recargo por lluvia.') });
    } finally {
      this.cambiandoLluvia = false;
    }
  }

  /**
   * Misma fórmula que la base (fn_calcular_tarifa): base + km × valor_km + min × valor_minuto, recargo nocturno,
   * nunca menos de la mínima y redondeado a la centena hacia arriba (para el efectivo).
   */
  precio(t: Pick<Tarifa, 'tarifa_base' | 'valor_km' | 'valor_minuto' | 'tarifa_minima' | 'recargo_nocturno_pct' | 'recargo_lluvia_pct'>,
      noche: boolean, lluvia = false): number {
    let v = Number(t.tarifa_base) + EJEMPLO_KM * Number(t.valor_km) + EJEMPLO_MIN * Number(t.valor_minuto);
    const recargo = (noche ? Number(t.recargo_nocturno_pct) : 0) + (lluvia ? Number(t.recargo_lluvia_pct || 0) : 0);
    v *= 1 + recargo / 100;
    v = Math.max(v, Number(t.tarifa_minima));
    return Math.ceil(v / 100) * 100;
  }

  /** Diferencia del precio de ejemplo frente a la tarifa activa ("+$600" / "−$300"). */
  get diferencia(): number {
    return this.editando?.activa ? this.precio(this.form, false) - this.precio(this.editando.activa, false) : 0;
  }

  editar(c: Combinacion): void {
    this.editando = c;
    this.errorForm = '';
    const a = c.activa;
    this.form = {
      tarifa_base: Number(a?.tarifa_base ?? 0),
      valor_km: Number(a?.valor_km ?? 0),
      valor_minuto: Number(a?.valor_minuto ?? 0),
      tarifa_minima: Number(a?.tarifa_minima ?? 0),
      recargo_nocturno_pct: Number(a?.recargo_nocturno_pct ?? 0),
      recargo_lluvia_pct: Number(a?.recargo_lluvia_pct ?? 0),
    };
  }

  async guardar(): Promise<void> {
    const c = this.editando;
    if (!c || this.guardando) return;
    const f = this.form;
    const valores = [f.tarifa_base, f.valor_km, f.valor_minuto, f.tarifa_minima, f.recargo_nocturno_pct, f.recargo_lluvia_pct];
    if (valores.some(v => v === null || isNaN(Number(v)) || Number(v) < 0)) {
      this.errorForm = 'Todos los valores son obligatorios y no pueden ser negativos.';
      return;
    }
    if (Number(f.recargo_nocturno_pct) > 100 || Number(f.recargo_lluvia_pct) > 100) {
      this.errorForm = 'Los recargos van de 0 a 100 %.';
      return;
    }
    if (Number(f.tarifa_minima) <= 0) {
      this.errorForm = 'La tarifa mínima tiene que ser mayor que 0 (es lo menos que cobra un servicio corto).';
      return;
    }
    this.guardando = true;
    this.errorForm = '';
    try {
      await this.api.post('/admin/tarifas', { tipo_servicio: c.servicio, tipo_vehiculo: c.vehiculo, ...f });
      this.aviso.emit({ tipo: 'ok', texto: `Nueva tarifa de "${c.nombre}" activa. Los servicios ya pedidos conservan su precio.` });
      this.editando = null;
      await this.cargar();
    } catch (err) {
      this.errorForm = ApiService.mensaje(err, 'No se pudo guardar la tarifa.');
    } finally {
      this.guardando = false;
    }
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const todas = await this.api.get<Tarifa[]>('/admin/tarifas');
      this.combinaciones = COMBINACIONES.map(c => {
        const propias = todas.filter(t => t.tipo_servicio === c.servicio && t.tipo_vehiculo === c.vehiculo);
        return {
          ...c,
          clave: `${c.servicio}-${c.vehiculo}`,
          activa: propias.find(t => t.activo) ?? null,
          historial: propias.filter(t => !t.activo).sort((a, b) => b.creado_en.localeCompare(a.creado_en)),
        };
      });
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar las tarifas.');
    } finally {
      this.cargando = false;
    }
  }
}
