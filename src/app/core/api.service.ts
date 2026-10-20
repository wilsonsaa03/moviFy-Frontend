import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Único punto de acceso al backend. Usa HttpClient para que el interceptor
 * agregue el JWT a TODAS las peticiones (antes cada página usaba fetch() suelto).
 * Devuelve Promises para mantener el estilo async/await de las páginas.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get<T = any>(ruta: string, params?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.url(ruta), { params: this.params(params) }));
  }

  post<T = any>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(ruta), cuerpo));
  }

  put<T = any>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.put<T>(this.url(ruta), cuerpo));
  }

  patch<T = any>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.patch<T>(this.url(ruta), cuerpo));
  }

  delete<T = any>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(this.url(ruta)));
  }

  /** Para archivos protegidos (documentos del conductor, CSV de ganancias). */
  blob(ruta: string): Promise<Blob> {
    return firstValueFrom(this.http.get(this.url(ruta), { responseType: 'blob' }));
  }

  /** Mensaje legible de un error del backend ({ error: "..." }). */
  static mensaje(err: any, porDefecto = 'Ocurrió un error. Intenta de nuevo.'): string {
    return err?.error?.error || err?.error?.message || porDefecto;
  }

  private url(ruta: string): string {
    return `${this.base}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
  }

  private params(p?: Record<string, string | number | boolean | null | undefined>): HttpParams {
    let hp = new HttpParams();
    if (!p) return hp;
    for (const [k, v] of Object.entries(p)) {
      if (v !== null && v !== undefined && v !== '') hp = hp.set(k, String(v));
    }
    return hp;
  }
}
