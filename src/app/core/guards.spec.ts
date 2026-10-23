import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { invitadoGuard, rolGuard } from './guards';

/** JWT sin firma real (el guard solo lee el exp; la firma la valida el backend). */
function jwtFalso(segundos = 3600): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256' })}.${b64({ sub: '1', exp: Math.floor(Date.now() / 1000) + segundos })}.firma`;
}

function iniciarSesion(rol: string, token = jwtFalso()): void {
  localStorage.setItem('token', token);
  localStorage.setItem('rol', rol);
}

/** HU 2.3: cada rol solo entra a sus rutas; si no, el guard lo devuelve a su propio home. */
describe('Guards de la web', () => {
  let router: Router;

  const correr = (guard: typeof rolGuard, roles: string[] = []) =>
    TestBed.runInInjectionContext(() =>
      guard({ data: { roles } } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  const url = (r: unknown) => router.serializeUrl(r as UrlTree);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  it('rolGuard: sin sesión manda al login', () => {
    expect(url(correr(rolGuard, ['cliente']))).toBe('/login');
  });

  it('rolGuard: con el token vencido borra la sesión y manda al login', () => {
    iniciarSesion('cliente', jwtFalso(-10));
    expect(url(correr(rolGuard, ['cliente']))).toBe('/login');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('rolGuard: deja pasar al rol correcto', () => {
    iniciarSesion('cliente');
    expect(correr(rolGuard, ['cliente'])).toBe(true);
  });

  it('rolGuard: un cliente que entra a una ruta del conductor vuelve a su home', () => {
    iniciarSesion('cliente');
    expect(url(correr(rolGuard, ['conductor']))).toBe('/home-usuario');
  });

  it('rolGuard: un cliente que entra al panel admin vuelve a su home', () => {
    iniciarSesion('cliente');
    expect(url(correr(rolGuard, ['admin', 'soporte']))).toBe('/home-usuario');
  });

  it('rolGuard: un conductor que entra al panel admin vuelve a su home', () => {
    iniciarSesion('conductor');
    expect(url(correr(rolGuard, ['admin', 'soporte']))).toBe('/conductor');
  });

  it('invitadoGuard: con sesión salta el login y va a su inicio', () => {
    iniciarSesion('admin');
    expect(url(correr(invitadoGuard))).toBe('/admin');
  });
});
