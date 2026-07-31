// Campos de formulario reutilizables: numerico con unidad rotulada,
// ayuda contextual bajo demanda (boton "?" en la etiqueta) y error de
// validacion en sitio.
import { el } from './dom.js';
import { aNumero } from './formato.js';

let consecutivo = 0;
function idUnico(prefijo) {
  consecutivo += 1;
  return `${prefijo}-${consecutivo}`;
}

// Solo una ayuda abierta a la vez en toda la pantalla: si cada boton
// dejara su globo abierto, dos o tres campos consultados devuelven el
// muro de texto que este patron vino a quitar.
let cerrarAyudaAbierta = null;

/* Ayuda contextual de un campo: el texto ya no se imprime siempre bajo
   el control. Vive en un globo que abre el boton "?" de la etiqueta y
   que se cierra al volver a pulsarlo, con Escape o al abrir la ayuda de
   otro campo.

   El globo va EN EL FLUJO, no flotando: una tarjeta recorta lo que se
   sale de ella, y en un telefono un globo absoluto acaba tapando el
   propio campo que explica. Empujar el contenido hacia abajo es lo que
   se puede pintar sin recortes en cualquier superficie. Y va DEBAJO del
   control, no entre la etiqueta y el: en medio, el rotulo se separa de
   su campo y deja de leerse a cual pertenece. */
export function crearAyuda({ idCampo, etiqueta, texto }) {
  const globo = el(
    'p',
    { clase: 'ayuda ayuda--globo oculto', id: `${idCampo}-ayuda`, role: 'note' },
    texto
  );
  const boton = el(
    'button',
    {
      type: 'button',
      clase: 'ayuda-boton',
      'aria-expanded': 'false',
      'aria-controls': globo.id,
      'aria-label': `Ayuda sobre ${etiqueta}`,
    },
    '?'
  );

  function cerrar() {
    boton.setAttribute('aria-expanded', 'false');
    globo.classList.add('oculto');
    if (cerrarAyudaAbierta === cerrar) cerrarAyudaAbierta = null;
  }

  function abrir() {
    if (cerrarAyudaAbierta && cerrarAyudaAbierta !== cerrar) cerrarAyudaAbierta();
    boton.setAttribute('aria-expanded', 'true');
    globo.classList.remove('oculto');
    cerrarAyudaAbierta = cerrar;
  }

  boton.addEventListener('click', () => {
    if (boton.getAttribute('aria-expanded') === 'true') cerrar();
    else abrir();
  });
  // Escape cierra la ayuda y NO llega al dialogo que la contiene: quien
  // abrio un globo espera cerrar el globo, no perder lo capturado.
  boton.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && boton.getAttribute('aria-expanded') === 'true') {
      evento.stopPropagation();
      cerrar();
    }
  });

  return { boton, globo, cerrar };
}

/* Cabecera de un campo: la etiqueta y, si hay ayuda, el boton "?" a su
   lado. Sin ayuda devuelve la etiqueta pelada, sin envoltorio extra.
   El boton queda FUERA del <label> a proposito: dentro, pulsarlo
   activaria el control del campo y su texto ensuciaria el nombre
   accesible de la etiqueta. */
export function crearEtiquetaConAyuda({ idCampo, etiqueta, unidad = '', ayuda = null }) {
  const rotulo = el(
    'label',
    { clase: 'etiqueta', for: idCampo },
    etiqueta,
    unidad ? el('span', { clase: 'texto-suave' }, ` (${unidad})`) : null
  );
  if (!ayuda) return { cabecera: rotulo, globo: null };
  const { boton, globo } = crearAyuda({ idCampo, etiqueta, texto: ayuda });
  return { cabecera: el('div', { clase: 'campo__cabecera' }, rotulo, boton), globo };
}

