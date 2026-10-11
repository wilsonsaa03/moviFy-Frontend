/**
 * Carga leaflet-routing-machine desde unpkg con versión FIJA y Subresource Integrity.
 * Si el CDN sirviera otro archivo, el navegador lo bloquea en vez de ejecutarlo.
 */
const VERSION = '3.2.12';
const BASE = `https://unpkg.com/leaflet-routing-machine@${VERSION}/dist`;
const SRI_JS = 'sha384-Le/Ab4WG5Ezkdf4RS5P5eZrpmvNgcZ4QcTozVDXGoOsTxGroBLM4e9OSqeh6V26n';
const SRI_CSS = 'sha384-n6BdBD4Ahcb9IGZDgjgv0hV2a/y2WOCf1n0kEMZDpZySy/Hv1QMAtLIrC3y9oIZD';

let cargando: Promise<void> | null = null;

export function cargarRoutingMachine(): Promise<void> {
  if ((window as any).L?.Routing) return Promise.resolve();
  if (cargando) return cargando;

  cargando = new Promise<void>(resolve => {
    if (!document.querySelector('link[data-lrm]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${BASE}/leaflet-routing-machine.css`;
      link.integrity = SRI_CSS;
      link.crossOrigin = 'anonymous';
      link.setAttribute('data-lrm', '');
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = `${BASE}/leaflet-routing-machine.js`;
    script.integrity = SRI_JS;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => { cargando = null; resolve(); };
    document.head.appendChild(script);
  });
  return cargando;
}
