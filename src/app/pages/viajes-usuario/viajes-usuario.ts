import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

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
    fetch(`${environment.apiUrl}/transporte/servicios/usuario/${id}`)
      .then(res => res.json())
      .then(data => {
        // Invertimos para ver los más recientes arriba
        const sorted = Array.isArray(data) ? data.reverse() : [];
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
        
        // Intentar obtener el conteo de favoritos (endpoint opcional)
        fetch(`${environment.apiUrl}/usuario/favoritos-count/${id}`)
          .then(r => r.json())
          .then(fav => {
            this.stats.favoritos = fav.total || 0;
            this.cdr.detectChanges();
          })
          .catch(() => {
            // Fallback si el endpoint no existe aún: contar los que vienen marcados en la lista si aplica
            this.stats.favoritos = 0;
          });

        this.cargando = false;
        this.cdr.detectChanges();
      })
      .catch(err => {
        console.error('Error al cargar historial:', err);
        this.cargando = false;
        this.cdr.detectChanges();
      });

    // 2. Cargar estadísticas financieras del mes actual
    fetch(`${environment.apiUrl}/transporte/servicios/usuario/${id}/mes-actual`)
      .then(res => res.json())
      .then(data => {
        // Si el backend devuelve un objeto con totales
        this.stats.viajes = data.total_servicios || (Array.isArray(data) ? data.length : 0);
        this.stats.gastado = data.total_gasto || (Array.isArray(data) ? data.reduce((acc: number, v: any) => acc + (v.tarifa || 0), 0) : 0);
        this.cdr.detectChanges();
      })
      .catch(err => console.warn('No se pudieron obtener stats del mes:', err));
  }

  private cargarDetalleServicioActivo(servicioId: number) {
    fetch(`${environment.apiUrl}/transporte/servicio/${servicioId}`)
      .then(res => res.json())
      .then(s => {
        this.servicioEnCurso = {
          id: s.id,
          origen: 'Tu ubicación',
          origenDir: s.origen_direccion || 'Punto de recogida',
          destino: s.destino_direccion || 'Destino',
          destinoDir: s.destino_direccion || '',
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
      origen: item.origen_direccion || 'Origen',
      destino: item.destino_direccion || 'Destino',
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
      const resp = await fetch(`${environment.apiUrl}/transporte/servicio/${this.servicioEnCurso.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'CANCELADO' })
      });

      if (resp.ok) {
        alert('Servicio cancelado correctamente.');
        const usuarioId = localStorage.getItem('id');
        if (usuarioId) this.cargarDatosDesdeDB(usuarioId);
      } else {
        alert('No se pudo cancelar el servicio. Intenta de nuevo.');
      }
    } catch (err) {
      console.error('Error al cancelar el viaje:', err);
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