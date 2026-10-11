import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol, SesionService } from './sesion.service';

/**
 * Uso: { path: 'admin', canActivate: [rolGuard], data: { roles: ['admin', 'soporte'] } }
 * Sin sesión → /login. Con otro rol → a su propio inicio.
 * (Es solo navegación: la seguridad real la aplica el backend con el JWT.)
 */
export const rolGuard: CanActivateFn = (route) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  if (!sesion.activa) {
    sesion.cerrar();
    return router.createUrlTree(['/login']);
  }
  const roles = (route.data?.['roles'] as Rol[] | undefined) ?? [];
  return roles.length === 0 || roles.includes(sesion.rol as Rol)
    ? true
    : router.createUrlTree([sesion.rutaInicio()]);
};

/** Login y registro: si ya hay sesión válida, va directo a su inicio. */
export const invitadoGuard: CanActivateFn = () => {
  const sesion = inject(SesionService);
  return sesion.activa ? inject(Router).createUrlTree([sesion.rutaInicio()]) : true;
};
