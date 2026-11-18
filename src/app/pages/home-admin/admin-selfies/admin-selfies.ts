import { Component, EventEmitter, OnDestroy, OnInit, Output, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';

/** Fila de GET /api/admin/selfies (V22). */
interface Selfie {
  id: number;
  conductor_id: number;
  conductor_nombre: string;
  foto_url: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  creado_en: string;
  disponible: boolean;
}

/**
 * Selfies de los conductores antes de conectarse (como el "Real-Time ID Check" de Uber).
 * Soporte compara la selfie con la foto de perfil: si no es la misma persona la rechaza y el conductor queda
 * desconectado hasta tomarse otra. Las fotos son privadas: se descargan con el token (blob).
 */
@Component({
  selector: 'app-admin-selfies',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="adm-card">
      <div class="adm-card-head">
        <div>
          <h2>Selfies por revisar</h2>
          <p class="adm-card-sub">¿Es la misma persona de la foto de perfil? Si no, recházala: el conductor queda desconectado.</p>
        </div>
        <span class="adm-pill-num">{{ selfies.length }}</span>
      </div>
      @if (error) {
        <p class="adm-error" role="alert">{{ error }}</p>
      }
      @if (!selfies.length && !error) {
        <p class="adm-card-sub">No hay selfies pendientes.</p>
      }
      <ul class="sf-lista">
        @for (s of selfies; track s.id) {
          <li class="sf-item">
            <div class="sf-fotos">
              <figure>
                @if (perfiles[s.id]) { <img [src]="perfiles[s.id]" alt="Foto de perfil de {{ s.conductor_nombre }}" /> }
                @else { <span class="sf-sin">Sin foto de perfil</span> }
                <figcaption>Perfil</figcaption>
              </figure>
              <figure>
                @if (imagenes[s.id]) { <img [src]="imagenes[s.id]" alt="Selfie de {{ s.conductor_nombre }}" /> }
                @else { <span class="sf-sin">Cargando…</span> }
                <figcaption>Selfie · {{ s.creado_en | date: 'd MMM, h:mm a' }}</figcaption>
              </figure>
            </div>
            <div class="sf-acciones">
              <b>{{ s.conductor_nombre }}</b>
              <span class="adm-card-sub">{{ s.disponible ? 'En línea ahora' : 'Desconectado' }}</span>
              <button type="button" class="adm-btn adm-btn-ok" [disabled]="ocupado === s.id" (click)="revisar(s, true)">Es la misma persona</button>
              <button type="button" class="adm-btn adm-btn-peligro" [disabled]="ocupado === s.id" (click)="revisar(s, false)">No coincide</button>
            </div>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .sf-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .sf-item { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 220px); gap: 12px; align-items: center;
      padding: 12px; border-radius: 12px; background: var(--fondo-suave, #f5f7fa); }
    .sf-fotos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    figure { margin: 0; }
    img, .sf-sin { display: grid; place-items: center; width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px;
      background: #e3e9f0; font-size: 12px; color: #5a6b7d; }
    figcaption { margin-top: 4px; font-size: 12px; color: #5a6b7d; }
    .sf-acciones { display: grid; gap: 6px; }
    @media (max-width: 700px) { .sf-item { grid-template-columns: minmax(0, 1fr); } }
  `,
})
export class AdminSelfiesComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cd = inject(ChangeDetectorRef);
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();

  selfies: Selfie[] = [];
  imagenes: Record<number, string> = {};
  perfiles: Record<number, string> = {};
  error = '';
  ocupado: number | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    [...Object.values(this.imagenes), ...Object.values(this.perfiles)].forEach((u) => URL.revokeObjectURL(u));
  }

  async cargar(): Promise<void> {
    try {
      this.selfies = await this.api.get<Selfie[]>('/admin/selfies', { estado: 'pendiente' });
      this.error = '';
      for (const s of this.selfies) {
        if (!this.imagenes[s.id]) {
          this.api.blob(`/admin/selfies/${s.id}/archivo`).then((b) => {
            this.imagenes[s.id] = URL.createObjectURL(b);
            this.cd.markForCheck();
          }).catch(() => undefined);
        }
        // La foto de perfil es pública (/api/usuarios/{id}/foto/...): se pide igual como blob
        if (s.foto_url && !this.perfiles[s.id] && s.foto_url.startsWith('/api/')) {
          this.api.blob(s.foto_url.substring(4)).then((b) => {
            this.perfiles[s.id] = URL.createObjectURL(b);
            this.cd.markForCheck();
          }).catch(() => undefined);
        }
      }
    } catch (e) {
      this.error = ApiService.mensaje(e, 'No se pudieron cargar las selfies.');
    }
    this.cd.markForCheck();
  }

  async revisar(s: Selfie, aprobar: boolean): Promise<void> {
    let motivo: string | null = null;
    if (!aprobar) {
      motivo = prompt(`¿Por qué la selfie de ${s.conductor_nombre} no coincide?`, 'No es la misma persona de la foto de perfil');
      if (!motivo || !motivo.trim()) return;
    }
    this.ocupado = s.id;
    try {
      const r = await this.api.post<{ message: string }>(`/admin/selfies/${s.id}/revisar`, { aprobar, motivo });
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      this.selfies = this.selfies.filter((x) => x.id !== s.id);
    } catch (e) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(e, 'No se pudo guardar la revisión.') });
    } finally {
      this.ocupado = null;
      this.cd.markForCheck();
    }
  }
}
