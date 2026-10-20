import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MagiaService } from '../efectos/magia.service';
import { RevelarDirective } from '../efectos/revelar.directive';

export interface EtiquetaAuth {
  texto: string;
  /** Color del puntico de la etiqueta. */
  color: string;
}

/** Etiquetas por defecto: los cuatro servicios de MoviFY. */
export const ETIQUETAS_SERVICIOS: EtiquetaAuth[] = [
  { texto: 'Moto', color: '#02AAB4' },
  { texto: 'Taxi', color: '#FFC93C' },
  { texto: 'Domicilios', color: '#FE7B13' },
  { texto: 'Encomiendas', color: '#5FD3D9' }
];

/**
 * Plantilla común de las pantallas de acceso (login, recuperar contraseña, registros).
 *
 * - Izquierda: mensaje + escena 3D con el pin del logo (igual que la landing).
 * - Derecha: una tarjeta blanca que se inclina con el mouse. Lo que va DENTRO de la
 *   tarjeta lo pone cada página con <ng-content> (proyección de contenido).
 *
 * Uso:
 *   <app-auth-layout tituloInicio="Qué bueno verte" tituloResaltado="de nuevo" texto="...">
 *     ...formulario de la página...
 *   </app-auth-layout>
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterModule, RevelarDirective],
  templateUrl: './auth-layout.html',
  styleUrls: ['./auth-layout.css']
})
export class AuthLayoutComponent implements AfterViewInit, OnDestroy {
  @Input() volverRuta = '/';
  @Input() volverTexto = 'Volver al inicio';
  @Input() chip = 'Buenaventura se mueve contigo';
  @Input() tituloInicio = '';
  @Input() tituloResaltado = '';
  @Input() texto = '';
  @Input() etiquetas: EtiquetaAuth[] = ETIQUETAS_SERVICIOS;

  @ViewChild('pagina') paginaRef!: ElementRef<HTMLElement>;
  @ViewChild('escena') escenaRef!: ElementRef<HTMLElement>;
  @ViewChild('tarjeta') tarjetaRef!: ElementRef<HTMLElement>;
  @ViewChild('lienzo') lienzoRef!: ElementRef<HTMLCanvasElement>;

  /** Grosor 3D del pin del logo (capas apiladas). */
  readonly capasPin = Array.from({ length: 12 }, (_, i) => {
    const profundidad = 11 - i;
    return {
      transform: `translateZ(${-profundidad * 1.8}px)`,
      filtro: `brightness(${profundidad === 0 ? 1 : 0.55})`
    };
  });

  private zone = inject(NgZone);
  private magia = inject(MagiaService);
  private limpiezas: Array<() => void> = [];

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.magia.conectar(this.lienzoRef.nativeElement);

    // El mouse se escucha FUERA de Angular: solo cambiamos variables CSS,
    // así la pantalla no se recalcula en cada movimiento.
    this.zone.runOutsideAngular(() => {
      const pagina = this.paginaRef.nativeElement;
      const escena = this.escenaRef.nativeElement;
      const tarjeta = this.tarjetaRef.nativeElement;
      let ultimoX = -999;
      let ultimoY = -999;

      const mover = (e: Event) => {
        const ev = e as MouseEvent;
        const px = ev.clientX / window.innerWidth - 0.5;
        const py = ev.clientY / window.innerHeight - 0.5;
        escena.style.setProperty('--rx', `${(-py * 14).toFixed(2)}deg`);
        escena.style.setProperty('--ry', `${(px * 20).toFixed(2)}deg`);
        tarjeta.style.setProperty('--trx', `${(-py * 5).toFixed(2)}deg`);
        tarjeta.style.setProperty('--try', `${(px * 6).toFixed(2)}deg`);

        if ((ev.clientX - ultimoX) ** 2 + (ev.clientY - ultimoY) ** 2 >= 64) {
          ultimoX = ev.clientX;
          ultimoY = ev.clientY;
          this.magia.estela(ev.clientX, ev.clientY);
        }
      };
      const salir = () => {
        ['--rx', '--ry'].forEach((v) => escena.style.setProperty(v, '0deg'));
        ['--trx', '--try'].forEach((v) => tarjeta.style.setProperty(v, '0deg'));
      };

      pagina.addEventListener('mousemove', mover);
      pagina.addEventListener('mouseleave', salir);
      this.limpiezas.push(
        () => pagina.removeEventListener('mousemove', mover),
        () => pagina.removeEventListener('mouseleave', salir)
      );
    });
  }

  ngOnDestroy(): void {
    this.limpiezas.forEach((quitar) => quitar());
    this.magia.desconectar();
  }
}
