import { Injectable } from '@angular/core';

export type Rol = 'admin' | 'soporte' | 'conductor' | 'cliente';

/** Sesión guardada en localStorage. El backend es quien decide; esto solo guía la navegación. */
@Injectable({ providedIn: 'root' })
export class SesionService {

  private ls(): Storage | null {
    try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
  }

  get token(): string { return this.ls()?.getItem('token') || ''; }
  get id(): string { return this.ls()?.getItem('id') || ''; }
  get correo(): string { return this.ls()?.getItem('correo') || ''; }
  get nombre(): string { return this.ls()?.getItem('nombre') || ''; }
  get telefono(): string { return this.ls()?.getItem('telefono') || ''; }

  get rol(): Rol | '' {
    const r = (this.ls()?.getItem('rol') || '').toLowerCase().trim();
    if (!r) return '';
    return (r === 'usuario' ? 'cliente' : r) as Rol;
  }

  /** Hay token y no venció (se lee el exp del JWT sin validarlo: eso lo hace el backend). */
  get activa(): boolean {
    const t = this.token;
    if (!t || t.split('.').length !== 3) return false;
    try {
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  guardar(res: any, correoRespaldo = ''): void {
    const ls = this.ls();
    if (!ls) return;
    ls.setItem('token', res.token || '');
    ls.setItem('id', res.id != null ? String(res.id) : '');
    ls.setItem('rol', res.rol || '');
    ls.setItem('nombre', res.nombre || '');
    ls.setItem('foto', res.foto || '');
    ls.setItem('correo', res.correo || correoRespaldo);
    ls.setItem('telefono', res.telefono || '');
  }

  cerrar(): void {
    this.ls()?.clear();
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
