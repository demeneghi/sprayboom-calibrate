// Tubo del rotametro dibujado en SVG, y superficie de captura de la
// lectura del flotador.
//
// Se dibuja como el aparato real: bloque de acrilico con su conexion
// roscada arriba y su tuerca abajo, tubo conico (mas ancho arriba) y la
// escala grabada a la derecha del tubo. La escala NO llega a los
// extremos del tubo, igual que en el instrumento: asi el flotador cabe
// entero cuando marca el minimo, y el canal de la izquierda queda libre
// para la pastilla de lectura.
//
// El modulo no conoce el estado de la pestana: recibe lo que tiene que
// dibujar y devuelve los nodos. Quien lo llama decide donde ponerlos y
// que hacer con la captura.

import { el } from '../../dom.js';
import { nodoSvg, textoSvg, lineaSvg, poligonoSvg, puntoEnSvg } from '../../svg.js';
import { formatear } from '../../formato.js';
import { pasoLegible, ajustar } from './escala.js';

// ---------------------------------------------------------------------
// Geometria del rotametro (viewBox 200 x 360)
// ---------------------------------------------------------------------
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

// Nodos del tubo para el estado dado.
//
//   rotametro            el activo de Configuracion, o null
//   lectura              SCFM vigente del modo (capturada o despejada)
//   capturable           false en el modo que DESPEJA la lectura: ahi el
//                        tubo es un resultado y no se toca
//   presionEstandarPsia  para el grabado lateral de calibracion
//   alCapturar(valor)    toque sobre el tubo, ya pegado al escalon
export function nodosTubo({
  rotametro,
  lectura,
  capturable,
  presionEstandarPsia,
  alCapturar,
}) {
  const nodos = [];
  if (!rotametro) {
    nodos.push(
      el(
        'p',
        { clase: 'texto-suave' },
        'Sin rotámetro configurado: agrégalo en Sistema, Configuración para ver el tubo.'
      )
    );
    return nodos;
  }

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
    return nodos;
  }

  const fueraDeEscala = lectura !== null && (lectura < min || lectura > max);
  const eps = amplitud * 1e-6;
  // La escala ocupa el tramo grabado del tubo, no el tubo entero.
  const yDe = (v) => G.escalaInf - ((v - min) / amplitud) * (G.escalaInf - G.escalaSup);

  const etiquetaAria =
    lectura === null
      ? `Tubo del rotámetro ${rotametro.modelo}: sin lectura`
      : `Tubo del rotámetro ${rotametro.modelo}: flotador en ${formatear(lectura, 2)} SCFM` +
        (fueraDeEscala ? ', fuera de escala' : '');
  const svg = nodoSvg('svg', {
    class: 'instrumento',
    viewBox: `0 0 ${G.ancho} ${G.alto}`,
    role: 'img',
    'aria-label': etiquetaAria,
    'data-fuera': fueraDeEscala ? 'true' : 'false',
  });

  // Captura por toque: solo cuando la lectura se captura.
  const pasoTubo = rotametro.resolucion > 0 ? rotametro.resolucion : amplitud / 100;
  if (capturable) {
    svg.setAttribute('data-captura', 'true');
    svg.addEventListener('click', (evento) => {
      const punto = puntoEnSvg(svg, evento, G.ancho);
      if (!punto) return;
      const fraccion = (G.escalaInf - punto.y) / (G.escalaInf - G.escalaSup);
      alCapturar(ajustar(min + fraccion * amplitud, pasoTubo, min, max));
    });
  }

  svg.append(...piezasChasis(), ...piezasTubo());

  // Serigrafia del instrumento: modelo en el encabezado y condicion de
  // calibracion grabada al costado, como el real.
  const modeloCorto =
    rotametro.modelo.length > 18 ? `${rotametro.modelo.slice(0, 17)}…` : rotametro.modelo;
  svg.append(
    textoSvg(G.cuerpoX + 8, 44, modeloCorto, { clase: 'instrumento__grabado' }),
    textoSvg(G.cuerpoX2 - 8, 44, 'SCFM', { clase: 'instrumento__unidad', anclaje: 'end' })
  );
  if (Number.isFinite(presionEstandarPsia)) {
    const yGrabado = (G.tuboSup + G.tuboInf) / 2;
    svg.append(
      textoSvg(
        G.grabadoX,
        yGrabado,
        `Calibrado a ${formatear(presionEstandarPsia, 2, { fijos: false })} psia`,
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

  // Flotador: en la lectura vigente; fuera de escala se fija al extremo
  // en ambar de advertencia y el numero mostrado es el REAL, nunca el
  // recortado. El borde superior del flotador es la linea de lectura,
  // como en el instrumento (se lee al diametro mayor), y de ahi salen la
  // guia y la pastilla con la cifra.
  if (lectura !== null) {
    const lecturaDibujo = Math.min(Math.max(lectura, min), max);
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
      textoSvg(G.pastillaX + G.pastillaAncho / 2, y + 4, `${formatear(lectura, 2)} SCFM`, {
        clase: 'instrumento__lectura',
        anclaje: 'middle',
      })
    );
  }
  nodos.push(svg);

  if (!capturable) {
    if (lectura === null) {
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
          `La lectura real (${formatear(lectura, 2)} SCFM) queda fuera de la escala del tubo ` +
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
  return nodos;
}
