import { Injectable, NgZone, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import Lenis from 'lenis';

/**
 * Scroll suave con inercia (Lenis) para toda la web: la rueda del mouse desliza la página en vez de
 * saltar a golpes. En celulares se deja el scroll nativo del dedo (ya es suave).
 *
 *  - No se activa si la persona pidió "reducir movimiento" en su sistema (accesibilidad).
 *  - No toca los mapas (Leaflet usa la rueda para el zoom) ni lo que tenga data-sin-scroll-suave.
 *  - Las listas y ventanas con su propio scroll siguen funcionando (allowNestedScroll).
 *  - Corre fuera de Angular: el requestAnimationFrame de cada cuadro no dispara detección de cambios.
 */
@Injectable({ providedIn: 'root' })
export class ScrollSuave {
  private readonly zona = inject(NgZone);
  private readonly router = inject(Router);
  private lenis: Lenis | null = null;
  private rutaAnterior = '';

  iniciar(): void {
    if (typeof window === 'undefined' || this.lenis) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.zona.runOutsideAngular(() => {
      this.lenis = new Lenis({
        autoRaf: true,
        lerp: 0.09,
        wheelMultiplier: 1,
        smoothWheel: true,
        allowNestedScroll: true,
        prevent: (nodo) => !!nodo.closest?.('.leaflet-container, [data-sin-scroll-suave]'),
      });
    });

    // Al cambiar de pantalla, empezar arriba (no al cambiar solo los filtros de la URL)
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      const ruta = e.urlAfterRedirects.split(/[?#]/)[0];
      if (this.rutaAnterior && ruta !== this.rutaAnterior) this.lenis?.scrollTo(0, { immediate: true });
      this.rutaAnterior = ruta;
    });
  }

  /** Desliza hasta un elemento o un id, dejando espacio para la barra de arriba. */
  irA(destino: string | HTMLElement, margenArriba = 72): void {
    const el = typeof destino === 'string' ? document.getElementById(destino) : destino;
    if (!el) return;
    if (this.lenis) {
      this.lenis.scrollTo(el, { offset: -margenArriba, duration: 1.3 });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
