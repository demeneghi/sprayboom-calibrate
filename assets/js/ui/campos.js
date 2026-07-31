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

// Geometria del globo flotante. Va en pixeles porque son medidas
// fisicas (la raiz mide 14px, no 16), igual que el resto del sistema.
const GLOBO_ANCHO_MAX = 288; // el mismo tope que el tooltip de Sherman
const GLOBO_SEPARACION = 8; // hueco entre el boton "?" y el globo
const GLOBO_MARGEN = 8; // aire minimo contra los bordes de la pantalla
const GLOBO_FLECHA_MIN = 12; // la puntita no se pega a la esquina redondeada

// La capa superior del navegador (`popover`) es lo unico que no recorta
// una tarjeta y lo unico que se pinta por ENCIMA de un dialogo modal.
// Donde no exista, el globo sigue flotando con `position: fixed`.
const SOPORTA_POPOVER =
  typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

/* Ayuda contextual de un campo: el texto ya no se imprime siempre bajo
   el control. Vive en un globo que abre el boton "?" de la etiqueta y
   que se cierra al volver a pulsarlo, con Escape, al tocar fuera o al
   abrir la ayuda de otro campo.

   El globo FLOTA, no ocupa lugar en el flujo (se copia el tooltip de
   Sherman): abrir una ayuda ya no empuja el formulario hacia abajo ni
   descoloca el campo que se estaba leyendo. Para que la tarjeta no lo
   recorte se pinta en la capa superior; la posicion la calcula
   `colocar()` y la escribe en variables CSS, asi que el globo se
   coloca donde de verdad cabe y la puntita sigue apuntando al boton. */
export function crearAyuda({ idCampo, etiqueta, texto }) {
  const globo = el(
    'p',
    { clase: 'ayuda ayuda--globo oculto', id: `${idCampo}-ayuda`, role: 'note' },
    texto
  );
  if (SOPORTA_POPOVER) globo.setAttribute('popover', 'manual');
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

  let abierto = false;

  // Se mide con el globo ya visible: el ancho sale de `max-content`
  // acotado por el tope, asi que no depende de donde este colocado y
  // medir no obliga a pintarlo dos veces.
  function colocar() {
    const marco = boton.getBoundingClientRect();
    const anchoMax = Math.min(GLOBO_ANCHO_MAX, window.innerWidth - GLOBO_MARGEN * 2);
    globo.style.setProperty('--globo-ancho-max', `${anchoMax}px`);
    const caja = globo.getBoundingClientRect();

    // Arriba por defecto, como en Sherman: el control que la ayuda
    // explica queda justo debajo del boton, asi que un globo hacia
    // abajo taparia el campo que se acaba de consultar.
    const cabeArriba = marco.top >= caja.height + GLOBO_SEPARACION + GLOBO_MARGEN;
    const arriba = cabeArriba || marco.top > window.innerHeight - marco.bottom;
    const y = arriba ? marco.top - GLOBO_SEPARACION - caja.height : marco.bottom + GLOBO_SEPARACION;

    // Alineado por la derecha con el boton (que vive en el extremo
    // derecho de la etiqueta) y metido dentro de la pantalla.
    const xMaximo = window.innerWidth - GLOBO_MARGEN - caja.width;
    const x = Math.max(GLOBO_MARGEN, Math.min(marco.right - caja.width, xMaximo));

    const centroBoton = marco.left + marco.width / 2 - x;
    const flecha = Math.max(
      GLOBO_FLECHA_MIN,
      Math.min(centroBoton, caja.width - GLOBO_FLECHA_MIN)
    );

    globo.dataset.lado = arriba ? 'arriba' : 'abajo';
    globo.style.setProperty('--globo-x', `${Math.round(x)}px`);
    globo.style.setProperty('--globo-y', `${Math.round(Math.max(GLOBO_MARGEN, y))}px`);
    globo.style.setProperty('--globo-flecha', `${Math.round(flecha)}px`);
  }

  // Al desplazar o girar el telefono el globo persigue a su boton. Si
  // el panel se volvio a dibujar mientras estaba abierto, el boton ya
  // no esta en la pagina y el globo se cierra en vez de quedar suelto.
  function alMover() {
    if (!boton.isConnected) cerrar();
    else colocar();
  }

  function alPulsarFuera(evento) {
    if (!boton.isConnected) {
      cerrar();
      return;
    }
    // El toque sobre el propio boton lo resuelve su `click` (alternar).
    if (boton.contains(evento.target) || globo.contains(evento.target)) return;
    cerrar();
  }

  // Escape cierra la ayuda y NO llega al dialogo que la contiene: quien
  // abrio un globo espera cerrar el globo, no perder lo capturado.
  function alTeclear(evento) {
    if (evento.key !== 'Escape') return;
    evento.stopPropagation();
    evento.preventDefault();
    const teniaFoco = boton.contains(document.activeElement);
    cerrar();
    if (teniaFoco) boton.focus();
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;
    boton.setAttribute('aria-expanded', 'false');
    globo.classList.add('oculto');
    if (SOPORTA_POPOVER && globo.matches(':popover-open')) globo.hidePopover();
    window.removeEventListener('scroll', alMover, true);
    window.removeEventListener('resize', alMover);
    document.removeEventListener('pointerdown', alPulsarFuera, true);
    document.removeEventListener('keydown', alTeclear, true);
    if (cerrarAyudaAbierta === cerrar) cerrarAyudaAbierta = null;
  }

  function abrir() {
    if (abierto) return;
    if (cerrarAyudaAbierta && cerrarAyudaAbierta !== cerrar) cerrarAyudaAbierta();
    abierto = true;
    boton.setAttribute('aria-expanded', 'true');
    globo.classList.remove('oculto');
    if (SOPORTA_POPOVER && globo.isConnected) globo.showPopover();
    colocar();
    // El scroll no burbujea: hay que escucharlo en fase de captura.
    window.addEventListener('scroll', alMover, true);
    window.addEventListener('resize', alMover);
    document.addEventListener('pointerdown', alPulsarFuera, true);
    document.addEventListener('keydown', alTeclear, true);
    cerrarAyudaAbierta = cerrar;
  }

  boton.addEventListener('click', () => {
    if (abierto) cerrar();
    else abrir();
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
