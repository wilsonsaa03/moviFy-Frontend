import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type Rol = 'admin' | 'soporte' | 'conductor' | 'cliente';

function almacen(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}

/**
 * Cierra la sesión de verdad: además de borrar el navegador, avisa al backend para que el refresh token
 * deje de servir (si alguien lo copió, ya no puede abrir sesión con él). No espera la respuesta.
 */
export function cerrarSesionWeb(): void {
  const ls = almacen();
  const refresh = ls?.getItem('refreshToken');
  if (refresh) {
    try {
      fetch(`${environment.apiUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
        keepalive: true
      }).catch(() => undefined);
    } catch {
      // sin red: igual se borra la sesión local
    }
  }
  ls?.clear();
}

/** Sesión guardada en localStorage. El backend es quien decide; esto solo guía la navegación. */
@Injectable({ providedIn: 'root' })
export class SesionService {

  private ls(): Storage | null {
    return almacen();
  }

  get token(): string { return this.ls()?.getItem('token') || ''; }
  /** Con él se pide un token nuevo cuando el de acceso vence (auth.interceptor), sin volver a escribir la clave. */
  get refreshToken(): string { return this.ls()?.getItem('refreshToken') || ''; }
  get id(): string { return this.ls()?.getItem('id') || ''; }
  get correo(): string { return this.ls()?.getItem('correo') || ''; }
  get nombre(): string { return this.ls()?.getItem('nombre') || ''; }
  get telefono(): string { return this.ls()?.getItem('telefono') || ''; }

  get rol(): Rol | '' {
    const r = (this.ls()?.getItem('rol') || '').toLowerCase().trim();
    if (!r) return '';
    return (r === 'usuario' ? 'cliente' : r) as Rol;
  }

  /**
   * Hay token y no venció (se lee el exp del JWT sin validarlo: eso lo hace el backend). Si venció pero hay
   * refresh token, la sesión sigue: la primera petición la renueva sola.
   */
  get activa(): boolean {
    const t = this.token;
    if (!t || t.split('.').length !== 3) return false;
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now() || !!this.refreshToken;
    } catch {
      return false;
    }
  }

  guardar(res: any, correoRespaldo = ''): void {
    const ls = this.ls();
    if (!ls) return;
    ls.setItem('token', res.token || '');
    ls.setItem('refreshToken', res.refreshToken || '');
    ls.setItem('id', res.id != null ? String(res.id) : '');
    ls.setItem('rol', res.rol || '');
    ls.setItem('nombre', res.nombre || '');
    ls.setItem('foto', res.foto || '');
    ls.setItem('correo', res.correo || correoRespaldo);
    ls.setItem('telefono', res.telefono || '');
  }

  cerrar(): void {
    cerrarSesionWeb();
  }

  rutaInicio(): string {
    switch (this.rol) {
      case 'admin':
      case 'soporte': return '/admin';
      case 'conductor': return '/conductor';
      case 'cliente': return '/home-usuario';
      default: return '/login';
    }
  }
}
