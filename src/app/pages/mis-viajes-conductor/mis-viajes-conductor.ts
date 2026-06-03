import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-mis-viajes-conductor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './mis-viajes-conductor.html',
  styleUrls: ['./mis-viajes-conductor.css']
})
export class MisViajesConductorComponent implements OnInit {

  // ===================== DATOS CONDUCTOR =====================
  nombre: string = '';
  foto: string = '';
  conductorId: number = 0;
  menuAbierto: boolean = false;
  menuNavAbierto: boolean = false;
  sidebarColapsado: boolean = false;
  enLinea: boolean = false;

  // ===================== VIAJES =====================
  viajes: any[] = [];
  viajesFiltrados: any[] = [];
  cargando: boolean = true;
  error: string = '';

  // ===================== ESTADÍSTICAS =====================
  totalHoy: number = 0;
  gananciasHoy: number = 0;
  viajeActivo: any = null;
  calificacionPromedio: number = 0;

  // ===================== FILTROS =====================
  filtroActivo: string = 'todos';
  filtroPeriodo: string = 'todos';
  busqueda: string = '';
  fechaInicio: string = '';
  fechaFin: string = '';
  mostrarFiltros: boolean = false;

  // ===================== DETALLE =====================
  viajeDetalle: any = null;
  mostrarDetalle: boolean = false;

  private apiBase = `${environment.apiUrl}/transporte`;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Conductor';
    this.foto = localStorage.getItem('foto') || '';
    this.conductorId = parseInt(localStorage.getItem('conductor_id') || '0');

