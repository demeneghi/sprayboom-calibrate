// Pestana Gas etileno (dominio C): los cuatro modos del rotametro.
//
// Modos con botones segmentados (convencion de avance.js): consumo
// (masa), presion requerida, tiempo requerido y lectura del flotador.
// La masa por pie cubico estandar efectiva del gas activo se muestra
// SIEMPRE, con badge de anulacion manual o derivacion y su desglose.
// Los DOS instrumentos de la linea se dibujan en SVG desde su escala
// configurada —el tubo del rotametro y el manometro de la entrada— y
// son ademas la superficie de captura: se toca el dibujo, o se sube y
// baja con los botones mas y menos, y el escalon es la resolucion
// legible del aparato. El flotador y la aguja se posicionan en el valor
// vigente del modo; fuera de escala se fijan al extremo en color de
// advertencia mostrando el numero real, nunca recortado. El modo que
// DESPEJA una de las dos variables deja de capturarla: ahi el
// instrumento es un resultado.
//
// Convenciones de la pestana ejemplar: borradores con autosave en base
// metrica, resultados con desglose auditable, avisos tipados, gate de
// verificacion y errores de dominio atrapados como alerta destructiva
// (jamas NaN en pantalla).

import { el, reemplazar } from '../dom.js';
import {
  tarjeta,
  pintarAvisos,
  pintarDesglose,
  pintarResultado,
  pintarVerificacion,
  resultadoConfiable,
  pintarResultadoNoVerificado,
} from '../render.js';
import { crearCampoNumerico } from '../campos.js';
import { formatear, formatearTiempo } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import {
  redondeoLegible,
  marchasDeTractor,
  velocidadEfectiva,
  factorDesviacion,
  velocidadCorregida,
  avance,
  avanceDesdeReporte,
} from '../../domain/speed.js';
import { masaGas, despejePresion, despejeTiempo, despejeScfm } from '../../domain/flowmeter.js';
import { valorDefault } from '../../domain/defaults.js';
import { gPorScfEfectivo } from '../../domain/gas.js';

export const id = 'gas';

const GRID_2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };
const COLUMNA = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };

const MODOS = [
  { id: 'masa', etiqueta: 'Consumo (masa)', descripcion: 'consumo de gas' },
  { id: 'presion', etiqueta: 'Presión requerida', descripcion: 'presión requerida' },
  { id: 'tiempo', etiqueta: 'Tiempo requerido', descripcion: 'tiempo requerido' },
  { id: 'lectura', etiqueta: 'Lectura del flotador', descripcion: 'lectura del flotador' },
];

// ---------------------------------------------------------------------
// Ayudantes SVG: nodos con createElementNS y texto via textContent.
// El color NO se escribe aqui: cada nodo lleva su clase y el bloque
// `.instrumento*` de components.css lo pinta con tokens del tema.
// ---------------------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg';

function nodoSvg(nombre, atributos = {}) {
  const nodo = document.createElementNS(SVG_NS, nombre);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined) continue;
    nodo.setAttribute(clave, String(valor));
  }
  return nodo;
}

function textoSvg(x, y, contenido, opciones = {}) {
  const { clase = 'instrumento__numero', anclaje = 'start', giro = null } = opciones;
  const nodo = nodoSvg('text', {
    x,
    y,
    class: clase,
    'text-anchor': anclaje,
    transform: giro,
  });
  nodo.textContent = contenido;
  return nodo;
}

function lineaSvg(clase, x1, y1, x2, y2) {
  return nodoSvg('line', { class: clase, x1, y1, x2, y2 });
}

function poligonoSvg(clase, puntos) {
  return nodoSvg('polygon', {
    class: clase,
    points: puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
  });
}

// ---------------------------------------------------------------------
// Geometria del rotametro (viewBox 200 x 360)
// ---------------------------------------------------------------------
// Se dibuja como el aparato real: bloque de acrilico con su conexion
// roscada arriba y su tuerca abajo, tubo conico (mas ancho arriba) y la
// escala grabada a la derecha del tubo. La escala NO llega a los
// extremos del tubo, igual que en el instrumento: asi el flotador cabe
// entero cuando marca el minimo, y el canal de la izquierda queda libre
// para la pastilla de lectura.
const G = {
  ancho: 200,
  alto: 360,
  cuerpoX: 54,
  cuerpoX2: 192,
  cuerpoY: 26,
  cuerpoY2: 332,
  bandaY: 50, // filete bajo el encabezado serigrafiado
  cx: 100, // eje del tubo
  tuboSup: 58,
  tuboInf: 300,
  semiSup: 26, // semiancho del tubo arriba (conico)
  semiInf: 17, // y abajo
  escalaSup: 68, // la escala vive dentro del tubo, sin tocar los topes
  escalaInf: 278,
  rayaX: 130,
  rayaMenorX2: 138,
  rayaMayorX2: 145,
  numeroX: 149,
  grabadoX: 186,
  // La pastilla de lectura es un rotulo que flota sobre el chasis, a la
  // izquierda del tubo: por eso el dibujo entero cabe centrado y no
  // queda un canal vacio cuando todavia no hay lectura.
  pastillaX: 2,
  pastillaAncho: 68,
  flotadorSemi: 13,
  flotadorAlto: 22,
};

// Semiancho del tubo a una altura dada (el cono interpola linealmente).
function semiAncho(y) {
  const t = (y - G.tuboSup) / (G.tuboInf - G.tuboSup);
  return G.semiSup + (G.semiInf - G.semiSup) * t;
}

// Chasis: acrilico, conexion roscada superior y tuerca moleteada.
function piezasChasis() {
  const piezas = [
    nodoSvg('rect', {
      class: 'instrumento__conexion',
      x: G.cx - 17,
      y: 6,
      width: 34,
      height: 22,
      rx: 3,
    }),
    nodoSvg('rect', {
      class: 'instrumento__tuerca',
      x: G.cx - 23,
      y: G.cuerpoY2,
      width: 46,
      height: 24,
      rx: 4,
    }),
    nodoSvg('rect', {
      class: 'instrumento__cuerpo',
      x: G.cuerpoX,
      y: G.cuerpoY,
      width: G.cuerpoX2 - G.cuerpoX,
      height: G.cuerpoY2 - G.cuerpoY,
      rx: 12,
    }),
    lineaSvg('instrumento__banda', G.cuerpoX, G.bandaY, G.cuerpoX2, G.bandaY),
  ];
  for (const y of [12, 17, 22]) {
    piezas.push(lineaSvg('instrumento__rosca', G.cx - 15, y, G.cx + 15, y));
  }
  for (let i = 0; i < 5; i += 1) {
    const x = G.cx - 16 + i * 8;
    piezas.push(lineaSvg('instrumento__estria', x, G.cuerpoY2 + 5, x, G.cuerpoY2 + 19));
  }
  return piezas;
}

