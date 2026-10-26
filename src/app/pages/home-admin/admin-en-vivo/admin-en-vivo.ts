import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { ApiService } from '../../../core/api.service';
import { crearMapaCiudad } from '../../../core/mapa-ciudad';
import { AdminIcoComponent } from '../admin-ico';

/** GET /api/admin/en-vivo → conductores */
interface ConductorVivo {
  id: number;
  nombre: string;
  telefono: string | null;
  tipo_vehiculo: 'moto' | 'taxi' | null;
  placa: string | null;
  lat: number;
  lng: number;
  segundos_sin_reportar: number;
  servicio_id: number | null;
  servicio_estado: string | null;
}

/** GET /api/admin/en-vivo → servicios */
export interface ServicioVivo {
  id: number;
  tipo_servicio: 'transporte' | 'domicilio' | 'encomienda';
  tipo_vehiculo: 'moto' | 'taxi';
  estado_codigo: 'buscando' | 'asignado' | 'en_origen' | 'en_curso';
  estado_nombre: string;
  cliente_nombre: string;
  conductor_nombre: string | null;
  origen: string;
  destino: string;
  origen_lat: number;
  origen_lng: number;
  tarifa: number;
  minutos: number;
  ofertas: number;
  con_sos: boolean;
  con_alerta: boolean;
  pasajero_nombre: string | null;
}

interface Programado {
  id: number;
  tipo_vehiculo: 'moto' | 'taxi';
  origen: string;
  destino: string;
  programado_para: string;
  estado: 'pendiente' | 'enviado' | 'cancelado' | 'fallido';
  motivo_fallo: string | null;
  cliente_nombre: string;
  telefono: string | null;
  servicio_id: number | null;
}

interface Contadores {
  sos_abiertas: number;
  alertas_pendientes: number;
  programados_24h: number;
  expirados_hora: number;
}

/** Cada cuánto se actualiza el mapa (el conductor reporta su GPS cada ~6 s). */
const CADA_MS = 10000;
/** Más de esto sin reportar = "sin señal" (gris en el mapa). */
const SIN_SENAL_SEG = 120;
/** Buscando más de esto = hay que mirarlo (sin conductores cerca, tarifa baja…). */
const DEMORA_MIN = 2;

const SVG_MOTO = '<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M5.5 16.5l4-6h5l4 6M14.5 10.5l-1.5-4h3"/>';
const SVG_TAXI = '<path d="M5 17h14v-4l-2-5H7l-2 5v4zM9 5h6v3M5 13h14"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>';

/**
 * "En vivo": lo que está pasando ahora en Buenaventura. Mapa con los conductores conectados (libre, con
 * servicio o sin señal) y los pedidos que buscan conductor; a la derecha los servicios activos (primero los que
 * tienen SOS o "¿Todo bien?" sin revisar, después los que llevan rato buscando) y los programados de las
 * próximas 24 horas. Se actualiza solo cada 10 s.
 */
