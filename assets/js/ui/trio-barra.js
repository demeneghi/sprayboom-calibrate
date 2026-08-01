// Los tres datos de la barra, amarrados: ancho, numero de boquillas y
// espaciamiento.
//
// Una barra con las boquillas parejas cumple
// `ancho = número * espaciamiento`, asi que capturar los tres es capturar
// uno de mas. Antes solo se derivaba el espaciamiento del ancho entre el
// numero de boquillas, y las otras dos direcciones se hacian a mano con
// la calculadora del telefono: quien mide con el flexometro la distancia
// entre dos boquillas y las cuenta —lo que se puede hacer parado junto a
// la barra— tenia que multiplicar para llegar al ancho.
//
// CUAL de los tres se calcula es una eleccion explicita y no una
// adivinanza sobre que campo quedo vacio: el grupo de opciones lo dice y
// el campo elegido se pinta de solo lectura. La cuarta opcion —capturar
// los tres— existe a proposito: es la unica que conserva la señal de
// diagnostico de que el ancho efectivo no es el que se cree.
//
// El componente NO sabe donde se guarda lo capturado: recibe los valores
// en base metrica y avisa por `alCambiar`. La barra de Configuracion y la
// captura del dia de Gasto de agua lo usan igual.

import { el, reemplazar } from './dom.js';
import { crearCampoNumerico, crearAyuda } from './campos.js';
import { pintarAvisos } from './render.js';
import { formatear } from './formato.js';
import { aSistema, deSistema, unidad } from '../domain/units.js';
import { completarTrioBarra, redondeoLegible } from '../domain/speed.js';

const AYUDA_MODO =
  'Los tres datos están amarrados: el ancho de la barra es el número de boquillas por el ' +
  'espaciamiento. Elige cuál quieres que se calcule solo y captura los otros dos. Con ' +
  '«Ninguno» capturas los tres y te avisamos si no cuadran, que es la señal de que el ancho ' +
  'efectivo no es el que se cree.';

const ETIQUETAS_MODO = {
  anchoBarra: 'El ancho de la barra',
  numBoquillas: 'El número de boquillas',
  espaciamiento: 'El espaciamiento',
  ninguno: 'Ninguno: capturo los tres',
};

let consecutivo = 0;

