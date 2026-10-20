import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  signal
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MagiaService } from '../../shared/efectos/magia.service';
import { RevelarDirective } from '../../shared/efectos/revelar.directive';

type TipoServicio = 'moto' | 'taxi' | 'domicilio' | 'encomienda';

interface Servicio {
  id: TipoServicio;
  nombre: string;
  titulo: string;
  resumen: string;
  pregunta: string;
  accion: string;
  ruta: string;
  detalle: string[];
  fondoIcono: string;
  trazoIcono: string;
  sombraIcono: string;
}

interface EstadoSolicitud {
  nombre: string;
  descripcion: string;
  /** Posición del conductor en el mapa (coordenadas del SVG de 600 x 360). */
  punto: [number, number];
  /** Cuánto de la ruta lleva dibujado, de 0 a 100. */
  avance: number;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterModule, NgTemplateOutlet, RevelarDirective],
  templateUrl: './landing.html',
  styleUrls: ['./landing.css']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private magia = inject(MagiaService);

  @ViewChild('hero') heroRef!: ElementRef<HTMLElement>;
  @ViewChild('escena') escenaRef!: ElementRef<HTMLElement>;
  @ViewChild('lienzo') lienzoRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('progreso') progresoRef!: ElementRef<HTMLElement>;
  @ViewChildren('tarjeta') tarjetasRef!: QueryList<ElementRef<HTMLElement>>;

  /** Lo que se le muestra al usuario. Las reglas reales (tarifas, estados) viven en el backend. */
  readonly servicios: Servicio[] = [
    {
      id: 'moto',
      nombre: 'Moto',
      titulo: 'Transporte en moto',
      resumen: 'Llega rápido a donde vas. Marca recogida y destino y conoce la tarifa estimada.',
      pregunta: '¿A dónde vas?',
      accion: 'Pedir una moto',
      ruta: '/solicitar-transporte',
      detalle: [
        'Marcar el punto de recogida y el destino',
        'Ver la tarifa estimada antes de pedir',
        'Conocer al conductor y los datos de la moto',
        'Seguir el estado y la ubicación del viaje'
      ],
      fondoIcono: '#02AAB4',
      trazoIcono: '#03274D',
      sombraIcono: 'rgba(2, 124, 132, 0.8)'
    },
    {
      id: 'taxi',
      nombre: 'Taxi',
      titulo: 'Transporte en taxi',
      resumen: 'Viaja cómodo y bajo techo. Ves los datos del conductor y del vehículo antes de subir.',
      pregunta: '¿A dónde te llevamos?',
      accion: 'Pedir un taxi',
      ruta: '/solicitar-transporte',
      detalle: [
        'Indicar el origen y el destino',
        'Consultar la tarifa estimada del taxi',
        'Ver los datos del conductor y del vehículo',
        'Seguir la ubicación del taxi en el mapa'
      ],
      fondoIcono: '#FFC93C',
      trazoIcono: '#03274D',
      sombraIcono: 'rgba(160, 110, 0, 0.7)'
    },
    {
      id: 'domicilio',
      nombre: 'Domicilios',
      titulo: 'Domicilios y diligencias',
      resumen: 'Comida, compras, documentos y diligencias. Tú describes el pedido y nosotros lo llevamos.',
      pregunta: '¿Qué te llevamos?',
      accion: 'Pedir un domicilio',
      ruta: '/solicitar-domicilio',
      detalle: [
        'Registrar dónde recoger y dónde entregar',
        'Describir el pedido o la diligencia',
        'Dejar instrucciones para el conductor',
        'Seguir el estado de la entrega'
      ],
      fondoIcono: '#FE7B13',
      trazoIcono: '#03274D',
      sombraIcono: 'rgba(200, 90, 0, 0.8)'
    },
    {
      id: 'encomienda',
      nombre: 'Encomiendas',
      titulo: 'Encomiendas',
      resumen: 'Envía paquetes pequeños de un punto a otro con un conductor autorizado y síguelos.',
      pregunta: '¿A quién le envías?',
      accion: 'Enviar una encomienda',
      ruta: '/solicitar-encomienda',
      detalle: [
        'Registrar remitente y destinatario',
        'Describir el paquete que envías',
        'Seguir la encomienda en cada estado',
        'Confirmar la entrega al final'
      ],
      fondoIcono: '#03274D',
      trazoIcono: '#5FD3D9',
      sombraIcono: 'rgba(3, 39, 77, 0.8)'
    }
  ];

  readonly estados: EstadoSolicitud[] = [
    { nombre: 'Pendiente', descripcion: 'Tu solicitud llega a los conductores disponibles cerca de ti.', punto: [70, 300], avance: 0 },
    { nombre: 'Aceptada', descripcion: 'Un conductor la aceptó. Ves su nombre, su vehículo y la placa.', punto: [70, 300], avance: 0 },
    { nombre: 'Conductor en camino', descripcion: 'Sigues su ubicación en el mapa mientras llega a recogerte.', punto: [230, 150], avance: 39.5 },
    { nombre: 'Servicio iniciado', descripcion: 'Van rumbo al destino y el recorrido queda registrado.', punto: [400, 150], avance: 70 },
    { nombre: 'Servicio completado', descripcion: 'Llegaste. El servicio queda guardado en tu historial.', punto: [540, 60], avance: 100 }
  ];

  /** Capas para dar grosor 3D al teléfono y al pin del logo. */
  readonly capasTelefono = Array.from({ length: 8 }, (_, i) => ({
    transform: `translateZ(${-(i + 1) * 2.2}px)`,
    fondo: i < 7 ? '#13314F' : '#050D17'
  }));
  readonly capasPin = Array.from({ length: 12 }, (_, i) => {
    const profundidad = 11 - i;
    return {
      transform: `translateZ(${-profundidad * 1.8}px)`,
      filtro: `brightness(${profundidad === 0 ? 1 : 0.55})`
    };
  });

  // ---------- Estado de la vista (signals) ----------
  readonly servicioId = signal<TipoServicio>('moto');
  readonly servicio = computed(() => this.servicios.find((s) => s.id === this.servicioId())!);

  readonly paso = signal(0);
  readonly automatico = signal(true);
  readonly estadoActual = computed(() => this.estados[this.paso()]);
  readonly marcador = computed(() => {
    const [x, y] = this.estadoActual().punto;
    return { left: `${(x / 6).toFixed(2)}%`, top: `${(y / 3.6).toFixed(2)}%` };
  });
  readonly desfaseRuta = computed(() => 100 - this.estadoActual().avance);

  private intervalo?: ReturnType<typeof setInterval>;
  private limpiezas: Array<() => void> = [];

  ngOnInit(): void {
    if (this.magia.sinMovimiento()) this.automatico.set(false);
    // El recorrido del mapa avanza solo cada 2,6 s mientras esté en automático.
    this.intervalo = setInterval(() => {
      if (this.automatico()) this.paso.update((p) => (p + 1) % this.estados.length);
    }, 2600);
  }

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.magia.conectar(this.lienzoRef.nativeElement);

    // Todos estos eventos pasan muchísimas veces por segundo. Los escuchamos FUERA
    // de Angular y cambiamos variables CSS directamente, así no se recalcula la vista.
    this.zone.runOutsideAngular(() => {
      this.escuchar(this.heroRef.nativeElement, 'mousemove', (e) => this.inclinarEscena(e as MouseEvent));
      this.escuchar(this.heroRef.nativeElement, 'mouseleave', () => this.inclinarEscena(null));

      this.tarjetasRef.forEach(({ nativeElement: tarjeta }) => {
        this.escuchar(tarjeta, 'mousemove', (e) => this.inclinarTarjeta(tarjeta, e as MouseEvent));
        this.escuchar(tarjeta, 'mouseleave', () => this.inclinarTarjeta(tarjeta, null));
      });

      let ultimoX = -999;
      let ultimoY = -999;
      this.escuchar(window, 'mousemove', (e) => {
        const { clientX: x, clientY: y } = e as MouseEvent;
        if ((x - ultimoX) ** 2 + (y - ultimoY) ** 2 < 64) return;
        ultimoX = x;
        ultimoY = y;
        this.magia.estela(x, y);
      });

      const actualizarProgreso = () => {
        const doc = document.scrollingElement || document.documentElement;
        const maximo = doc.scrollHeight - window.innerHeight;
        const avance = maximo > 0 ? Math.min(1, Math.max(0, window.scrollY / maximo)) : 0;
        this.progresoRef.nativeElement.style.transform = `scaleX(${avance.toFixed(4)})`;
      };
      this.escuchar(window, 'scroll', actualizarProgreso, { passive: true });
      actualizarProgreso();
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalo);
    this.limpiezas.forEach((quitar) => quitar());
    this.magia.desconectar();
  }

  // ---------- Acciones desde la plantilla ----------
  elegir(id: TipoServicio, evento?: Event): void {
    this.servicioId.set(id);
    const origen = evento?.currentTarget as HTMLElement | undefined;
    if (origen) this.magia.rafaga(origen.getBoundingClientRect(), 'centro');
  }

  irAPaso(indice: number): void {
    this.paso.set(indice);
    this.automatico.set(false);
  }

  alternarAutomatico(): void {
    this.automatico.update((a) => !a);
  }

  irA(evento: Event, id: string): void {
    evento.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- Efecto 3D con el mouse ----------
  private inclinarEscena(e: MouseEvent | null): void {
    const escena = this.escenaRef.nativeElement;
    if (!e) {
      escena.style.setProperty('--rx', '0deg');
      escena.style.setProperty('--ry', '0deg');
      return;
    }
    const r = this.heroRef.nativeElement.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    escena.style.setProperty('--rx', `${(-py * 16).toFixed(2)}deg`);
    escena.style.setProperty('--ry', `${(px * 24).toFixed(2)}deg`);
  }

  private inclinarTarjeta(tarjeta: HTMLElement, e: MouseEvent | null): void {
    if (!e) {
      tarjeta.style.setProperty('--trx', '0deg');
      tarjeta.style.setProperty('--try', '0deg');
      tarjeta.style.setProperty('--tty', '0px');
      return;
    }
    const r = tarjeta.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tarjeta.style.setProperty('--trx', `${(-py * 18).toFixed(2)}deg`);
    tarjeta.style.setProperty('--try', `${(px * 20).toFixed(2)}deg`);
    tarjeta.style.setProperty('--tty', '-6px');
  }

  /** Agrega un listener y guarda cómo quitarlo en ngOnDestroy (evita fugas de memoria). */
  private escuchar(
    destino: Window | HTMLElement,
    evento: string,
    manejador: (e: Event) => void,
    opciones?: AddEventListenerOptions
  ): void {
    destino.addEventListener(evento, manejador, opciones);
    this.limpiezas.push(() => destino.removeEventListener(evento, manejador, opciones));
  }
}