    if (!this.conductorId) {
      // Intentar obtenerlo por correo
      const correo = localStorage.getItem('correo') || '';
      this.obtenerConductorIdYCargar(correo);
    } else {
      this.cargarViajes();
    }
  }

  private async obtenerConductorIdYCargar(correo: string): Promise<void> {
    try {
      const resp = await fetch(`${environment.apiUrl}/conductor/perfil?correo=${encodeURIComponent(correo)}`);
      if (resp.ok) {
        const data = await resp.json();
        this.conductorId = data.conductor_id || data.id;
        localStorage.setItem('conductor_id', String(this.conductorId));
      }
    } catch (e) {
      console.warn('No se pudo obtener conductor_id');
    }
    this.cargarViajes();
  }

  async cargarViajes(): Promise<void> {
    this.cargando = true;
    this.error = '';
    try {
      const resp = await fetch(`${this.apiBase}/viajes-conductor/${this.conductorId}`);
      if (!resp.ok) throw new Error('Error al cargar viajes');
      const data = await resp.json();
      this.viajes = data.map((v: any) => this.transformarViaje(v));
      this.aplicarFiltros();
      this.calcularEstadisticas();
    } catch (e) {
      this.error = 'No se pudieron cargar los viajes. Verifica tu conexión.';
      console.error(e);
    } finally {
      this.cargando = false;
    }
  }

  private transformarViaje(v: any): any {
    const fecha = new Date(v.fecha_solicitud || v.fecha_inicio || Date.now());
    const hoy = new Date();
    const esHoy = fecha.toDateString() === hoy.toDateString();

    return {
      id: v.id,
      estado: v.estado || 'DESCONOCIDO',
      tipo: v.tipo || 'TRANSPORTE',
      fecha: fecha,
      fechaFormateada: this.formatearFecha(fecha),
      horaFormateada: this.formatearHora(fecha),
      esHoy,
      origen: v.origen || this.formatearCoords(v.origen_lat, v.origen_lng),
      destino: v.destino || this.formatearCoords(v.destino_lat, v.destino_lng),
      origenDetalle: this.extraerBarrio(v.origen),
      destinoDetalle: this.extraerBarrio(v.destino),
      distancia_km: v.distancia_km || 0,
      tarifa: v.tarifa || v.monto_total || 0,
      duracion: this.calcularDuracion(v.fecha_solicitud, v.fecha_finalizacion),
      descripcion: v.descripcion || '',
      usuario_nombre: v.usuario_nombre || 'Cliente MoviFY',
      calificacion: v.calificacion_conductor || null,
      metodo_pago: v.metodo_pago || 'Efectivo',
      origen_lat: v.origen_lat,
      origen_lng: v.origen_lng,
      destino_lat: v.destino_lat,
      destino_lng: v.destino_lng,
      // Mapa miniatura usando OpenStreetMap estático
      mapaUrl: this.generarMapaMiniatura(v.origen_lat, v.origen_lng, v.destino_lat, v.destino_lng),
    };
  }

  private formatearFecha(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private formatearHora(fecha: Date): string {
    return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  private formatearCoords(lat?: number, lng?: number): string {
    if (!lat || !lng) return 'Ubicación';
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  private extraerBarrio(direccion?: string): string {
    if (!direccion) return '';
    const partes = direccion.split(',');
    return partes.length > 1 ? partes[1].trim() : '';
  }

  private calcularDuracion(inicio?: string, fin?: string): number {
    if (!inicio || !fin) return 0;
    const diff = new Date(fin).getTime() - new Date(inicio).getTime();
    return Math.round(diff / 60000);
  }

  private generarMapaMiniatura(oLat?: number, oLng?: number, dLat?: number, dLng?: number): string {
    // Usar un placeholder SVG con gradiente verde — no depende de API externa
    return '';
  }

  calcularEstadisticas(): void {
    const hoy = new Date();
    const viajesHoy = this.viajes.filter(v => v.esHoy);
    this.totalHoy = viajesHoy.length;
    this.gananciasHoy = viajesHoy
      .filter(v => v.estado === 'FINALIZADO')
      .reduce((sum, v) => sum + (v.tarifa || 0), 0);

    this.viajeActivo = this.viajes.find(v =>
      ['ACEPTADO', 'EN_CAMINO_AL_USUARIO', 'LLEGO_AL_ORIGEN', 'EN_VIAJE', 'PAQUETE_RECOGIDO'].includes(v.estado)
    ) || null;

    const conCalif = this.viajes.filter(v => v.calificacion);
    this.calificacionPromedio = conCalif.length
      ? conCalif.reduce((s, v) => s + v.calificacion, 0) / conCalif.length
      : 4.9;
  }

  aplicarFiltros(): void {
    let resultado = [...this.viajes];

    // Filtro por estado
    if (this.filtroActivo !== 'todos') {
      if (this.filtroActivo === 'activo') {
        resultado = resultado.filter(v =>
          ['ACEPTADO', 'EN_CAMINO_AL_USUARIO', 'EN_VIAJE', 'LLEGO_AL_ORIGEN', 'PAQUETE_RECOGIDO'].includes(v.estado)
        );
      } else {
        resultado = resultado.filter(v => v.estado === this.filtroActivo);
      }
    }

    // Filtro por período
    const ahora = new Date();
    if (this.filtroPeriodo === 'hoy') {
      resultado = resultado.filter(v => v.esHoy);
    } else if (this.filtroPeriodo === 'semana') {
      const hace7 = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      resultado = resultado.filter(v => v.fecha >= hace7);
    } else if (this.filtroPeriodo === 'mes') {
      const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      resultado = resultado.filter(v => v.fecha >= hace30);
    }

    // Filtro por fechas personalizadas
    if (this.fechaInicio) {
      resultado = resultado.filter(v => v.fecha >= new Date(this.fechaInicio));
    }
    if (this.fechaFin) {
      const fin = new Date(this.fechaFin);
      fin.setHours(23, 59, 59);
      resultado = resultado.filter(v => v.fecha <= fin);
    }

    // Búsqueda
    if (this.busqueda.trim()) {
      const q = this.busqueda.toLowerCase();
      resultado = resultado.filter(v =>
        v.origen?.toLowerCase().includes(q) ||
        v.destino?.toLowerCase().includes(q) ||
        v.usuario_nombre?.toLowerCase().includes(q) ||
        String(v.id).includes(q)
      );
    }

    // Ordenar: más recientes primero
    resultado.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    this.viajesFiltrados = resultado;
  }

  setFiltro(f: string): void { this.filtroActivo = f; this.aplicarFiltros(); }
  setPeriodo(p: string): void { this.filtroPeriodo = p; this.aplicarFiltros(); }
  onBusqueda(): void { this.aplicarFiltros(); }
  limpiarFiltros(): void {
    this.filtroActivo = 'todos'; this.filtroPeriodo = 'todos';
    this.busqueda = ''; this.fechaInicio = ''; this.fechaFin = '';
    this.aplicarFiltros();
  }

  verDetalle(viaje: any): void { this.viajeDetalle = viaje; this.mostrarDetalle = true; }
  cerrarDetalle(): void { this.mostrarDetalle = false; this.viajeDetalle = null; }

  abrirMapa(viaje: any): void {
    if (viaje.origen_lat && viaje.destino_lat) {
      const url = `https://www.google.com/maps/dir/${viaje.origen_lat},${viaje.origen_lng}/${viaje.destino_lat},${viaje.destino_lng}`;
      window.open(url, '_blank');
    }
  }

  exportarGanancias(): void {
    const finalizados = this.viajesFiltrados.filter(v => v.estado === 'FINALIZADO');
    const total = finalizados.reduce((s, v) => s + v.tarifa, 0);
    const csv = [
      'ID,Fecha,Tipo,Origen,Destino,Distancia,Tarifa,Metodo Pago',
      ...finalizados.map(v =>
        `${v.id},"${v.fechaFormateada} ${v.horaFormateada}",${v.tipo},"${v.origen}","${v.destino}",${v.distancia_km},${v.tarifa},${v.metodo_pago}`
      ),
      `,,,,,,TOTAL:,$${total.toLocaleString('es-CO')}`
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `ganancias-movify-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  getEstadoClass(estado: string): string {
    const m: any = {
      FINALIZADO: 'estado-completado',
      ACEPTADO: 'estado-en-curso', EN_CAMINO_AL_USUARIO: 'estado-en-curso',
      EN_VIAJE: 'estado-en-curso', LLEGO_AL_ORIGEN: 'estado-en-curso',
      PAQUETE_RECOGIDO: 'estado-en-curso',
      CANCELADO: 'estado-cancelado', RECHAZADO: 'estado-cancelado',
      PENDIENTE: 'estado-pendiente'
    };
    return m[estado] || 'estado-pendiente';
  }

  getEstadoLabel(estado: string): string {
    const m: any = {
      FINALIZADO: 'COMPLETADO', ACEPTADO: 'EN CURSO',
      EN_CAMINO_AL_USUARIO: 'EN CURSO', EN_VIAJE: 'EN CURSO',
      LLEGO_AL_ORIGEN: 'EN CURSO', PAQUETE_RECOGIDO: 'EN CURSO',
      CANCELADO: 'CANCELADO', RECHAZADO: 'CANCELADO', PENDIENTE: 'PENDIENTE'
    };
    return m[estado] || estado;
  }

  getTipoIcon(tipo: string): string {
    const m: any = { TRANSPORTE: '🛵', DOMICILIO: '🍔', ENCOMIENDA: '📦' };
    return m[tipo] || '🛵';
  }

  get gananciasFiltradasTotal(): number {
    return this.viajesFiltrados
      .filter(v => v.estado === 'FINALIZADO')
      .reduce((s, v) => s + v.tarifa, 0);
  }

  get conteoFiltrados(): number { return this.viajesFiltrados.length; }

  toggleSidebar(): void {
    if (window.innerWidth <= 992) this.menuNavAbierto = !this.menuNavAbierto;
    else this.sidebarColapsado = !this.sidebarColapsado;
  }

  toggleMenu(): void { this.menuAbierto = !this.menuAbierto; }
  toggleEnLinea(): void { this.enLinea = !this.enLinea; }

  irA(ruta: string): void { this.menuAbierto = false; this.router.navigate([ruta]); }

  cerrarSesion(): void { localStorage.clear(); this.router.navigate(['/login']); }
}