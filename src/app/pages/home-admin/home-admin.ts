import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SesionService } from '../../core/sesion.service';
import { AdminCatalogosComponent } from './admin-catalogos/admin-catalogos';
import { AdminEnVivoComponent } from './admin-en-vivo/admin-en-vivo';
import { AdminSeguridadComponent } from './admin-seguridad/admin-seguridad';
import { AdminReportesComponent } from './admin-reportes/admin-reportes';
import { AdminTarifasComponent } from './admin-tarifas/admin-tarifas';
import { AdminConfiguracionComponent } from './admin-configuracion/admin-configuracion';
import { AdminAuditoriaComponent } from './admin-auditoria/admin-auditoria';
import { AdminServicioDetalleComponent } from './admin-servicio-detalle/admin-servicio-detalle';
import { AdminDocumentosVencerComponent } from './admin-documentos-vencer/admin-documentos-vencer';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';
import { AdminServiciosComponent } from './admin-servicios/admin-servicios';
import { AdminUsuariosComponent } from './admin-usuarios/admin-usuarios';
import { AdminConductoresComponent } from './admin-conductores/admin-conductores';
import { AdminEstadisticasComponent } from './admin-estadisticas/admin-estadisticas';
import { AdminCalificacionesComponent } from './admin-calificaciones/admin-calificaciones';
import { AdminEquipoComponent } from './admin-equipo/admin-equipo';
import { AdminOperacionComponent } from './admin-operacion/admin-operacion';
import { AdminIcoComponent } from './admin-ico';

type Seccion = 'dashboard' | 'vivo' | 'seguridad' | 'soporte' | 'servicios' | 'conductores' | 'usuarios' | 'calificaciones'
  | 'reportes' | 'tarifas' | 'configuracion' | 'catalogos' | 'equipo' | 'auditoria';

/** Secciones que solo ve el admin: soporte no tiene configuracion.ver, auditoria.ver ni seguridad.ver. */
const SOLO_ADMIN: Seccion[] = ['configuracion', 'equipo', 'auditoria'];
/** Secciones que usan los íconos propios de home-admin (las demás usan adm-ico). */
const ICONOS_LOCALES = ['dashboard', 'conductores', 'usuarios', 'servicios', 'reportes', 'catalogos'];
/** Cada cuánto se refrescan los números del menú (SOS, PQRS, conductores por validar). */
const RESUMEN_MS = 30000;

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

/** GET /api/admin/conductores/{id}/expediente: checklist de su tipo de vehículo, actividad e historial. */
interface Expediente {
  tipo_vehiculo: 'moto' | 'taxi' | null;
  requisitos: { codigo: string; nombre: string; obligatorio: boolean; exigir_desde_anios: number | null; estado: string | null; dias_para_vencer: number | null }[];
  obligatorios_sin_aprobar: number;
  actividad: { total_servicios: number; total_cancelaciones: number; calificacion_promedio: number | null; tasa_cancelacion: number; cobrado_30_dias: number };
  servicios: { id: number; estado_codigo: string; estado_nombre: string; solicitado_en: string; destino: string }[];
  calificaciones: { servicio_id: number; puntuacion: number; comentario: string | null }[];
  historial_estado: { accion: string; creado_en: string; por: string | null }[];
}

/**
 * Panel de gestión de MoviFY (admin y soporte). Este componente solo arma la navegación, los números del menú y
 * los modales del conductor (expediente y motivo); cada sección es su propio componente y trae sus datos
 * filtrados y paginados desde el backend. Que un botón no se vea aquí no protege nada: cada endpoint valida su
 * permiso en Spring Boot.
 */
@Component({
  selector: 'app-home-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminCatalogosComponent, AdminEnVivoComponent, AdminSeguridadComponent,
    AdminReportesComponent, AdminTarifasComponent, AdminConfiguracionComponent, AdminAuditoriaComponent,
    AdminServicioDetalleComponent, AdminDocumentosVencerComponent, AdminDashboardComponent, AdminServiciosComponent,
    AdminUsuariosComponent, AdminConductoresComponent, AdminEstadisticasComponent, AdminCalificacionesComponent,
    AdminEquipoComponent, AdminOperacionComponent, AdminIcoComponent],
  templateUrl: './home-admin.html',
  styleUrls: ['./home-admin.css']
})
export class HomeAdminComponent implements OnInit, OnDestroy {

  // NAV
  nombre = '';
  foto = '';
  rolEtiqueta = 'Administrador';
  hoyTexto = '';

