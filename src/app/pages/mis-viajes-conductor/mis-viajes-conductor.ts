import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConductorService } from '../../Base_de_datos/conductor.service';
import { environment } from '../../../environments/environment';

// ─────────────────────────────────────────────
// INTERFACES (tipos que llegan del backend)
// ─────────────────────────────────────────────
export interface ViajeItem {
  servicio_id: number;
  estado: string;
  fecha_solicitud: string;          // ISO 8601: "2026-06-01T15:45:00"
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  origen_direccion: string;
  origen_ciudad: string;
  destino_direccion: string;
  destino_ciudad: string;
  distancia_km: number;
  duracion_min: number;
  tarifa: number;
  metodo_pago: string;              // "Efectivo" | "Nequi" | "Daviplata"
  usuario_nombre: string;
  tipo: string;                     // "TRANSPORTE" | "DOMICILIO"
  razon_cancelacion?: string;
}

export interface StatsViajes {
  viajes_hoy: number;
  ganancias_hoy: number;
  activos: number;
  total_viajes: number;
  tendencia_hoy: number;
  tendencia_ganancia: number;
}

@Component({
  selector: 'app-mis-viajes-conductor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './mis-viajes-conductor.html',
  styleUrls: ['./mis-viajes-conductor.css']
})
export class MisViajesConductorComponent implements OnInit, OnDestroy {

  // ── DATOS CONDUCTOR ──
  nombre: string = '';
  conductorId: number | null = null;
  correo: string = '';
  foto: string = '';
  calificacion: number = 0;
  enLinea: boolean = false;
  notificaciones: number = 0;

  // ── UI STATE ──
  menuAbierto: boolean = false;
  menuNavAbierto: boolean = false;
  sidebarColapsado: boolean = false;
  cargando: boolean = true;

  // ── DATOS VIAJES ──
  viajes: ViajeItem[] = [];
  viajesFiltrados: ViajeItem[] = [];
  stats: StatsViajes = {
    viajes_hoy: 0,
    ganancias_hoy: 0,
    activos: 0,
    total_viajes: 0,
    tendencia_hoy: 0,
    tendencia_ganancia: 0
  };

  // ── FILTROS ──
  filtros = [
    { label: 'Todos ▾', valor: 'todos' },
    { label: 'Hoy',     valor: 'hoy'   },
    { label: 'Semana',  valor: 'semana' },
    { label: 'Mes',     valor: 'mes'   }
  ];
  filtroActivo: string = 'todos';
  busqueda: string = '';
  rangoFecha: string = '01 May - 31 May';

  // ── PAGINACIÓN ──
  paginaActual: number = 1;
  totalPaginas: number = 1;
  itemsPorPagina: number = 10;
  paginas: number[] = [];

  // ── POLLING ──
  private pollingInterval: any;

  constructor(
    private conductorService: ConductorService,
    private router: Router
  ) {}

  // ══════════════════════════════════════════
  // CICLO DE VIDA
  // ══════════════════════════════════════════

