import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectorPuntos, TipoPunto } from '../../core/mapa-ciudad';

/**
 * Campos de recogida y destino de las pantallas de pedir (transporte, domicilio y encomienda).
 * Cada campo se puede escribir (Enter busca en Buenaventura) o marcar tocando el mapa: el botón
 * "En el mapa" elige cuál de los dos marca el próximo toque.
 */
@Component({
  selector: 'app-puntos-ruta',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './puntos-ruta.html',
  styleUrls: ['./puntos-ruta.css'],
  host: { '[style.--acento]': 'acento' }
})
export class PuntosRutaComponent {
  @Input({ required: true }) selector!: SelectorPuntos;
  @Input() etiquetaOrigen = 'Punto de recogida';
  @Input() etiquetaDestino = 'Punto de destino';
  @Input() acento = '#16a34a';
  /** false mientras hay un servicio en curso. */
  @Input() editable = true;

  elegir(tipo: TipoPunto): void {
    if (this.editable) this.selector.activo = tipo;
  }
}
