// Campos de formulario reutilizables: numerico con unidad rotulada,
// ayuda contextual bajo demanda (boton "?" en la etiqueta) y error de
// validacion en sitio.
import { el } from './dom.js';
import { aNumero } from './formato.js';
import { nodoSvg } from './svg.js';
import { entreSistemas, esConvertible, otroSistema, unidad as unidadDe } from '../domain/units.js';

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

/* Las dos flechas del boton de unidades. Van dibujadas y no como signo
   de texto: el subconjunto latino de las fuentes autohospedadas no trae
   flechas, asi que un caracter como el de doble flecha caeria en la
   fuente del sistema —o en un recuadro vacio— y cambiaria de tamano
   entre telefonos. El color no se escribe aqui: lo pone
   `.campo__unidad-icono` con el token del tema. */
function iconoIntercambio() {
  const svg = nodoSvg('svg', {
    class: 'campo__unidad-icono',
    viewBox: '0 0 16 16',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.append(
    nodoSvg('path', { d: 'M2.5 5.5H13M10.5 3L13 5.5L10.5 8' }),
    nodoSvg('path', { d: 'M13.5 10.5H3M5.5 8L3 10.5L5.5 13' })
  );
  return svg;
}

/* Numero convertido a texto para el input: los MISMOS seis digitos
   significativos con los que cada pantalla precarga sus campos, para que
   lo que escribe el boton de unidades se lea igual que lo que ya venia y
   no aparezcan colas de punto flotante (39.370078740157481). */
function textoDeValor(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  return String(Number(valor.toPrecision(6)));
}

/* Boton de unidades de un campo: convierte lo capturado de metrico a
   imperial y de regreso.

   Para que sirve: quien calibra lee el dato en la unidad que trae el
   fierro que tiene enfrente —el manometro de la barra marca psi, la
   ficha de la boquilla americana viene en GPM, el tanque esta rotulado
   en galones— y la aplicacion trabaja en la otra. Antes ese numero se
   convertia a mano, con el telefono en una mano y el celular de la
   calculadora en la otra, de pie en el lote. Es justo donde se cuela un
   error de factor que despues nadie encuentra.

   Que NO hace: cambiar el sistema de la aplicacion. Eso sigue viviendo
   en Sistema, Configuración y sigue siendo uno solo para toda la
   pantalla. Este boton solo cambia en que unidad se ESCRIBE este campo;
   hacia afuera el valor sigue saliendo en `sistemaBase`, que es lo que
   la pantalla que lo creo espera recibir.

   La vuelta devuelve el texto ORIGINAL, no el reconvertido: con seis
   digitos significativos, 2.7579 bar -> 40.0001 psi -> 2.75791 bar, y
   ver cambiar el numero al regresar se lee como un error de la
   aplicacion. Por eso se guarda de donde se venia. */
function crearBotonUnidad({ idCampo, etiqueta, magnitud, sistemaBase, entrada }) {
  let sistemaCampo = sistemaBase;
  let regreso = null;

  const rotulo = el('span', { clase: 'campo__unidad-texto' });
  const boton = el(
    'button',
    { type: 'button', clase: 'campo__unidad', id: `${idCampo}-unidad` },
    rotulo,
    iconoIntercambio()
  );

  function unidadActual() {
    return unidadDe(magnitud, sistemaCampo);
  }

  function rotular() {
    const actual = unidadActual();
    const otra = unidadDe(magnitud, otroSistema(sistemaCampo));
    rotulo.textContent = actual;
    // El nombre accesible incluye el texto visible (la unidad) y dice
    // que pasa al pulsar, que es lo que no se ve.
    boton.setAttribute('aria-label', `${etiqueta} en ${actual}. Convertir a ${otra}.`);
    boton.dataset.sistema = sistemaCampo;
    // Marca de "este campo NO está en las unidades de la aplicación",
    // que es lo que hay que ver de lejos. No es "esta en imperial": con
    // la aplicacion en imperial, imperial es lo normal.
    boton.dataset.convertido = String(sistemaCampo !== sistemaBase);
  }

  boton.addEventListener('click', () => {
    const destino = otroSistema(sistemaCampo);
    const textoAntes = entrada.value;
    const valor = aNumero(textoAntes);
    if (regreso && regreso.destino === destino && regreso.textoResultado === textoAntes) {
      entrada.value = regreso.textoOrigen;
    } else if (valor !== null) {
      entrada.value = textoDeValor(entreSistemas(magnitud, valor, sistemaCampo, destino));
    }
    // Un campo vacio —o con algo que no es numero— solo cambia de
    // unidad: no hay nada que convertir y no se borra lo escrito.
    regreso = { destino: sistemaCampo, textoOrigen: textoAntes, textoResultado: entrada.value };
    sistemaCampo = destino;
    rotular();
  });

  rotular();

  return {
    boton,
    // Del sistema en que se esta escribiendo al que espera la pantalla.
    aBase: (valor) => entreSistemas(magnitud, valor, sistemaCampo, sistemaBase),
    // Del valor que manda la pantalla al texto que toca mostrar. Sin
    // conversion de por medio se escribe tal cual, como siempre.
    textoDesdeBase(valor) {
      regreso = null;
      if (sistemaCampo === sistemaBase) return String(valor);
      return textoDeValor(entreSistemas(magnitud, valor, sistemaBase, sistemaCampo));
    },
    olvidarRegreso() {
      regreso = null;
    },
  };
}

export function crearCampoNumerico({
  id = null,
  etiqueta,
  unidad = '',
  // Magnitud de units.js y sistema en el que ENTRAN y SALEN los valores
  // de este campo. Con los dos, el campo lleva boton de conversion; la
  // unidad la pone entonces el boton y no hace falta pasarla.
  magnitud = null,
  sistema = null,
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
  const unidades =
    sistema && esConvertible(magnitud)
      ? crearBotonUnidad({ idCampo, etiqueta, magnitud, sistemaBase: sistema, entrada })
      : null;
  const nodoError = el('p', { clase: 'campo__error oculto', id: `${idCampo}-error` });
  const { cabecera, globo: nodoAyuda } = crearEtiquetaConAyuda({
    idCampo,
    etiqueta,
    // Con boton, la unidad va pegada al numero y no se repite arriba.
    unidad: unidades ? '' : unidad,
    ayuda,
  });
  const raiz = el(
    'div',
    { clase: 'campo' },
    cabecera,
    unidades ? el('div', { clase: 'campo__medida' }, entrada, unidades.boton) : entrada,
    nodoError,
    nodoAyuda
  );

  // Descripcion del control: el error si esta a la vista, la unidad —que
  // ya no esta en la etiqueta— y la ayuda. En ese orden: lo que corrige
  // primero.
  function sincronizarDescripcion() {
    const ids = [];
    if (!nodoError.classList.contains('oculto')) ids.push(nodoError.id);
    if (unidades) ids.push(unidades.boton.id);
    if (nodoAyuda) ids.push(nodoAyuda.id);
    if (ids.length > 0) entrada.setAttribute('aria-describedby', ids.join(' '));
    else entrada.removeAttribute('aria-describedby');
  }
  sincronizarDescripcion();

  function obtener() {
    const valor = aNumero(entrada.value);
    return unidades ? unidades.aBase(valor) : valor;
  }

  if (alCambiar) {
    entrada.addEventListener('input', () => alCambiar(obtener(), entrada.value));
  }

  return {
    elemento: raiz,
    entrada,
    obtener,
    obtenerTexto() {
      return entrada.value;
    },
    fijar(valor) {
      if (valor === null || valor === undefined) {
        if (unidades) unidades.olvidarRegreso();
        entrada.value = '';
        return;
      }
      entrada.value = unidades ? unidades.textoDesdeBase(valor) : String(valor);
    },
    fijarError(mensaje) {
      if (mensaje) {
        nodoError.textContent = mensaje;
        nodoError.classList.remove('oculto');
        entrada.setAttribute('aria-invalid', 'true');
      } else {
        nodoError.classList.add('oculto');
        entrada.removeAttribute('aria-invalid');
      }
      sincronizarDescripcion();
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