export function crearTrioBarra({
  sistema,
  // Valores iniciales en base metrica; null es campo vacio.
  valores = {},
  // 'anchoBarra' | 'numBoquillas' | 'espaciamiento' | 'ninguno'
  calcular = 'espaciamiento',
  umbralDiscrepanciaPct = null,
  espaciamientoMinimoPlausible = null,
  etiquetas = {},
  ayudas = {},
  // (estado) => void, con estado = { valores, calcular, avisos }. Se
  // llama en cada captura y en cada cambio de modo, ya con el tercer
  // dato calculado.
  alCambiar = null,
}) {
  consecutivo += 1;
  const idGrupo = `trio-barra-${consecutivo}`;
  const unidadAncho = unidad('distancia', sistema);
  const unidadEspaciamiento = unidad('distanciaCorta', sistema);

  let modo = calcular;
  // Se apaga mientras el componente escribe el campo calculado: `fijar`
  // no dispara eventos, pero si el aviso al consumidor, y reentrar
  // volveria a leer el campo a medio escribir.
  let sincronizando = false;
  let ultimo = null;

  function aCampo(magnitud, valorMetrico) {
    if (valorMetrico === null || valorMetrico === undefined) return null;
    return Number(aSistema(magnitud, valorMetrico, sistema).toPrecision(6));
  }

  const campoAncho = crearCampoNumerico({
    etiqueta: etiquetas.anchoBarra ?? 'Ancho de la barra',
    magnitud: 'distancia',
    sistema,
    valorInicial: aCampo('distancia', valores.anchoBarraM ?? null),
    ayuda: ayudas.anchoBarra ?? null,
    alCambiar: () => sincronizar(),
  });
  const campoNumBoquillas = crearCampoNumerico({
    etiqueta: etiquetas.numBoquillas ?? 'Número de boquillas',
    unidad: '',
    valorInicial: valores.numBoquillas ?? null,
    ayuda: ayudas.numBoquillas ?? null,
    alCambiar: () => sincronizar(),
  });
  const campoEspaciamiento = crearCampoNumerico({
    etiqueta: etiquetas.espaciamiento ?? 'Espaciamiento entre boquillas',
    magnitud: 'distanciaCorta',
    sistema,
    valorInicial: aCampo('distanciaCorta', valores.espaciamientoM ?? null),
    ayuda: ayudas.espaciamiento ?? null,
    alCambiar: () => sincronizar(),
  });

  const CAMPOS = {
    anchoBarra: campoAncho,
    numBoquillas: campoNumBoquillas,
    espaciamiento: campoEspaciamiento,
  };

  // ---------------- Grupo de opciones: cual se calcula ----------------
  const rotulo = el('span', { clase: 'etiqueta', id: idGrupo }, '¿Cuál se calcula?');
  const ayudaModo = crearAyuda({
    idCampo: idGrupo,
    etiqueta: 'cuál dato de la barra se calcula',
    texto: AYUDA_MODO,
  });
  const botonesModo = new Map();
  const grupo = el('div', { clase: 'grupo-modo', role: 'group', 'aria-labelledby': idGrupo });
  for (const [clave, texto] of Object.entries(ETIQUETAS_MODO)) {
    // El resalte de la opcion elegida lo pinta components.css desde
    // `aria-pressed`: aqui no se intercambian variantes de boton.
    const boton = el(
      'button',
      { type: 'button', clase: 'boton boton--contorno', 'aria-pressed': 'false' },
      texto
    );
    boton.addEventListener('click', () => {
      if (modo === clave) return;
      modo = clave;
      sincronizar();
    });
    botonesModo.set(clave, boton);
    grupo.append(boton);
  }

  const nota = el('p', { clase: 'ayuda' });
  const zonaAvisos = el('div', {});

  function leer() {
    return {
      anchoBarraM: deSistema('distancia', campoAncho.obtener(), sistema),
      numBoquillas: campoNumBoquillas.obtener(),
      espaciamientoM: deSistema('distanciaCorta', campoEspaciamiento.obtener(), sistema),
    };
  }

  // Texto de la operacion aplicada. Es RESULTADO —cambia con lo
  // capturado—, asi que se imprime en vez de irse al globo del "?".
  function textoNota(resultado) {
    const v = resultado.valores;
    const ancho = () => `${formatear(aSistema('distancia', v.anchoBarraM, sistema), 2)} ${unidadAncho}`;
    const esp = () =>
      `${formatear(aSistema('distanciaCorta', v.espaciamientoM, sistema), 3)} ${unidadEspaciamiento}`;
    const num = () => `${formatear(v.numBoquillas, 0)}`;
    if (modo === 'ninguno') {
      return (
        'Los tres capturados a mano. Si el ancho no cuadra con el número de boquillas por su ' +
        'espaciamiento, te avisamos aquí.'
      );
    }
    if (v.calculado === 'espaciamiento') {
      return `Espaciamiento calculado: ${ancho()} entre ${num()} boquillas dan ${esp()}.`;
    }
    if (v.calculado === 'anchoBarra') {
      return `Ancho calculado: ${num()} boquillas a ${esp()} dan ${ancho()}.`;
    }
    if (v.calculado === 'numBoquillas') {
      return `Número de boquillas calculado: ${ancho()} entre ${esp()} dan ${num()} boquillas.`;
    }
    if (modo === 'espaciamiento') {
      return 'Captura el ancho de la barra y el número de boquillas para que salga el espaciamiento.';
    }
    if (modo === 'anchoBarra') {
      return 'Captura el número de boquillas y el espaciamiento para que salga el ancho de la barra.';
    }
    return 'Captura el ancho de la barra y el espaciamiento para que salga el número de boquillas.';
  }

  function sincronizar({ propagar = true } = {}) {
    if (sincronizando) return ultimo;
    sincronizando = true;
    let resultado = ultimo;
    try {
      resultado = completarTrioBarra({
        ...leer(),
        calcular: modo,
        umbralDiscrepanciaPct,
        espaciamientoMinimoPlausible,
      });
      const v = resultado.valores;

      // El campo calculado se escribe; los capturados no se tocan, ni
      // siquiera para reformatearlos, o el numero cambiaria bajo el dedo
      // a media captura.
      if (modo !== 'ninguno') {
        const campo = CAMPOS[modo];
        if (v.calculado === 'espaciamiento') {
          campo.fijar(redondeoLegible(aSistema('distanciaCorta', v.espaciamientoM, sistema)));
        } else if (v.calculado === 'anchoBarra') {
          campo.fijar(redondeoLegible(aSistema('distancia', v.anchoBarraM, sistema)));
        } else if (v.calculado === 'numBoquillas') {
          campo.fijar(String(v.numBoquillas));
        } else {
          // Todavia no alcanza para calcularlo: se vacia en vez de dejar
          // a la vista un numero viejo que ya no sale de lo capturado.
          campo.fijar(null);
        }
      }

      for (const [clave, campo] of Object.entries(CAMPOS)) {
        const calculado = modo === clave;
        campo.entrada.readOnly = calculado;
        botonesModo.get(clave).setAttribute('aria-pressed', calculado ? 'true' : 'false');
        // El boton de unidades convierte lo que se TECLEO en la unidad
        // del fierro que se tiene enfrente. En un campo que sale de los
        // otros dos no hay nada que convertir: se apaga, igual que
        // cuando el campo esta vacio.
        const botonUnidad = campo.elemento.querySelector('.campo__unidad');
        if (botonUnidad) botonUnidad.disabled = calculado || campo.obtener() === null;
      }
      botonesModo.get('ninguno').setAttribute('aria-pressed', modo === 'ninguno' ? 'true' : 'false');

      nota.textContent = textoNota(resultado);
      reemplazar(zonaAvisos, ...pintarAvisos(resultado.avisos));
      ultimo = resultado;
    } finally {
      sincronizando = false;
    }
    if (propagar && alCambiar) {
      alCambiar({ valores: resultado.valores, calcular: modo, avisos: resultado.avisos });
    }
    return resultado;
  }

  const raiz = el(
    'div',
    { clase: 'pila-campos' },
    el(
      'div',
      { clase: 'campo' },
      el('div', { clase: 'campo__cabecera' }, rotulo, ayudaModo.boton),
      grupo,
      ayudaModo.globo
    ),
    campoAncho.elemento,
    campoNumBoquillas.elemento,
    campoEspaciamiento.elemento,
    nota,
    zonaAvisos
  );

  const inicial = sincronizar({ propagar: false });

  return {
    elemento: raiz,
    campos: CAMPOS,
    // Estado ya completado, en base metrica.
    obtener: () => sincronizar({ propagar: false }).valores,
    modo: () => modo,
    // Vuelve a poner los tres valores (base metrica) y, si se pide, el
    // modo. No propaga: lo usa quien acaba de guardar lo que entrega.
    fijar({ anchoBarraM = null, numBoquillas = null, espaciamientoM = null }, nuevoModo = null) {
      if (nuevoModo) modo = nuevoModo;
      campoAncho.fijar(aCampo('distancia', anchoBarraM));
      campoNumBoquillas.fijar(numBoquillas);
      campoEspaciamiento.fijar(aCampo('distanciaCorta', espaciamientoM));
      return sincronizar({ propagar: false });
    },
    fijarError(clave, mensaje) {
      CAMPOS[clave]?.fijarError(mensaje);
    },
    valoresIniciales: inicial.valores,
  };
}
