import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class ConductorService {

  private api =
    'http://localhost:8080/api/conductor';

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