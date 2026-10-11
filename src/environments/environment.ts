// Desarrollo local (ng serve). En producción Angular lo reemplaza por environment.prod.ts.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  // Solo para pruebas locales: permite enviar posiciones inventadas desde "Simular ubicación"
  demoSimulacion: true
};
