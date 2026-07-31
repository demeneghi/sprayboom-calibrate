// Manometro de la entrada dibujado en SVG, y superficie de captura de
// la presion.
//
// Caratula redonda de 0 al fondo de escala configurado, con el barrido
// de 270 grados de un manometro de Bourdon: la aguja arranca abajo a la
// izquierda (225 grados) y termina abajo a la derecha (-45). El fondo de
// escala y la resolucion son parametros (Sistema, Configuracion): aqui
// no se inventa ningun numero de dominio.
//
// Como el tubo, el modulo no conoce el estado de la pestana: recibe lo
// que tiene que dibujar y devuelve los nodos.

import { el } from '../../dom.js';
import { nodoSvg, textoSvg, lineaSvg, poligonoSvg, puntoEnSvg } from '../../svg.js';
import { formatear } from '../../formato.js';
import { pasoLegible, ajustar } from './escala.js';

// ---------------------------------------------------------------------
// Geometria del manometro (viewBox 200 x 212)
// ---------------------------------------------------------------------
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

// Nodos del manometro para el estado dado.
//
//   maxPsi            fondo de escala configurado
//   resPsi            resolucion legible de la caratula
//   presion           psi vigente del modo (capturada o despejada)
//   capturable        false en el modo que DESPEJA la presion
//   alCapturar(valor) toque sobre la caratula, ya pegado al escalon
export function nodosManometro({ maxPsi, resPsi, presion, capturable, alCapturar }) {
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
    return nodos;
  }

  const fueraDeEscala = presion !== null && (presion < 0 || presion > maxPsi);
  const eps = maxPsi * 1e-6;
  const etiquetaAria =
    presion === null
      ? `Manómetro de 0 a ${formatear(maxPsi, 2, { fijos: false })} psi: sin lectura`
      : `Manómetro: aguja en ${formatear(presion, 1)} psi` +
        (fueraDeEscala ? ', fuera de escala' : '');
  const svg = nodoSvg('svg', {
    class: 'instrumento',
    viewBox: `0 0 ${M.ancho} ${M.alto}`,
    role: 'img',
    'aria-label': etiquetaAria,
    'data-fuera': fueraDeEscala ? 'true' : 'false',
  });

  // Captura por toque, salvo en el modo que despeja la presion.
  if (capturable) {
    svg.setAttribute('data-captura', 'true');
    svg.addEventListener('click', (evento) => {
      const punto = puntoEnSvg(svg, evento, M.ancho);
      if (!punto) return;
      if (Math.hypot(punto.x - M.cx, punto.y - M.cy) < 18) return; // el eje no dice angulo
      const fraccion = fraccionDesdePunto(punto.x, punto.y);
      if (fraccion === null) return;
      alCapturar(ajustar(fraccion * maxPsi, resPsi, 0, maxPsi));
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
  if (presion === null) {
    svg.append(
      textoSvg(M.cx, M.cy + 60, 'psi', { clase: 'instrumento__unidad', anclaje: 'middle' })
    );
  }

  // Aguja: fuera de escala se fija al tope en ambar y la cifra sigue
  // siendo la real, igual que el flotador del tubo.
  if (presion !== null) {
    const fraccion = Math.min(Math.max(presion / maxPsi, 0), 1);
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
      textoSvg(M.cx, M.cy + 60, `${formatear(presion, 1)} psi`, {
        clase: 'instrumento__lectura',
        anclaje: 'middle',
      })
    );
  } else {
    svg.append(nodoSvg('circle', { class: 'instrumento__eje', cx: M.cx, cy: M.cy, r: 7 }));
  }
  nodos.push(svg);

  if (!capturable) {
    if (presion === null) {
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
          `La presión real (${formatear(presion, 2)} psi) queda fuera de la carátula ` +
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
  return nodos;
}
