import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

interface Operacion {
  tipos_vehiculo: { codigo: string; nombre: string; capacidad_pasajeros: number }[];
  tipos_servicio: { codigo: string; nombre: string; descripcion: string | null }[];
  permitidos: { tipo_servicio: string; tipo_vehiculo: string }[];
  limites: { clave: string; valor: string; descripcion: string }[];
}

interface Prohibido {
  base: Record<string, string[]>;
  permitidos_base: string[];
  agregadas: { id: number; palabra: string; categoria: string; tipo: 'prohibida' | 'permitida'; creado_en: string; creado_por: string | null }[];
}

/**
 * Catálogos de operación: qué vehículo hace qué servicio, los límites de domicilios y encomiendas (se cambian en
 * Configuración) y el contenido prohibido. La lista base de palabras prohibidas está en el código (probada); aquí
 * se agregan palabras nuevas o excepciones legales y se aplican al instante, sin desplegar.
 */
@Component({
  selector: 'app-admin-operacion',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-operacion.html',
  styleUrls: ['../home-admin.css', '../admin-catalogos/admin-catalogos.css', './admin-operacion.css'],
})
export class AdminOperacionComponent implements OnInit {
  @Input() soloLectura = false;
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();
  @Output() ir = new EventEmitter<string>();

  op: Operacion | null = null;
  pr: Prohibido | null = null;
  error = '';

  palabra = '';
  categoria = 'drogas';
  tipo: 'prohibida' | 'permitida' = 'prohibida';
  guardando = false;
  errorPalabra = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get categorias(): string[] {
    return [...Object.keys(this.pr?.base ?? {}), 'otros'];
  }

  permitido(servicio: string, vehiculo: string): boolean {
    return !!this.op?.permitidos.some(p => p.tipo_servicio === servicio && p.tipo_vehiculo === vehiculo);
  }

  async agregar(): Promise<void> {
    if (this.guardando) return;
    if (this.palabra.trim().length < 3) {
      this.errorPalabra = 'Escribe una palabra o frase de al menos 3 letras.';
      return;
    }
    this.guardando = true;
    this.errorPalabra = '';
    try {
      const r = await this.api.post<{ message: string }>('/admin/catalogos/contenido-prohibido', {
        palabra: this.palabra.trim(), categoria: this.categoria, tipo: this.tipo,
      });
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      this.palabra = '';
      await this.cargar();
    } catch (err) {
      this.errorPalabra = ApiService.mensaje(err, 'No se pudo agregar.');
    } finally {
      this.guardando = false;
    }
  }

  async quitar(id: number, palabra: string): Promise<void> {
    if (!confirm(`¿Quitar «${palabra}» de la lista?`)) return;
    try {
      await this.api.delete(`/admin/catalogos/contenido-prohibido/${id}`);
      this.aviso.emit({ tipo: 'ok', texto: `«${palabra}» quitada.` });
      await this.cargar();
    } catch (err) {
      this.aviso.emit({ tipo: 'error', texto: ApiService.mensaje(err, 'No se pudo quitar.') });
    }
  }

  private async cargar(): Promise<void> {
    try {
      const [op, pr] = await Promise.all([
        this.api.get<Operacion>('/admin/catalogos/operacion'),
        this.api.get<Prohibido>('/admin/catalogos/contenido-prohibido'),
      ]);
      this.op = op;
      this.pr = pr;
      this.error = '';
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar los catálogos.');
    }
  }
}
