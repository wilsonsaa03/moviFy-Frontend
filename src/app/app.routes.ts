import { Routes } from '@angular/router';
import { invitadoGuard, rolGuard } from './core/guards';

export const routes: Routes = [
  // Inicio y Auth
  { path: '', loadComponent: () => import('./pages/landing/landing').then(m => m.LandingComponent) },
  // Público: la familia sigue el viaje en vivo desde el enlace que comparte el pasajero (sin cuenta)
  { path: 'seguir/:token', loadComponent: () => import('./pages/seguir-viaje/seguir-viaje').then(m => m.SeguirViajeComponent) },
  { path: 'login', loadComponent: () => import('./Controlador/login.component').then(m => m.LoginComponent), canActivate: [invitadoGuard] },
  { path: 'olvide-password', loadComponent: () => import('./pages/olvide-password/olvide-password').then(m => m.OlvidePasswordComponent), canActivate: [invitadoGuard] },
  { path: 'restablecer-password', loadComponent: () => import('./pages/restablecer-password/restablecer-password').then(m => m.RestablecerPasswordComponent), canActivate: [invitadoGuard] },
  { path: 'mi-perfil', loadComponent: () => import('./pages/perfil-usuario/perfil-usuario').then(m => m.PerfilUsuarioComponent), canActivate: [rolGuard], data: { roles: ['cliente'] } },

  // Registros
  { path: 'registro', loadComponent: () => import('./pages/registro/registro').then(m => m.Registro), canActivate: [invitadoGuard] },
  { path: 'registro/usuario', loadComponent: () => import('./pages/registro-usuario/registro-usuario').then(m => m.RegistroUsuario), canActivate: [invitadoGuard] },
  { path: 'registro/conductor', loadComponent: () => import('./pages/registro-conductor/registro-conductor').then(m => m.RegistroConductor), canActivate: [invitadoGuard] },
  { path: 'registro/admin', loadComponent: () => import('./pages/registro-admin/registro-admin').then(m => m.RegistroAdminComponent), canActivate: [invitadoGuard] },

  // Dashboards (Home)
  { path: 'home-usuario', loadComponent: () => import('./pages/home-usuario/home-usuario').then(m => m.HomeUsuarioComponent), canActivate: [rolGuard], data: { roles: ['cliente'] } },
  { path: 'mis-viajes', loadComponent: () => import('./pages/viajes-usuario/viajes-usuario').then(m => m.ViajesUsuarioComponent), canActivate: [rolGuard], data: { roles: ['cliente'] } },
  { path: 'conductor', loadComponent: () => import('./pages/home-conductor/home-conductor').then(m => m.HomeConductorComponent), canActivate: [rolGuard], data: { roles: ['conductor'] } },
  { path: 'admin', loadComponent: () => import('./pages/home-admin/home-admin').then(m => m.HomeAdminComponent), canActivate: [rolGuard], data: { roles: ['admin', 'soporte'] } },
  
  // Perfil y Acciones de Usuario
  { path: 'perfil-conductor', loadComponent: () => import('./pages/ver-mi-perfil-conductor/ver-mi-perfil-conductor').then(m => m.VerMiPerfilConductorComponent), canActivate: [rolGuard], data: { roles: ['conductor'] } },
  { path: 'solicitar-transporte', loadComponent: () => import('./pages/solicitar-transporte/solicitar-transporte').then(m => m.SolicitarTransporte), canActivate: [rolGuard], data: { roles: ['cliente'] } },
  { path: 'solicitar-domicilio', loadComponent: () => import('./pages/solicitar-domicilio/solicitar-domicilio').then(m => m.SolicitarDomicilio), canActivate: [rolGuard], data: { roles: ['cliente'] } },
  { path: 'solicitar-encomienda', loadComponent: () => import('./pages/solicitar-encomienda/solicitar-encomienda').then(m => m.SolicitarEncomienda), canActivate: [rolGuard], data: { roles: ['cliente'] } },
  { path: 'mis-viajes-conductor', loadComponent: () => import('./pages/mis-viajes-conductor/mis-viajes-conductor').then(m => m.MisViajesConductorComponent), canActivate: [rolGuard], data: { roles: ['conductor'] } },
  { path: 'ganancias-conductor', loadComponent: () => import('./pages/ganancias-conductor/ganancias-conductor').then(m => m.GananciasConductorComponent), canActivate: [rolGuard], data: { roles: ['conductor'] } },
  

  // Secciones del menú que aún no existen: pantalla "Próximamente" en vez de caer al landing
  { path: 'mis-pedidos', redirectTo: 'mis-viajes' },
  { path: 'mis-encomiendas', redirectTo: 'mis-viajes' },
  ...[
    ['favoritos', 'Lugares favoritos'], ['metodos-pago', 'Métodos de pago'], ['promociones', 'Promociones'],
    ['soporte', 'Soporte'], ['notificaciones', 'Notificaciones'], ['configuracion', 'Configuración'],
    ['seguridad', 'Seguridad'], ['invitar', 'Invitar amigos'], ['privacidad', 'Privacidad']
  ].map(([path, titulo]) => ({
    path,
    loadComponent: () => import('./pages/proximamente/proximamente').then(m => m.ProximamenteComponent),
    data: { titulo }
  })),

  // Manejo de rutas no encontradas (SIEMPRE AL FINAL)
  { path: '**', redirectTo: '' }
  
];