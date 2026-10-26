import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Íconos de línea del panel (24×24, trazo de 2 px, toman el color del texto). Los mismos trazos que la
 * barra lateral de home-admin, para las secciones que viven en su propio componente.
 *   <adm-ico n="sos" />
 */
@Component({
  selector: 'adm-ico',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (n) {
        @case ('vivo') { <circle cx="12" cy="12" r="2.5"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5"/> }
        @case ('seguridad') { <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z"/><path d="M12 8v5M12 16h.01"/> }
        @case ('soporte') { <path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/> }
        @case ('tarifas') { <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/> }
        @case ('configuracion') { <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/> }
        @case ('auditoria') { <path d="M9 3h6l1 2h3v16H5V5h3z"/><path d="M9 11h6M9 15h4"/><path d="M9 3v3h6V3"/> }
        @case ('sos') { <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/> }
        @case ('telefono') { <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/> }
        @case ('mapa') { <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/> }
        @case ('reloj') { <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/> }
        @case ('check') { <path d="M20 6 9 17l-5-5"/> }
        @case ('x') { <path d="M18 6 6 18M6 6l12 12"/> }
        @case ('editar') { <path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/> }
        @case ('mas') { <path d="M12 5v14M5 12h14"/> }
        @case ('refrescar') { <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/> }
        @case ('mensaje') { <path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/> }
        @case ('pin') { <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/> }
        @case ('documento') { <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/> }
        @case ('candado') { <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/> }
        @case ('escudo') { <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5V6z"/><path d="m9 12 2 2 4-4"/> }
        @case ('calificaciones') { <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/> }
        @case ('equipo') { <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M17 11l2 2 4-4"/> }
        @case ('cancelar') { <circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/> }
      }
    </svg>
  `,
  styles: `
    :host { display: block; width: 20px; height: 20px; flex: none; }
    svg { width: 100%; height: 100%; display: block; }
  `,
})
export class AdminIcoComponent {
  @Input() n = '';
}
