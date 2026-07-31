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
    const botonConfirmar = el(
      'button',
      { clase: `boton${destructivo ? ' boton--destructivo' : ''}` },
      confirmarTexto
    );
    const botonCancelar = el('button', { clase: 'boton boton--contorno' }, cancelarTexto);

    // Los hijos se montan con `el()`, NUNCA con `dialogo.append()` a
    // secas: `append` convierte a texto lo que no es nodo, asi que un
    // `cuerpo` ausente (null) se pintaba como la palabra «null» bajo la
    // descripcion, en TODOS los dialogos de la aplicacion. `el()`
    // descarta null, undefined y false.
    const dialogo = el(
      'dialog',
      { clase: 'dialogo' },
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
