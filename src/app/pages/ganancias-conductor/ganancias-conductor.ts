import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConductorService } from '../../Base_de_datos/conductor.service';
import { environment } from '../../../environments/environment';

// Declaramos Chart.js como global (se carga por CDN o se importa abajo)
declare var Chart: any;

@Component({
  selector: 'app-ganancias-conductor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './ganancias-conductor.html',
  styleUrls: ['./ganancias-conductor.css']
})
export class GananciasConductorComponent implements OnInit, OnDestroy, AfterViewInit {

  // ── DATOS USUARIO ────────────────────────────────────────────
  nombre: string = '';
  conductorId: number | null = null;
  ultimosCuatro: string = '4567';
  enLinea: boolean = true;
  notificaciones: number = 3;
  menuAbierto: boolean = false;
  sidebarColapsado: boolean = false;
  menuNavAbierto: boolean = false;

  // ── ESTADO UI ────────────────────────────────────────────────
  cargando: boolean = true;
  retirando: boolean = false;
  mensajeOk: string = '';
  mensajeErr: string = '';
  filtro: 'mes' | 'semana' | 'mes_cal' | 'anio' = 'mes';

  // ── ESTADÍSTICAS ─────────────────────────────────────────────
  stats = {
    ganancias_hoy:     0,
    viajes_hoy:        0,
    trend_hoy:         0,
    ganancias_semana:  0,
    viajes_semana:     0,
    trend_semana:      0,
    ganancias_mes:     0,
    viajes_mes:        0,
    trend_mes:         0,
    saldo_disponible:  0,
    total_acumulado:   0,
    ganancia_viajes:   0,
    propinas:          0,
    incentivos:        0
  };

  // ── GRÁFICA ──────────────────────────────────────────────────
  /** Puntos de la gráfica de líneas: { dia: string, valor: number }[] */
  puntosGrafica: { dia: string; valor: number }[] = [];

  // ── TRANSACCIONES ────────────────────────────────────────────
  transacciones: any[] = [];
  paginaTransacciones: number = 0;
  readonly PAGE_SIZE = 5;

  // ── MÉTODOS DE PAGO ──────────────────────────────────────────
  metodosPago: { icono: string; nombre: string; monto: number; pct: number }[] = [];

  // ── CHARTS ───────────────────────────────────────────────────
  private chartLinea: any = null;
  private chartDona: any = null;
  private pollingInterval: any = null;

  constructor(
    private conductorService: ConductorService,
    private router: Router
  ) {}

  // ════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ════════════════════════════════════════════════════════════
  ngOnInit(): void {
    const correo = localStorage.getItem('correo');
    if (!correo) { this.router.navigate(['/login']); return; }

    this.conductorService.obtenerPerfil(correo).subscribe({
      next: (p: any) => {
        this.nombre      = p.nombre || 'Conductor';
        this.conductorId = p.conductor_id || p.id;
        this.cargarTodo();
        // Refresca estadísticas cada 30 s
        this.pollingInterval = setInterval(() => this.cargarStats(), 30000);
      },
      error: (err: any) => {
        this.nombre = localStorage.getItem('nombre') || 'Conductor';
        this.cargando = false;
        const msg = err.error?.error || 'No eres un conductor registrado.';
        this.mensajeErr = `Error: ${msg}`;
      }
    });
  }

  ngAfterViewInit(): void {
    // Chart.js se carga después de que los datos lleguen (ver cargarTodo)
  }

