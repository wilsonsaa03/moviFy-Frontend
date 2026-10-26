/**
 * Carga un script externo solo cuando una pantalla lo necesita (no en todas las páginas desde index.html).
 * Así la página de inicio no descarga Chart.js ni el login de Google, que bloqueaban el primer pintado y
 * dejaban cookies de terceros. Cada script se pide una sola vez; si falla, se puede volver a intentar.
 */
const pendientes = new Map<string, Promise<void>>();

export function cargarScript(src: string, integridad?: string): Promise<void> {
  const enCurso = pendientes.get(src);
  if (enCurso) return enCurso;

  const promesa = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    if (integridad) {
      script.integrity = integridad;
      script.crossOrigin = 'anonymous';
    }
    script.onload = () => resolve();
    script.onerror = () => {
      pendientes.delete(src);
      script.remove();
      reject(new Error('No se pudo cargar ' + src));
    };
    document.head.appendChild(script);
  });
  pendientes.set(src, promesa);
  return promesa;
}

/** Chart.js con versión FIJA y Subresource Integrity (la misma que estaba en index.html). */
export function cargarChartJs(): Promise<void> {
  if ((window as any).Chart) return Promise.resolve();
  return cargarScript(
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js',
    'sha384-FcQlsUOd0TJjROrBxhJdUhXTUgNJQxTMcxZe6nHbaEfFL1zjQ+bq/uRoBQxb0KMo',
  );
}

/** Botón "Iniciar sesión con Google" (Google Identity Services). Google no publica un hash fijo de este archivo. */
export function cargarGoogleLogin(): Promise<void> {
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  return cargarScript('https://accounts.google.com/gsi/client');
}