export function crearCampoNumerico({
  id = null,
  etiqueta,
  unidad = '',
  ayuda = null,
  valorInicial = null,
  placeholder = '',
  soloLectura = false,
  alCambiar = null,
}) {
  const idCampo = id ?? idUnico('campo');
  const entrada = el('input', {
    clase: 'entrada',
    id: idCampo,
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    placeholder,
    readonly: soloLectura || null,
    value: valorInicial === null || valorInicial === undefined ? '' : String(valorInicial),
  });
  const nodoError = el('p', { clase: 'campo__error oculto', id: `${idCampo}-error` });
  const { cabecera, globo: nodoAyuda } = crearEtiquetaConAyuda({ idCampo, etiqueta, unidad, ayuda });
  if (nodoAyuda) entrada.setAttribute('aria-describedby', nodoAyuda.id);
  const raiz = el(
    'div',
    { clase: 'campo' },
    cabecera,
    entrada,
    nodoError,
    nodoAyuda
  );

  if (alCambiar) {
    entrada.addEventListener('input', () => alCambiar(aNumero(entrada.value), entrada.value));
  }

  return {
    elemento: raiz,
    entrada,
    obtener() {
      return aNumero(entrada.value);
    },
    obtenerTexto() {
      return entrada.value;
    },
    fijar(valor) {
      entrada.value = valor === null || valor === undefined ? '' : String(valor);
    },
    fijarError(mensaje) {
      const idsAyuda = nodoAyuda ? `${nodoAyuda.id} ` : '';
      if (mensaje) {
        nodoError.textContent = mensaje;
        nodoError.classList.remove('oculto');
        entrada.setAttribute('aria-invalid', 'true');
        entrada.setAttribute('aria-describedby', `${nodoError.id} ${idsAyuda}`.trim());
      } else {
        nodoError.classList.add('oculto');
        entrada.removeAttribute('aria-invalid');
        if (nodoAyuda) entrada.setAttribute('aria-describedby', nodoAyuda.id);
        else entrada.removeAttribute('aria-describedby');
      }
    },
  };
}

export function crearCampoSelect({ id = null, etiqueta, opciones, valorInicial = null, ayuda = null, alCambiar = null }) {
  const idCampo = id ?? idUnico('select');
  const select = el(
    'select',
    { id: idCampo },
    opciones.map((opcion) =>
      el('option', { value: opcion.valor, selected: opcion.valor === valorInicial || null }, opcion.texto)
    )
  );
  if (alCambiar) select.addEventListener('change', () => alCambiar(select.value));
  const { cabecera, globo } = crearEtiquetaConAyuda({ idCampo, etiqueta, ayuda });
  if (globo) select.setAttribute('aria-describedby', globo.id);
  const raiz = el(
    'div',
    { clase: 'campo' },
    cabecera,
    el('div', { clase: 'selector' }, select),
    globo
  );
  return {
    elemento: raiz,
    select,
    obtener() {
      return select.value;
    },
    fijar(valor) {
      select.value = valor;
    },
    fijarOpciones(nuevas, seleccionado = null) {
      while (select.firstChild) select.removeChild(select.firstChild);
      for (const opcion of nuevas) {
        select.append(el('option', { value: opcion.valor }, opcion.texto));
      }
      if (seleccionado !== null) select.value = seleccionado;
    },
  };
}

export function crearInterruptor({ etiqueta, valorInicial = false, ayuda = null, alCambiar = null }) {
  const idCampo = idUnico('interruptor');
  const casilla = el('input', { type: 'checkbox', clase: 'switch', id: idCampo });
  casilla.checked = Boolean(valorInicial);
  if (alCambiar) casilla.addEventListener('change', () => alCambiar(casilla.checked));
  // La fila del interruptor es toda ella un <label>, asi que el boton
  // "?" no puede ir dentro: pulsarlo cambiaria el interruptor.
  const ayudaCampo = ayuda ? crearAyuda({ idCampo, etiqueta, texto: ayuda }) : null;
  if (ayudaCampo) casilla.setAttribute('aria-describedby', ayudaCampo.globo.id);
  const filaEtiqueta = el('label', { clase: 'fila-control' }, casilla, el('span', {}, etiqueta));
  const raiz = el(
    'div',
    { clase: 'campo' },
    ayudaCampo ? el('div', { clase: 'campo__cabecera' }, filaEtiqueta, ayudaCampo.boton) : filaEtiqueta,
    ayudaCampo ? ayudaCampo.globo : null
  );
  return {
    elemento: raiz,
    obtener() {
      return casilla.checked;
    },
    fijar(valor) {
      casilla.checked = Boolean(valor);
    },
  };
}
