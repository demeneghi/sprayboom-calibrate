// Campos de formulario reutilizables: numerico con unidad rotulada,
// ayuda contextual visible (sustituto movil del tooltip) y error de
// validacion en sitio.
import { el } from './dom.js';
import { aNumero } from './formato.js';

let consecutivo = 0;
function idUnico(prefijo) {
  consecutivo += 1;
  return `${prefijo}-${consecutivo}`;
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
  const nodoAyuda = ayuda ? el('p', { clase: 'ayuda', id: `${idCampo}-ayuda` }, ayuda) : null;
  if (nodoAyuda) entrada.setAttribute('aria-describedby', nodoAyuda.id);
  const raiz = el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'etiqueta', for: idCampo }, etiqueta, unidad ? el('span', { clase: 'texto-suave' }, ` (${unidad})`) : null),
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
  const raiz = el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'etiqueta', for: idCampo }, etiqueta),
    el('div', { clase: 'selector' }, select),
    ayuda ? el('p', { clase: 'ayuda' }, ayuda) : null
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
  const casilla = el('input', { type: 'checkbox', clase: 'switch' });
  casilla.checked = Boolean(valorInicial);
  if (alCambiar) casilla.addEventListener('change', () => alCambiar(casilla.checked));
  const raiz = el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'fila-control' }, casilla, el('span', {}, etiqueta)),
    ayuda ? el('p', { clase: 'ayuda' }, ayuda) : null
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
