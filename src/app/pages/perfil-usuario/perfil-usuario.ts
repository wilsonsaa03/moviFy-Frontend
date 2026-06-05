import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-perfil-usuario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './perfil-usuario.html',
  styleUrls: ['./perfil-usuario.css']
})
export class PerfilUsuarioComponent implements OnInit, OnDestroy {

  // ── Datos de sesión ──────────────────────────────────────────────────
  nombre   = '';
  foto     = '';

  // ── Control de menús ─────────────────────────────────────────────────
  menuAbierto    = false;   // sidebar mobile
  dropdownAbierto = false;  // dropdown del navbar

  // ── Datos del perfil ─────────────────────────────────────────────────
  email           = '';
  telefono        = '';
  fechaNacimiento = '';
  direccion       = '';
  idioma          = 'Español';

  calificacion      = 0;
  totalCalificaciones = 0;
  puntos            = 0;

  viajesCompletados = 0;
  pedidosRealizados = 0;
  lugaresFavoritos  = 0;
  metodosPago       = 0;

  cargando = true;

  private clickListener: any;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.nombre   = localStorage.getItem('nombre')   || 'Usuario';
    this.foto     = localStorage.getItem('foto')     || '';
    this.email    = localStorage.getItem('correo')   || '';
    this.telefono = localStorage.getItem('telefono') || '';

    const userId = localStorage.getItem('id');
    const correo = localStorage.getItem('correo');

    if (userId && userId !== '' && userId !== 'undefined') {
      this.cargarPerfilDesdeDB(userId);
    } else if (correo) {
      // Buscar por correo como alternativa
      this.cargarPerfilPorCorreo(correo);
    } else {
      this.cargando = false;
    }

    // Cierra el dropdown al hacer clic fuera
    this.clickListener = () => {
      this.dropdownAbierto = false;
      this.menuAbierto = false; // ✅ Cerrar sidebar también
      this.cdr.detectChanges();
    };
    document.addEventListener('click', this.clickListener);
  }

  ngOnDestroy(): void {
    if (this.clickListener) document.removeEventListener('click', this.clickListener);
  }

  cargarPerfilPorCorreo(correo: string) {
    this.cargando = true;
    fetch(`${environment.apiUrl}/usuario/perfil/correo/${encodeURIComponent(correo)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const u = data.usuario || data;
        // Guardar el id ahora que lo tenemos
        if (u.id) localStorage.setItem('id', u.id.toString());
        this.poblarPerfil(u);
      })
      .catch(() => {
        this.cargando = false;
        this.cdr.detectChanges();
      });
  }

  cargarPerfilDesdeDB(id: string) {
    this.cargando = true;
    fetch(`${environment.apiUrl}/usuario/perfil/${id}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => this.poblarPerfil(data.usuario || data))
      .catch(() => {
        this.cargando = false;
        this.cdr.detectChanges();
      });
  }

  private poblarPerfil(u: any) {
    this.nombre          = u.nombre          || localStorage.getItem('nombre') || 'Usuario';
    this.email           = u.correo          || localStorage.getItem('correo') || '';
    this.telefono        = u.telefono        || '';
    this.foto            = u.foto            || '';
    this.fechaNacimiento = u.fecha_nacimiento || 'No registrada';
    this.direccion       = u.direccion        || 'No registrada';
    this.idioma          = u.idioma           || 'Español';
    this.calificacion         = Number(u.calificacion)    || 0;
    this.totalCalificaciones  = u.total_calificaciones    || 0;
    this.puntos               = u.puntos                  || 0;
    this.viajesCompletados    = u.viajes_completados       || 0;
    this.pedidosRealizados    = u.pedidos_realizados       || 0;
    this.lugaresFavoritos     = u.lugares_favoritos        || 0;
    this.metodosPago          = u.metodos_pago             || 0;
    this.cargando = false;
    this.cdr.detectChanges();
  }

  // ── Control de Interfaz ──────────────────────────────────────────────
  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    this.cdr.detectChanges(); // Asegura que el sidebar responda al clic en móviles
  }

  toggleMenuPerfil(): void {
    this.dropdownAbierto = !this.dropdownAbierto;
  }

  verPerfil(): void {
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  configuracion(): void {
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    // Redirigimos a perfil o a una ruta de ajustes si la tienes creada
    this.router.navigate(['/mi-perfil']);
  }

  // ── Editar un campo específico ────────────────────────────────────────
  editarPerfil(): void {
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    this.router.navigate(['/editar-perfil']);
  }

  editarCampo(campo: string): void {
    // Puedes navegar a una pantalla de edición pasando el campo como queryParam
    this.router.navigate(['/editar-perfil'], { queryParams: { campo } });
  }

  // ── Cerrar sesión ─────────────────────────────────────────────────────
  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}