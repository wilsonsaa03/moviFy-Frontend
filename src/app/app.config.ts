import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Desde Angular 21 lo predeterminado es "sin zone.js". La web se escribió con zone.js (las pantallas se
    // actualizan solas tras un setInterval, un fetch o un evento de Leaflet), así que se mantiene a propósito.
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
  ],
};