// Tubo conico, su cuello hacia la tuerca, el brillo de la pared y el
// vastago guia que atraviesa el flotador.
function piezasTubo() {
  const supIzq = G.cx - G.semiSup;
  const supDer = G.cx + G.semiSup;
  const infIzq = G.cx - G.semiInf;
  const infDer = G.cx + G.semiInf;
  const yA = G.tuboSup + 8;
  const yB = G.tuboInf - 8;
  return [
    nodoSvg('rect', {
      class: 'instrumento__cuello',
      x: G.cx - 11,
      y: G.tuboInf - 4,
      width: 22,
      height: G.cuerpoY2 - G.tuboInf + 4,
    }),
    nodoSvg('path', {
      class: 'instrumento__tubo',
      d: `M ${supIzq} ${G.tuboSup} L ${supDer} ${G.tuboSup} L ${infDer} ${G.tuboInf} L ${infIzq} ${G.tuboInf} Z`,
    }),
    poligonoSvg('instrumento__brillo', [
      [G.cx - semiAncho(yA) + 4, yA],
      [G.cx - semiAncho(yA) + 12, yA],
      [G.cx - semiAncho(yB) + 12, yB],
      [G.cx - semiAncho(yB) + 4, yB],
    ]),
    lineaSvg('instrumento__vastago', G.cx, G.tuboSup + 4, G.cx, G.tuboInf - 4),
  ];
}

// ---------------------------------------------------------------------
// Geometria del manometro (viewBox 200 x 212)
// ---------------------------------------------------------------------
// Caratula redonda de 0 al fondo de escala configurado, con el barrido
// de 270 grados de un manometro de Bourdon: la aguja arranca abajo a la
// izquierda (225 grados) y termina abajo a la derecha (-45).
const M = {
  ancho: 200,
  alto: 212,
  cx: 100,
  cy: 100,
  rBisel: 90,
  rCaratula: 80,
  rRayaBorde: 74, // de donde arrancan las rayas, hacia adentro
  rRayaMenor: 68,
  rRayaMayor: 62,
  rNumero: 51,
  rAguja: 66,
  rCola: 14,
  anguloInicio: 225,
  barrido: 270,
};

function puntoPolar(radio, grados) {
  const rad = (grados * Math.PI) / 180;
  return [M.cx + radio * Math.cos(rad), M.cy - radio * Math.sin(rad)];
}

// Angulo de la aguja para una fraccion 0..1 del fondo de escala.
function anguloManometro(fraccion) {
  return M.anguloInicio - M.barrido * fraccion;
}

// Fraccion 0..1 del fondo de escala para un punto de la caratula: es lo
// que convierte un toque en presion capturada. Devuelve null en el
// hueco de abajo (los 90 grados sin escala): ahi el toque no dice nada
// y saltar al tope seria capturar un numero que nadie pidio.
function fraccionDesdePunto(x, y) {
  let grados = (Math.atan2(M.cy - y, x - M.cx) * 180) / Math.PI;
  if (grados < -90) grados += 360;
  const barrido = M.anguloInicio - grados;
  if (barrido < 0 || barrido > M.barrido) return null;
  return barrido / M.barrido;
}

// Bisel, caratula y vastago de conexion: el chasis del manometro.
function piezasCaratula() {
  return [
    nodoSvg('rect', {
      class: 'instrumento__conexion',
      x: M.cx - 11,
      y: M.cy + M.rBisel - 6,
      width: 22,
      height: 22,
      rx: 3,
    }),
    nodoSvg('circle', { class: 'instrumento__bisel', cx: M.cx, cy: M.cy, r: M.rBisel }),
    nodoSvg('circle', { class: 'instrumento__caratula', cx: M.cx, cy: M.cy, r: M.rCaratula }),
  ];
}

