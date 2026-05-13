import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private BASE_URL = `${environment.apiUrl}/auth`;
  private CONDUCTOR_URL = `${environment.apiUrl}/conductor`;

  constructor(private http: HttpClient) {}

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

  registroConductor(formData: FormData): Observable<any> {
    return this.http.post(`${this.CONDUCTOR_URL}/registro`, formData);
  }
}