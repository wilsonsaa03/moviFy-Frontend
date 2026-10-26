import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { AdminIcoComponent } from '../admin-ico';

/** Fila de GET /api/admin/configuracion (tabla configuracion_sistema). */
interface Parametro {
  clave: string;
  valor: string;
  descripcion: string | null;
  actualizado_en: string;
}

interface Grupo {
  nombre: string;
  ayuda: string;
  parametros: Parametro[];
}

/** Grupo y unidad de cada parámetro conocido; lo que no esté aquí sale en "Otros". */
const META: Record<string, { grupo: string; unidad?: string }> = {
  radio_busqueda_km: { grupo: 'busqueda', unidad: 'km' },
  radio_favoritos_km: { grupo: 'busqueda', unidad: 'km' },
  tiempo_busqueda_seg: { grupo: 'busqueda', unidad: 'segundos' },
  ubicacion_vigencia_seg: { grupo: 'busqueda', unidad: 'segundos' },
  minutos_espera_conductor: { grupo: 'viaje', unidad: 'minutos' },
  max_aumento_tarifa_pct: { grupo: 'viaje', unidad: '%' },
  max_aumentos_tarifa: { grupo: 'viaje', unidad: 'veces' },
  hora_inicio_nocturno: { grupo: 'viaje', unidad: 'h (0–23)' },
  hora_fin_nocturno: { grupo: 'viaje', unidad: 'h (0–23)' },
  dias_para_calificar: { grupo: 'viaje', unidad: 'días' },
  peso_max_moto_kg: { grupo: 'viaje', unidad: 'kg' },
  minutos_anticipo_programado: { grupo: 'programados', unidad: 'minutos' },
  min_minutos_programar: { grupo: 'programados', unidad: 'minutos' },
  max_dias_programar: { grupo: 'programados', unidad: 'días' },
  max_programados_cliente: { grupo: 'programados', unidad: 'viajes' },
  telefono_central: { grupo: 'seguridad' },
  horas_enlace_compartido: { grupo: 'seguridad', unidad: 'horas' },
  max_contactos_emergencia: { grupo: 'seguridad', unidad: 'contactos' },
  otp_vigencia_seg: { grupo: 'cuentas', unidad: 'segundos' },
  otp_max_intentos: { grupo: 'cuentas', unidad: 'intentos' },
  otp_max_envios_hora: { grupo: 'cuentas', unidad: 'SMS / hora' },
  max_intentos_fallidos: { grupo: 'cuentas', unidad: 'intentos' },
  minutos_ventana_intentos: { grupo: 'cuentas', unidad: 'minutos' },
  minutos_bloqueo_acceso: { grupo: 'cuentas', unidad: 'minutos' },
  horas_vida_access_token: { grupo: 'cuentas', unidad: 'horas' },
  dias_vida_refresh_token: { grupo: 'cuentas', unidad: 'días' },
  ciudad_operacion: { grupo: 'cobertura' },
  cobertura_lat: { grupo: 'cobertura', unidad: '°' },
  cobertura_lng: { grupo: 'cobertura', unidad: '°' },
  cobertura_radio_km: { grupo: 'cobertura', unidad: 'km' },
  retencion_seguimiento_dias: { grupo: 'datos', unidad: 'días' },
};

const GRUPOS: { id: string; nombre: string; ayuda: string }[] = [
  { id: 'busqueda', nombre: 'Búsqueda de conductores', ayuda: 'A quién se le ofrece un pedido y por cuánto tiempo se busca.' },
  { id: 'viaje', nombre: 'Viajes y tarifas', ayuda: 'Espera en la recogida, cuánto puede subir la tarifa el pasajero y horario nocturno.' },
  { id: 'programados', nombre: 'Viajes programados', ayuda: 'Desde cuándo y hasta cuándo se puede programar, y cuándo arranca la búsqueda.' },
  { id: 'seguridad', nombre: 'Seguridad del pasajero', ayuda: 'Central para pedir por llamada, enlace para compartir el viaje y contactos de emergencia.' },
  { id: 'cuentas', nombre: 'Cuentas y acceso', ayuda: 'Códigos SMS, intentos fallidos y duración de la sesión.' },
  { id: 'cobertura', nombre: 'Zona de cobertura', ayuda: 'Desde dónde se pueden pedir servicios.' },
  { id: 'datos', nombre: 'Datos y privacidad', ayuda: 'Cuánto tiempo se guarda el rastro GPS de los viajes (Ley 1581).' },
  { id: 'otros', nombre: 'Otros', ayuda: '' },
];

/**
 * Configuración del sistema: los parámetros de configuracion_sistema agrupados por tema, con su unidad y para
 * qué sirven. Se editan en línea; el backend valida que un número siga siendo número (la base los lee con
 * fn_config_num y un texto la rompería) y cada cambio queda en la auditoría. Solo el admin entra aquí.
 */
@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIcoComponent],
  templateUrl: './admin-configuracion.html',
  styleUrls: ['../home-admin.css', '../admin-catalogos/admin-catalogos.css', './admin-configuracion.css'],
})
export class AdminConfiguracionComponent implements OnInit {
  @Output() aviso = new EventEmitter<{ tipo: 'ok' | 'error'; texto: string }>();

  parametros: Parametro[] = [];
  busqueda = '';
  cargando = false;
  error = '';

  editando: string | null = null;
  valor = '';
  errorFila = '';
  guardando = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.cargar();
  }

  get grupos(): Grupo[] {
    const q = this.busqueda.trim().toLowerCase();
    const visibles = this.parametros.filter(p => !q || p.clave.includes(q) || (p.descripcion ?? '').toLowerCase().includes(q));
    return GRUPOS.map(g => ({ ...g, parametros: visibles.filter(p => (META[p.clave]?.grupo ?? 'otros') === g.id) }))
      .filter(g => g.parametros.length);
  }

  unidad(clave: string): string {
    return META[clave]?.unidad ?? '';
  }

  /** "radio_busqueda_km" → "Radio búsqueda km" (la descripción explica el resto). */
  nombre(clave: string): string {
    const t = clave.replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  editar(p: Parametro): void {
    this.editando = p.clave;
    this.valor = p.valor;
    this.errorFila = '';
  }

  async guardar(p: Parametro): Promise<void> {
    if (this.guardando) return;
    if (this.valor.trim() === p.valor) {
      this.editando = null;
      return;
    }
    this.guardando = true;
    this.errorFila = '';
    try {
      const r = await this.api.put<{ valor: string }>(`/admin/configuracion/${encodeURIComponent(p.clave)}`, { valor: this.valor.trim() });
      p.valor = r.valor ?? this.valor.trim();
      p.actualizado_en = new Date().toISOString();
      this.editando = null;
      this.aviso.emit({ tipo: 'ok', texto: `"${this.nombre(p.clave)}" quedó en ${p.valor || '(vacío)'} ${this.unidad(p.clave)}.` });
    } catch (err) {
      this.errorFila = ApiService.mensaje(err, 'No se pudo guardar.');
    } finally {
      this.guardando = false;
    }
  }

  private async cargar(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      this.parametros = await this.api.get<Parametro[]>('/admin/configuracion');
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo cargar la configuración.');
    } finally {
      this.cargando = false;
    }
  }
}
