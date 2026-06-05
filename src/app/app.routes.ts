import { Routes } from '@angular/router';

export const routes: Routes = [
  // Inicio y Auth
  { path: '', loadComponent: () => import('./pages/landing/landing').then(m => m.LandingComponent) },
  { path: 'login', loadComponent: () => import('./Controlador/login.component').then(m => m.LoginComponent) },
  { path: 'olvide-password', loadComponent: () => import('./pages/olvide-password/olvide-password').then(m => m.OlvidePasswordComponent) },
  { path: 'restablecer-password', loadComponent: () => import('./pages/restablecer-password/restablecer-password').then(m => m.RestablecerPasswordComponent) },
  { path: 'mi-perfil', loadComponent: () => import('./pages/perfil-usuario/perfil-usuario').then(m => m.PerfilUsuarioComponent) },

  // Registros
  { path: 'registro', loadComponent: () => import('./pages/registro/registro').then(m => m.Registro) },
  { path: 'registro/usuario', loadComponent: () => import('./pages/registro-usuario/registro-usuario').then(m => m.RegistroUsuario) },
  { path: 'registro/conductor', loadComponent: () => import('./pages/registro-conductor/registro-conductor').then(m => m.RegistroConductor) },
  { path: 'registro/admin', loadComponent: () => import('./pages/registro-admin/registro-admin').then(m => m.RegistroAdminComponent) },

  // Dashboards (Home)
  { path: 'home-usuario', loadComponent: () => import('./pages/home-usuario/home-usuario').then(m => m.HomeUsuarioComponent) },
  { path: 'mis-viajes', loadComponent: () => import('./pages/viajes-usuario/viajes-usuario').then(m => m.ViajesUsuarioComponent) },
  //  Otras rutas comentadas temporalmente hasta que crees los archivos para evitar errores de compilación
  // { path: 'mis-pedidos', loadComponent: () => import('./pages/mis-pedidos/mis-pedidos').then(m => m.MisPedidosComponent) },
  // { path: 'favoritos', loadComponent: () => import('./pages/favoritos/favoritos').then(m => m.FavoritosComponent) },
  // { path: 'metodos-pago', loadComponent: () => import('./pages/metodos-pago/metodos-pago').then(m => m.MetodosPagoComponent) },
  // { path: 'promociones', loadComponent: () => import('./pages/promociones/promociones').then(m => m.PromocionesComponent) },
  // { path: 'soporte', loadComponent: () => import('./pages/soporte/soporte').then(m => m.SoporteComponent) },
  // { path: 'notificaciones', loadComponent: () => import('./pages/notificaciones/notificaciones').then(m => m.NotificacionesComponent) },
  // { path: 'configuracion', loadComponent: () => import('./pages/configuracion/configuracion').then(m => m.ConfiguracionComponent) },
  { path: 'conductor', loadComponent: () => import('./pages/home-conductor/home-conductor').then(m => m.HomeConductorComponent) },
  { path: 'admin', loadComponent: () => import('./pages/home-admin/home-admin').then(m => m.HomeAdminComponent) },
  
  // Perfil y Acciones de Usuario
  { path: 'perfil-conductor', loadComponent: () => import('./pages/ver-mi-perfil-conductor/ver-mi-perfil-conductor').then(m => m.VerMiPerfilConductorComponent) },
  { path: 'solicitar-transporte', loadComponent: () => import('./pages/solicitar-transporte/solicitar-transporte').then(m => m.SolicitarTransporte) },
  { path: 'solicitar-domicilio', loadComponent: () => import('./pages/solicitar-domicilio/solicitar-domicilio').then(m => m.SolicitarDomicilio) },
  { path: 'solicitar-encomienda', loadComponent: () => import('./pages/solicitar-encomienda/solicitar-encomienda').then(m => m.SolicitarEncomienda) },
  { path: 'mis-viajes-conductor', loadComponent: () => import('./pages/mis-viajes-conductor/mis-viajes-conductor').then(m => m.MisViajesConductorComponent) },
  { path: 'ganancias-conductor', loadComponent: () => import('./pages/ganancias-conductor/ganancias-conductor').then(m => m.GananciasConductorComponent) },
  

  // Manejo de rutas no encontradas (SIEMPRE AL FINAL)
  { path: '**', redirectTo: '' }
  
];