// Pestana bitacora: se construye en su fase; este es el esqueleto minimo.
import { tarjeta } from '../render.js';
import { el } from '../dom.js';

export const id = 'bitacora';

export function render(panel, ctx) {
  panel.append(
    tarjeta(
      { titulo: 'En construccion' },
      el('p', { clase: 'texto-suave' }, 'Esta pantalla se construye en una fase posterior.')
    )
  );
}
