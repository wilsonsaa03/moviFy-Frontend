import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-home-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-usuario.html',
  styleUrls: ['./home-usuario.css']
})
export class HomeUsuarioComponent implements OnInit, OnDestroy {

  nombre = '';
  foto = '';
  menuAbierto = false;      // Controla el sidebar en móviles
  dropdownAbierto = false;  // dropdown navbar
  cargandoHistorial = true;

  private clickListener: any;

  historial: any[] = [];

  constructor(
    private router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef // ✅ Inyectamos el detector de cambios
  ) {}

  ngOnInit(): void {
    this.nombre = localStorage.getItem('nombre') || 'Usuario';
    this.foto   = localStorage.getItem('foto')   || '';
    const usuarioId = localStorage.getItem('id');

    if (usuarioId) {
      this.cargarHistorialDesdeDB(usuarioId);
    }

    // Cierra el dropdown al hacer clic fuera
    this.clickListener = () => {
      this.dropdownAbierto = false;
      this.menuAbierto = false; // ✅ También cierra el sidebar
      this.cdr.detectChanges(); // ✅ Forzar actualización al cerrar
    };
    document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    if (this.clickListener) document.removeEventListener('click', this.clickListener);
  }

  cargarHistorialDesdeDB(id: string) {
    this.cargandoHistorial = true;
    // Usamos environment.apiUrl para que funcione en local y producción automáticamente
    this.api.get<any[]>(`/servicios/usuario/${id}`)
      .then(data => {
        // El backend ya los entrega del más reciente al más antiguo
        this.historial = (data || []).slice(0, 4).map((item: any) => {
          const { icono, tipoClass, prefijo } = this.obtenerInfoTipo(item.tipo);
          const statusClass = this.obtenerClaseEstado(item.estado);
          // NOTA: la columna real en la tabla `servicios` es `destino`,
          // no `destino_direccion` (ver aprendizajes del proyecto).
          const lugar = item.destino || 'Destino no especificado';

          return {
            icono,
            // El color del círculo refleja el tipo de servicio (verde/naranja/morado);
            // si el servicio fue cancelado, se muestra en rojo independientemente del tipo.
            tipoClass: statusClass === 'cancelado' ? 'cancelado' : tipoClass,
            destino: prefijo ? `${prefijo} ${lugar}` : lugar,
            fecha: new Date(item.fecha_solicitud).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
            hora: new Date(item.fecha_solicitud).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            estado: this.formatearEstado(item.estado),
            statusClass,
            precio: item.tarifa || 0
          };
        });
        this.cargandoHistorial = false;
        this.cdr.detectChanges(); // ✅ AVISAR A ANGULAR QUE LOS DATOS LLEGARON
      })
      .catch(err => {
        console.error('Error al obtener datos reales:', err);
        this.cargandoHistorial = false;
        this.cdr.detectChanges();
      });
  }

  // Determina ícono, clase de color y prefijo de texto según el tipo de servicio
  private obtenerInfoTipo(tipo: string): { icono: string; tipoClass: string; prefijo: string } {
    const t = (tipo || '').toUpperCase();
    if (t === 'DOMICILIO') {
      return { icono: '🛍️', tipoClass: 'domicilio', prefijo: 'Domicilio -' };
    }
    if (t === 'ENCOMIENDA') {
      return { icono: '📦', tipoClass: 'encomienda', prefijo: 'Encomienda a' };
    }
    // TRANSPORTE u otro por defecto
    return { icono: '🛵', tipoClass: 'transporte', prefijo: 'Viaje a' };
  }

  private formatearEstado(estado: string): string {
    if (estado === 'FINALIZADO') return 'Completado';
    return estado.charAt(0) + estado.slice(1).toLowerCase();
  }

  private obtenerClaseEstado(estado: string): string {
    if (estado === 'FINALIZADO') return 'completado';
    if (estado === 'CANCELADO' || estado === 'RECHAZADO') return 'cancelado';
    return 'en-camino';
  }

  // Abre/cierra el menú hamburguesa del sidebar (mobile)
  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    this.cdr.detectChanges();
  }

  // Abre/cierra el dropdown del perfil en el navbar  ← agregado
  toggleMenuPerfil(): void {
    this.dropdownAbierto = !this.dropdownAbierto;
    this.cdr.detectChanges(); // ✅ Esto hará que el menú responda al instante
  }

  verPerfil(): void {
    console.log('Navegando al perfil del usuario:', localStorage.getItem('id'));
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    this.cdr.detectChanges(); // Asegura que el menú se cierre visualmente
    this.router.navigate(['/mi-perfil']).catch(err => console.error('Error al navegar:', err));
  }

  editarPerfil(): void {
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    this.router.navigate(['/mi-perfil']);
  }

  configuracion(): void {
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    this.router.navigate(['/mi-perfil']);
  }

  solicitarServicio(tipo: string): void {
    if (tipo === 'transporte')  this.router.navigate(['/solicitar-transporte']);
    else if (tipo === 'domicilio')  this.router.navigate(['/solicitar-domicilio']);
    else if (tipo === 'encomienda') this.router.navigate(['/solicitar-encomienda']);
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}