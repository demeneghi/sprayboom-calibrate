// Como se LOGRA un tiempo por tabla: a que velocidad hay que ir y con
// que marchas se consigue.
//
// Es el sentido inverso del campo de velocidad heredado (ui/dato.js).
// Cuando el rotametro despeja el TIEMPO DE INYECCION —los segundos que
// hay que tener abierta la valvula para soltar la masa objetivo—, ese
// numero solo se cumple si la barra cruza la tabla en ese mismo rato.
// Sin este bloque el tiempo requerido quedaba en pantalla sin decir como
// lograrlo, y quien calibra tenia que ir a Avance a tantear marchas
// hasta que el tiempo por tabla cuadrara.
//
// Se usa en Gas etileno (modo «tiempo requerido») y en Forzamiento
// (despeje «tiempo de inyeccion requerido»), que son las dos pantallas
// que producen ese numero.

import { el } from './dom.js';
import { pintarResultado, pintarDesglose } from './render.js';
import { formatear } from './formato.js';
import { aSistema, unidad } from '../domain/units.js';
import { velocidadParaTiempoPorTabla, marchasParaVelocidad } from '../domain/speed.js';

const GRID_2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };

// Nodos del bloque, listos para colgar bajo el resultado que despejo el
// tiempo. Nunca lanza: una geometria invalida o un tiempo imposible
// devuelven la lista vacia, porque esto acompana a un resultado y no
// puede tumbar la pantalla que lo muestra.
export function nodosAvanceParaTiempo({ ctx, sistema, tiempoTotalS }) {
  if (!Number.isFinite(tiempoTotalS) || tiempoTotalS <= 0) return [];
  let derivado;
  let tractor;
  try {
    const g = ctx.estado().parametros.geometria;
    tractor = ctx.tractorActivo();
    derivado = velocidadParaTiempoPorTabla({
      tiempoTotalS,
      largoTabla: g.largoTabla,
      distanciaReferencia: g.distanciaReferencia,
    });
  } catch {
    return [];
  }

  const unidadVelocidad = unidad('velocidad', sistema);
  const distanciaReferencia = ctx.estado().parametros.geometria.distanciaReferencia;
  const tramoTexto = `${formatear(aSistema('distancia', distanciaReferencia, sistema), 0)} ${unidad('distancia', sistema)}`;

  const nodos = [
    el('h3', { clase: 'etiqueta' }, 'Cómo se logra ese tiempo'),
    el(
      'div',
      { estilo: GRID_2 },
      pintarResultado({
        etiqueta: 'Velocidad de avance',
        valor: aSistema('velocidad', derivado.valores.velocidadKmh, sistema),
        unidad: unidadVelocidad,
        decimales: 2,
        principal: true,
      }),
      pintarResultado({
        etiqueta: `Segundos por tramo de ${tramoTexto}`,
        valor: derivado.valores.segundosPorTramo,
        unidad: 's',
        decimales: 1,
      })
    ),
  ];

  // Que marchas dan esa velocidad, y a que rpm. Se listan solo las que
  // se pueden usar de verdad —con el motor dentro de su rango de
  // trabajo—, igual que en Avance: lo que no se puede usar no se
  // imprime, y en telefono una tabla de diez renglones inservibles se va
  // a scroll horizontal.
  let filas = [];
  if (tractor) {
    try {
      filas = marchasParaVelocidad({
        tractor,
        velocidadObjetivoKmh: derivado.valores.velocidadKmh,
      }).filter((fila) => !fila.fueraDeRango);
    } catch {
      filas = [];
    }
  }

  if (!tractor) {
    nodos.push(el('p', { clase: 'ayuda' }, 'Sin tractor configurado no hay marchas que listar.'));
  } else if (filas.length === 0) {
    nodos.push(
      el(
        'p',
        { clase: 'texto-suave' },
        `Ninguna marcha del ${tractor.nombre} da esa velocidad con el motor dentro de su rango ` +
          `de trabajo (${tractor.regimenMinimo} a ${tractor.regimenMaximo} rpm). Cambia el ` +
          'ajuste del rotámetro para que el tiempo requerido quepa en una marcha usable.'
      )
    );
  } else {
    nodos.push(
      el(
        'table',
        { clase: 'tabla tabla--numerica' },
        el(
          'thead',
          {},
          el('tr', {}, el('th', {}, 'Marcha'), el('th', { clase: 'numero' }, 'rpm requeridas'))
        ),
        el(
          'tbody',
          {},
          filas.map((fila) =>
            el(
              'tr',
              {},
              el('td', {}, fila.etiqueta),
              el('td', { clase: 'numero' }, formatear(fila.rpmRequeridas, 0))
            )
          )
        )
      ),
      el(
        'p',
        { clase: 'ayuda' },
        `Rango de trabajo del motor: ${tractor.regimenMinimo} a ${tractor.regimenMaximo} rpm. ` +
          'La velocidad sale del largo de tabla configurado; el patinaje no está incluido, se ' +
          'mide en Avance.'
      )
    );
  }

  nodos.push(pintarDesglose(derivado.desglose));
  return nodos;
}
