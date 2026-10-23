import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { cargarRoutingMachine } from '../../core/lrm-loader';
import { ApiService } from '../../core/api.service';
import { SesionService } from '../../core/sesion.service';
import { contenidoProhibido } from '../../core/contenido-prohibido';
import { SelectorPuntos, crearMapaCiudad, rutaOsrm } from '../../core/mapa-ciudad';
import { PuntosRutaComponent } from '../../shared/puntos-ruta/puntos-ruta';

declare let window: any;

@Component({
  selector: 'app-solicitar-encomienda',
  standalone: true,
  imports: [CommonModule, FormsModule, PuntosRutaComponent],
  templateUrl: './solicitar-encomienda.html',
  styleUrls: ['./solicitar-encomienda.css']
})
export class SolicitarEncomienda implements OnInit, AfterViewInit, OnDestroy {

  /* ===================== VARIABLES PÚBLICAS ===================== */
  origen: string = 'Detectando ubicación...';
  nombreRemitente: string = '';
  telefonoRemitente: string = '';
  nombreDestinatario: string = '';
  telefonoDestinatario: string = '';
  descripcion: string = '';
  tipoPaquete: string = 'pequeno';
  pesoAproximado: string = '2';
  fotoSeleccionada: string = '';
  /** PIN de 4 dígitos que el destinatario le da al conductor al recibir (solo lo ve quien envía). */
  codigoEntrega: string = '';
  /** true después del primer intento de enviar: desde ahí se marcan los campos que faltan. */
  intentoEnviar: boolean = false;
  tarifaEstimada: number = 0;
  distanciaViaje: number = 0;
  tiempoEstimado: number = 0;
  buscandoConductor: boolean = false;
  mensajeEstado: string = '';
  conductorInfo: any = null;
  totalConductoresActivos: number = 0;
  ubicacionEncontrada: boolean = false;
  userLat: number = 0;
  userLng: number = 0;

  // Modal calificación
  mostrarModalDestino: boolean = false;
  calificacionSeleccionada: number = 5;
  estrellasArray: number[] = [1, 2, 3, 4, 5];

  /** Tamaños del Figma (Encomienda 2 · Paquete). El backend los traduce a pequeno/mediano. */
  tiposPaquete = [
    { valor: 'sobre',   label: 'Sobre',   detalle: 'Documentos o cartas',      icon: '✉️', vehiculo: 'moto' },
    { valor: 'pequeno', label: 'Pequeño', detalle: 'Cabe en una mochila',       icon: '🎒', vehiculo: 'moto' },
    { valor: 'mediano', label: 'Mediano', detalle: 'Cabe en el baúl de un carro', icon: '🧳', vehiculo: 'taxi' }
  ];
  fragil: boolean = false;
  /** "Lo recibo yo mismo": quien recibe es la misma persona que envía. */
  recibeYo: boolean = false;

  /** Mismos límites que el backend: hasta 30 kg; más de 15 kg o caja grande va en taxi. */
  pesos = [1, 2, 5, 10, 15, 20, 30];

  /* ===================== VARIABLES PRIVADAS ===================== */
  private idServicioFinal: number = 0;
  private map!: L.Map;
  /** Recogida y entrega marcadas en el mapa (core/mapa-ciudad). */
  puntos!: SelectorPuntos;
  destinoMarker?: L.Marker;
  private conductorMarker?: L.Marker;
  private routingControl: any;
  private pollingServicio: any;
  private intervaloRefreshConductores: any;
  private transicionFinalizada: boolean = false;
  private conductoresMarkers: Map<number, L.Marker> = new Map();
  private apiBase = '/transporte';
  private servicioId: number | null = null;
  private faseRuta: '' | 'recogida' | 'destino' = '';

  // Simulación
  private puntosRuta: L.LatLng[] = [];
  private indexSimulacion: number = 0;
  private intervaloSimulacion: any = null;
  private simulacionActiva: boolean = false;
  private lineaSimulacion?: L.Polyline;
  private lineaRecorrida?: L.Polyline;

  constructor(private router: Router, private api: ApiService, private sesion: SesionService) {}

  /* ===================== LIFECYCLE ===================== */
  ngOnInit(): void {
    // Quien envía casi siempre es quien pide: se llena con su cuenta y lo puede cambiar
    this.nombreRemitente = this.sesion.nombre;
    this.telefonoRemitente = this.sesion.telefono.replace(/^\+57/, '');
  }

