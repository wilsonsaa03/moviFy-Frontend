import { Routes } from '@angular/router';

import { LandingComponent } from './pages/landing/landing';
import { LoginComponent } from './Controlador/login.component';
import { Registro } from './pages/registro/registro';
import { RegistroUsuario } from './pages/registro-usuario/registro-usuario';
import { RegistroConductor } from './pages/registro-conductor/registro-conductor';
import { RegistroAdmin } from './pages/registro-admin/registro-admin';

export const routes: Routes = [
  { path: '', component: LandingComponent },

  { path: 'login', component: LoginComponent },

  { path: 'registro', component: Registro },
  { path: 'registro/usuario', component: RegistroUsuario },
  { path: 'registro/conductor', component: RegistroConductor },
  { path: 'registro/admin', component: RegistroAdmin },

  { path: '**', redirectTo: '' }
];