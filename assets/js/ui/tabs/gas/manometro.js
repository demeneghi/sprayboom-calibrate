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
//   alCapturar(valor) toque o giro sobre la caratula, ya pegado al
//                     escalon; se llama al SOLTAR, no en cada paso
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
  const etiquetaDe = (valor) =>
    valor === null
      ? `Manómetro de 0 a ${formatear(maxPsi, 2, { fijos: false })} psi: sin lectura`
      : `Manómetro: aguja en ${formatear(valor, 1)} psi` +
        (valor < 0 || valor > maxPsi ? ', fuera de escala' : '');
  const svg = nodoSvg('svg', {
    class: 'instrumento',
    viewBox: `0 0 ${M.ancho} ${M.alto}`,
    role: 'img',
    'aria-label': etiquetaDe(presion),
    'data-fuera': fueraDeEscala ? 'true' : 'false',
  });

  // Punto de la caratula -> presion, ya pegada al escalon. Devuelve null
  // donde el toque no dice angulo: el eje y el hueco de abajo.
  const valorEn = (punto) => {
    if (Math.hypot(punto.x - M.cx, punto.y - M.cy) < 18) return null;
    const fraccion = fraccionDesdePunto(punto.x, punto.y);
    if (fraccion === null) return null;
    return ajustar(fraccion * maxPsi, resPsi, 0, maxPsi);
  };

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
  // Aguja: fuera de escala se fija al tope en ambar y la cifra sigue
  // siendo la real, igual que el flotador del tubo.
  //
  // Va en un grupo aparte porque durante el giro se vuelve a pintar SOLO
  // ella, decenas de veces por segundo: rehacer la pestana en cada paso
  // del dedo destruiria el propio SVG que esta recibiendo el gesto.
  const capaAguja = nodoSvg('g', { class: 'instrumento__movil' });
  svg.append(capaAguja);

  function pintarAguja(valor) {
    capaAguja.replaceChildren();
    const fuera = valor !== null && (valor < 0 || valor > maxPsi);
    svg.setAttribute('data-fuera', fuera ? 'true' : 'false');
    svg.setAttribute('aria-label', etiquetaDe(valor));
    // La unidad va donde iria la pastilla de lectura: si hay aguja, la
    // cifra ya la trae, y un rotulo fijo en medio de la caratula queda
    // tarde o temprano debajo de la aguja.
    if (valor === null) {
      capaAguja.append(
        textoSvg(M.cx, M.cy + 60, 'psi', { clase: 'instrumento__unidad', anclaje: 'middle' }),
        nodoSvg('circle', { class: 'instrumento__eje', cx: M.cx, cy: M.cy, r: 7 })
      );
      return;
    }
    const fraccion = Math.min(Math.max(valor / maxPsi, 0), 1);
    const grados = anguloManometro(fraccion);
    const rad = (grados * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = -Math.sin(rad);
    const ancho = 4;
    capaAguja.append(
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
      textoSvg(M.cx, M.cy + 60, `${formatear(valor, 1)} psi`, {
        clase: 'instrumento__lectura',
        anclaje: 'middle',
      })
    );
  }
  pintarAguja(presion);

  // Captura por gesto, salvo en el modo que despeja la presion.
  //
  // La aguja se gira, no solo se pica: con guantes y el telefono a la
  // distancia del brazo, acertarle de un toque a la raya de la caratula
  // es justo lo que no se puede hacer en el lote. El tap sigue vivo: es
  // el mismo gesto con recorrido cero.
  if (capturable) {
    svg.setAttribute('data-captura', 'true');
    // El agarre es la caratula entera, transparente y como ultimo hijo
    // para que sea SIEMPRE el destino del toque. El bisel y las esquinas
    // quedan fuera: ahi el dedo tiene que poder desplazar la pagina.
    const agarre = nodoSvg('circle', {
      class: 'instrumento__agarre',
      cx: M.cx,
      cy: M.cy,
      r: M.rCaratula,
    });
    svg.append(agarre);

    let puntero = null; // id del dedo que trae el gesto, o null
    let valorGesto = null;

    const seguir = (evento) => {
      const punto = puntoEnSvg(svg, evento, M.ancho);
      if (!punto) return;
      // Sobre el eje o cruzando el hueco de abajo el punto no dice
      // angulo: la aguja se queda donde iba en vez de saltar al tope.
      const valor = valorEn(punto);
      if (valor === null) return;
      valorGesto = valor;
      pintarAguja(valorGesto);
    };

    agarre.addEventListener('pointerdown', (evento) => {
      if (puntero !== null) return; // un segundo dedo no manda
      const punto = puntoEnSvg(svg, evento, M.ancho);
      if (!punto || valorEn(punto) === null) return;
      puntero = evento.pointerId;
      // Con el puntero capturado el giro sobrevive aunque el dedo se
      // salga de la caratula, y de hecho conviene: mientras mas lejos
      // del eje, mas fino queda el angulo.
      if (svg.setPointerCapture) svg.setPointerCapture(evento.pointerId);
      seguir(evento);
    });

    svg.addEventListener('pointermove', (evento) => {
      if (evento.pointerId !== puntero) return;
      seguir(evento);
    });

    // iOS Safari no respeta `touch-action` declarado sobre un hijo del
    // SVG: sin este preventDefault, el giro se lo lleva el scroll de la
    // pagina y la aguja no se mueve. Va no pasivo a proposito.
    svg.addEventListener(
      'touchmove',
      (evento) => {
        if (puntero !== null) evento.preventDefault();
      },
      { passive: false }
    );

    const soltar = (evento) => {
      if (evento.pointerId !== puntero) return;
      puntero = null;
      // El valor se entrega UNA vez, al soltar: durante el gesto la
      // pastilla ya iba mostrando a donde va, y recalcular en cada paso
      // volveria a montar la pestana bajo el dedo.
      if (valorGesto !== null) alCapturar(valorGesto);
    };
    svg.addEventListener('pointerup', soltar);
    svg.addEventListener('pointercancel', soltar);

    // Toque fuera de la caratula (bisel, vastago): sigue capturando de un
    // tap, como antes. El de adentro ya lo resolvio el gesto, asi que
    // aqui se ignora para no capturar dos veces.
    svg.addEventListener('click', (evento) => {
      if (evento.target === agarre) return;
      const punto = puntoEnSvg(svg, evento, M.ancho);
      if (!punto) return;
      const valor = valorEn(punto);
      if (valor !== null) alCapturar(valor);
    });
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
        'Gira la aguja hasta donde marca el manómetro —o toca ahí de una vez—, o usa los botones, para capturar la presión.'
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
