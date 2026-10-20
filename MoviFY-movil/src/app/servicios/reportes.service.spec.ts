import { TestBed } from '@angular/core/testing';
import { ApiService } from '../core/api.service';
import { ReportesService } from './reportes.service';

describe('ReportesService', () => {
  let post: ReturnType<typeof vi.fn>;
  let reportes: ReportesService;

  beforeEach(() => {
    post = vi.fn().mockResolvedValue({ id: 14, fecha_limite_respuesta: '2026-11-09', message: 'ok' });
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { post } }] });
    reportes = TestBed.inject(ReportesService);
  });

  it('un motivo grave se envía como incidente de seguridad, ligado al viaje', async () => {
    await reportes.enviar(88, 'Mala conducta', '  Se pasó dos semáforos.  ');
    expect(post).toHaveBeenCalledWith('/pqrs', {
      servicioId: 88,
      tipo: 'incidente_seguridad',
      asunto: 'Reporte: Mala conducta',
      descripcion: 'Mala conducta. Se pasó dos semáforos.',
    });
  });

  it('los demás motivos se envían como queja y sin detalle usan el motivo como descripción', async () => {
    await reportes.enviar(80, 'Pidió el servicio, pero no llegó');
    expect(post).toHaveBeenCalledWith('/pqrs', expect.objectContaining({
      tipo: 'queja',
      descripcion: 'Pidió el servicio, pero no llegó',
    }));
  });
});
