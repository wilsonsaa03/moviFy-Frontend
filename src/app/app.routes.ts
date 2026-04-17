import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing';
import { LoginComponent } from './Controlador/login.component';

export const routes: Routes = [
  { path: 'landing', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'landing', pathMatch: 'full' }, // Si entran a la raíz, ven la landing
  { path: '**', redirectTo: 'landing' } // Por seguridad, cualquier error vuelve a la landing
];