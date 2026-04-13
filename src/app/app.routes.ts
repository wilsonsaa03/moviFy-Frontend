import { Routes } from '@angular/router';
import { Landing } from './pages/landing/landing';
import { Registro } from './pages/registro/registro';
import { RegistroUsuario } from './pages/registro-usuario/registro-usuario';
import { RegistroConductor } from './pages/registro-conductor/registro-conductor';

export const routes: Routes = [
  {
    path: '',
    component: Landing
  },
  {
    path: 'registro',
    component: Registro
  },
  {
    path: 'registro/usuario',
    component: RegistroUsuario
  },
  {
    path: 'registro/conductor',
    component: RegistroConductor
  }
];