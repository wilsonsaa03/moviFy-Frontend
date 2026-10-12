import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SesionService } from '../../core/sesion.service';

/**
 * Secciones del menú que todavía no existen (favoritos, soporte, notificaciones…).
 * Antes esas rutas caían al landing y parecía que se cerraba la sesión.
 */
@Component({
  selector: 'app-proximamente',
  standalone: true,
  imports: [RouterModule],
  template: `
    <main class="pagina">
      <section class="tarjeta">
        <img src="/assets/brand/movify-isotipo.svg" alt="MoviFY" class="logo">
        <h1>{{ titulo }}</h1>
        <p>Esta sección estará disponible pronto. Mientras tanto puedes seguir usando MoviFY con normalidad.</p>
        <button type="button" (click)="volver()">Volver al inicio</button>
      </section>
    </main>
  `,
  styles: [`
    .pagina { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #F6F9FC;
              font-family: 'Nunito', 'Inter', system-ui, sans-serif; }
    .tarjeta { max-width: 420px; width: 100%; background: #fff; border-radius: 24px; padding: 32px 28px;
               text-align: center; box-shadow: 0 10px 30px rgba(3, 39, 77, .08); }
    .logo { height: 72px; margin-bottom: 12px; }
    h1 { color: #03274D; font-size: 1.4rem; margin: 0 0 8px; }
    p { color: #4A5B70; line-height: 1.5; margin: 0 0 24px; }
    button { width: 100%; height: 52px; border: 0; border-radius: 28px; background: #FE7B13; color: #fff;
             font-weight: 800; font-size: 1rem; cursor: pointer; box-shadow: 0 6px 0 #C2560A; }
  `]
})
export class ProximamenteComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sesion = inject(SesionService);
  titulo = this.route.snapshot.data['titulo'] || 'Próximamente';

  volver(): void {
    this.router.navigate([this.sesion.activa ? this.sesion.rutaInicio() : '/']);
  }
}
