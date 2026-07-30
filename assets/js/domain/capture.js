// Dominio B: prueba de captura (aforo boquilla por boquilla).
//
// El desgaste de boquillas es la causa mas comun de sobreaplicacion y
// esta es la pantalla que lo detecta. El caudal de catalogo es el de una
// boquilla nueva: el desgaste solo se detecta aforando.

import { ML_POR_L, SEG_POR_MIN, PORCIENTO } from './constants.js';
import { aviso, requierePositivo } from './validate.js';
import { paso, redondeoLegible } from './speed.js';
import { lhaPorBoquilla } from './water.js';

// Convierte un volumen recogido en mililitros durante un tiempo dado a
// caudal en L/min.
export function caudalDesdeVolumen({ volumenMl, tiempoS }) {
  requierePositivo('el volumen recogido', volumenMl);
  requierePositivo('el tiempo de captura', tiempoS);
  return (volumenMl / ML_POR_L) / (tiempoS / SEG_POR_MIN);
}

// Estadistica completa de una prueba de captura.
//
// Entrada: caudalesLmin directos, o volumenesMl + tiempoS.
// umbralAtipicasPct es parametro explicito (default de la aplicacion:
// 10 %, criterio de la literatura de extension).
export function estadisticaCaptura({
  caudalesLmin = null,
  volumenesMl = null,
  tiempoS = null,
  umbralAtipicasPct,
  caudalTeoricoLmin = null,
  velocidadKmh = null,
  espaciamientoM = null,
  lhaObjetivo = null,
}) {
  requierePositivo('el umbral de atipicas', umbralAtipicasPct);

  let caudales = caudalesLmin;
  if (caudales === null || caudales === undefined) {
    if (!Array.isArray(volumenesMl) || volumenesMl.length === 0) {
      throw new Error('No se puede calcular: no hay capturas registradas.');
    }
    caudales = volumenesMl.map((volumenMl) => caudalDesdeVolumen({ volumenMl, tiempoS }));
  }
  if (!Array.isArray(caudales) || caudales.length === 0) {
    throw new Error('No se puede calcular: no hay capturas registradas.');
  }
  caudales.forEach((c, i) => requierePositivo(`el caudal de la boquilla ${i + 1}`, c));

  const n = caudales.length;
  const media = caudales.reduce((suma, c) => suma + c, 0) / n;

  const avisos = [];
  const desglose = [
    paso(
      'Media de la barra',
      'suma de caudales / n',
      `${redondeoLegible(caudales.reduce((s, c) => s + c, 0))} / ${n}`,
      media,
      'L/min'
    ),
  ];

  let dePoblacional = null;
  let deMuestral = null;
  let cvPoblacionalPct = null;
  let cvMuestralPct = null;

  if (n === 1) {
    avisos.push(
      aviso(
        'info',
        'cv-indefinido',
        'Con una sola boquilla capturada no existe dispersion que medir: el coeficiente de ' +
          'variacion no esta definido. Captura mas boquillas para evaluar la uniformidad de la barra.',
        null
      )
    );
  } else {
    const sumaCuadrados = caudales.reduce((s, c) => s + (c - media) ** 2, 0);
    dePoblacional = Math.sqrt(sumaCuadrados / n);
    deMuestral = Math.sqrt(sumaCuadrados / (n - 1));
    cvPoblacionalPct = (dePoblacional / media) * PORCIENTO;
    cvMuestralPct = (deMuestral / media) * PORCIENTO;
    desglose.push(
      paso(
        'Desviacion estandar (poblacional)',
        'raiz(suma((x - media)^2) / n)',
        `raiz(${redondeoLegible(sumaCuadrados)} / ${n})`,
        dePoblacional,
        'L/min'
      ),
      paso(
        'Coeficiente de variacion',
        'DE / media * 100',
        `${redondeoLegible(dePoblacional)} / ${redondeoLegible(media)} * 100`,
        cvPoblacionalPct,
        '%'
      )
    );
  }

  // Boquillas atipicas: desviacion respecto a la media sobre el umbral.
  const porBoquilla = caudales.map((caudal, indice) => {
    const desviacionPct = ((caudal - media) / media) * PORCIENTO;
    return {
      indice,
      caudalLmin: caudal,
      desviacionPct,
      atipica: Math.abs(desviacionPct) > umbralAtipicasPct,
    };
  });
  const atipicas = porBoquilla.filter((b) => b.atipica);
  if (atipicas.length > 0) {
    avisos.push(
      aviso(
        'advertencia',
        'boquillas-atipicas',
        `${atipicas.length} boquilla(s) se desvian mas de ${redondeoLegible(umbralAtipicasPct)} % ` +
          'de la media de la barra. Se recomienda reemplazarlas.',
        { indices: atipicas.map((b) => b.indice) }
      )
    );
  }

  // Desgaste implicito contra el caudal teorico de catalogo.
  let desgastePct = null;
  if (caudalTeoricoLmin !== null && caudalTeoricoLmin !== undefined) {
    requierePositivo('el caudal teorico', caudalTeoricoLmin);
    desgastePct = ((media - caudalTeoricoLmin) / caudalTeoricoLmin) * PORCIENTO;
    desglose.push(
      paso(
        'Desgaste implicito contra catalogo',
        '(media - caudal_teorico) / caudal_teorico * 100',
        `(${redondeoLegible(media)} - ${redondeoLegible(caudalTeoricoLmin)}) / ${redondeoLegible(caudalTeoricoLmin)} * 100`,
        desgastePct,
        '%'
      )
    );
    if (desgastePct > umbralAtipicasPct) {
      avisos.push(
        aviso(
          'advertencia',
          'desgaste-excesivo',
          `La media de la barra entrega ${redondeoLegible(desgastePct)} % mas caudal que el ` +
            'teorico de catalogo: las boquillas estan desgastadas. El desgaste es la causa mas ' +
            'comun de sobreaplicacion.',
          { desgastePct }
        )
      );
    }
  }

  // L/ha real medido, si hay velocidad y espaciamiento.
  let lhaRealMedido = null;
  let comparacionObjetivoPct = null;
  let verificacion = null;
  if (velocidadKmh !== null && espaciamientoM !== null && velocidadKmh !== undefined && espaciamientoM !== undefined) {
    const lhaReal = lhaPorBoquilla({ caudalLmin: media, velocidadKmh, espaciamientoM });
    lhaRealMedido = lhaReal.valores.lha;
    verificacion = lhaReal.verificacion;
    desglose.push(...lhaReal.desglose);
    avisos.push(...lhaReal.avisos);
    if (lhaObjetivo !== null && lhaObjetivo !== undefined) {
      requierePositivo('el volumen objetivo', lhaObjetivo);
      comparacionObjetivoPct = ((lhaRealMedido - lhaObjetivo) / lhaObjetivo) * PORCIENTO;
      desglose.push(
        paso(
          'Comparacion contra objetivo',
          '(L/ha_real - objetivo) / objetivo * 100',
          `(${redondeoLegible(lhaRealMedido)} - ${redondeoLegible(lhaObjetivo)}) / ${redondeoLegible(lhaObjetivo)} * 100`,
          comparacionObjetivoPct,
          '%'
        )
      );
    }
  }

  return {
    valores: {
      n,
      mediaLmin: media,
      dePoblacional,
      deMuestral,
      cvPoblacionalPct,
      cvMuestralPct,
      porBoquilla,
      atipicas,
      desgastePct,
      lhaRealMedido,
      comparacionObjetivoPct,
    },
    desglose,
    avisos,
    verificacion,
  };
}
