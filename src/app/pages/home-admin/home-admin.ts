import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioService } from '../../Base_de_datos/usuario.service';
import { ApiService } from '../../core/api.service';
import { SesionService } from '../../core/sesion.service';
import { AdminCatalogosComponent } from './admin-catalogos/admin-catalogos';

type Seccion = 'dashboard' | 'conductores' | 'usuarios' | 'servicios' | 'reportes' | 'catalogos';

interface DiaSemana { etiqueta: string; total: number; altura: number; esHoy: boolean; }
interface Conteo { clave: string; etiqueta: string; total: number; porcentaje: number; }

/** Estados de un servicio tal como los devuelve el backend (nombres de la web, fn_estado_legado). */
const ESTADOS_EN_CURSO = ['ACEPTADO', 'EN_CAMINO_AL_USUARIO', 'LLEGO_AL_ORIGEN', 'EN_CAMINO', 'EN_VIAJE', 'PAQUETE_RECOGIDO'];
const ETIQUETA_ESTADO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADO: 'Aceptado',
  EN_CAMINO_AL_USUARIO: 'Va por el cliente',
  LLEGO_AL_ORIGEN: 'Llegó al origen',
  EN_CAMINO: 'En camino',
  EN_VIAJE: 'En viaje',
  PAQUETE_RECOGIDO: 'Pedido recogido',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado'
};

/** Documento vigente del conductor (GET /admin/conductor/{id}/detalle → documentos). */
interface DocumentoConductor {
  id: number;
  tipo_documento: string;
  nombre: string;
  archivo: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'vencido';
  estado_nombre: string;
  observacion: string | null;
  fecha_vencimiento: string | null;
}
const ETIQUETA_TIPO: Record<string, string> = {
  TRANSPORTE: 'Transporte',
  DOMICILIO: 'Domicilio',
  ENCOMIENDA: 'Encomienda'
};

@Component({
  selector: 'app-home-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminCatalogosComponent],
  templateUrl: './home-admin.html',
  styleUrls: ['./home-admin.css']
})
export class HomeAdminComponent implements OnInit {

  // NAV
  nombre = '';
  foto = '';
  rolEtiqueta = 'Administrador';
  hoyTexto = '';

  // SECCIONES
  seccionActiva: Seccion = 'dashboard';
  readonly secciones: { id: Seccion; titulo: string; subtitulo: string }[] = [
    { id: 'dashboard', titulo: 'Resumen', subtitulo: 'Lo más importante de la plataforma hoy' },
    { id: 'conductores', titulo: 'Conductores', subtitulo: 'Valida documentos y gestiona a los conductores' },
    { id: 'usuarios', titulo: 'Usuarios', subtitulo: 'Clientes, conductores y equipo registrados' },
    { id: 'servicios', titulo: 'Servicios', subtitulo: 'Todas las solicitudes de la plataforma' },
    { id: 'reportes', titulo: 'Reportes', subtitulo: 'Cómo se está usando MoviFY' },
    { id: 'catalogos', titulo: 'Datos básicos', subtitulo: 'Motivos de cancelación y tipos de documento de la plataforma' }
  ];

  get esSoporte(): boolean {
    return this.sesion.rol === 'soporte';
  }

  // CONDUCTORES
  conductores: any[] = [];
  filtroConductor = 'todos';
  conductorSeleccionado: any = null;
  mostrarModal = false;
  motivoRechazo = '';
  procesandoConductor = false;

  // MODAL DE DETALLE / DOCUMENTOS
  mostrarModalDocumentos = false;
  conductorDetalle: any = null;
  cargandoDetalle = false;

  // USUARIOS
  usuarios: any[] = [];
  cargandoUsuarios = false;
  errorUsuarios = '';
  busquedaUsuarios = '';

  // SERVICIOS
  servicios: any[] = [];
  cargandoServicios = false;
  errorServicios = '';
  busquedaServicios = '';
  filtroTipoServicio = 'todos';
  filtroEstadoServicio = 'todos';
  /** Cuántas filas se muestran; con "Ver 20 más" se amplía (la tabla no se vuelve eterna). */
  limiteServicios = 20;