  // SECCIONES
  seccionActiva: Seccion = 'dashboard';
  private readonly todasLasSecciones: { id: Seccion; titulo: string; subtitulo: string }[] = [
    { id: 'dashboard', titulo: 'Resumen', subtitulo: 'Lo que pasa hoy y lo que necesita atención' },
    { id: 'vivo', titulo: 'En vivo', subtitulo: 'Conductores conectados y servicios en este momento' },
    { id: 'seguridad', titulo: 'Seguridad', subtitulo: 'Alertas SOS y "¿Todo bien?" de los viajes' },
    { id: 'soporte', titulo: 'Soporte (PQRS)', subtitulo: 'Peticiones, quejas, reclamos y objetos olvidados' },
    { id: 'servicios', titulo: 'Solicitudes', subtitulo: 'Supervisión de todos los servicios, con su línea de tiempo' },
    { id: 'conductores', titulo: 'Conductores', subtitulo: 'Valida documentos según el vehículo y gestiona a los conductores' },
    { id: 'usuarios', titulo: 'Clientes y usuarios', subtitulo: 'Perfiles, actividad y bloqueos por mal uso' },
    { id: 'calificaciones', titulo: 'Calificaciones', subtitulo: 'Calificaciones bajas para darles seguimiento' },
    { id: 'reportes', titulo: 'Reportes', subtitulo: 'Estadísticas por periodo y exportación a Excel' },
    { id: 'tarifas', titulo: 'Tarifas', subtitulo: 'Cuánto cuesta cada servicio: de día, de noche y con lluvia' },
    { id: 'configuracion', titulo: 'Configuración', subtitulo: 'Parámetros de búsqueda, viajes, seguridad y cuentas' },
    { id: 'catalogos', titulo: 'Datos básicos', subtitulo: 'Motivos, documentos, vehículos, servicios y contenido prohibido' },
    { id: 'equipo', titulo: 'Equipo y permisos', subtitulo: 'Quién es admin o soporte y qué puede hacer cada uno' },
    { id: 'auditoria', titulo: 'Auditoría', subtitulo: 'Quién hizo qué, cuándo y por qué' }
  ];

  get secciones() {
    return this.todasLasSecciones.filter(s => !this.esSoporte || !SOLO_ADMIN.includes(s.id));
  }

  get seccion() {
    return this.secciones.find(s => s.id === this.seccionActiva) ?? this.secciones[0];
  }

  get esSoporte(): boolean {
    return this.sesion.rol === 'soporte';
  }

  /** Números del menú (del backend, cada 30 s). */
  pendientesSeguridad = 0;
  pqrsAbiertas = 0;
  conductoresPendientes = 0;
  private relojResumen?: ReturnType<typeof setInterval>;

  /** Al cambiarlos, la lista correspondiente se vuelve a pedir. */
  versionConductores = 0;
  versionServicios = 0;
  filtroConductor = 'todos';

  /** Servicio abierto en el modal de detalle (desde Solicitudes, En vivo, Seguridad, Soporte o un perfil). */
  servicioAbierto: number | null = null;

  // MODAL DE MOTIVO (rechazar / suspender: siempre con motivo, que el conductor ve en la app)
  conductorSeleccionado: { conductor_id: number; nombre?: string } | null = null;
  mostrarModal = false;
  motivoRechazo = '';
  accionModal: 'rechazado' | 'suspendido' = 'rechazado';
  procesandoConductor = false;

  // MODAL DEL EXPEDIENTE DEL CONDUCTOR
  mostrarModalDocumentos = false;
  conductorDetalle: any = null;
  expediente: Expediente | null = null;
  cargandoDetalle = false;
  /** URLs locales (blob:) de los documentos, por id: se descargan con el token del admin. */
  docUrls: Record<string, string> = {};
  docTipos: Record<string, string> = {};
  rechazandoDoc: number | null = null;
  observacionDoc = '';
  procesandoDoc: number | null = null;
  /** Error dentro del modal (p. ej. "falta la licencia"): el modal no se cierra. */
  errorModal = '';

  /** Aviso arriba del contenido (en lugar de alert): éxito o error de una acción. */
  aviso: { tipo: 'ok' | 'error'; texto: string } | null = null;
  private relojAviso?: ReturnType<typeof setTimeout>;

