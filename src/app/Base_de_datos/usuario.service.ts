import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Usuario {
  id?: number;
  nombre: string;
  correo: string;
  telefono: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private BASE_URL      = `${environment.apiUrl}/auth`;
  private CONDUCTOR_URL = `${environment.apiUrl}/conductor`;
  private USUARIO_URL   = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  // =========================
  // LOGIN Y REGISTRO
  // =========================

  login(datos: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/login`, datos);
  }

  registro(datos: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/registro`, datos);
  }

  loginGoogle(datos: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/login-google`, datos);
  }

  loginFacebook(datos: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/login-facebook`, datos);
  }

  // =========================
  // CONDUCTOR
  // =========================

  registroConductor(formData: FormData): Observable<any> {
    return this.http.post(`${this.CONDUCTOR_URL}/registro`, formData);
  }

  // =========================
  // RECUPERAR CONTRASEÑA
  // =========================

  olvideClave(correo: string): Observable<any> {
    return this.http.post(`${this.BASE_URL}/olvide-password`, { correo });
  }

  restablecerClave(token: string, password: string): Observable<any> {
    return this.http.post(`${this.BASE_URL}/restablecer-password`, {
      token,
      password
    });
  }

  // =========================
  // PERFIL DE USUARIO
  // =========================

  obtenerPerfil(): Observable<Usuario> {

    const token = localStorage.getItem('token');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<Usuario>(
      `${this.USUARIO_URL}/perfil`,
      { headers }
    );
  }

  actualizarPerfil(usuario: Usuario): Observable<Usuario> {

    const token = localStorage.getItem('token');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.put<Usuario>(
      `${this.USUARIO_URL}/perfil`,
      usuario,
      { headers }
    );
  }

  // =========================
  // TOKEN
  // =========================

  guardarToken(token: string): void {
    localStorage.setItem('token', token);
  }

  obtenerToken(): string | null {
    return localStorage.getItem('token');
  }

  eliminarToken(): void {
    localStorage.removeItem('token');
  }

  estaAutenticado(): boolean {
    return !!localStorage.getItem('token');
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  }

  // =========================
  // USUARIO LOCAL
  // =========================

  guardarUsuario(usuario: any): void {
    localStorage.setItem('usuario', JSON.stringify(usuario));
  }

  obtenerUsuario(): any {
    const usuario = localStorage.getItem('usuario');
    return usuario ? JSON.parse(usuario) : null;
  }
}