import { Component, EventEmitter, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

type Audiencia = 'todos' | 'clientes' | 'conductores';

interface Comunicado {
  id: number;
  titulo: string;
  mensaje: string;
  audiencia: Audiencia;
  destinatarios: number;
  creado_en: string;
  enviado_por: string | null;
}

/**
 * Comunicados masivos (POST /api/admin/comunicados): "Hoy hay paro", "Nuevas tarifas desde el lunes".
 * Llegan a la bandeja de notificaciones de la app y como push. Antes de enviar se muestra a cuántas personas
 * les llegará y se pide confirmar: un comunicado no se puede borrar del celular de la gente.
 */
@Component({
  selector: 'app-admin-comunicados',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-comunicados.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../home-admin.css', './admin-comunicados.css'],
})
export class AdminComunicadosComponent implements OnInit {
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();

  readonly audiencias: { id: Audiencia; nombre: string; detalle: string }[] = [
    { id: 'todos', nombre: 'Todos', detalle: 'Clientes y conductores' },
    { id: 'clientes', nombre: 'Clientes', detalle: 'Quienes piden servicios' },
    { id: 'conductores', nombre: 'Conductores', detalle: 'Motos y taxis aprobados' },
  ];

  titulo = '';
  mensaje = '';
  audiencia: Audiencia = 'todos';
  alcance: number | null = null;
  confirmando = false;
  enviando = false;
  error = '';
  enviados: Comunicado[] = [];
  cargando = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
    this.calcularAlcance();
  }

  get valido(): boolean {
    return this.titulo.trim().length >= 3 && this.mensaje.trim().length >= 5;
  }

  nombreAudiencia(a: Audiencia): string {
    return this.audiencias.find((x) => x.id === a)?.nombre ?? a;
  }

  elegir(a: Audiencia): void {
    this.audiencia = a;
    this.confirmando = false;
    this.calcularAlcance();
  }

  async calcularAlcance(): Promise<void> {
    this.alcance = null;
    try {
      const r = await this.api.get<{ personas: number }>('/admin/comunicados/alcance', {
        audiencia: this.audiencia,
      });
      this.alcance = r.personas;
    } catch {
      this.alcance = null;
    }
  }

  /** Primer clic: muestra el resumen. Segundo clic (confirmar): envía. */
  revisar(): void {
    this.error = '';
    if (!this.valido) {
      this.error = 'Escribe un título (3 letras o más) y el mensaje (5 letras o más).';
      return;
    }
    this.confirmando = true;
  }

  async enviar(): Promise<void> {
    if (this.enviando) return;
    this.enviando = true;
    this.error = '';
    try {
      const r = await this.api.post<{ message: string }>('/admin/comunicados', {
        titulo: this.titulo.trim(),
        mensaje: this.mensaje.trim(),
        audiencia: this.audiencia,
      });
      this.aviso.emit({ tipo: 'ok', texto: r.message });
      this.titulo = '';
      this.mensaje = '';
      this.confirmando = false;
      this.cargar();
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo enviar el comunicado.');
      this.confirmando = false;
    } finally {
      this.enviando = false;
    }
  }

  async cargar(): Promise<void> {
    this.cargando = true;
    try {
      this.enviados = await this.api.get<Comunicado[]>('/admin/comunicados');
    } catch {
      this.enviados = [];
    } finally {
      this.cargando = false;
    }
  }
}
