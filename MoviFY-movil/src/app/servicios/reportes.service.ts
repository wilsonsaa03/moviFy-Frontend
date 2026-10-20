import { Injectable, inject } from '@angular/core';
import { ApiService } from '../core/api.service';

/** Motivos que muestra la pantalla "Reportar usuario" (los mismos chips del diseño en Figma). */
export type MotivoReporte =
  | 'Mala conducta'
  | 'Fue irrespetuoso/a'
  | 'Pidió el servicio, pero no llegó'
  | 'Indicaciones inapropiadas'
  | 'Viaje incompleto'
  | 'Pago incompleto'
  | 'Otra razón';

/** Motivos que el backend debe atender primero: se envían como incidente de seguridad (prioridad urgente). */
const GRAVES: MotivoReporte[] = ['Mala conducta', 'Indicaciones inapropiadas'];

export interface ReporteCreado {
  id: number;
  fecha_limite_respuesta: string;
  message: string;
}

/**
 * Reportar al pasajero o al conductor de un viaje.
 * El reporte se guarda como una PQRS ligada al viaje (POST /api/pqrs → tabla tickets_soporte)
 * y lo atiende el administrador desde la web, en "Quejas y reportes".
 */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly api = inject(ApiService);

  enviar(servicioId: number, motivo: MotivoReporte, detalle = ''): Promise<ReporteCreado> {
    const texto = detalle.trim();
    return this.api.post<ReporteCreado>('/pqrs', {
      servicioId,
      tipo: GRAVES.includes(motivo) ? 'incidente_seguridad' : 'queja',
      asunto: `Reporte: ${motivo}`.slice(0, 120),
      descripcion: (texto ? `${motivo}. ${texto}` : motivo).slice(0, 2000),
    });
  }
}