  constructor(
    private router: Router,
    private api: ApiService,
    private sesion: SesionService
  ) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Admin';
    this.foto = localStorage.getItem('foto') || '';
    this.rolEtiqueta = this.esSoporte ? 'Soporte' : 'Administrador';
    const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    this.hoyTexto = hoy.charAt(0).toUpperCase() + hoy.slice(1);
    this.cargarResumen();
    this.relojResumen = setInterval(() => this.cargarResumen(), RESUMEN_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.relojResumen);
    this.liberarDocumentos();
  }

  iconoLocal(id: string): boolean {
    return ICONOS_LOCALES.includes(id);
  }

  badge(id: Seccion): number {
    if (id === 'conductores') return this.conductoresPendientes;
    if (id === 'seguridad') return this.pendientesSeguridad;
    if (id === 'soporte') return this.pqrsAbiertas;
    return 0;
  }

  irA(seccion: Seccion, filtroConductor?: string) {
    this.seccionActiva = seccion;
    this.filtroConductor = filtroConductor ?? 'todos';
  }

  /** Contadores del backend (GET /admin/resumen) para el menú. */
  cargarResumen(): void {
    this.api.get<{ totales: Record<string, number> }>('/admin/resumen')
      .then(r => {
        const t = r.totales;
        this.pendientesSeguridad = Number(t['sos_abiertas'] || 0) + Number(t['alertas_viaje_pendientes'] || 0);
        this.pqrsAbiertas = Number(t['pqrs_abiertas'] || 0);
        this.conductoresPendientes = Number(t['conductores_pendientes'] || 0);
      })
      .catch(() => undefined);
  }

  /** Los componentes de cada sección avisan aquí el resultado de sus acciones. */
  mostrarAviso(a: { tipo: 'ok' | 'error'; texto: string }): void {
    this.avisar(a.tipo, a.texto);
    this.cargarResumen();
  }

  abrirServicio(id: number): void {
    this.servicioAbierto = id;
  }

  servicioCambio(texto: string): void {
    this.avisar('ok', texto);
    this.versionServicios++;
    this.cargarResumen();
  }

  verConductor(id: number): void {
    this.verDocumentos({ conductor_id: id });
  }

  /** Desde Calificaciones: el conductor abre su expediente; el pasajero, Clientes con su nombre. */
  verPersona(p: { id: number; rol: 'conductor' | 'cliente' }): void {
    if (p.rol === 'conductor') this.verConductor(p.id);
    else this.irA('usuarios');
  }

  // ─── CONDUCTORES: EXPEDIENTE ───────────────────
  verDocumentos(c: { conductor_id: number }) {
    this.mostrarModalDocumentos = true;
    this.cargandoDetalle = true;
    this.conductorDetalle = null;
    this.expediente = null;
    this.errorModal = '';
    this.rechazandoDoc = null;
    this.liberarDocumentos();

    this.api.get<Expediente>(`/admin/conductores/${c.conductor_id}/expediente`)
      .then(e => (this.expediente = e))
      .catch(() => undefined);
    this.api.get(`/transporte/admin/conductor/${c.conductor_id}/detalle`)
      .then((data: any) => {
        this.conductorDetalle = data;
        this.cargandoDetalle = false;
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

  /**
   * Documentos obligatorios de SU tipo de vehículo que no están subidos o están rechazados/vencidos: con alguno,
   * no se puede aprobar (los "por revisar" sí: el admin los está viendo y quedan aprobados al aprobar).
   */
  get faltanRequisitos(): number {
    return (this.expediente?.requisitos ?? [])
      .filter(r => r.obligatorio && (!r.estado || r.estado === 'rechazado' || r.estado === 'vencido')).length;
  }

  cerrarModalDocumentos() {
    this.mostrarModalDocumentos = false;
    this.conductorDetalle = null;
    this.expediente = null;
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
      const req = this.expediente?.requisitos.find(r => r.codigo === d.tipo_documento);
      if (req) req.estado = estado;
      this.versionConductores++;
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
   * Los documentos no se abren con un enlace directo al backend: exigen el JWT del admin. Se descargan como Blob y
   * se muestran con una URL local; el servidor valida el tipo real del archivo.
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

  // ─── CONDUCTORES: CAMBIOS DE ESTADO ────────────
  /** Aprobar (o reactivar) solo desde el expediente; si el backend lo impide, el motivo se ve en el modal. */
  async aprobarDesdeModal(c: any) {
    this.errorModal = '';
    if (this.faltanRequisitos) {
      this.errorModal = 'Faltan documentos obligatorios para su tipo de vehículo.';
      return;
    }
    const ok = await this.cambiarEstado(c.conductor_id, 'aprobado', true);
    if (ok) this.cerrarModalDocumentos();
  }

  rechazarDesdeModal(c: any) {
    this.cerrarModalDocumentos();
    this.abrirMotivo(c, 'rechazado');
  }

  suspenderDesdeModal(c: any) {
    this.cerrarModalDocumentos();
    this.abrirMotivo(c, 'suspendido');
  }

  private abrirMotivo(c: { conductor_id: number; nombre?: string }, accion: 'rechazado' | 'suspendido') {
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

  cerrarModal() {
    this.mostrarModal = false;
    this.conductorSeleccionado = null;
    this.motivoRechazo = '';
  }

  /** @param enModal el error se muestra dentro del modal del expediente (no como aviso de la página). */
  async cambiarEstado(conductorId: number, nuevoEstado: string, enModal = false): Promise<boolean> {
    const conMotivo = nuevoEstado === 'rechazado' || nuevoEstado === 'suspendido';
    if (conMotivo && this.motivoRechazo.trim().length < 5) {
      this.avisar('error', 'Escribe el motivo (al menos 5 letras) para que el conductor sepa qué pasó.');
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
      this.versionConductores++;
      this.cargarResumen();
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

  // ─── SESIÓN ────────────────────────────────────
  cerrarSesion() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  inicial(nombre: string): string {
    return (nombre || '?').trim().charAt(0).toUpperCase();
  }
}
