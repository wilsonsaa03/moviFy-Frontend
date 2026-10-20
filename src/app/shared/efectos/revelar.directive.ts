import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, inject } from '@angular/core';
import { MagiaService } from './magia.service';

export type VarianteRevelar = '' | 'izq' | 'der' | 'zoom' | 'voltea' | 'portal';

/**
 * Hace aparecer un elemento "con magia" cuando entra en la pantalla al hacer scroll.
 *
 * Uso en el HTML:
 *   <div appRevelar>...</div>                       → sube y se enfoca
 *   <div appRevelar="voltea" [rvRetraso]="0.14">    → gira como una carta, con retraso
 *   <div appRevelar="portal" rvRafaga="centro">     → se abre como un portal y explota en chispas
 *
 * Cómo funciona:
 *  1. Le pone la clase "rv" (estado inicial: invisible y borroso, definido en landing.css).
 *  2. Un IntersectionObserver avisa cuando el elemento entra en la pantalla.
 *  3. Le agrega "rv-in" → CSS hace la transición; y pide una ráfaga de chispas.
 *  4. Deja de observar: cada elemento aparece una sola vez.
 */
@Directive({
  selector: '[appRevelar]',
  standalone: true,
  host: { class: 'rv' }
})
export class RevelarDirective implements AfterViewInit, OnDestroy {
  @Input('appRevelar') variante: VarianteRevelar = '';
  /** Retraso en segundos, para que varios elementos aparezcan uno tras otro. */
  @Input() rvRetraso = 0;
  /** De dónde salen las chispas. */
  @Input() rvRafaga: 'borde' | 'centro' = 'borde';

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private magia = inject(MagiaService);
  private observador?: IntersectionObserver;
  private temporizador?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    const el = this.el.nativeElement;
    if (this.variante) el.classList.add(this.variante);
    el.style.setProperty('--d', `${this.rvRetraso}s`);

    // Sin soporte o con "reducir movimiento": se muestra de una vez.
    if (this.magia.sinMovimiento() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('rv-in');
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.observador = new IntersectionObserver(
        (entradas) => {
          if (!entradas.some((e) => e.isIntersecting)) return;
          el.classList.add('rv-in');
          this.observador?.disconnect();
          this.temporizador = setTimeout(
            () => this.magia.rafaga(el.getBoundingClientRect(), this.rvRafaga),
            this.rvRetraso * 1000 + 120
          );
        },
        { threshold: 0.01, rootMargin: '0px 0px -12% 0px' }
      );
      this.observador.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
    clearTimeout(this.temporizador);
  }
}