  ngOnDestroy(): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.chartLinea) this.chartLinea.destroy();
    if (this.chartDona)  this.chartDona.destroy();
  }

  // ════════════════════════════════════════════════════════════
  //  CARGA DE DATOS
  // ════════════════════════════════════════════════════════════

  cargarTodo(): void {
    this.cargando = true;
    Promise.all([
      this.cargarStats(),
      this.cargarTransacciones(),
      this.cargarGrafica()
    ]).finally(() => {
      this.cargando = false;
      // Pequeño delay para que el DOM renderice el canvas
      setTimeout(() => {
        this.renderizarCharts();
      }, 150);
    });
  }

  /**
   * GET /api/transporte/ganancias-stats/:conductorId?filtro=mes
   *
   * Respuesta esperada del backend:
   * {
   *   ganancias_hoy: number,     viajes_hoy: number,     trend_hoy: number,
   *   ganancias_semana: number,  viajes_semana: number,  trend_semana: number,
   *   ganancias_mes: number,     viajes_mes: number,     trend_mes: number,
   *   saldo_disponible: number,  total_acumulado: number,
   *   ganancia_viajes: number,   propinas: number,       incentivos: number,
   *   metodos_pago: [{ nombre: string, monto: number, pct: number }],
   *   ultimos_cuatro: string     // últimos 4 dígitos de la cuenta
   * }
   */
  cargarStats(): Promise<void> {
    if (!this.conductorId) return Promise.resolve();
    return fetch(`${environment.apiUrl}/transporte/ganancias-stats/${this.conductorId}?filtro=${this.filtro}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((d: any) => {
        this.stats = {
          ganancias_hoy:    Number(d.ganancias_hoy)    || 0,
          viajes_hoy:       Number(d.viajes_hoy)       || 0,
          trend_hoy:        Number(d.trend_hoy)        || 0,
          ganancias_semana: Number(d.ganancias_semana) || 0,
          viajes_semana:    Number(d.viajes_semana)    || 0,
          trend_semana:     Number(d.trend_semana)     || 0,
          ganancias_mes:    Number(d.ganancias_mes)    || 0,
          viajes_mes:       Number(d.viajes_mes)       || 0,
          trend_mes:        Number(d.trend_mes)        || 0,
          saldo_disponible: Number(d.saldo_disponible) || 0,
          total_acumulado:  Number(d.total_acumulado)  || 0,
          ganancia_viajes:  Number(d.ganancia_viajes)  || 0,
          propinas:         Number(d.propinas)         || 0,
          incentivos:       Number(d.incentivos)       || 0
        };
        this.ultimosCuatro = d.ultimos_cuatro || '4567';
        if (d.metodos_pago && Array.isArray(d.metodos_pago)) {
          this.metodosPago = d.metodos_pago.map((m: any) => ({
            icono:  m.nombre === 'Efectivo' ? '💵' : m.nombre === 'Tarjeta' ? '💳' : '📱',
            nombre: m.nombre,
            monto:  Number(m.monto) || 0,
            pct:    Number(m.pct)   || 0
          }));
        }
      })
      .catch((err) => {
        console.error('Error al cargar estadísticas reales:', err);
        this.mensajeErr = 'Error al sincronizar estadísticas con la base de datos.';
      });
  }

  /**
   * GET /api/transporte/transacciones-conductor/:conductorId?filtro=mes&page=0&size=5
   *
   * Respuesta esperada del backend (array):
   * [
   *   {
   *     id: number,
   *     tipo: 'Pago' | 'Propina' | 'Incentivo' | 'Retiro',
   *     titulo: string,      // "Viaje completado", "Propina recibida", etc.
   *     subtitulo: string,   // origen → destino o descripción
   *     fecha: string,       // "01 Jun 2026"
   *     hora: string,        // "3:45 PM"
   *     monto: number        // positivo o negativo (retiros negativos)
   *   }
   * ]
   */
  cargarTransacciones(pagina: number = 0): Promise<void> {
    if (!this.conductorId) return Promise.resolve();
    const url = `${environment.apiUrl}/transporte/transacciones-conductor/${this.conductorId}?filtro=${this.filtro}&page=${pagina}&size=${this.PAGE_SIZE}`;
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data: any[]) => {
        const mapeadas = data.map(t => this.mapearTransaccion(t));
        this.transacciones = pagina === 0 ? mapeadas : [...this.transacciones, ...mapeadas];
        this.paginaTransacciones = pagina;
      })
      .catch((err) => {
        console.error('Error al cargar transacciones reales:', err);
        this.transacciones = [];
      });
  }

  /**
   * GET /api/transporte/grafica-conductor/:conductorId?filtro=mes
   *
   * Respuesta esperada (array de puntos):
   * [{ dia: "1 May", valor: 45000 }, { dia: "2 May", valor: 72000 }, ...]
   */
  cargarGrafica(): Promise<void> {
    if (!this.conductorId) return Promise.resolve();
    return fetch(`${environment.apiUrl}/transporte/grafica-conductor/${this.conductorId}?filtro=${this.filtro}`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data: { dia: string; valor: number }[]) => {
        this.puntosGrafica = data;
      })
      .catch((err) => {
        console.error('Error al cargar gráfica real:', err);
        this.puntosGrafica = [];
      });
  }

  cargarMasTransacciones(): void {
    this.cargarTransacciones(this.paginaTransacciones + 1);
  }

  // ── HELPERS MAPEO ────────────────────────────────────────────
  private mapearTransaccion(t: any): any {
    const tipoMap: Record<string, { icono: string; iconClass: string; badgeClass: string }> = {
      'Pago':      { icono: '✅', iconClass: 'ti-green',  badgeClass: 'badge-pago' },
      'Propina':   { icono: '🎁', iconClass: 'ti-orange', badgeClass: 'badge-propina' },
      'Incentivo': { icono: '⭐', iconClass: 'ti-blue',   badgeClass: 'badge-incentivo' },
      'Retiro':    { icono: '🏦', iconClass: 'ti-purple', badgeClass: 'badge-retiro' }
    };
    const meta = tipoMap[t.tipo] || { icono: '💳', iconClass: 'ti-green', badgeClass: 'badge-pago' };
    return { ...t, ...meta };
  }

  // ════════════════════════════════════════════════════════════
  //  CHARTS
  // ════════════════════════════════════════════════════════════

  private renderizarCharts(): void {
    this.renderChartLinea();
    this.renderChartDona();
  }

  private renderChartLinea(): void {
    const canvas = document.getElementById('chartGanancias') as HTMLCanvasElement;
    if (!canvas || typeof Chart === 'undefined') return;
    if (this.chartLinea) this.chartLinea.destroy();

    const labels = this.puntosGrafica.map(p => p.dia);
    const valores = this.puntosGrafica.map(p => p.valor);

    this.chartLinea = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: valores,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.10)',
          borderWidth: 2.5,
          pointBackgroundColor: '#10b981',
          pointRadius: 4,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#1e293b',
            bodyColor: '#10b981',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (ctx: any) => ` $${ctx.parsed.y.toLocaleString('es-CO')}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 12 } }
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              color: '#94a3b8',
              font: { size: 12 },
              callback: (v: any) => `$${(v / 1000).toFixed(0)}K`
            }
          }
        }
      }
    });
  }

  private renderChartDona(): void {
    const canvas = document.getElementById('chartDona') as HTMLCanvasElement;
    if (!canvas || typeof Chart === 'undefined') return;
    if (this.chartDona) this.chartDona.destroy();

    this.chartDona = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [this.stats.ganancia_viajes, this.stats.propinas, this.stats.incentivos],
          backgroundColor: ['#10b981', '#f97316', '#3b82f6'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: { legend: { display: false }, tooltip: { enabled: true } }
      }
    });
  }

  // ════════════════════════════════════════════════════════════
  //  PORCENTAJES DESGLOSE
  // ════════════════════════════════════════════════════════════
  get pctViajes(): string {
    const total = this.stats.ganancias_mes || 1;
    return ((this.stats.ganancia_viajes / total) * 100).toFixed(1);
  }
  get pctPropinas(): string {
    const total = this.stats.ganancias_mes || 1;
    return ((this.stats.propinas / total) * 100).toFixed(1);
  }
  get pctIncentivos(): string {
    const total = this.stats.ganancias_mes || 1;
    return ((this.stats.incentivos / total) * 100).toFixed(1);
  }

  // ════════════════════════════════════════════════════════════
  //  FILTROS
  // ════════════════════════════════════════════════════════════
  setFiltro(f: typeof this.filtro): void {
    this.filtro = f;
    this.paginaTransacciones = 0;
    this.cargando = true;
    Promise.all([this.cargarStats(), this.cargarTransacciones(0), this.cargarGrafica()])
      .finally(() => {
        this.cargando = false;
        setTimeout(() => this.renderizarCharts(), 150);
      });
  }

  get rangoLabel(): string {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const lastDay   = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
    return `${fmt(primerDia)} – ${fmt(lastDay)}`;
  }

  // ════════════════════════════════════════════════════════════
  //  EXPORTAR CSV
  // ════════════════════════════════════════════════════════════
  exportarCSV(): void {
    const cabeceras = ['ID', 'Tipo', 'Título', 'Subtítulo', 'Fecha', 'Hora', 'Monto'];
    const filas = this.transacciones.map(t => [
      t.id, t.tipo, t.titulo, t.subtitulo, t.fecha, t.hora, t.monto
    ]);
    const csv = [cabeceras, ...filas].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `ganancias_conductor_${this.conductorId}_${this.filtro}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ════════════════════════════════════════════════════════════
  //  RETIRO
  // ════════════════════════════════════════════════════════════
  solicitarRetiro(): void {
    if (!this.conductorId || this.stats.saldo_disponible <= 0) return;
    this.retirando = true;

    fetch(`${environment.apiUrl}/transporte/solicitar-retiro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conductor_id: this.conductorId,
        monto: this.stats.saldo_disponible
      })
    })
      .then(r => r.json())
      .then(() => {
        this.mostrarOk('Retiro solicitado exitosamente. Llegará en 1-2 días hábiles.');
        this.stats.saldo_disponible = 0;
        this.cargarTransacciones(0);
      })
      .catch(() => this.mostrarErr('No se pudo procesar el retiro. Intenta más tarde.'))
      .finally(() => this.retirando = false);
  }

  verHistorialRetiros(): void {
    this.filtro = 'anio';
    this.setFiltro('anio');
  }

  // ════════════════════════════════════════════════════════════
  //  FALLBACKS (datos de demostración cuando el backend no responde)
  // ════════════════════════════════════════════════════════════
  private cargarDatosFallback(): void {
    // Método vaciado para evitar mostrar datos falsos de david s
    console.warn('El sistema intentó cargar datos de prueba, pero han sido deshabilitados.');
  }

  private cargarGraficaFallback(): void {
    this.puntosGrafica = [];
  }

  private cargarTransaccionesFallback(): void {
    this.transacciones = [];
  }

  // ════════════════════════════════════════════════════════════
  //  UI HELPERS
  // ════════════════════════════════════════════════════════════
  toggleSidebar(): void {
    if (window.innerWidth <= 992) this.menuNavAbierto = !this.menuNavAbierto;
    else this.sidebarColapsado = !this.sidebarColapsado;
  }

  toggleMenu(): void { this.menuAbierto = !this.menuAbierto; }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  private mostrarOk(msg: string): void {
    this.mensajeOk = msg; this.mensajeErr = '';
    setTimeout(() => this.mensajeOk = '', 5000);
  }

  private mostrarErr(msg: string): void {
    this.mensajeErr = msg; this.mensajeOk = '';
    setTimeout(() => this.mensajeErr = '', 5000);
  }
}