  ngAfterViewInit(): void {
    this.cargarLRM().then(() => this.initMap());
  }

  ngOnDestroy(): void {
    this.detenerSimulacion();
    if (this.pollingServicio) clearInterval(this.pollingServicio);
    if (this.intervaloRefreshConductores) clearInterval(this.intervaloRefreshConductores);
    if (this.map) this.map.remove();
  }

  /* ===================== CARGAR LRM ===================== */
  private cargarLRM(): Promise<void> {
    return cargarRoutingMachine();
  }

  /* ===================== MAPA ===================== */
  private initMap(): void {
    const container = document.getElementById('map');
    if (!container) { setTimeout(() => this.initMap(), 300); return; }
    if ((container as any)._leaflet_id) (container as any)._leaflet_id = null;

    // Abre en Buenaventura aunque el GPS no responda
    this.map = crearMapaCiudad('map');

    // Recogida y entrega: tocando el mapa, escribiendo la dirección o con el GPS
    this.puntos = new SelectorPuntos(
      this.map,
      {
        origen: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -35] }),
        destino: L.icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/679/679821.png', iconSize: [42, 42], iconAnchor: [21, 42], popupAnchor: [0, -35] })
      },
      { origen: '📍 Punto de recogida', destino: '📦 Entregar aquí' },
      () => this.alCambiarPuntos(),
      () => this.puedeEditarPuntos
    );
    this.puntos.iniciar();
  }

  /** Mientras se busca conductor o hay una encomienda en curso, los puntos ya no se mueven. */
  get puedeEditarPuntos(): boolean {
    return !this.buscandoConductor && !this.conductorInfo;
  }

  /* ===================== RECOGIDA Y ENTREGA ===================== */
  private alCambiarPuntos(): void {
    const p = this.puntos;
    if (p.origen) {
      this.userLat = p.origen.lat;
      this.userLng = p.origen.lng;
      this.origen = p.textoOrigen;
      if (!this.ubicacionEncontrada) {
        this.ubicacionEncontrada = true;
        this.obtenerConductoresReales();
        // Refrescar conductores cada 8 segundos (igual que transporte)
        this.intervaloRefreshConductores = setInterval(() => {
          if (!this.buscandoConductor && !this.simulacionActiva) this.obtenerConductoresReales();
        }, 8000);
      }
    }
    this.destinoMarker = p.marcador('destino');
    if (p.origen && p.destino) this.calcularRutaYTarifa();
  }

  /* ===================== CONDUCTORES ACTIVOS ===================== */
  private async obtenerConductoresReales(): Promise<void> {
    try {
      const conductores = await this.api.get<any[]>(`${this.apiBase}/conductores-activos`);
      this.totalConductoresActivos = conductores.length;
      this.dibujarConductoresEnMapa(conductores);
    } catch (e) {
      console.error('Error cargando conductores:', e);
    }
  }

  private dibujarConductoresEnMapa(conductores: any[]): void {
    const motoIcon = L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
      iconSize: [35, 35], iconAnchor: [17, 35], popupAnchor: [0, -30]
    });

    conductores.forEach(c => {
      const id = c.conductor_id || c.id;
      if (this.conductoresMarkers.has(id)) {
        this.conductoresMarkers.get(id)!.setLatLng([c.latitud, c.longitud]);
      } else {
        const m = L.marker([c.latitud, c.longitud], { icon: motoIcon })
          .addTo(this.map).bindPopup('<b>🛵 Conductor disponible</b>');
        this.conductoresMarkers.set(id, m);
      }
    });
  }

  /* ===================== RUTA Y TARIFA ===================== */
  /** Dibuja la ruta por calles (OSRM) entre recogida y entrega y calcula distancia, tiempo y tarifa estimada. */
  private async calcularRutaYTarifa(): Promise<void> {
    const o = this.puntos.origen!;
    const d = this.puntos.destino!;
    const ruta = await rutaOsrm(o, d);
    if (ruta) {
      this.puntos.mostrarRuta(ruta.puntos, '#f97316');
      this.distanciaViaje = ruta.km;
      this.tiempoEstimado = Math.round(ruta.min);
    } else {
      // Sin OSRM: línea recta como respaldo
      this.puntos.mostrarRuta([o, d], '#f97316');
      this.distanciaViaje = this.map.distance(o, d) / 1000;
      this.tiempoEstimado = Math.max(1, Math.round(this.distanciaViaje * 3));
    }
    await this.cotizar();
  }

  /**
   * Precio con la tarifa de encomienda del backend (el mismo con el que se cobra), según el vehículo
   * que exige el paquete. Si no responde, una estimación local para no dejar la pantalla en blanco.
   */
  private async cotizar(): Promise<void> {
    const o = this.puntos?.origen;
    const d = this.puntos?.destino;
    if (!o || !d) return;
    try {
      const c = await this.api.get('/tarifas/cotizar', {
        tipo_servicio: 'encomienda', tipo_vehiculo: this.vehiculo,
        origen_lat: o.lat, origen_lng: o.lng, destino_lat: d.lat, destino_lng: d.lng
      });
      this.tarifaEstimada = Number(c.opciones?.[0]?.valor_estimado) || 0;
      if (c.duracion_min) this.tiempoEstimado = Number(c.duracion_min);
    } catch {
      this.tarifaEstimada = 0;
    }
    if (!this.tarifaEstimada) {
      const base = this.vehiculo === 'taxi' ? 6000 : 4000;
      const porKm = this.vehiculo === 'taxi' ? 1500 : 900;
      this.tarifaEstimada = Math.ceil((base + this.distanciaViaje * porKm) / 100) * 100;
    }
  }

  /* ===================== PAQUETE ===================== */
  /** Como en el Figma: el mediano va en taxi; y la moto no lleva más de 15 kg (regla de la BD). */
  get vehiculo(): 'moto' | 'taxi' {
    const tipo = this.tiposPaquete.find(t => t.valor === this.tipoPaquete);
    return tipo?.vehiculo === 'taxi' || Number(this.pesoAproximado) > 15 ? 'taxi' : 'moto';
  }

  /** Llena (o limpia) quién recibe con los datos de quien envía. */
  alternarRecibeYo(): void {
    this.recibeYo = !this.recibeYo;
    this.nombreDestinatario = this.recibeYo ? this.nombreRemitente : '';
    this.telefonoDestinatario = this.recibeYo ? this.telefonoRemitente : '';
  }

  elegirTipoPaquete(valor: string): void {
    this.tipoPaquete = valor;
    this.cotizar();
  }

  cambiarPeso(): void {
    this.cotizar();
  }

  /* ===================== VALIDACIÓN FORMULARIO ===================== */
  onFotoChange(event: any): void {
    const file = event.target.files[0];
    if (file) this.fotoSeleccionada = file.name;
  }

  /** Celular colombiano (3xx…) o fijo (60x…), con o sin +57 y espacios. Igual que el backend. */
  private static telefonoValido(t: string): boolean {
    const d = (t || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    return /^(3\d{9}|60\d{8})$/.test(d);
  }

  /** Lo que falta para poder enviar, en el orden de la pantalla. Vacío = listo. */
  get faltantes(): { campo: string; texto: string }[] {
    const f: { campo: string; texto: string }[] = [];
    if (!this.ubicacionEncontrada) f.push({ campo: 'recogida', texto: 'el lugar de recogida' });
    if (!this.destinoMarker) f.push({ campo: 'entrega', texto: 'la dirección de entrega' });
    if (!this.nombreRemitente.trim()) f.push({ campo: 'nombreRemitente', texto: 'el nombre de quien envía' });
    if (!SolicitarEncomienda.telefonoValido(this.telefonoRemitente)) f.push({ campo: 'telefonoRemitente', texto: 'un celular válido de quien envía' });
    if (!this.nombreDestinatario.trim()) f.push({ campo: 'nombreDestinatario', texto: 'el nombre de quien recibe' });
    if (!SolicitarEncomienda.telefonoValido(this.telefonoDestinatario)) f.push({ campo: 'telefonoDestinatario', texto: 'un celular válido de quien recibe' });
    if (!this.descripcion.trim()) f.push({ campo: 'descripcion', texto: 'qué vas a enviar' });
    else if (this.prohibido) f.push({ campo: 'descripcion', texto: `quitar lo que no podemos llevar (${this.prohibido})` });
    return f;
  }

  /** Drogas, armas, dinero, robado…: se avisa al escribir y no se deja enviar (el backend también lo rechaza). */
  get prohibido(): string | null {
    return contenidoProhibido(this.descripcion);
  }

  /** Campo marcado en rojo (solo después de intentar enviar, para no regañar mientras escribe). */
  invalido(campo: string): boolean {
    return this.intentoEnviar && this.faltantes.some(f => f.campo === campo);
  }

  /** "Falta: el nombre de quien recibe y la dirección de entrega." */
  get mensajeFaltantes(): string {
    const t = this.faltantes.map(f => f.texto);
    if (!t.length) return '';
    const lista = t.length === 1 ? t[0] : `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}`;
    return `Para enviar tu encomienda falta ${lista}.`;
  }

  puedeEnviar(): boolean {
    return this.faltantes.length === 0;
  }

  /* ===================== SOLICITAR ENCOMIENDA ===================== */
  async solicitarEncomienda(): Promise<void> {
    if (this.buscandoConductor) return;
    if (!this.puedeEnviar()) {
      // No se crea nada: se dice qué falta y se lleva al primer campo pendiente
      this.intentoEnviar = true;
      const primero = document.querySelector<HTMLElement>(`[data-campo="${this.faltantes[0].campo}"]`);
      primero?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      primero?.focus?.();
      return;
    }

    this.buscandoConductor = true;
    this.transicionFinalizada = false;
    this.mensajeEstado = 'Buscando conductores disponibles...';

    const dest = this.destinoMarker!.getLatLng();
    const body = {
      origen_lat: this.userLat,
      origen_lng: this.userLng,
      destino_lat: dest.lat,
      destino_lng: dest.lng,
      origen: this.puntos.textoOrigen,
      destino: this.puntos.textoDestino,
      tipo: 'ENCOMIENDA',
      tipo_vehiculo: this.vehiculo,
      metodo_pago: 'efectivo',
      descripcion: this.descripcion.trim(),
      // Columnas propias de la encomienda (antes todo iba pegado en la descripción)
      nombre_remitente: this.nombreRemitente.trim(),
      telefono_remitente: this.telefonoRemitente,
      nombre_destinatario: this.nombreDestinatario.trim(),
      telefono_destinatario: this.telefonoDestinatario,
      tipo_paquete: this.tipoPaquete,
      fragil: this.fragil,
      peso_kg: String(this.pesoAproximado ?? '').slice(0, 10)
    };

    try {
      const data = await this.api.post(`${this.apiBase}/solicitar`, body);
      this.servicioId = data.id;
      this.codigoEntrega = data.codigo_entrega ?? '';
      if (data.tarifa) this.tarifaEstimada = Number(data.tarifa);
      if (data.conductores_notificados === 0) {
        this.mensajeEstado = 'No hay conductores en línea en este momento. Seguimos buscando...';
      }
      this.comenzarPollingServicio(data.id);
    } catch (e) {
      this.buscandoConductor = false;
      alert(ApiService.mensaje(e, 'No se pudo contactar con el servidor'));
    }
  }

  /* ===================== POLLING ===================== */
  private comenzarPollingServicio(id: number): void {
    setTimeout(() => {
      this.pollingServicio = setInterval(async () => {
        try {
          const servicio = await this.api.get(`${this.apiBase}/servicio/${id}`);
          this.conductorInfo = servicio;
          this.procesarEstadoServicio(servicio);
        } catch (e) {
          console.warn('Error de red en polling, reintentando...');
        }
      }, 3000);
    }, 3000);
  }

  /* ===================== PROCESAR ESTADOS (datos reales del backend) ===================== */
  private procesarEstadoServicio(s: any): void {
    if (s.codigo_entrega) this.codigoEntrega = s.codigo_entrega;
    const enCurso = ['ACEPTADO', 'EN_CAMINO_AL_USUARIO', 'LLEGO_AL_ORIGEN', 'EN_CAMINO', 'EN_VIAJE', 'PAQUETE_RECOGIDO'];
    if (enCurso.includes(s.estado)) {
      this.transicionFinalizada = true;
      this.buscandoConductor = false;
      if (s.conductor_lat != null && s.conductor_lng != null) {
        this.moverConductor(Number(s.conductor_lat), Number(s.conductor_lng));
      }
    }

    if ((s.estado === 'ACEPTADO' || s.estado === 'EN_CAMINO_AL_USUARIO') && this.faseRuta !== 'recogida') {
      this.faseRuta = 'recogida';
      this.mensajeEstado = '🛵 ¡Conductor encontrado! En camino a recoger el paquete.';
      if (s.conductor_lat != null) {
        this.iniciarSimulacion(Number(s.conductor_lat), Number(s.conductor_lng), this.userLat, this.userLng, '#f59e0b');
      }
    }

    if (s.estado === 'LLEGO_AL_ORIGEN') {
      this.mensajeEstado = '📍 ¡El conductor llegó al punto de recogida!';
    }

    if (['PAQUETE_RECOGIDO', 'EN_VIAJE', 'EN_CAMINO'].includes(s.estado) && this.faseRuta !== 'destino') {
      this.faseRuta = 'destino';
      this.mensajeEstado = '📦 Paquete recogido — en camino al destino.';
      const dest = this.destinoMarker?.getLatLng();
      if (dest) this.iniciarSimulacion(this.userLat, this.userLng, dest.lat, dest.lng, '#f97316');
    }

    if (s.estado === 'CANCELADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      alert('🔴 El servicio fue cancelado.');
      this.router.navigate(['/home-usuario']);
    }

    if (s.estado === 'FINALIZADO') {
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.idServicioFinal = s.id;
      this.mostrarModalDestino = true;
    }
  }

  private moverConductor(lat: number, lng: number): void {
    if (!this.map) return;
    if (!this.conductorMarker) {
      const motoIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3721/3721619.png',
        iconSize: [45, 45], iconAnchor: [22, 45]
      });
      this.conductorMarker = L.marker([lat, lng], { icon: motoIcon }).addTo(this.map).bindPopup('<b>🛵 Tu conductor</b>');
    } else {
      this.conductorMarker.setLatLng([lat, lng]);
    }
  }

  /* ===================== SIMULACIÓN DE MOVIMIENTO ===================== */
  public iniciarSimulacion(
    origenLat: number, origenLng: number,
    destinoLat: number, destinoLng: number,
    colorLinea: string
  ): void {
    this.detenerSimulacion();
    this.simulacionActiva = true;
    this.indexSimulacion = 0;

    this.puntos?.mostrarRuta(null); // la ruta del servicio reemplaza a la propuesta
    const url = `https://router.project-osrm.org/route/v1/driving/${origenLng},${origenLat};${destinoLng},${destinoLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!data.routes?.length) { this.simulacionActiva = false; return; }

        const coords = data.routes[0].geometry.coordinates;
        this.puntosRuta = coords.map((c: number[]) => L.latLng(c[1], c[0]));

        if (this.puntosRuta.length < 2) { this.simulacionActiva = false; return; }

        // Línea de ruta restante
        this.lineaSimulacion = L.polyline(this.puntosRuta, {
          color: colorLinea, weight: 6, opacity: 0.85
        }).addTo(this.map);

        // Estela del recorrido ya hecho
        this.lineaRecorrida = L.polyline([this.puntosRuta[0]], {
          color: colorLinea, weight: 3, opacity: 0.35
        }).addTo(this.map);

        // Ajustar cámara
        this.map.fitBounds((this.lineaSimulacion as L.Polyline).getBounds(), { padding: [60, 60] });

        // La moto la ubica moverConductor() con el GPS real del conductor
        this.simulacionActiva = false;
      })
      .catch(e => {
        console.error('Error obteniendo ruta OSRM:', e);
        this.simulacionActiva = false;
      });
  }

  public detenerSimulacion(): void {
    if (this.intervaloSimulacion) {
      clearInterval(this.intervaloSimulacion);
      this.intervaloSimulacion = null;
    }
    if (this.lineaSimulacion) {
      try { this.map.removeLayer(this.lineaSimulacion); } catch (e) {}
      this.lineaSimulacion = undefined;
    }
    if (this.lineaRecorrida) {
      try { this.map.removeLayer(this.lineaRecorrida); } catch (e) {}
      this.lineaRecorrida = undefined;
    }
    this.simulacionActiva = false;
    this.indexSimulacion = 0;
    this.puntosRuta = [];
  }

  /* ===================== CALIFICACIÓN ===================== */
  private async enviarCalificacion(servicioId: number, puntos: string): Promise<void> {
    if (!servicioId) return;
    try {
      await this.api.post(`${this.apiBase}/calificar`, {
        servicio_id: servicioId,
        puntos: Math.min(5, Math.max(1, parseInt(puntos) || 5)),
        comentario: 'Calificado desde Encomiendas'
      });
    } catch (e) {
      alert(ApiService.mensaje(e, 'No se pudo guardar la calificación.'));
    }
  }

  seleccionarEstrella(n: number): void { this.calificacionSeleccionada = n; }

  async confirmarCalificacion(): Promise<void> {
    await this.enviarCalificacion(this.idServicioFinal, String(this.calificacionSeleccionada));
    this.mostrarModalDestino = false;
    this.reiniciarComponente();
  }

  saltarCalificacion(): void {
    this.mostrarModalDestino = false;
    this.reiniciarComponente();
  }

  /* ===================== REINICIAR ===================== */
  private reiniciarComponente(): void {
    this.detenerSimulacion();
    if (this.pollingServicio) clearInterval(this.pollingServicio);

    this.conductorInfo = null;
    this.buscandoConductor = false;
    this.transicionFinalizada = false;
    this.mensajeEstado = '';
    this.tarifaEstimada = 0;
    this.distanciaViaje = 0;
    this.tiempoEstimado = 0;
    this.descripcion = '';
    this.nombreRemitente = '';
    this.telefonoRemitente = '';
    this.nombreDestinatario = '';
    this.telefonoDestinatario = '';
    this.fotoSeleccionada = '';
    this.codigoEntrega = '';
    this.intentoEnviar = false;
    this.fragil = false;
    this.recibeYo = false;
    this.calificacionSeleccionada = 5;
    this.idServicioFinal = 0;
    this.servicioId = null;
    this.faseRuta = '';

    this.puntos?.quitarDestino();
    this.destinoMarker = undefined;
    if (this.conductorMarker) { this.map.removeLayer(this.conductorMarker); this.conductorMarker = undefined; }

    this.router.navigate(['/home-usuario']);
  }

  /* ===================== ACCIONES ===================== */
  enviarMensaje(): void {
    if (this.conductorInfo?.conductor_telefono) {
      const msg = encodeURIComponent(
        `Hola ${this.conductorInfo.conductor_nombre}, soy ${this.conductorInfo.usuario_nombre ?? 'el remitente'}. Estoy esperando en ${this.origen}.`
      );
      window.open(`https://wa.me/${this.conductorInfo.conductor_telefono}?text=${msg}`, '_blank');
    } else {
      alert('No se encontró el número de teléfono del conductor.');
    }
  }

  async cancelarServicio(): Promise<void> {
    const id = this.servicioId ?? this.conductorInfo?.id;
    if (!id) return;
    if (!confirm('¿Estás seguro de que deseas cancelar el servicio?')) return;

    try {
      await this.api.patch(`${this.apiBase}/servicio/${id}/estado`, { estado: 'CANCELADO' });
      clearInterval(this.pollingServicio);
      this.detenerSimulacion();
      this.buscandoConductor = false;
      this.conductorInfo = null;
      this.servicioId = null;
      this.transicionFinalizada = false;
      alert('Servicio cancelado correctamente.');
      this.router.navigate(['/home-usuario']);
    } catch (e) {
      alert(ApiService.mensaje(e, 'No se pudo cancelar el servicio en este momento.'));
    }
  }

  volver(): void { this.router.navigate(['/home-usuario']); }

  /** Pendiente o aceptada: el cliente todavía puede cancelar (después ya va con el paquete). */
  get puedeCancelar(): boolean {
    const e = this.conductorInfo?.estado;
    return this.buscandoConductor || e === 'PENDIENTE' || e === 'ACEPTADO' || e === 'EN_CAMINO_AL_USUARIO';
  }

  /** Para que quien envía se lo pase a quien recibe (WhatsApp o copiar). */
  compartirCodigo(): void {
    const texto = `Te envío un paquete por MoviFY. Cuando llegue, dale al conductor este código de entrega: ${this.codigoEntrega}`;
    const tel = (this.telefonoDestinatario || '').replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    if (tel) window.open(`https://wa.me/57${tel}?text=${encodeURIComponent(texto)}`, '_blank');
    else navigator.clipboard?.writeText(this.codigoEntrega);
  }

  /* ===================== HELPERS UI ===================== */
  getProgresoPorcentaje(estado: string): number {
    const pasos: { [key: string]: number } = {
      'PENDIENTE': 10,
      'ACEPTADO': 25,
      'EN_CAMINO_AL_USUARIO': 40,
      'LLEGO_AL_ORIGEN': 55,
      'PAQUETE_RECOGIDO': 70,
      'EN_VIAJE': 85,
      'FINALIZADO': 100
    };
    return pasos[estado] || 0;
  }

  esPasoActivo(paso: string): boolean {
    if (!this.conductorInfo) return paso === 'PENDIENTE';
    const p = this.getProgresoPorcentaje(this.conductorInfo.estado);
    const umbrales: { [key: string]: number } = {
      'PENDIENTE': 10,
      'ACEPTADO': 25,
      'PAQUETE_RECOGIDO': 70,
      'FINALIZADO': 100
    };
    return p >= (umbrales[paso] || 0);
  }


}
