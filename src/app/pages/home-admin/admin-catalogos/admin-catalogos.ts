import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

/** Fila de GET /api/admin/catalogos/motivos-cancelacion */
export interface MotivoCancelacion {
  id: number;
  actor: 'cliente' | 'conductor' | 'admin' | 'sistema';
  descripcion: string;
  activo: boolean;
}

/** Fila de GET /api/admin/catalogos/tipos-documento */
export interface TipoDocumento {
  codigo: string;
  nombre: string;
  aplica_a: 'conductor' | 'vehiculo';
  requiere_vencimiento: boolean;
  obligatorio_moto: boolean;
  obligatorio_taxi: boolean;
  paso: 'identidad' | 'licencia' | 'vehiculo' | 'documentos';
  orden: number;
  solo_imagen: boolean;
  exigir_desde_anios: number | null;
  ayuda: string | null;
}

type Pestana = 'motivos' | 'documentos';

const ACTORES: Record<string, string> = {
  cliente: 'Cliente', conductor: 'Conductor', admin: 'Plataforma', sistema: 'Sistema'
};
const PASOS: Record<string, string> = {
  identidad: 'Identidad', licencia: 'Licencia', vehiculo: 'Vehículo', documentos: 'Documentos'
};

/**
 * Sección "Datos básicos" del panel (tarea 1.5): el admin consulta, crea, edita y elimina
 * los motivos de cancelación y los tipos de documento. Soporte solo consulta.
 * Las reglas (qué no se puede borrar, validaciones) viven en el backend; aquí se muestra su mensaje.
 */
@Component({
  selector: 'app-admin-catalogos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-catalogos.html',
  // Reutiliza los estilos del panel para que la sección se vea igual a las demás
  styleUrls: ['../home-admin.css', './admin-catalogos.css']
})
export class AdminCatalogosComponent implements OnInit {
  /** Soporte ve los catálogos pero no los cambia (el backend lo exige igual). */
  @Input() soloLectura = false;

  pestana: Pestana = 'motivos';
  readonly actores = Object.entries(ACTORES);
  readonly pasos = Object.entries(PASOS);

  motivos: MotivoCancelacion[] = [];
  tipos: TipoDocumento[] = [];
  cargando = false;
  error = '';

  // Formulario (modal) de crear / editar
  mostrarForm = false;
  editando = false;
  guardando = false;
  errorForm = '';
  motivoForm: MotivoCancelacion = this.motivoVacio();
  tipoForm: TipoDocumento = this.tipoVacio();

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      [this.motivos, this.tipos] = await Promise.all([
        this.api.get<MotivoCancelacion[]>('/admin/catalogos/motivos-cancelacion'),
        this.api.get<TipoDocumento[]>('/admin/catalogos/tipos-documento')
      ]);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudieron cargar los datos básicos. Si acabas de actualizar, cierra sesión y vuelve a entrar.');
    } finally {
      this.cargando = false;
    }
  }

  // ─── Crear / editar ────────────────────────────
  nuevo(): void {
    this.editando = false;
    this.motivoForm = this.motivoVacio();
    this.tipoForm = this.tipoVacio();
    this.abrirForm();
  }

  editarMotivo(m: MotivoCancelacion): void {
    this.editando = true;
    this.motivoForm = { ...m };
    this.abrirForm();
  }

  editarTipo(t: TipoDocumento): void {
    this.editando = true;
    this.tipoForm = { ...t };
    this.abrirForm();
  }

  cerrarForm(): void {
    this.mostrarForm = false;
    this.errorForm = '';
  }

  async guardar(): Promise<void> {
    if (this.guardando) return;
    this.guardando = true;
    this.errorForm = '';
    try {
      if (this.pestana === 'motivos') {
        const m = this.motivoForm;
        const cuerpo = { actor: m.actor, descripcion: m.descripcion, activo: m.activo };
        if (this.editando) await this.api.put(`/admin/catalogos/motivos-cancelacion/${m.id}`, cuerpo);
        else await this.api.post('/admin/catalogos/motivos-cancelacion', cuerpo);
      } else {
        const t = this.tipoForm;
        const cuerpo = {
          codigo: t.codigo, nombre: t.nombre, aplicaA: t.aplica_a, requiereVencimiento: t.requiere_vencimiento,
          obligatorioMoto: t.obligatorio_moto, obligatorioTaxi: t.obligatorio_taxi, paso: t.paso, orden: t.orden,
          soloImagen: t.solo_imagen, exigirDesdeAnios: t.exigir_desde_anios || null, ayuda: t.ayuda
        };
        if (this.editando) await this.api.put(`/admin/catalogos/tipos-documento/${encodeURIComponent(t.codigo)}`, cuerpo);
        else await this.api.post('/admin/catalogos/tipos-documento', cuerpo);
      }
      this.cerrarForm();
      await this.cargar();
    } catch (err) {
      this.errorForm = ApiService.mensaje(err, 'No se pudo guardar.');
    } finally {
      this.guardando = false;
    }
  }

  // ─── Eliminar ──────────────────────────────────
  async eliminarMotivo(m: MotivoCancelacion): Promise<void> {
    if (!confirm(`¿Eliminar el motivo "${m.descripcion}"?`)) return;
    await this.eliminar(`/admin/catalogos/motivos-cancelacion/${m.id}`);
  }

  async eliminarTipo(t: TipoDocumento): Promise<void> {
    if (!confirm(`¿Eliminar el tipo de documento "${t.nombre}"?`)) return;
    await this.eliminar(`/admin/catalogos/tipos-documento/${encodeURIComponent(t.codigo)}`);
  }

  private async eliminar(ruta: string): Promise<void> {
    try {
      await this.api.delete(ruta);
      await this.cargar();
    } catch (err) {
      alert(ApiService.mensaje(err, 'No se pudo eliminar.'));
    }
  }

  // ─── Ayudas para la vista ──────────────────────
  actorTexto(a: string): string {
    return ACTORES[a] || a;
  }

  pasoTexto(p: string): string {
    return PASOS[p] || p;
  }

  obligatorioTexto(t: TipoDocumento): string {
    if (t.obligatorio_moto && t.obligatorio_taxi) return 'Moto y taxi';
    if (t.obligatorio_moto) return 'Moto';
    if (t.obligatorio_taxi) return 'Taxi';
    return 'Opcional';
  }

  private abrirForm(): void {
    this.errorForm = '';
    this.mostrarForm = true;
  }

  private motivoVacio(): MotivoCancelacion {
    return { id: 0, actor: 'cliente', descripcion: '', activo: true };
  }

  private tipoVacio(): TipoDocumento {
    return {
      codigo: '', nombre: '', aplica_a: 'conductor', requiere_vencimiento: false, obligatorio_moto: false,
      obligatorio_taxi: false, paso: 'documentos', orden: 50, solo_imagen: false, exigir_desde_anios: null, ayuda: ''
    };
  }
}
