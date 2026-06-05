import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

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
    fetch(`${environment.apiUrl}/servicios/usuario/${id}`)
      .then(res => res.json())
      .then(data => {
        // Tomamos los últimos 4 servicios para el historial rápido del Home
        this.historial = data.reverse().slice(0, 4).map((item: any) => ({
          icono: item.tipo === 'ENCOMIENDA' ? '📦' : '🛵',
          destino: item.destino_direccion || 'Destino no especificado',
          fecha: new Date(item.fecha_solicitud).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
          hora: new Date(item.fecha_solicitud).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          estado: this.formatearEstado(item.estado),
          statusClass: this.obtenerClaseEstado(item.estado),
          precio: item.tarifa || 0
        }));
        this.cargandoHistorial = false;
        this.cdr.detectChanges(); // ✅ AVISAR A ANGULAR QUE LOS DATOS LLEGARON
      })
      .catch(err => {
        console.error('Error al obtener datos reales:', err);
        this.cargandoHistorial = false;
        this.cdr.detectChanges();
      });
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