  // STATS DASHBOARD (todas calculadas con datos reales del backend)
  totalUsuarios = 0;
  totalClientes = 0;
  totalConductores = 0;
  totalServicios = 0;          // servicios de hoy
  serviciosEnCurso = 0;
  serviciosPendientes = 0;
  totalGanancias = 0;          // suma de tarifas de servicios FINALIZADOS este mes (no son pagos)
  conductoresPendientes = 0;
  serviciosSemana: DiaSemana[] = [];
  totalSemana = 0;
  totalSemanaAnterior = 0;

  // STATS REPORTES
  transportesMes = 0;
  domiciliosMes = 0;
  encomiendaMes = 0;
  porcentajeTransporte = 0;
  porcentajeDomicilio = 0;
  porcentajeEncomienda = 0;
  serviciosPorEstado: Conteo[] = [];
  estadosDisponibles: string[] = [];

  cargando = true;

  /** URLs locales (blob:) de los documentos, por id de documento: se descargan con el token del admin. */
  docUrls: Record<string, string> = {};
  docTipos: Record<string, string> = {};

  /** Documento que se está rechazando (muestra el campo del motivo debajo de su tarjeta). */
  rechazandoDoc: number | null = null;
  observacionDoc = '';
  procesandoDoc: number | null = null;
  /** Error de aprobar/rechazar dentro del modal (p. ej. "falta la licencia"): el modal no se cierra. */
  errorModal = '';
  /** Aviso arriba del contenido (en lugar de alert): éxito o error de una acción. */
  aviso: { tipo: 'ok' | 'error'; texto: string } | null = null;
  private relojAviso?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private usuarioService: UsuarioService,
    private api: ApiService,
    private sesion: SesionService
  ) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Admin';
    this.foto = localStorage.getItem('foto') || '';
    this.rolEtiqueta = this.sesion.rol === 'soporte' ? 'Soporte' : 'Administrador';
    const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    this.hoyTexto = hoy.charAt(0).toUpperCase() + hoy.slice(1);
    this.cargarDatos();
    this.cargarUsuarios();
    this.cargarServicios();
  }

  get seccion() {
    return this.secciones.find(s => s.id === this.seccionActiva)!;
  }

  irA(seccion: Seccion, filtroConductor?: string) {
    this.seccionActiva = seccion;
    if (filtroConductor) this.filtroConductor = filtroConductor;
  }

  // ─── CONDUCTORES ───────────────────────────────
  cargarDatos() {
    this.cargando = true;
    this.api.get<any[]>('/transporte/admin/conductores')
      .then(data => {
        this.conductores = data;
        this.totalConductores = data.filter((c: any) => c.estado === 'aprobado').length;
        this.conductoresPendientes = data.filter((c: any) => c.estado === 'pendiente').length;
        this.cargando = false;
      })
      .catch(err => {
        console.error('Error:', err);
        this.cargando = false;
      });
  }

  conductoresFiltrados(): any[] {
    if (this.filtroConductor === 'todos') return this.conductores;
    return this.conductores.filter(c => c.estado === this.filtroConductor);
  }

  /** Solo los que de verdad esperan validación (antes se mostraban los 3 primeros de todos). */
  get pendientesLista(): any[] {
    return this.conductores.filter(c => c.estado === 'pendiente');
  }

  contarConductores(estado: string): number {
    return estado === 'todos' ? this.conductores.length : this.conductores.filter(c => c.estado === estado).length;
  }

  /** Rechazar y suspender piden motivo (el backend lo exige y el conductor lo ve en la app). */
  accionModal: 'rechazado' | 'suspendido' = 'rechazado';

  aprobarConductor(c: any) { this.cambiarEstado(c.conductor_id, 'aprobado'); }
  rechazarConductor(c: any) { this.abrirMotivo(c, 'rechazado'); }
  bloquearConductor(c: any) { this.abrirMotivo(c, 'suspendido'); }

  private abrirMotivo(c: any, accion: 'rechazado' | 'suspendido') {
    this.conductorSeleccionado = c;
    this.accionModal = accion;
    this.motivoRechazo = '';
    this.mostrarModal = true;
  }

  /** Botón del modal de motivo: rechaza o suspende. */
  confirmarRechazo() {
    if (!this.conductorSeleccionado) return;
    this.cambiarEstado(this.conductorSeleccionado.conductor_id, this.accionModal);
  }

  verDocumentos(c: any) {
    this.mostrarModalDocumentos = true;
    this.cargandoDetalle = true;
    this.conductorDetalle = null;
    this.errorModal = '';
    this.rechazandoDoc = null;

    this.liberarDocumentos();

    this.api.get(`/transporte/admin/conductor/${c.conductor_id}/detalle`)
      .then((data: any) => {
        this.conductorDetalle = data;
        this.cargandoDetalle = false;
        // Todos los documentos vigentes (licencia, SOAT, técnico-mecánica, fotos del vehículo…), no solo 4
        for (const d of (data.documentos || []) as DocumentoConductor[]) {
          if (d.archivo) this.cargarDocumento(String(d.id), d.archivo);
        }
      })
      .catch(err => {
        this.cargandoDetalle = false;
        this.errorModal = ApiService.mensaje(err, 'No se pudo cargar el detalle del conductor.');
      });
  }

  get documentosDetalle(): DocumentoConductor[] {
    return this.conductorDetalle?.documentos || [];
  }

  get documentosPorRevisar(): number {
    return this.documentosDetalle.filter(d => d.estado === 'pendiente').length;
  }

  cerrarModalDocumentos() {
    this.mostrarModalDocumentos = false;
    this.conductorDetalle = null;
    this.errorModal = '';
    this.rechazandoDoc = null;
    this.liberarDocumentos();
  }

  /** Aprueba o rechaza un documento (PATCH /api/admin/documentos/{id}); rechazar exige el motivo. */
  async revisarDocumento(d: DocumentoConductor, estado: 'aprobado' | 'rechazado') {
    if (estado === 'rechazado' && this.rechazandoDoc !== d.id) {
      this.rechazandoDoc = d.id;
      this.observacionDoc = '';
      return;
    }
    if (estado === 'rechazado' && !this.observacionDoc.trim()) {
      this.errorModal = 'Escribe por qué rechazas el documento para que el conductor sepa qué corregir.';
      return;
    }
    this.procesandoDoc = d.id;
    this.errorModal = '';
    try {
      await this.api.patch(`/admin/documentos/${d.id}`, {
        estado,
        observacion: estado === 'rechazado' ? this.observacionDoc.trim() : null
      });
      d.estado = estado;
      d.estado_nombre = estado === 'aprobado' ? 'Aprobado' : 'Rechazado';
      d.observacion = estado === 'rechazado' ? this.observacionDoc.trim() : null;
      this.rechazandoDoc = null;
      this.cargarDatos(); // el contador de "documentos por revisar" de la tabla
    } catch (err) {
      this.errorModal = ApiService.mensaje(err, 'No se pudo actualizar el documento.');
    } finally {
      this.procesandoDoc = null;
    }
  }

  vence(d: DocumentoConductor): string {
    if (!d.fecha_vencimiento) return '';
    const f = new Date(d.fecha_vencimiento + 'T12:00:00');
    const vencido = f.getTime() < Date.now();
    return `${vencido ? 'Venció' : 'Vence'} el ${f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  /**
   * Los documentos ya no se abren con un enlace directo al backend: exigen el JWT del admin.
   * Se descargan como Blob y se muestran con una URL local; el servidor valida el tipo real
   * del archivo, así que un HTML disfrazado nunca se ejecuta en el dominio de MoviFY.
   */
  private cargarDocumento(campo: string, nombreArchivo: string) {
    this.api.blob(`/conductor/documento/${encodeURIComponent(nombreArchivo)}`)
      .then(blob => {
        this.docTipos[campo] = blob.type;
        this.docUrls[campo] = URL.createObjectURL(blob);
      })
      .catch(() => { this.docUrls[campo] = ''; });
  }

  private liberarDocumentos() {
    Object.values(this.docUrls).forEach(u => u && URL.revokeObjectURL(u));
    this.docUrls = {};
    this.docTipos = {};
  }

  esImagen(campo: string): boolean {
    return (this.docTipos[campo] || '').startsWith('image/');
  }

  abrirDocumento(campo: string) {
    const url = this.docUrls[campo];
    if (url) window.open(url, '_blank', 'noopener');
  }

  /** Solo se cierra si quedó aprobado; si el backend lo impide (falta un documento…), el motivo se ve en el modal. */
  async aprobarDesdeModal(c: any) {
    this.errorModal = '';
    const ok = await this.cambiarEstado(c.conductor_id, 'aprobado', true);
    if (ok) this.cerrarModalDocumentos();
  }

  rechazarDesdeModal(c: any) {
    this.cerrarModalDocumentos();
    this.rechazarConductor(c);
  }

  /** @param enModal el error se muestra dentro del modal de detalle (no como aviso de la página). */
  async cambiarEstado(conductorId: number, nuevoEstado: string, enModal = false): Promise<boolean> {
    const conMotivo = nuevoEstado === 'rechazado' || nuevoEstado === 'suspendido';
    if (conMotivo && !this.motivoRechazo.trim()) {
      this.avisar('error', 'Escribe el motivo para que el conductor sepa qué pasó.');
      return false;
    }

    if (this.procesandoConductor) return false;
    this.procesandoConductor = true;
    try {
      await this.api.patch(`/transporte/admin/conductor/${conductorId}/estado`, {
        estado: nuevoEstado,
        motivo_rechazo: conMotivo ? this.motivoRechazo.trim() : ''
      });
      const textos: Record<string, string> = {
        aprobado: 'Conductor aprobado: ya puede conectarse y recibir servicios.',
        rechazado: 'Conductor rechazado. Verá el motivo en la app para corregir.',
        suspendido: 'Conductor suspendido: deja de recibir servicios.'
      };
      this.avisar('ok', textos[nuevoEstado] || `Conductor ${nuevoEstado}.`);
      this.cerrarModal();
      this.cargarDatos();
      return true;
    } catch (err) {
      const msg = ApiService.mensaje(err, 'No se pudo actualizar el conductor.');
      if (enModal) this.errorModal = msg;
      else this.avisar('error', msg);
      return false;
    } finally {
      this.procesandoConductor = false;
    }
  }

  private avisar(tipo: 'ok' | 'error', texto: string) {
    clearTimeout(this.relojAviso);
    this.aviso = { tipo, texto };
    this.relojAviso = setTimeout(() => (this.aviso = null), 6000);
  }

  // ─── USUARIOS ──────────────────────────────────
  cargarUsuarios() {
    this.cargandoUsuarios = true;
    this.errorUsuarios = '';
    this.usuarioService.obtenerTodos().subscribe({
      next: (data: any[]) => {
        this.usuarios = data;
        this.totalUsuarios = data.length;
        this.totalClientes = data.filter(u => this.esCliente(u.rol)).length;
        this.cargandoUsuarios = false;
      },
      error: (err: any) => {
        console.error('Error cargando usuarios:', err);
        this.errorUsuarios = 'No se pudieron cargar los usuarios.';
        this.cargandoUsuarios = false;
      }
    });
  }

  usuariosFiltrados(): any[] {
    const q = this.busquedaUsuarios.trim().toLowerCase();
    if (!q) return this.usuarios;
    return this.usuarios.filter(u =>
      [u.nombre, u.correo, u.telefono].some((v: any) => String(v || '').toLowerCase().includes(q)));
  }

  private esCliente(rol: string): boolean {
    const r = (rol || '').toLowerCase();
    return r === 'cliente' || r === 'usuario';
  }

  /** En la BD el rol puede venir como "usuario"; en pantalla siempre decimos "Cliente". */
  rolEtiquetaDe(rol: string): string {
    const r = (rol || '').toLowerCase();
    if (this.esCliente(r)) return 'Cliente';
    if (r === 'admin') return 'Admin';
    if (r === 'soporte') return 'Soporte';
    if (r === 'conductor') return 'Conductor';
    return rol || '—';
  }

  rolClase(rol: string): string {
    const r = (rol || '').toLowerCase();
    return this.esCliente(r) ? 'rol-cliente' : `rol-${r || 'otro'}`;
  }

  bloquearUsuario(u: any) {
    if (confirm(`¿Estás seguro de bloquear al usuario ${u.nombre}?`)) {
      this.cambiarEstadoUsuario(u.id, 'bloqueado');
    }
  }

  activarUsuario(u: any) {
    this.cambiarEstadoUsuario(u.id, 'activo');
  }

  private async cambiarEstadoUsuario(id: number, nuevoEstado: string) {
    try {
      await this.api.patch(`/auth/usuarios/${id}/estado`, { estado: nuevoEstado });
      const user = this.usuarios.find(user => user.id === id);
      if (user) user.estado = nuevoEstado;
      this.avisar('ok', nuevoEstado === 'bloqueado' ? `${user?.nombre ?? 'El usuario'} quedó bloqueado.` : `${user?.nombre ?? 'El usuario'} quedó activo.`);
    } catch (err) {
      this.avisar('error', ApiService.mensaje(err, 'No se pudo actualizar el usuario.'));
    }
  }

  // ─── SERVICIOS ─────────────────────────────────
  cargarServicios() {
    this.cargandoServicios = true;
    this.errorServicios = '';
    this.api.get<any[]>('/transporte/admin/servicios')
      .then((data: any[]) => {
        this.servicios = data
          .map(s => ({
            tipo: s.tipo,
            tipoEtiqueta: ETIQUETA_TIPO[s.tipo] || s.tipo || '—',
            destino: s.destino_direccion || (s.destino_lat != null ? `${s.destino_lat?.toFixed(4)}, ${s.destino_lng?.toFixed(4)}` : '—'),
            conductor: s.conductor_nombre || 'Sin asignar',
            cliente: s.usuario_nombre || 'Desconocido',
            precio: s.tarifa || 0,
            estadoRaw: (s.estado || 'PENDIENTE').toUpperCase(),
            estado: s.estado?.toLowerCase() || 'pendiente',
            estadoEtiqueta: ETIQUETA_ESTADO[(s.estado || 'PENDIENTE').toUpperCase()] || s.estado,
            fecha: s.fecha_solicitud ? new Date(s.fecha_solicitud) : null
          }))
          // Lo más reciente primero
          .sort((a, b) => (b.fecha?.getTime() || 0) - (a.fecha?.getTime() || 0));

        this.calcularEstadisticas();
        this.cargandoServicios = false;
      })
      .catch(err => {
        console.error('Error cargando servicios:', err);
        this.errorServicios = 'No se pudieron cargar los servicios.';
        this.cargandoServicios = false;
      });
  }

  /** Todas las cifras salen de los servicios reales; nada está escrito a mano. */
  private calcularEstadisticas() {
    const hoy = new Date();
    const mismoDia = (f: Date | null, d: Date) => !!f && f.toDateString() === d.toDateString();
    // Antes solo se comparaba el mes: octubre de 2025 contaba como octubre de 2026.
    const esteMes = this.servicios.filter(s =>
      s.fecha && s.fecha.getMonth() === hoy.getMonth() && s.fecha.getFullYear() === hoy.getFullYear());

    this.totalServicios = this.servicios.filter(s => mismoDia(s.fecha, hoy)).length;
    this.serviciosEnCurso = this.servicios.filter(s => ESTADOS_EN_CURSO.includes(s.estadoRaw)).length;
    this.serviciosPendientes = this.servicios.filter(s => s.estadoRaw === 'PENDIENTE').length;
    this.totalGanancias = esteMes.filter(s => s.estadoRaw === 'FINALIZADO').reduce((acc, s) => acc + (s.precio || 0), 0);

    this.transportesMes = esteMes.filter(s => s.tipo === 'TRANSPORTE').length;
    this.domiciliosMes = esteMes.filter(s => s.tipo === 'DOMICILIO').length;
    this.encomiendaMes = esteMes.filter(s => s.tipo === 'ENCOMIENDA').length;
    const total = this.transportesMes + this.domiciliosMes + this.encomiendaMes || 1;
    this.porcentajeTransporte = Math.round((this.transportesMes / total) * 100);
    this.porcentajeDomicilio = Math.round((this.domiciliosMes / total) * 100);
    this.porcentajeEncomienda = Math.round((this.encomiendaMes / total) * 100);

    // Últimos 7 días (hoy incluido) y los 7 anteriores, para comparar de verdad
    const dias: { fecha: Date; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - i);
      dias.push({ fecha: d, total: this.servicios.filter(s => mismoDia(s.fecha, d)).length });
    }
    const inicioSemana = new Date(hoy); inicioSemana.setHours(0, 0, 0, 0); inicioSemana.setDate(inicioSemana.getDate() - 6);
    const inicioAnterior = new Date(inicioSemana); inicioAnterior.setDate(inicioAnterior.getDate() - 7);
    this.totalSemana = dias.reduce((a, d) => a + d.total, 0);
    this.totalSemanaAnterior = this.servicios.filter(s => s.fecha && s.fecha >= inicioAnterior && s.fecha < inicioSemana).length;
    const maximo = Math.max(1, ...dias.map(d => d.total));
    this.serviciosSemana = dias.map(d => ({
      etiqueta: d.fecha.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', ''),
      total: d.total,
      altura: Math.round((d.total / maximo) * 100),
      esHoy: mismoDia(d.fecha, hoy)
    }));

    // Servicios por estado (para reportes y filtros)
    const porEstado = new Map<string, number>();
    this.servicios.forEach(s => porEstado.set(s.estadoRaw, (porEstado.get(s.estadoRaw) || 0) + 1));
    const totalServ = this.servicios.length || 1;
    this.serviciosPorEstado = [...porEstado.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([clave, n]) => ({
        clave,
        etiqueta: ETIQUETA_ESTADO[clave] || clave,
        total: n,
        porcentaje: Math.round((n / totalServ) * 100)
      }));
    this.estadosDisponibles = this.serviciosPorEstado.map(e => e.clave);
  }

  /** Variación real semana contra semana anterior. null si no hay con qué comparar. */
  get variacionSemana(): number | null {
    if (!this.totalSemanaAnterior) return null;
    return Math.round(((this.totalSemana - this.totalSemanaAnterior) / this.totalSemanaAnterior) * 100);
  }

  serviciosFiltrados(): any[] {
    const q = this.busquedaServicios.trim().toLowerCase();
    return this.servicios.filter(s =>
      (this.filtroTipoServicio === 'todos' || s.tipo === this.filtroTipoServicio) &&
      (this.filtroEstadoServicio === 'todos' || s.estadoRaw === this.filtroEstadoServicio) &&
      (!q || [s.cliente, s.conductor, s.destino].some((v: any) => String(v || '').toLowerCase().includes(q))));
  }

  etiquetaEstado(clave: string): string {
    return ETIQUETA_ESTADO[clave] || clave;
  }

  // ─── SESIÓN ────────────────────────────────────
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.conductorSeleccionado = null;
    this.motivoRechazo = '';
  }

  getEstadoClass(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'aprobado': return 'status-approved';
      case 'rechazado': return 'status-rejected';
      case 'suspendido': return 'status-suspended';
      default: return 'status-pending';
    }
  }

  getFriendlyDate(fecha: string): string {
    if (!fecha) return 'Pendiente';
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  }

  inicial(nombre: string): string {
    return (nombre || '?').trim().charAt(0).toUpperCase();
  }
}