// Paso de numeracion legible de la escala: el menor candidato que deja
// nueve etiquetas o menos (para la F-550 de 0.5 a 4.5 sale 0.5 SCFM).
// Es una decision de presentacion, no un valor de dominio.
function pasoLegible(amplitud) {
  const candidatos = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
  for (const paso of candidatos) {
    if (amplitud / paso <= 9) return paso;
  }
  return candidatos[candidatos.length - 1];
}

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const tractor = ctx.tractorActivo();
  const unidadMasa = unidad('masa', sistema);
  const decMasa = sistema === 'imperial' ? 2 : 1;

  let modo = borrador.modo ?? 'masa';
  let gEfectivoValor = null; // g/SCF confiable listo para calcular
  let gEfectivoAnulado = null;
  let lecturaTubo = null; // SCFM vigente del modo (capturada o despejada)
  let presionAguja = null; // psi vigente del modo (capturada o despejada)
  let ultimoCalculo = null; // datos planos listos para bitacora

  function alertaDestructiva(error) {
    return el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    );
  }

  // Valor inicial de un campo de masa: el borrador vive en gramos y se
  // muestra convertido al sistema vigente con redondeo legible.
  function precargaMasa(valorG) {
    if (valorG === null || valorG === undefined) return null;
    return redondeoLegible(aSistema('masa', valorG, sistema));
  }

  // ---------------- Modo ----------------
  const botonesModo = new Map();
  const filaModos = el('div', { clase: 'grupo-modo' });
  for (const def of MODOS) {
    const boton = el('button', { clase: 'boton boton--contorno', 'aria-pressed': 'false' }, def.etiqueta);
    boton.addEventListener('click', () => {
      modo = def.id;
      ctx.guardarBorrador(id, { modo });
      pintarModo();
      recalcular();
    });
    botonesModo.set(def.id, boton);
    filaModos.append(boton);
  }

  function pintarModo() {
    for (const [modoId, boton] of botonesModo) {
      // El resalte del modo elegido lo pinta components.css desde
      // `aria-pressed`: no se intercambian variantes de boton aqui.
      boton.setAttribute('aria-pressed', modoId === modo ? 'true' : 'false');
    }
    // Cada modo despeja una variable: su campo se oculta y los otros
    // tres se capturan.
    campoMasa.elemento.classList.toggle('oculto', modo === 'masa');
    campoScfm.elemento.classList.toggle('oculto', modo === 'lectura');
    campoPsi.elemento.classList.toggle('oculto', modo === 'presion');
    campoTiempo.elemento.classList.toggle('oculto', modo === 'tiempo');
    botonTiempoAvance.classList.toggle('oculto', modo === 'tiempo');
  }

  // ---------------- Campos (todos con borrador) ----------------
  const campoMasa = crearCampoNumerico({
    etiqueta: 'Masa de gas objetivo',
    unidad: unidadMasa,
    valorInicial: precargaMasa(borrador.masaObjetivoG ?? null),
    ayuda: 'La masa de etileno que se quiere inyectar en la corrida.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { masaObjetivoG: deSistema('masa', valor, sistema) });
      recalcular();
    },
  });

  const campoScfm = crearCampoNumerico({
    etiqueta: 'Lectura del flotador',
    unidad: 'SCFM',
    valorInicial: borrador.scfm ?? null,
    ayuda: 'La raya de la escala donde flota la bola, en pies cúbicos estándar por minuto.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { scfm: valor });
      recalcular();
    },
  });

  const campoPsi = crearCampoNumerico({
    etiqueta: 'Presión manométrica en el rotámetro',
    unidad: 'psi',
    valorInicial: borrador.psiManometrica ?? null,
    ayuda:
      'La presión del manómetro a la entrada del tubo. La escala está calibrada a la presión estándar: con el gas comprimido el flotador subestima el flujo real y la corrección lo compensa.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { psiManometrica: valor });
      recalcular();
    },
  });

  const campoTiempo = crearCampoNumerico({
    etiqueta: 'Tiempo de inyección',
    unidad: 's',
    valorInicial: borrador.tiempoS ?? null,
    ayuda: 'Tiempo con la válvula abierta. Para una tabla completa, tráelo de Avance con el botón de abajo.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { tiempoS: valor });
      recalcular();
    },
  });

  const botonTiempoAvance = el(
    'button',
    { clase: 'boton boton--contorno' },
    'Usar el tiempo por tabla de Avance'
  );
  botonTiempoAvance.addEventListener('click', traerTiempoDeAvance);

  function traerTiempoDeAvance() {
    const capturaAvance = ctx.borrador('avance');
    const p = ctx.estado().parametros;
    try {
      let resultadoAvance = null;
      let origen = '';
      if (capturaAvance.segundosPorTramo !== null && capturaAvance.segundosPorTramo !== undefined) {
        resultadoAvance = avanceDesdeReporte({
          segundosPorTramo: capturaAvance.segundosPorTramo,
          distanciaReferencia: p.geometria.distanciaReferencia,
          largoTabla: p.geometria.largoTabla,
        });
        origen = 'del reporte de campo';
      } else if (
        capturaAvance.marcha &&
        capturaAvance.rpm !== null &&
        capturaAvance.rpm !== undefined
      ) {
        const fila = marchasDeTractor(tractor).find(
          (f) => f.rango === capturaAvance.marcha.rango && f.marcha === capturaAvance.marcha.marcha
        );
        if (fila && fila.kmhNominal !== null) {
          const teorica = velocidadEfectiva({
            kmhNominal: fila.kmhNominal,
            rpm: capturaAvance.rpm,
            regimenNominal: tractor.regimenNominal,
          });
          const mediciones = ctx
            .estado()
            .factoresDesviacion.filter((m) => m.tractorId === tractor.id)
            .map((m) => ({ rpm: m.rpm, factor: m.factor }));
          const factor = factorDesviacion({ mediciones, rpm: capturaAvance.rpm });
          const corregida = velocidadCorregida({
            velocidadTeoricaKmh: teorica,
            factor: factor.factor,
            umbralDesviacionPct: p.umbrales.umbralDesviacionVelocidad,
          });
          const velocidadKmh = corregida.valores.velocidadCorregidaKmh ?? teorica;
          resultadoAvance = avance({
            velocidadKmh,
            distanciaReferencia: p.geometria.distanciaReferencia,
            largoTabla: p.geometria.largoTabla,
          });
          origen =
            corregida.valores.velocidadCorregidaKmh !== null
              ? `de la marcha ${fila.etiqueta} con factor medido`
              : `de la marcha ${fila.etiqueta} (teórica sin verificar)`;
        }
      }
      if (!resultadoAvance) {
        mostrarToast(
          'No hay datos utilizables en Avance: captura ahí los segundos por tramo o una marcha con régimen.',
          { tipo: 'destructivo' }
        );
        return;
      }
      const tiempo = Math.round(resultadoAvance.valores.tiempoTotalS * 10) / 10;
      campoTiempo.fijar(tiempo);
      ctx.guardarBorrador(id, { tiempoS: tiempo });
      recalcular();
      mostrarToast(`Tiempo por tabla traído ${origen}: ${formatearTiempo(tiempo)}.`);
    } catch (error) {
      mostrarToast(String(error?.message ?? error), { tipo: 'destructivo' });
    }
  }

  function lecturas() {
    return {
      masaObjetivoG: deSistema('masa', campoMasa.obtener(), sistema),
      scfm: campoScfm.obtener(),
      psiManometrica: campoPsi.obtener(),
      tiempoS: campoTiempo.obtener(),
    };
  }

  // ---------------- Captura desde el instrumento ----------------
  // Los dos numeros que se leen en campo —SCFM del flujometro y psi del
  // manometro— se capturan tocando el dibujo o con los botones mas y
  // menos, sin teclado y con guantes. El campo de texto sigue siendo el
  // mismo: aqui solo se escribe en el, se guarda el borrador y se
  // recalcula, igual que si la persona lo hubiera tecleado.

  // Decimales que exige un escalon (0.1 -> 1, 1 -> 0, 0.25 -> 2).
  function decimalesDe(paso) {
    const texto = String(paso);
    const punto = texto.indexOf('.');
    return punto === -1 ? 0 : Math.min(texto.length - punto - 1, 3);
  }

  function ajustar(valor, paso, minimo, maximo) {
    const pegado = paso > 0 ? Math.round(valor / paso) * paso : valor;
    const acotado = Math.min(Math.max(pegado, minimo), maximo);
    return Number(acotado.toFixed(decimalesDe(paso)));
  }

  function fijarCaptura(campo, clave, valor) {
    campo.fijar(String(valor));
    ctx.guardarBorrador(id, { [clave]: valor });
    recalcular();
  }

  // Fila de captura: menos, cifra grande y mas. El escalon es la
  // resolucion legible del instrumento, no un numero inventado aqui.
  function filaPasos({ campo, clave, etiqueta, unidad, paso, minimo, maximo, arranque }) {
    const decimales = decimalesDe(paso);
    const cifra = el('span', { clase: 'captura__valor' }, '—');
    const unidadNodo = el('span', { clase: 'captura__unidad' }, unidad);
    const mover = (signo) => {
      const actual = campo.obtener();
      if (!Number.isFinite(actual)) {
        fijarCaptura(campo, clave, ajustar(arranque, paso, minimo, maximo));
        return;
      }
      // Con un valor ya fuera de escala (tecleado o traido de un
      // despeje), el escalon solo puede ACERCARLO al rango: un boton de
      // mas que baja el numero de golpe al tope se lee como un error.
      const piso = Math.min(minimo, actual);
      const techo = Math.max(maximo, actual);
      fijarCaptura(campo, clave, ajustar(actual + signo * paso, paso, piso, techo));
    };
    const menos = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        type: 'button',
        'aria-label': `Bajar ${etiqueta} un escalón de ${paso} ${unidad}`,
      },
      '−'
    );
    const mas = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        type: 'button',
        'aria-label': `Subir ${etiqueta} un escalón de ${paso} ${unidad}`,
      },
      '+'
    );
    menos.addEventListener('click', () => mover(-1));
    mas.addEventListener('click', () => mover(1));
    const raiz = el('div', { clase: 'captura' }, menos, cifra, unidadNodo, mas);
    return {
      elemento: raiz,
      refrescar(activo) {
        const actual = campo.obtener();
        cifra.textContent = Number.isFinite(actual) ? formatear(actual, decimales) : '—';
        menos.disabled = !activo;
        mas.disabled = !activo;
        raiz.classList.toggle('oculto', !activo);
      },
    };
  }

  // Toque sobre el dibujo: convierte la posicion en valor. El SVG se
  // escala con la tarjeta, asi que la conversion pasa por el ancho real
  // del nodo (el viewBox conserva la proporcion).
  function puntoEnSvg(svg, evento, anchoViewBox) {
    const caja = svg.getBoundingClientRect();
    if (!(caja.width > 0)) return null;
    const factor = anchoViewBox / caja.width;
    return { x: (evento.clientX - caja.left) * factor, y: (evento.clientY - caja.top) * factor };
  }

  // ---------------- Masa por pie cubico estandar (siempre visible) ----
  const zonaGscf = el('div', { estilo: COLUMNA });

  function pintarGscf() {
    const nodos = [];
    gEfectivoValor = null;
    gEfectivoAnulado = null;
    const gas = ctx.gasActivo();
    const p = ctx.estado().parametros;
    if (!gas) {
      nodos.push(
        el(
          'div',
          { clase: 'alerta alerta--destructiva', role: 'alert' },
          el(
            'p',
            { clase: 'alerta__descripcion' },
            'Sin gas configurado: agrégalo en Sistema, Configuración para poder calcular.'
          )
        )
      );
    } else {
      try {
        const efectivo = gPorScfEfectivo({ gas });
        gEfectivoAnulado = efectivo.valores.anulado;
        nodos.push(
          el(
            'div',
            { clase: 'fila-control' },
            efectivo.valores.anulado
              ? el('span', { clase: 'badge badge--advertencia' }, 'ANULADO manualmente')
              : el('span', { clase: 'badge badge--secundario' }, 'derivado del peso molecular'),
            el('span', {}, gas.nombre)
          )
        );
        nodos.push(...pintarAvisos(efectivo.avisos));
        if (!resultadoConfiable(efectivo)) {
          nodos.push(
            pintarResultadoNoVerificado('Masa por pie cúbico estándar'),
            pintarVerificacion(efectivo.verificacion)
          );
        } else {
          gEfectivoValor = efectivo.valores.gPorScf;
          nodos.push(
            pintarResultado({
              etiqueta: 'Masa por pie cúbico estándar',
              valor: efectivo.valores.gPorScf,
              unidad: 'g/SCF',
              decimales: 3,
              principal: true,
            }),
            pintarVerificacion(efectivo.verificacion),
            pintarDesglose(efectivo.desglose)
          );
        }
        nodos.push(
          el(
            'div',
            { estilo: GRID_2 },
            pintarResultado({
              etiqueta: 'Presión estándar de calibración',
              valor: gas.presionEstandarPsia,
              unidad: 'psia',
              decimales: 2,
            }),
            pintarResultado({
              etiqueta: 'Presión atmosférica local',
              valor: p.sitio.presionAtmosfericaLocal,
              unidad: 'psia',
              decimales: 2,
            })
          ),
          el(
            'p',
            { clase: 'ayuda' },
            'Son dos parámetros distintos: la estándar es la condición a la que el fabricante calibró la escala del tubo; la local es la presión absoluta del sitio. El despeje de presión resta la atmosférica LOCAL, no la estándar. Ambas se editan en Sistema, Configuración.'
          )
        );
      } catch (error) {
        nodos.push(alertaDestructiva(error));
      }
    }
    reemplazar(zonaGscf, nodos);
  }

  // ---------------- Resultado por modo ----------------
  const zonaResultado = el('div', { estilo: COLUMNA });

  function pintarCentral() {
    const nodos = [];
    ultimoCalculo = null;
    lecturaTubo = null;
    presionAguja = null;
    try {
      const gas = ctx.gasActivo();
      const p = ctx.estado().parametros;
      const { masaObjetivoG, scfm, psiManometrica, tiempoS } = lecturas();

      // Los instrumentos reflejan lo capturado en cuanto existe, aunque
      // el calculo del modo aun este incompleto. El modo que despeja la
      // variable no la toma de la captura: la pone su resultado.
      if (modo !== 'lectura' && Number.isFinite(scfm)) {
        lecturaTubo = scfm;
      }
      if (modo !== 'presion' && Number.isFinite(psiManometrica)) {
        presionAguja = psiManometrica;
      }

      if (!gas) {
        nodos.push(
          el('p', { clase: 'texto-suave' }, 'Sin gas configurado no hay nada que calcular.')
        );
      } else if (gEfectivoValor === null) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--destructiva', role: 'alert' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              'La masa por pie cúbico estándar no está disponible o no está verificada: revisa la tarjeta de arriba antes de calcular.'
            )
          )
        );
      } else {
        const rotametro = ctx.rotametroActivo();
        const base = {
          gPorScf: gEfectivoValor,
          presionAtmosfericaLocal: p.sitio.presionAtmosfericaLocal,
          presionEstandarCalibracion: gas.presionEstandarPsia,
        };
        const comunes = {
          modo,
          gasId: gas.id,
          gasNombre: gas.nombre,
          gPorScf: gEfectivoValor,
          gPorScfAnulado: gEfectivoAnulado,
          presionEstandarCalibracionPsia: gas.presionEstandarPsia,
          presionAtmosfericaLocalPsia: p.sitio.presionAtmosfericaLocal,
          rotametroId: rotametro?.id ?? null,
          rotametroModelo: rotametro?.modelo ?? null,
          escalaMinScfm: rotametro?.escalaMin ?? null,
          escalaMaxScfm: rotametro?.escalaMax ?? null,
        };

        if (modo === 'masa') {
          if (scfm === null || psiManometrica === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura lectura del flotador, presión manométrica y tiempo para calcular la masa inyectada.'
              )
            );
          } else {
            const resultado = masaGas({ scfm, psiManometrica, tiempoS, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Masa de gas inyectada'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Masa de gas inyectada',
                    valor: aSistema('masa', resultado.valores.masaG, sistema),
                    unidad: unidadMasa,
                    decimales: decMasa,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                scfm,
                psiManometrica,
                tiempoS,
                factor: resultado.valores.factor,
                masaG: resultado.valores.masaG,
              };
            }
          }
        } else if (modo === 'presion') {
          if (masaObjetivoG === null || scfm === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, lectura del flotador y tiempo para despejar la presión.'
              )
            );
          } else {
            const resultado = despejePresion({ masaObjetivoG, scfm, tiempoS, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Presión manométrica requerida'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              presionAguja = resultado.valores.psiManometrica;
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Presión manométrica requerida',
                    valor: resultado.valores.psiManometrica,
                    unidad: 'psi',
                    decimales: 2,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor requerido',
                    valor: resultado.valores.factorRequerido,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                scfm,
                tiempoS,
                factorRequerido: resultado.valores.factorRequerido,
                psiManometrica: resultado.valores.psiManometrica,
              };
            }
          }
        } else if (modo === 'tiempo') {
          if (masaObjetivoG === null || scfm === null || psiManometrica === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, lectura del flotador y presión manométrica para despejar el tiempo.'
              )
            );
          } else {
            const resultado = despejeTiempo({ masaObjetivoG, scfm, psiManometrica, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Tiempo requerido'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: `Tiempo requerido (${formatearTiempo(resultado.valores.tiempoS)})`,
                    valor: resultado.valores.tiempoS,
                    unidad: 's',
                    decimales: 0,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                scfm,
                psiManometrica,
                factor: resultado.valores.factor,
                tiempoS: resultado.valores.tiempoS,
              };
            }
          }
        } else if (modo === 'lectura') {
          if (masaObjetivoG === null || psiManometrica === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, presión manométrica y tiempo para despejar la lectura del flotador.'
              )
            );
          } else {
            const resultado = despejeScfm({
              masaObjetivoG,
              psiManometrica,
              tiempoS,
              ...base,
              rotametro: rotametro ?? null,
            });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Lectura de flotador requerida'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              lecturaTubo = resultado.valores.scfm;
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Lectura de flotador requerida',
                    valor: resultado.valores.scfm,
                    unidad: 'SCFM',
                    decimales: 2,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                psiManometrica,
                tiempoS,
                factor: resultado.valores.factor,
                scfm: resultado.valores.scfm,
              };
            }
          }
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaResultado, nodos);
  }

  // ---------------- Bitacora ----------------
  const botonBitacora = el('button', { clase: 'boton' }, 'Guardar en bitácora');
  botonBitacora.addEventListener('click', () => {
    if (!ultimoCalculo) {
      mostrarToast(
        'Completa el cálculo antes de guardar: faltan capturas o el resultado no está verificado.',
        { tipo: 'destructivo' }
      );
      return;
    }
    const c = ultimoCalculo;
    const etiquetaModo = MODOS.find((m) => m.id === c.modo)?.descripcion ?? c.modo;
    let resumen = '';
    if (c.modo === 'masa') {
      resumen =
        `${formatear(c.masaG, 1)} g inyectados con ${formatear(c.scfm, 2)} SCFM a ` +
        `${formatear(c.psiManometrica, 1)} psi durante ${formatearTiempo(c.tiempoS)}.`;
    } else if (c.modo === 'presion') {
      resumen =
        `Se requieren ${formatear(c.psiManometrica, 2)} psi manométricas para ${formatear(c.masaObjetivoG, 1)} g ` +
        `con ${formatear(c.scfm, 2)} SCFM en ${formatearTiempo(c.tiempoS)}.`;
    } else if (c.modo === 'tiempo') {
      resumen =
        `Se requieren ${formatearTiempo(c.tiempoS)} para ${formatear(c.masaObjetivoG, 1)} g ` +
        `con ${formatear(c.scfm, 2)} SCFM a ${formatear(c.psiManometrica, 1)} psi.`;
    } else {
      resumen =
        `Flotador en ${formatear(c.scfm, 2)} SCFM para ${formatear(c.masaObjetivoG, 1)} g ` +
        `a ${formatear(c.psiManometrica, 1)} psi en ${formatearTiempo(c.tiempoS)}.`;
    }
    const registroBase = {
      id: `gas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'gas',
      fecha: new Date().toISOString(),
      titulo: `Gas etileno: ${etiquetaModo}`,
      resumen,
      datos: { ...c },
    };
    ctx.almacen.actualizar((e) => {
      // El snapshot es COPIA de los parametros vigentes, no referencia:
      // el registro historico conserva los numeros con los que se calculo.
      e.bitacora.push({
        ...registroBase,
        parametros: JSON.parse(
          JSON.stringify({
            parametros: e.parametros,
            tractor: ctx.tractorActivo(),
            equipo: ctx.equipoActivo(),
          })
        ),
      });
    }, 'datos');
    mostrarToast('Cálculo de gas guardado en la bitácora.');
  });

  // ---------------- Tubo del rotametro en SVG ----------------
  const zonaTubo = el('div', { estilo: COLUMNA });

  function dibujarTubo() {
    const rotametro = ctx.rotametroActivo();
    const nodos = [];
    if (!rotametro) {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'Sin rotámetro configurado: agrégalo en Sistema, Configuración para ver el tubo.'
        )
      );
    } else {
      const min = rotametro.escalaMin;
      const max = rotametro.escalaMax;
      const amplitud = max - min;
      if (!(amplitud > 0)) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--destructiva', role: 'alert' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              'La escala del rotámetro configurado no es válida: el mínimo debe ser menor que el máximo.'
            )
          )
        );
      } else {
        const fueraDeEscala = lecturaTubo !== null && (lecturaTubo < min || lecturaTubo > max);
        const eps = amplitud * 1e-6;
        // La escala ocupa el tramo grabado del tubo, no el tubo entero.
        const yDe = (v) =>
          G.escalaInf - ((v - min) / amplitud) * (G.escalaInf - G.escalaSup);

        const etiquetaAria =
          lecturaTubo === null
            ? `Tubo del rotámetro ${rotametro.modelo}: sin lectura`
            : `Tubo del rotámetro ${rotametro.modelo}: flotador en ${formatear(lecturaTubo, 2)} SCFM` +
              (fueraDeEscala ? ', fuera de escala' : '');
        const svg = nodoSvg('svg', {
          class: 'instrumento',
          viewBox: `0 0 ${G.ancho} ${G.alto}`,
          role: 'img',
          'aria-label': etiquetaAria,
          'data-fuera': fueraDeEscala ? 'true' : 'false',
        });

        // Captura por toque: solo cuando la lectura se captura. En el
        // modo que la despeja, el tubo es un resultado y no se toca.
        const pasoTubo = rotametro.resolucion > 0 ? rotametro.resolucion : amplitud / 100;
        if (modo !== 'lectura') {
          svg.setAttribute('data-captura', 'true');
          svg.addEventListener('click', (evento) => {
            const punto = puntoEnSvg(svg, evento, G.ancho);
            if (!punto) return;
            const fraccion = (G.escalaInf - punto.y) / (G.escalaInf - G.escalaSup);
            fijarCaptura(campoScfm, 'scfm', ajustar(min + fraccion * amplitud, pasoTubo, min, max));
          });
        }

        svg.append(...piezasChasis(), ...piezasTubo());

        // Serigrafia del instrumento: modelo en el encabezado y
        // condicion de calibracion grabada al costado, como el real.
        const modeloCorto =
          rotametro.modelo.length > 18 ? `${rotametro.modelo.slice(0, 17)}…` : rotametro.modelo;
        svg.append(
          textoSvg(G.cuerpoX + 8, 44, modeloCorto, { clase: 'instrumento__grabado' }),
          textoSvg(G.cuerpoX2 - 8, 44, 'SCFM', { clase: 'instrumento__unidad', anclaje: 'end' })
        );
        const presionEstandar = ctx.gasActivo()?.presionEstandarPsia;
        if (Number.isFinite(presionEstandar)) {
          const yGrabado = (G.tuboSup + G.tuboInf) / 2;
          svg.append(
            textoSvg(
              G.grabadoX,
              yGrabado,
              `Calibrado a ${formatear(presionEstandar, 2, { fijos: false })} psia`,
              {
                clase: 'instrumento__grabado',
                anclaje: 'middle',
                giro: `rotate(-90 ${G.grabadoX} ${yGrabado})`,
              }
            )
          );
        }

        // Rayas menores: una por cada resolucion legible del instrumento.
        if (rotametro.resolucion > 0 && amplitud / rotametro.resolucion <= 400) {
          const nRayas = Math.round(amplitud / rotametro.resolucion);
          for (let i = 0; i <= nRayas; i += 1) {
            const v = min + i * rotametro.resolucion;
            if (v > max + eps) break;
            const y = yDe(v);
            svg.append(lineaSvg('instrumento__raya', G.rayaX, y, G.rayaMenorX2, y));
          }
        }

        // Rayas mayores con numero, a un paso legible de la escala.
        const paso = pasoLegible(amplitud);
        const kInicio = Math.ceil((min - eps) / paso);
        const kFin = Math.floor((max + eps) / paso);
        for (let k = kInicio; k <= kFin; k += 1) {
          const v = k * paso;
          const y = yDe(Math.min(Math.max(v, min), max));
          svg.append(
            lineaSvg('instrumento__rayamayor', G.rayaX, y, G.rayaMayorX2, y),
            textoSvg(G.numeroX, y + 4, formatear(v, 2, { fijos: false }))
          );
        }

        // Flotador: en la lectura vigente; fuera de escala se fija al
        // extremo en ambar de advertencia y el numero mostrado es el
        // REAL, nunca el recortado. El borde superior del flotador es la
        // linea de lectura, como en el instrumento (se lee al diametro
        // mayor), y de ahi salen la guia y la pastilla con la cifra.
        if (lecturaTubo !== null) {
          const lecturaDibujo = Math.min(Math.max(lecturaTubo, min), max);
          const y = yDe(lecturaDibujo);
          const semi = G.flotadorSemi;
          const anchoColumna = semiAncho(y) - 2;
          const anchoFondo = semiAncho(G.tuboInf) - 2;
          svg.append(
            poligonoSvg('instrumento__columna', [
              [G.cx - anchoColumna, y],
              [G.cx + anchoColumna, y],
              [G.cx + anchoFondo, G.tuboInf - 1],
              [G.cx - anchoFondo, G.tuboInf - 1],
            ]),
            poligonoSvg('instrumento__flotador', [
              [G.cx - semi, y],
              [G.cx + semi, y],
              [G.cx + semi, y + 8],
              [G.cx + 6, y + G.flotadorAlto],
              [G.cx - 6, y + G.flotadorAlto],
              [G.cx - semi, y + 8],
            ]),
            lineaSvg('instrumento__guia', G.cx + semi + 2, y, G.rayaX - 2, y),
            lineaSvg('instrumento__guia', G.pastillaX + G.pastillaAncho, y, G.cx - semi - 2, y),
            nodoSvg('rect', {
              class: 'instrumento__pastilla',
              x: G.pastillaX,
              y: y - 11,
              width: G.pastillaAncho,
              height: 22,
              rx: 7,
            }),
            textoSvg(G.pastillaX + G.pastillaAncho / 2, y + 4, `${formatear(lecturaTubo, 2)} SCFM`, {
              clase: 'instrumento__lectura',
              anclaje: 'middle',
            })
          );
        }
        nodos.push(svg);

        if (modo === 'lectura') {
          if (lecturaTubo === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Sin lectura despejada todavía: completa las capturas del modo para posicionar el flotador.'
              )
            );
          }
        } else {
          nodos.push(
            el(
              'p',
              { clase: 'texto-suave' },
              'Toca el tubo donde flota la bola, o usa los botones, para capturar la lectura.'
            )
          );
        }
        if (fueraDeEscala) {
          nodos.push(
            el(
              'div',
              { clase: 'alerta alerta--advertencia', role: 'alert' },
              el(
                'p',
                { clase: 'alerta__descripcion' },
                `La lectura real (${formatear(lecturaTubo, 2)} SCFM) queda fuera de la escala del tubo ` +
                  `(${formatear(min, 2, { fijos: false })} a ${formatear(max, 2, { fijos: false })} SCFM): ` +
                  'el flotador se dibuja fijado al extremo y el número mostrado es el calculado, sin recorte.'
              )
            )
          );
        }
        nodos.push(
          el(
            'p',
            { clase: 'ayuda' },
            `${rotametro.modelo}: escala de ${formatear(min, 2, { fijos: false })} a ` +
              `${formatear(max, 2, { fijos: false })} SCFM, rayas cada ` +
              `${formatear(rotametro.resolucion, 2, { fijos: false })} SCFM. Se edita en Sistema, Configuración.`
          )
        );
      }
    }
    reemplazar(zonaTubo, nodos);
  }

  // ---------------- Manometro en SVG ----------------
  // El fondo de escala y la resolucion de la caratula son parametros
  // (Sistema, Configuracion), igual que la escala del rotametro: aqui no
  // se inventa ningun numero de dominio.
  const cfgManometro = ctx.estado().parametros.manometro ?? {
    escalaMaxPsi: valorDefault('manometro', 'escalaMaxPsi'),
    resolucionPsi: valorDefault('manometro', 'resolucionPsi'),
  };
  const zonaManometro = el('div', { estilo: COLUMNA });

  function dibujarManometro() {
    const maxPsi = cfgManometro.escalaMaxPsi;
    const resPsi = cfgManometro.resolucionPsi;
    const nodos = [];
    if (!(maxPsi > 0)) {
      nodos.push(
        el(
          'div',
          { clase: 'alerta alerta--destructiva', role: 'alert' },
          el(
            'p',
            { clase: 'alerta__descripcion' },
            'El fondo de escala del manómetro no es válido: debe ser mayor que cero.'
          )
        )
      );
      reemplazar(zonaManometro, nodos);
      return;
    }

    const fueraDeEscala = presionAguja !== null && (presionAguja < 0 || presionAguja > maxPsi);
    const eps = maxPsi * 1e-6;
    const etiquetaAria =
      presionAguja === null
        ? `Manómetro de 0 a ${formatear(maxPsi, 2, { fijos: false })} psi: sin lectura`
        : `Manómetro: aguja en ${formatear(presionAguja, 1)} psi` +
          (fueraDeEscala ? ', fuera de escala' : '');
    const svg = nodoSvg('svg', {
      class: 'instrumento',
      viewBox: `0 0 ${M.ancho} ${M.alto}`,
      role: 'img',
      'aria-label': etiquetaAria,
      'data-fuera': fueraDeEscala ? 'true' : 'false',
    });

    // Captura por toque, salvo en el modo que despeja la presion.
    if (modo !== 'presion') {
      svg.setAttribute('data-captura', 'true');
      svg.addEventListener('click', (evento) => {
        const punto = puntoEnSvg(svg, evento, M.ancho);
        if (!punto) return;
        if (Math.hypot(punto.x - M.cx, punto.y - M.cy) < 18) return; // el eje no dice angulo
        const fraccion = fraccionDesdePunto(punto.x, punto.y);
        if (fraccion === null) return;
        fijarCaptura(campoPsi, 'psiManometrica', ajustar(fraccion * maxPsi, resPsi, 0, maxPsi));
      });
    }

    svg.append(...piezasCaratula());

    // Rayas menores por resolucion legible y mayores numeradas.
    if (resPsi > 0 && maxPsi / resPsi <= 300) {
      const nRayas = Math.round(maxPsi / resPsi);
      for (let i = 0; i <= nRayas; i += 1) {
        const v = i * resPsi;
        if (v > maxPsi + eps) break;
        const grados = anguloManometro(v / maxPsi);
        const [x1, y1] = puntoPolar(M.rRayaBorde, grados);
        const [x2, y2] = puntoPolar(M.rRayaMenor, grados);
        svg.append(lineaSvg('instrumento__raya', x1, y1, x2, y2));
      }
    }
    const paso = pasoLegible(maxPsi);
    for (let k = 0; k * paso <= maxPsi + eps; k += 1) {
      const v = k * paso;
      const grados = anguloManometro(v / maxPsi);
      const [x1, y1] = puntoPolar(M.rRayaBorde, grados);
      const [x2, y2] = puntoPolar(M.rRayaMayor, grados);
      const [xn, yn] = puntoPolar(M.rNumero, grados);
      svg.append(
        lineaSvg('instrumento__rayamayor', x1, y1, x2, y2),
        textoSvg(xn, yn + 4, formatear(v, 2, { fijos: false }), { anclaje: 'middle' })
      );
    }
    // La unidad va donde iria la pastilla de lectura: si hay aguja, la
    // cifra ya la trae, y un rotulo fijo en medio de la caratula queda
    // tarde o temprano debajo de la aguja.
    if (presionAguja === null) {
      svg.append(
        textoSvg(M.cx, M.cy + 60, 'psi', { clase: 'instrumento__unidad', anclaje: 'middle' })
      );
    }

    // Aguja: fuera de escala se fija al tope en ambar y la cifra sigue
    // siendo la real, igual que el flotador del tubo.
    if (presionAguja !== null) {
      const fraccion = Math.min(Math.max(presionAguja / maxPsi, 0), 1);
      const grados = anguloManometro(fraccion);
      const rad = (grados * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = -Math.sin(rad);
      const ancho = 4;
      svg.append(
        poligonoSvg('instrumento__aguja', [
          [M.cx + dx * M.rAguja, M.cy + dy * M.rAguja],
          [M.cx - dy * ancho, M.cy + dx * ancho],
          [M.cx - dx * M.rCola, M.cy - dy * M.rCola],
          [M.cx + dy * ancho, M.cy - dx * ancho],
        ]),
        nodoSvg('circle', { class: 'instrumento__eje', cx: M.cx, cy: M.cy, r: 7 }),
        nodoSvg('rect', {
          class: 'instrumento__pastilla',
          x: M.cx - 34,
          y: M.cy + 45,
          width: 68,
          height: 22,
          rx: 7,
        }),
        textoSvg(M.cx, M.cy + 60, `${formatear(presionAguja, 1)} psi`, {
          clase: 'instrumento__lectura',
          anclaje: 'middle',
        })
      );
    } else {
      svg.append(nodoSvg('circle', { class: 'instrumento__eje', cx: M.cx, cy: M.cy, r: 7 }));
    }
    nodos.push(svg);

    if (modo === 'presion') {
      if (presionAguja === null) {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Sin presión despejada todavía: completa las capturas del modo para mover la aguja.'
          )
        );
      }
    } else {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'Toca la carátula donde marca la aguja, o usa los botones, para capturar la presión.'
        )
      );
    }
    if (fueraDeEscala) {
      nodos.push(
        el(
          'div',
          { clase: 'alerta alerta--advertencia', role: 'alert' },
          el(
            'p',
            { clase: 'alerta__descripcion' },
            `La presión real (${formatear(presionAguja, 2)} psi) queda fuera de la carátula ` +
              `(0 a ${formatear(maxPsi, 2, { fijos: false })} psi): la aguja se dibuja fijada al ` +
              'tope y el número mostrado es el calculado, sin recorte.'
          )
        )
      );
    }
    nodos.push(
      el(
        'p',
        { clase: 'ayuda' },
        `Carátula de 0 a ${formatear(maxPsi, 2, { fijos: false })} psi, rayas cada ` +
          `${formatear(resPsi, 2, { fijos: false })} psi. Se edita en Sistema, Configuración.`
      )
    );
    reemplazar(zonaManometro, nodos);
  }

  // ---------------- Filas de captura rapida ----------------
  const rotametroMontaje = ctx.rotametroActivo();
  const pasosScfm = filaPasos({
    campo: campoScfm,
    clave: 'scfm',
    etiqueta: 'la lectura del flotador',
    unidad: 'SCFM',
    paso: rotametroMontaje?.resolucion > 0 ? rotametroMontaje.resolucion : 0.1,
    minimo: rotametroMontaje?.escalaMin ?? 0,
    maximo: rotametroMontaje?.escalaMax ?? Number.MAX_SAFE_INTEGER,
    arranque: rotametroMontaje?.escalaMin ?? 0,
  });
  const pasosPsi = filaPasos({
    campo: campoPsi,
    clave: 'psiManometrica',
    etiqueta: 'la presión manométrica',
    unidad: 'psi',
    paso: cfgManometro.resolucionPsi,
    minimo: 0,
    maximo: cfgManometro.escalaMaxPsi,
    arranque: 0,
  });

  function recalcular() {
    pintarGscf();
    pintarCentral();
    dibujarTubo();
    dibujarManometro();
    pasosScfm.refrescar(modo !== 'lectura');
    pasosPsi.refrescar(modo !== 'presion');
  }

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Gas etileno',
        descripcion:
          'Los cuatro modos del rotámetro: mide el consumo o despeja la presión, el tiempo o la lectura que logran la masa objetivo.',
      },
      filaModos,
      el(
        'div',
        { estilo: COLUMNA },
        campoMasa.elemento,
        campoScfm.elemento,
        campoPsi.elemento,
        campoTiempo.elemento,
        botonTiempoAvance
      )
    ),
    // Los dos instrumentos van ANTES del resultado: son la superficie de
    // captura de los dos numeros que se leen en campo, no una ilustracion
    // al final de la pantalla.
    tarjeta(
      {
        titulo: 'Tubo del rotámetro',
        descripcion:
          'La escala configurada, con el flotador en la lectura vigente del modo. Es también donde se captura la lectura.',
      },
      zonaTubo,
      pasosScfm.elemento
    ),
    tarjeta(
      {
        titulo: 'Manómetro',
        descripcion:
          'La carátula a la entrada del tubo, con la aguja en la presión vigente del modo. Es también donde se captura la presión.',
      },
      zonaManometro,
      pasosPsi.elemento
    ),
    tarjeta(
      {
        titulo: 'Masa por pie cúbico estándar',
        descripcion: 'El valor efectivo del gas activo que usan todos los modos.',
      },
      zonaGscf
    ),
    tarjeta({ titulo: 'Resultado' }, zonaResultado, botonBitacora)
  );

  pintarModo();
  recalcular();
}
