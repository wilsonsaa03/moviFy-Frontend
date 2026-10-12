import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-viajes-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './viajes-usuario.html',
  styleUrls: ['./viajes-usuario.css']
})
export class ViajesUsuarioComponent implements OnInit, OnDestroy {

  nombre = '';
  menuAbierto = false;      // Unificado: controla el menú izquierdo
  dropdownAbierto = false;  // Dropdown perfil
  filtroActivo = 'todos';
  cargando = true;

  private clickListener: any;

  // Stats del mes
  stats = {
    viajes: 0,
    gastado: 0,
    enCurso: 0,
    favoritos: 0
  };

  // Servicio en curso
  servicioEnCurso: any = null;

  // Lista de viajes
  viajes: any[] = [];

  get viajesFiltrados() {
    if (this.filtroActivo === 'todos') return this.viajes;
    return this.viajes.filter(v => v.tipo === this.filtroActivo);
  }

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Usuario';
    const usuarioId = localStorage.getItem('id');

    if (usuarioId) {
      this.cargarDatosDesdeDB(usuarioId);
    } else {
      this.cargando = false;
    }

    // ✅ Cerrar menús al hacer clic fuera
    this.clickListener = () => {
      this.dropdownAbierto = false;
      this.menuAbierto = false;
      this.cdr.detectChanges();
    };
    document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    if (this.clickListener) document.removeEventListener('click', this.clickListener);
  }

  cargarDatosDesdeDB(id: string) {
    this.cargando = true;
    
    // 1. Cargar historial completo del usuario
    this.api.get<any[]>(`/transporte/servicios/usuario/${id}`)
      .then(data => {
        // El backend ya los entrega del más reciente al más antiguo (antes se invertían y quedaban al revés)
        const sorted = Array.isArray(data) ? data : [];
        this.viajes = sorted.map((item: any) => this.mapearViaje(item));
        
        // Detectar automáticamente si hay un servicio activo para la tarjeta superior
        const activo = sorted.find((s: any) => 
          !['FINALIZADO', 'CANCELADO', 'RECHAZADO'].includes(s.estado.toUpperCase())
        );
        
        if (activo) {
          this.cargarDetalleServicioActivo(activo.id);
        } else {
          this.servicioEnCurso = null;
        }

        // Actualizar estadísticas basadas en la carga real
        this.stats.enCurso = sorted.filter((s: any) => !['FINALIZADO', 'CANCELADO'].includes(s.estado)).length;
        
        // Favoritos todavía no existe en el backend: se muestra 0 sin llamar a un endpoint inexistente
        this.stats.favoritos = 0;

        this.cargando = false;
        this.cdr.detectChanges();
      })
      .catch(err => {
        console.error('Error al cargar historial:', err);
        this.cargando = false;
        this.cdr.detectChanges();
      });

    // 2. Cargar estadísticas financieras del mes actual
    this.api.get(`/transporte/servicios/usuario/${id}/mes-actual`)
      .then((data: any) => {
        // Si el backend devuelve un objeto con totales
        this.stats.viajes = data.total_servicios || (Array.isArray(data) ? data.length : 0);
        this.stats.gastado = data.total_gasto || (Array.isArray(data) ? data.reduce((acc: number, v: any) => acc + (v.tarifa || 0), 0) : 0);
        this.cdr.detectChanges();
      })
      .catch(err => console.warn('No se pudieron obtener stats del mes:', err));
  }

  private cargarDetalleServicioActivo(servicioId: number) {
    this.api.get(`/transporte/servicio/${servicioId}`)
      .then((s: any) => {
        this.servicioEnCurso = {
          id: s.id,
          origen: 'Tu ubicación',
          origenDir: s.origen || 'Punto de recogida',
          destino: s.destino || 'Destino',
          destinoDir: s.destino || '',
          conductorNombre: s.conductor_nombre || 'Asignando conductor...',
          conductorFoto: s.conductor_foto || '',
          conductorRating: 4.9,
          tiempoRestante: 5
        };
        this.cdr.detectChanges();
      });
  }

  private mapearViaje(item: any) {
    const tipo = item.tipo?.toLowerCase() || 'transporte';
    const estado = item.estado?.toUpperCase() || 'PENDIENTE';
    
    return {
      id: item.id,
      tipo: tipo,
      tipoLabel: tipo.charAt(0).toUpperCase() + tipo.slice(1),
      tipoColor: tipo === 'domicilio' ? 'orange' : (tipo === 'encomienda' ? 'purple' : 'green'),
      icono: tipo === 'domicilio' ? '🛵' : (tipo === 'encomienda' ? '📦' : '🚗'),
      origen: item.origen || 'Origen',
      destino: item.destino || 'Destino',
      fecha: item.fecha_solicitud ? new Date(item.fecha_solicitud).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Hoy',
      hora: new Date(item.fecha_solicitud).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      pago: item.metodo_pago || 'Efectivo',
      precio: item.tarifa || 0,
      estado: estado === 'FINALIZADO' ? 'Completado' : (estado === 'CANCELADO' ? 'Cancelado' : 'En curso'),
      estadoClass: estado === 'FINALIZADO' ? 'completado' : (estado === 'CANCELADO' ? 'cancelado' : 'en-camino'),
      accionLabel: estado === 'FINALIZADO' ? 'Repetir viaje' : 'Ver detalle',
      accionClass: estado === 'FINALIZADO' ? 'btn-repetir' : 'btn-detalle-outline'
    };
  }

  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    this.cdr.detectChanges(); // Fuerza la actualización inmediata de la interfaz
  }

  toggleMenuPerfil(): void {
    this.dropdownAbierto = !this.dropdownAbierto;
    this.cdr.detectChanges(); // ✅ Asegura que el menú responda al instante
  }

  verPerfil(): void {
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    this.router.navigate(['/mi-perfil']);
  }

  setFiltro(filtro: string): void {
    this.filtroActivo = filtro;
  }

  verSeguimiento(): void {
    // navegar a mapa/seguimiento
  }

  async cancelarViajeEnCurso(): Promise<void> {
    if (!this.servicioEnCurso || !this.servicioEnCurso.id) return;

    const confirmar = confirm('¿Estás seguro de que deseas cancelar tu servicio actual?');
    if (!confirmar) return;

    try {
      await this.api.patch(`/transporte/servicio/${this.servicioEnCurso.id}/estado`, { estado: 'CANCELADO' });
      alert('Servicio cancelado correctamente.');
      const usuarioId = localStorage.getItem('id');
      if (usuarioId) this.cargarDatosDesdeDB(usuarioId);
    } catch (err) {
      // 409: el viaje ya arrancó o terminó y no se puede cancelar
      alert(ApiService.mensaje(err, 'No se pudo cancelar el servicio. Intenta de nuevo.'));
    }
  }

  solicitarDeNuevo(): void {
    this.router.navigate(['/solicitar-transporte']);
  }

  exportar(): void {
    // lógica de exportar
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}