  ngOnInit(): void {
    const correo = localStorage.getItem('correo');
    if (!correo) { this.router.navigate(['/login']); return; }

    this.conductorService.obtenerPerfil(correo).subscribe({
      next: (perfil: any) => {
        this.nombre       = perfil.nombre        || 'Conductor';
        this.conductorId  = perfil.conductor_id  || perfil.id;
        this.calificacion = Number(perfil.calificacion) || 4.9;
        this.enLinea      = perfil.en_linea      || false;

        if (this.conductorId) {
          this.cargarTodo();
          this.iniciarPollingStats();
        }
      },
      error: () => {
        this.cargando = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }

  // ══════════════════════════════════════════
  // CARGA DE DATOS
  // ══════════════════════════════════════════

  cargarTodo(): void {
    this.cargando = true;
    Promise.all([
      this.fetchStats(),
      this.fetchViajes()
    ]).finally(() => {
      this.cargando = false;
    });
  }

  private fetchStats(): Promise<void> {
    return fetch(`${environment.apiUrl}/transporte/stats-conductor/${this.conductorId}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: StatsViajes) => {
        this.stats = data;
      })
      .catch(err => {
        console.warn('Stats no disponibles, usando valores por defecto:', err);
        this.calcularStatsFallback();
      });
  }

  private fetchViajes(): Promise<void> {
    const params = new URLSearchParams({
      filtro:   this.filtroActivo,
      busqueda: this.busqueda,
      pagina:   String(this.paginaActual),
      limite:   String(this.itemsPorPagina)
    });

    return fetch(
      `${environment.apiUrl}/transporte/historial-conductor/${this.conductorId}?${params}`
    )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { viajes: ViajeItem[]; total: number; total_paginas: number; pagina_actual: number }) => {
        this.viajes          = data.viajes        || [];
        this.totalPaginas    = data.total_paginas || 1;
        this.paginaActual    = data.pagina_actual || 1;
        this.viajesFiltrados = [...this.viajes];
        this.construirPaginas();
      })
      .catch(err => {
        console.error('Error cargando historial:', err);
        this.viajes = [];
        this.viajesFiltrados = [];
      });
  }

  private iniciarPollingStats(): void {
    this.pollingInterval = setInterval(() => {
      if (this.conductorId) this.fetchStats();
    }, 30_000);
  }

  private calcularStatsFallback(): void {
    const hoy = new Date().toDateString();
    const viajesHoy = this.viajes.filter(v =>
      new Date(v.fecha_solicitud).toDateString() === hoy
    );
    this.stats = {
      viajes_hoy:         viajesHoy.filter(v => v.estado === 'FINALIZADO').length,
      ganancias_hoy:      viajesHoy.filter(v => v.estado === 'FINALIZADO')
                                   .reduce((acc, v) => acc + (v.tarifa || 0), 0),
      activos:            this.viajes.filter(v =>
                            ['EN_VIAJE','ACEPTADO','EN_CAMINO'].includes(v.estado)
                          ).length,
      total_viajes:       this.viajes.filter(v => v.estado === 'FINALIZADO').length,
      tendencia_hoy:      0,
      tendencia_ganancia: 0
    };
  }

  // ══════════════════════════════════════════
  // FILTROS Y BÚSQUEDA
  // ══════════════════════════════════════════

  cambiarFiltro(valor: string): void {
    this.filtroActivo = valor;
    this.paginaActual = 1;
    this.fetchViajes().then(() => this.cargando = false);
  }

  filtrarViajes(): void {
    clearTimeout((this as any)._debounce);
    (this as any)._debounce = setTimeout(() => {
      this.paginaActual = 1;
      this.fetchViajes();
    }, 300);
  }

  // ══════════════════════════════════════════
  // PAGINACIÓN
  // ══════════════════════════════════════════

  construirPaginas(): void {
    this.paginas = Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }

  cambiarPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    this.fetchViajes();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ══════════════════════════════════════════
  // EXPORTAR
  // ══════════════════════════════════════════

  exportarGanancias(): void {
    const url = `${environment.apiUrl}/transporte/exportar-ganancias/${this.conductorId}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ganancias-${this.conductorId}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // ══════════════════════════════════════════
  // ACCIONES DE VIAJE
  // ══════════════════════════════════════════

  verDetalle(viajeId: number): void {
    this.router.navigate(['/detalle-viaje', viajeId]);
  }

  abrirMapa(viaje: ViajeItem): void {
    this.router.navigate(['/conductor'], { queryParams: { viaje_id: viaje.servicio_id } });
  }

  toggleOpciones(viaje: ViajeItem): void {
    console.log('Opciones para viaje:', viaje.servicio_id);
  }

  // ══════════════════════════════════════════
  // HELPERS DE UI
  // ══════════════════════════════════════════

  getBadgeClass(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'FINALIZADO':                     return 'badge-completado';
      case 'EN_VIAJE':
      case 'ACEPTADO':
      case 'EN_CAMINO':
      case 'EN_CAMINO_AL_USUARIO':
      case 'LLEGO_AL_ORIGEN':
      case 'PAQUETE_RECOGIDO':               return 'badge-en-curso';
      case 'CANCELADO':
      case 'RECHAZADO':                      return 'badge-cancelado';
      default:                               return 'badge-pendiente';
    }
  }

  getFriendlyEstado(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'FINALIZADO':                     return 'COMPLETADO';
      case 'CANCELADO':                      return 'CANCELADO';
      case 'RECHAZADO':                      return 'RECHAZADO';
      case 'EN_VIAJE':
      case 'ACEPTADO':
      case 'EN_CAMINO':
      case 'EN_CAMINO_AL_USUARIO':
      case 'LLEGO_AL_ORIGEN':
      case 'PAQUETE_RECOGIDO':               return 'EN CURSO';
      case 'PENDIENTE':                      return 'PENDIENTE';
      default:                               return estado || '—';
    }
  }

  // ══════════════════════════════════════════
  // NAVEGACIÓN / SIDEBAR
  // ══════════════════════════════════════════

  /**
   * Alias usado por el HTML: [class.sidebar-visible]="sidebarVisible"
   * Mapea menuNavAbierto (móvil) o el inverso de sidebarColapsado (desktop).
   */
  get sidebarVisible(): boolean {
    return window.innerWidth <= 992
      ? this.menuNavAbierto
      : !this.sidebarColapsado;
  }

  toggleSidebar(): void {
    if (window.innerWidth <= 992) {
      this.menuNavAbierto = !this.menuNavAbierto;
    } else {
      this.sidebarColapsado = !this.sidebarColapsado;
    }
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }

  /** Alias usado por el HTML: (click)="irAPerfil()" */
  irAPerfil(): void {
    this.verPerfil();
  }

  verPerfil(): void {
    this.menuAbierto = false;
    this.router.navigate(['/perfil-conductor']);
  }

  editarPerfil(): void {
    this.menuAbierto = false;
    this.router.navigate(['/editar-perfil']);
  }

  configuracion(): void {
    this.menuAbierto = false;
    this.router.navigate(['/configuracion']);
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}