@Component({
  selector: 'app-admin-en-vivo',
  standalone: true,
  imports: [CommonModule, AdminIcoComponent],
  templateUrl: './admin-en-vivo.html',
  styleUrls: ['../home-admin.css', './admin-en-vivo.css'],
})
export class AdminEnVivoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapa') mapaRef!: ElementRef<HTMLElement>;
  @Output() abrirServicio = new EventEmitter<number>();
  @Output() ir = new EventEmitter<string>();

  conductores: ConductorVivo[] = [];
  servicios: ServicioVivo[] = [];
  programados: Programado[] = [];
  contadores: Contadores = { sos_abiertas: 0, alertas_pendientes: 0, programados_24h: 0, expirados_hora: 0 };
  filtro: 'todos' | 'buscando' | 'en_curso' = 'todos';
  error = '';
  actualizado: Date | null = null;

  private mapa?: L.Map;
  private capa?: L.LayerGroup;
  private sondeo?: ReturnType<typeof setInterval>;
  private encuadrado = false;

  constructor(private api: ApiService) {}

  ngAfterViewInit(): void {
    this.mapa = crearMapaCiudad(this.mapaRef.nativeElement);
    this.capa = L.layerGroup().addTo(this.mapa);
    this.cargar();
    this.sondeo = setInterval(() => this.cargar(), CADA_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.sondeo);
    this.mapa?.remove();
  }

  get libres(): number {
    return this.conductores.filter(c => !c.servicio_id && c.segundos_sin_reportar <= SIN_SENAL_SEG).length;
  }

  get ocupados(): number {
    return this.conductores.filter(c => !!c.servicio_id).length;
  }

  get buscando(): ServicioVivo[] {
    return this.servicios.filter(s => s.estado_codigo === 'buscando');
  }

  /** Buscando hace rato: lo que soporte debería mirar primero (después de SOS y alertas). */
  get demorados(): number {
    return this.buscando.filter(s => s.minutos >= DEMORA_MIN).length;
  }

  get visibles(): ServicioVivo[] {
    if (this.filtro === 'buscando') return this.buscando;
    if (this.filtro === 'en_curso') return this.servicios.filter(s => s.estado_codigo !== 'buscando');
    return this.servicios;
  }

  get proximos(): Programado[] {
    const limite = Date.now() + 24 * 3600_000;
    return this.programados.filter(p => p.estado === 'pendiente' && new Date(p.programado_para).getTime() <= limite)
      .concat(this.programados.filter(p => p.estado === 'fallido').slice(0, 5));
  }

  demorado(s: ServicioVivo): boolean {
    return s.estado_codigo === 'buscando' && s.minutos >= DEMORA_MIN;
  }

  refrescar(): void {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    try {
      const r = await this.api.get<{ conductores: ConductorVivo[]; servicios: ServicioVivo[]; contadores: Contadores }>('/admin/en-vivo');
      this.conductores = r.conductores;
      this.servicios = r.servicios;
      this.contadores = r.contadores;
      this.actualizado = new Date();
      this.error = '';
      this.pintar();
      this.programados = await this.api.get<Programado[]>('/admin/programados').catch(() => this.programados);
    } catch (err) {
      this.error = ApiService.mensaje(err, 'No se pudo actualizar el mapa. Seguimos intentando.');
    }
  }

  private pintar(): void {
    if (!this.mapa || !this.capa) return;
    this.capa.clearLayers();
    const puntos: L.LatLng[] = [];
    for (const c of this.conductores) {
      const sinSenal = c.segundos_sin_reportar > SIN_SENAL_SEG;
      const clase = sinSenal ? 'sin-senal' : c.servicio_id ? 'ocupado' : 'libre';
      const p = L.latLng(c.lat, c.lng);
      puntos.push(p);
      L.marker(p, {
        keyboard: false,
        icon: L.divIcon({
          className: '',
          html: `<span class="ev-cond ${clase}"><svg viewBox="0 0 24 24">${c.tipo_vehiculo === 'taxi' ? SVG_TAXI : SVG_MOTO}</svg></span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        }),
      })
        .bindTooltip(`${escapar(c.nombre)} · ${escapar(c.placa ?? '')}<br>${sinSenal ? 'Sin señal hace ' + Math.round(c.segundos_sin_reportar / 60) + ' min' : c.servicio_id ? 'Con servicio #' + c.servicio_id : 'Libre'}`)
        .addTo(this.capa);
    }
    for (const s of this.buscando) {
      const p = L.latLng(s.origen_lat, s.origen_lng);
      puntos.push(p);
      L.marker(p, {
        keyboard: false,
        icon: L.divIcon({ className: '', html: `<span class="ev-pedido ${this.demorado(s) ? 'demorado' : ''}"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
      })
        .bindTooltip(`Pedido #${s.id} · ${s.tipo_vehiculo} · busca hace ${s.minutos} min<br>${escapar(s.origen)}`)
        .on('click', () => this.abrirServicio.emit(s.id))
        .addTo(this.capa);
    }
    if (!this.encuadrado && puntos.length) {
      this.mapa.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
      this.encuadrado = true;
    }
  }
}

function escapar(t: string): string {
  return t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
