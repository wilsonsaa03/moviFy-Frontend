import { Routes } from '@angular/router';

// IMPORTACIONES DE PÁGINAS
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

// IMPORTACIÓN DE SOLICITAR TRANSPORTE
// Nota: Asegúrate que el nombre del archivo en la carpeta sea 'solicitar-transporte.ts'
import { SolicitarTransporte } from './pages/solicitar-transporte/solicitar-transporte';

export const routes: Routes = [
  // Inicio y Auth
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'olvide-password', component: OlvidePasswordComponent },
  { path: 'restablecer-password', component: RestablecerPasswordComponent },

  // Registros
  { path: 'registro', component: Registro },
  { path: 'registro/usuario', component: RegistroUsuario },
  { path: 'registro/conductor', component: RegistroConductor },
  { path: 'registro/admin', component: RegistroAdmin },

  // Dashboards (Home)
  { path: 'home-usuario', component: HomeUsuarioComponent },
  { path: 'conductor', component: HomeConductorComponent },
  { path: 'admin', component: HomeAdminComponent },

  // Perfil y Acciones de Usuario
  { path: 'perfil-usuario', component: PerfilUsuarioComponent },
  { path: 'solicitar-transporte', component: SolicitarTransporte },

  // Manejo de rutas no encontradas (SIEMPRE AL FINAL)
  { path: '**', redirectTo: '' }
];