import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** Fila de GET /api/admin/calificaciones */
interface Calificacion {
  id: number;
  servicio_id: number;
  puntuacion: number;
  comentario: string | null;
  creado_en: string;
  tipo_servicio: string;
  tipo_vehiculo: string;
  calificado_id: number;
  calificado_nombre: string;
  calificado_rol: 'conductor' | 'cliente';
  promedio_calificado: number | null;
  estado_calificado: string;
  calificador_nombre: string;
}

/**
 * Calificaciones bajas (1–2 estrellas por defecto): a quién, de quién, el comentario y el promedio de la persona.
 * Desde aquí se abre el viaje (línea de tiempo y chat) o el perfil de la persona para darle seguimiento; las quejas
 * formales siguen su curso en Soporte (PQRS).
 */
@Component({
  selector: 'app-admin-calificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  template: `
    <div class="cal">
      <div class="adm-barra-herr">
        <div class="adm-pills" role="tablist" aria-label="A quién">
          @for (o of opciones; track o.id) {
            <button type="button" role="tab" class="adm-pill" [class.activo]="a === o.id" [attr.aria-selected]="a === o.id" (click)="a = o.id; filtrar()">{{ o.nombre }}</button>
          }
        </div>
        <label class="adm-select"><span class="adm-sr">Estrellas</span>
          <select [(ngModel)]="maximo" (ngModelChange)="filtrar()">
            <option [ngValue]="1">Solo 1 estrella</option>
            <option [ngValue]="2">1 y 2 estrellas</option>
            <option [ngValue]="3">3 estrellas o menos</option>
          </select>
        </label>
        <span class="adm-contador">{{ total }} calificaciones</span>
      </div>
      @if (error) { <p class="adm-error" role="alert">{{ error }}</p> }
      <div class="cal-lista">
        @for (c of items; track c.id) {
          <article class="adm-card cal-item" [class.mala]="c.puntuacion === 1">
            <header class="cal-cabeza">
              <span class="cal-estrellas" [attr.aria-label]="c.puntuacion + ' de 5 estrellas'">{{ estrellas(c.puntuacion) }}</span>
              <small>{{ c.creado_en | date:'d MMM y, h:mm a' }}</small>
            </header>
            <p class="cal-texto">{{ c.comentario || 'Sin comentario.' }}</p>
            <p class="adm-lista-sub">
              <b>{{ c.calificador_nombre }}</b> calificó a <b>{{ c.calificado_nombre }}</b> ({{ c.calificado_rol === 'conductor' ? 'conductor' : 'pasajero' }}
              · promedio {{ c.promedio_calificado ? (c.promedio_calificado | number:'1.1-1') : '—' }} ★{{ c.estado_calificado !== 'activo' ? ' · ' + c.estado_calificado : '' }})
            </p>
            <div class="adm-pie-botones">
              <button type="button" class="adm-btn adm-btn-borde" (click)="abrirServicio.emit(c.servicio_id)">Viaje #{{ c.servicio_id }}</button>
              <button type="button" class="adm-btn adm-btn-borde" (click)="verPersona.emit({ id: c.calificado_id, rol: c.calificado_rol })">Ver {{ c.calificado_rol === 'conductor' ? 'conductor' : 'pasajero' }}</button>
            </div>
          </article>
        } @empty {
          <div class="adm-card adm-vacio-ok"><adm-ico n="escudo" /> {{ cargando ? 'Cargando…' : 'No hay calificaciones bajas con ese filtro.' }}</div>
        }
      </div>
      @if (total > tamano) {
        <nav class="adm-mas" aria-label="Páginas">
          <button type="button" class="adm-btn adm-btn-borde" (click)="ir(pagina - 1)" [disabled]="pagina === 0">Anterior</button>
          <span>Página {{ pagina + 1 }} de {{ paginas }}</span>
          <button type="button" class="adm-btn adm-btn-borde" (click)="ir(pagina + 1)" [disabled]="pagina + 1 >= paginas">Siguiente</button>
        </nav>
      }
    </div>
  `,
  styleUrls: ['../home-admin.css'],
  styles: `
    .cal { display: flex; flex-direction: column; gap: 16px; }
    .cal-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
    .cal-item { display: flex; flex-direction: column; gap: 8px; border-left: 4px solid var(--naranja); }
    .cal-item.mala { border-left-color: #E5484D; }
    .cal-cabeza { display: flex; justify-content: space-between; align-items: center; }
    .cal-cabeza small { color: var(--texto-3); font-weight: 700; }
    .cal-estrellas { color: #F5A623; font-size: 18px; letter-spacing: 2px; }
    .cal-texto { margin: 0; font-size: 15px; font-weight: 600; }
    @media (max-width: 480px) { .cal-lista { grid-template-columns: 1fr; } }
  `,
})
export class AdminCalificacionesComponent implements OnInit {
  @Output() abrirServicio = new EventEmitter<number>();
  @Output() verPersona = new EventEmitter<{ id: number; rol: 'conductor' | 'cliente' }>();

  readonly opciones = [
    { id: '', nombre: 'Todas' },
    { id: 'conductor', nombre: 'A conductores' },
    { id: 'cliente', nombre: 'A pasajeros' },
  ];
  a = '';
  maximo = 2;
  pagina = 0;
  readonly tamano = 20;
  items: Calificacion[] = [];
  total = 0;
  cargando = false;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get paginas(): number {
    return Math.max(1, Math.ceil(this.total / this.tamano));
  }

  estrellas(n: number): string {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  filtrar(): void {
    this.pagina = 0;
    this.cargar();
  }

  ir(p: number): void {
    if (p < 0 || p >= this.paginas) return;
    this.pagina = p;
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const r = await this.api.get<{ items: Calificacion[]; total: number }>('/admin/calificaciones', {
        maximo: this.maximo, a: this.a || null, pagina: this.pagina, tamano: this.tamano,
      });
      this.items = r.items;
      this.total = Number(r.total);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar las calificaciones.');
    } finally {
      this.cargando = false;
    }
  }
}
