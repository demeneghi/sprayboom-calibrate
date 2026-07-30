// Dialogo de confirmacion sobre el elemento <dialog> nativo: con
// superposicion y cierre por Escape sin codigo extra.
import { el } from './dom.js';

export function confirmar({
  titulo,
  descripcion = '',
  cuerpo = null,
  confirmarTexto = 'Confirmar',
  cancelarTexto = 'Cancelar',
  destructivo = false,
}) {
  return new Promise((resolver) => {
    const dialogo = el('dialog', { clase: 'dialogo' });
    const botonConfirmar = el(
      'button',
      { clase: `boton${destructivo ? ' boton--destructivo' : ''}` },
      confirmarTexto
    );
    const botonCancelar = el('button', { clase: 'boton boton--contorno' }, cancelarTexto);

    dialogo.append(
      el('h2', { clase: 'dialogo__titulo' }, titulo),
      descripcion ? el('p', { clase: 'dialogo__descripcion' }, descripcion) : null,
      cuerpo,
      el('div', { clase: 'dialogo__acciones' }, botonCancelar, botonConfirmar)
    );

    let resultado = false;
    botonConfirmar.addEventListener('click', () => {
      resultado = true;
      dialogo.close();
    });
    botonCancelar.addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('close', () => {
      dialogo.remove();
      resolver(resultado);
    });

    document.body.append(dialogo);
    dialogo.showModal();
  });
}
