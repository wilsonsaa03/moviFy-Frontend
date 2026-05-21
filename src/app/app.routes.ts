import { Routes } from '@angular/router';

import { LandingComponent } from './pages/landing/landing';
import { LoginComponent } from './Controlador/login.component';

import { Registro } from './pages/registro/registro';
import { RegistroUsuario } from './pages/registro-usuario/registro-usuario';
import { RegistroConductor } from './pages/registro-conductor/registro-conductor';
import { RegistroAdmin } from './pages/registro-admin/registro-admin';

import { HomeUsuarioComponent } from './pages/home-usuario/home-usuario';
import { HomeConductorComponent } from './pages/home-conductor/home-conductor';
import { HomeAdminComponent } from './pages/home-admin/home-admin';

import { OlvidePasswordComponent } from './pages/olvide-password/olvide-password';
import { RestablecerPasswordComponent } from './pages/restablecer-password/restablecer-password';

import { PerfilUsuarioComponent } from './pages/perfil-usuario/perfil-usuario.component';

export const routes: Routes = [

  { path: '', component: LandingComponent },

  { path: 'login', component: LoginComponent },

  { path: 'olvide-password', component: OlvidePasswordComponent },

  { path: 'restablecer-password', component: RestablecerPasswordComponent },

  { path: 'registro', component: Registro },

  { path: 'registro/usuario', component: RegistroUsuario },

  { path: 'registro/conductor', component: RegistroConductor },

  { path: 'registro/admin', component: RegistroAdmin },

  { path: 'home-usuario', component: HomeUsuarioComponent },

  { path: 'conductor', component: HomeConductorComponent },

  { path: 'admin', component: HomeAdminComponent },

  { path: 'perfil-usuario', component: PerfilUsuarioComponent },

  { path: '**', redirectTo: '' }

];