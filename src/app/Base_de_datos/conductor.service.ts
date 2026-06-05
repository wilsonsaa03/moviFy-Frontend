import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class ConductorService {

  private api = `${environment.apiUrl}/conductor`;

  constructor(
    private http: HttpClient
  ) {}

  obtenerPerfil(
    correo: string
  ): Observable<any> {

    return this.http.get(
      `${this.api}/perfil/${correo}`
    );

  }

}