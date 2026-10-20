import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, QueryList, ViewChild, ViewChildren, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MagiaService } from '../../shared/efectos/magia.service';
import { RevelarDirective } from '../../shared/efectos/revelar.directive';

interface TipoCuenta {
  id: 'usuario' | 'conductor' | 'admin';
  titulo: string;
  descripcion: string;
  puntos: string[];
  accion: string;
  ruta: string;
  fondoIcono: string;
  trazoIcono: string;
  sombraIcono: string;
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [RouterModule, RevelarDirective],
  templateUrl: './registro.html',
  styleUrl: './registro.css'
})
export class Registro implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private magia = inject(MagiaService);
  private limpiezas: Array<() => void> = [];

  @ViewChild('pagina') paginaRef!: ElementRef<HTMLElement>;
  @ViewChild('lienzo') lienzoRef!: ElementRef<HTMLCanvasElement>;
  @ViewChildren('tarjeta') tarjetasRef!: QueryList<ElementRef<HTMLElement>>;

  readonly tipos: TipoCuenta[] = [
    {
      id: 'usuario',
      titulo: 'Usuario',
      descripcion: 'Solicita transporte, domicilios y encomiendas de forma fácil y segura.',
      puntos: ['Moto o taxi a tu destino', 'Domicilios y encomiendas', 'Seguimiento de cada servicio'],
      accion: 'Crear cuenta',
      ruta: '/registro/usuario',
      fondoIcono: '#02AAB4',
      trazoIcono: '#03274D',
      sombraIcono: 'rgba(2, 124, 132, 0.8)'
    },
    {
      id: 'conductor',
      titulo: 'Conductor',
      descripcion: 'Gana dinero haciendo viajes y entregas, y maneja tu propio tiempo.',
      puntos: ['Con moto o con taxi', 'Revisamos tus documentos', 'Trabajas desde la app móvil'],
      accion: 'Quiero conducir',
      ruta: '/registro/conductor',
      fondoIcono: '#FE7B13',
      trazoIcono: '#03274D',
      sombraIcono: 'rgba(200, 90, 0, 0.8)'
    },
    {
      id: 'admin',
      titulo: 'Administrador',
      descripcion: 'Gestiona usuarios, conductores y controla la plataforma.',
      puntos: ['Valida conductores', 'Supervisa solicitudes', 'Necesitas un código de acceso'],
      accion: 'Entrar',
      ruta: '/registro/admin',
      fondoIcono: '#5FD3D9',
      trazoIcono: '#03274D',
      sombraIcono: 'rgba(2, 124, 132, 0.6)'
    }
  ];

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.magia.conectar(this.lienzoRef.nativeElement);

    // Igual que en la landing: el mouse se escucha FUERA de Angular y solo se
    // cambian variables CSS en la tarjeta.
    this.zone.runOutsideAngular(() => {
      this.tarjetasRef.forEach(({ nativeElement: tarjeta }) => {
        const mover = (e: Event) => {
          const ev = e as MouseEvent;
          const r = tarjeta.getBoundingClientRect();
          const px = (ev.clientX - r.left) / r.width - 0.5;
          const py = (ev.clientY - r.top) / r.height - 0.5;
          tarjeta.style.setProperty('--trx', `${(-py * 16).toFixed(2)}deg`);
          tarjeta.style.setProperty('--try', `${(px * 18).toFixed(2)}deg`);
          tarjeta.style.setProperty('--tty', '-8px');
        };
        const salir = () => {
          tarjeta.style.setProperty('--trx', '0deg');
          tarjeta.style.setProperty('--try', '0deg');
          tarjeta.style.setProperty('--tty', '0px');
        };
        tarjeta.addEventListener('mousemove', mover);
        tarjeta.addEventListener('mouseleave', salir);
        this.limpiezas.push(
          () => tarjeta.removeEventListener('mousemove', mover),
          () => tarjeta.removeEventListener('mouseleave', salir)
        );
      });

      let ultimoX = -999;
      let ultimoY = -999;
      const estela = (e: Event) => {
        const ev = e as MouseEvent;
        if ((ev.clientX - ultimoX) ** 2 + (ev.clientY - ultimoY) ** 2 < 64) return;
        ultimoX = ev.clientX;
        ultimoY = ev.clientY;
        this.magia.estela(ev.clientX, ev.clientY);
      };
      const pagina = this.paginaRef.nativeElement;
      pagina.addEventListener('mousemove', estela);
      this.limpiezas.push(() => pagina.removeEventListener('mousemove', estela));
    });
  }

  ngOnDestroy(): void {
    this.limpiezas.forEach((quitar) => quitar());
    this.magia.desconectar();
  }
}
