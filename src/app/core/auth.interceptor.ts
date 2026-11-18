import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SesionService } from './sesion.service';

/** Una sola renovación a la vez: si 5 peticiones reciben 401 juntas, todas esperan el mismo refresh. */
let renovando: Promise<boolean> | null = null;

/**
 * Agrega "Authorization: Bearer <jwt>". Si el backend responde 401 (el token venció o lo revocaron), pide uno
 * nuevo con el refresh token UNA vez y repite la petición: la persona sigue trabajando sin perder lo que
 * escribía. Solo si eso falla la manda al login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  const backend = inject(HttpBackend);
  const esApi = req.url.startsWith(environment.apiUrl);

  const conToken = (r: HttpRequest<unknown>, token: string) =>
    esApi && token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;

  return next(conToken(req, sesion.token)).pipe(
    catchError((err: HttpErrorResponse) => {
      const esAuth = req.url.includes('/auth/');
      if (!esApi || err.status !== 401 || esAuth) return throwError(() => err);
      return from(renovar(sesion, backend)).pipe(
        switchMap((ok) => {
          if (ok) return next(conToken(req, sesion.token));
          sesion.cerrar();
          router.navigate(['/login'], { queryParams: { expirada: 1 } });
          return throwError(() => err);
        })
      );
    })
  );
};

/** POST /auth/refresh sin pasar por este interceptor (HttpBackend): el refresh se usa una sola vez y rota. */
function renovar(sesion: SesionService, backend: HttpBackend): Promise<boolean> {
  const refresh = sesion.refreshToken;
  if (!refresh) return Promise.resolve(false);
  if (!renovando) {
    renovando = firstValueFrom(new HttpClient(backend).post<any>(`${environment.apiUrl}/auth/refresh`, { refreshToken: refresh }))
      .then((res) => {
        sesion.guardar(res, sesion.correo);
        return true;
      })
      .catch(() => false)
      .finally(() => setTimeout(() => (renovando = null)));
  }
  return renovando;
}
