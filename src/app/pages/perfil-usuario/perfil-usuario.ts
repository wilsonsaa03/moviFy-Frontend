import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/api.service';

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
    private cdr: ChangeDetectorRef,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.nombre   = localStorage.getItem('nombre')   || 'Usuario';
    this.foto     = localStorage.getItem('foto')     || '';
    this.email    = localStorage.getItem('correo')   || '';
    this.telefono = localStorage.getItem('telefono') || '';

    this.cargarPerfil();

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

  /** GET /api/usuarios/perfil: el backend identifica al usuario por el token. */
  cargarPerfil() {
    this.cargando = true;
    this.api.get('/usuarios/perfil')
      .then(u => this.poblarPerfil(u))
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
    this.viajesCompletados    = Number(u.viajes_finalizados ?? u.viajes_completados) || 0;
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

  // ── Editar nombre o teléfono (PUT /api/usuarios/perfil) ───────────────
  editarPerfil(): void {
    this.dropdownAbierto = false;
    this.menuAbierto = false;
    this.editarCampo('nombre');
  }

  editarCampo(campo: string): void {
    const editables: Record<string, { etiqueta: string; actual: string }> = {
      nombre:   { etiqueta: 'tu nombre', actual: this.nombre },
      telefono: { etiqueta: 'tu teléfono', actual: this.telefono }
    };
    const cfg = editables[campo];
    if (!cfg) {
      alert('Este dato todavía no se puede cambiar desde la app.');
      return;
    }
    const valor = prompt(`Escribe ${cfg.etiqueta}:`, cfg.actual || '');
    if (valor === null || valor.trim() === '' || valor.trim() === cfg.actual) return;

    this.api.put('/usuarios/perfil', { [campo]: valor.trim() })
      .then((u: any) => {
        this.nombre = u.nombre || this.nombre;
        this.telefono = u.telefono || '';
        localStorage.setItem('nombre', this.nombre);
        localStorage.setItem('telefono', this.telefono);
        this.cdr.detectChanges();
      })
      .catch(err => alert(ApiService.mensaje(err, 'No se pudo guardar el cambio.')));
  }

  // ── Cerrar sesión ─────────────────────────────────────────────────────
  cerrarSesion(): void {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}