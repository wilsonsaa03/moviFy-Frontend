import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SesionService } from './sesion.service';

/** Agrega "Authorization: Bearer <jwt>" y saca al usuario al login si el token venció (401). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  const esApi = req.url.startsWith(environment.apiUrl);
  const token = sesion.token;

  const peticion = esApi && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(peticion).pipe(
    catchError((err: HttpErrorResponse) => {
      const esLogin = req.url.includes('/auth/');
      if (esApi && err.status === 401 && !esLogin) {
        sesion.cerrar();
        router.navigate(['/login'], { queryParams: { expirada: 1 } });
      }
      return throwError(() => err);
    })
  );
};
