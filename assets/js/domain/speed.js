// Dominio A: velocidad, marchas y avance.
//
// Funciones puras: reciben todos los parametros por argumento, no leen
// globales, no tocan DOM ni almacenamiento. La velocidad de avance en
// transmision mecanica es exactamente proporcional al regimen del motor;
// la desviacion real proviene del patinaje y del instrumento, y se
// corrige con factores MEDIDOS en campo, nunca con formula inventada.

import { KMH_A_MS, M2_POR_HA, PORCIENTO, TOLERANCIA_RPM_COINCIDENCIA } from './constants.js';
import { aviso, requierePositivo, requiereFinito } from './validate.js';

// Redondeo solo para las sustituciones legibles del desglose; los
// valores numericos del resultado conservan precision completa.
export function redondeoLegible(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return String(x);
  return String(Number(x.toPrecision(6)));
}

export function paso(descripcion, formula, sustitucion, resultado, unidad) {
  return { descripcion, formula, sustitucion, resultado, unidad };
}

// ---------------------------------------------------------------------
// Velocidad por marcha y regimen
// ---------------------------------------------------------------------

export function factorRegimen({ rpm, regimenNominal }) {
  requierePositivo('el régimen del motor', rpm);
  requierePositivo('el régimen nominal del tractor', regimenNominal);
  return rpm / regimenNominal;
}

export function velocidadEfectiva({ kmhNominal, rpm, regimenNominal }) {
  requierePositivo('la velocidad nominal de la marcha', kmhNominal);
  return kmhNominal * factorRegimen({ rpm, regimenNominal });
}

export function rpmParaVelocidad({ velocidadObjetivoKmh, kmhNominal, regimenNominal }) {
  requierePositivo('la velocidad objetivo', velocidadObjetivoKmh);
  requierePositivo('la velocidad nominal de la marcha', kmhNominal);
  requierePositivo('el régimen nominal del tractor', regimenNominal);
  return (regimenNominal * velocidadObjetivoKmh) / kmhNominal;
}

// Calibracion de una marcha desde una medicion de campo.
export function calibrarMarcha({ velocidadMedidaKmh, rpmMedidas, regimenNominal }) {
  requierePositivo('la velocidad medida', velocidadMedidaKmh);
  requierePositivo('el régimen medido', rpmMedidas);
  requierePositivo('el régimen nominal del tractor', regimenNominal);
  return velocidadMedidaKmh * (regimenNominal / rpmMedidas);
}

// ---------------------------------------------------------------------
// Avance: segundos por tramo y tiempo por tabla
// ---------------------------------------------------------------------

export function segundosPorTramo({ velocidadKmh, distanciaReferencia }) {
  requierePositivo('la velocidad', velocidadKmh);
  requierePositivo('la distancia de referencia', distanciaReferencia);
  return distanciaReferencia / (velocidadKmh / KMH_A_MS);
}

export function velocidadDesdeReporte({ segundosPorTramo: segundos, distanciaReferencia }) {
  requierePositivo('los segundos por tramo', segundos);
  requierePositivo('la distancia de referencia', distanciaReferencia);
  return (distanciaReferencia * KMH_A_MS) / segundos;
}

// Avance completo a partir de una velocidad.
export function avance({ velocidadKmh, distanciaReferencia, largoTabla }) {
  requierePositivo('el largo de tabla', largoTabla);
  const segundos = segundosPorTramo({ velocidadKmh, distanciaReferencia });
  const tramosPorTabla = largoTabla / distanciaReferencia;
  const tiempoTotalS = segundos * tramosPorTabla;
  return {
    valores: { velocidadKmh, segundosPorTramo: segundos, tramosPorTabla, tiempoTotalS },
    desglose: [
      paso(
        'Segundos por tramo',
        'distancia_referencia / (velocidad / 3.6)',
        `${redondeoLegible(distanciaReferencia)} / (${redondeoLegible(velocidadKmh)} / ${KMH_A_MS})`,
        segundos,
        's'
      ),
      paso(
        'Tramos por tabla',
        'largo_tabla / distancia_referencia',
        `${redondeoLegible(largoTabla)} / ${redondeoLegible(distanciaReferencia)}`,
        tramosPorTabla,
        'tramos'
      ),
      paso(
        'Tiempo total por tabla',
        'segundos_por_tramo * tramos_por_tabla',
        `${redondeoLegible(segundos)} * ${redondeoLegible(tramosPorTabla)}`,
        tiempoTotalS,
        's'
      ),
    ],
    avisos: [],
  };
}

// Avance completo a partir del reporte de campo (sentido inverso).
export function avanceDesdeReporte({ segundosPorTramo: segundos, distanciaReferencia, largoTabla }) {
  const velocidadKmh = velocidadDesdeReporte({ segundosPorTramo: segundos, distanciaReferencia });
  const resultado = avance({ velocidadKmh, distanciaReferencia, largoTabla });
  resultado.desglose.unshift(
    paso(
      'Velocidad desde el reporte',
      'distancia_referencia * 3.6 / segundos_por_tramo',
      `${redondeoLegible(distanciaReferencia)} * ${KMH_A_MS} / ${redondeoLegible(segundos)}`,
      velocidadKmh,
      'km/h'
    )
  );
  return resultado;
}

// ---------------------------------------------------------------------
// Geometria de tabla y barra (valores derivados, nunca capturados)
// ---------------------------------------------------------------------

export function geometria({
  largoTabla,
  anchoBarra,
  numBoquillas,
  distanciaReferencia,
  espaciamientoCapturado = null,
  espaciamientoMinimoPlausible,
  umbralDiscrepanciaPct,
}) {
  requierePositivo('el largo de tabla', largoTabla);
  requierePositivo('el ancho de barra', anchoBarra);
  requierePositivo('el número de boquillas', numBoquillas);
  requierePositivo('la distancia de referencia', distanciaReferencia);

  const areaM2 = largoTabla * anchoBarra;
  const hectareasPorTabla = areaM2 / M2_POR_HA;
  const tramosPorTabla = largoTabla / distanciaReferencia;
  const espaciamientoDerivado = anchoBarra / numBoquillas;
  const espaciamientoEfectivo =
    espaciamientoCapturado === null || espaciamientoCapturado === undefined
      ? espaciamientoDerivado
      : espaciamientoCapturado;

  const avisos = [];
  let discrepanciaEspaciamientoPct = null;

  if (espaciamientoCapturado !== null && espaciamientoCapturado !== undefined) {
    requierePositivo('el espaciamiento capturado', espaciamientoCapturado);
    discrepanciaEspaciamientoPct =
      (Math.abs(espaciamientoCapturado - espaciamientoDerivado) / espaciamientoDerivado) *
      PORCIENTO;
    if (
      umbralDiscrepanciaPct !== undefined &&
      discrepanciaEspaciamientoPct > umbralDiscrepanciaPct
    ) {
      avisos.push(
        aviso(
          'advertencia',
          'espaciamiento-discrepante',
          `El espaciamiento capturado (${redondeoLegible(espaciamientoCapturado)} m) difiere ` +
            `${redondeoLegible(discrepanciaEspaciamientoPct)} % del derivado del ancho entre el ` +
            `número de boquillas (${redondeoLegible(espaciamientoDerivado)} m). Es síntoma de que ` +
            `el ancho efectivo no es el que se cree; revisa la barra en vez de confiar en uno de ` +
            `los dos números.`,
          { espaciamientoCapturado, espaciamientoDerivado, discrepanciaEspaciamientoPct }
        )
      );
    }
  }

  if (
    espaciamientoMinimoPlausible !== undefined &&
    espaciamientoEfectivo < espaciamientoMinimoPlausible
  ) {
    avisos.push(
      aviso(
        'advertencia',
        'espaciamiento-sospechoso-cm',
        `El espaciamiento (${redondeoLegible(espaciamientoEfectivo)} m) es menor que ` +
          `${redondeoLegible(espaciamientoMinimoPlausible)} m. Parece capturado en centimetros: ` +
          `con la constante 600 el espaciamiento va en METROS. Un error así cambia el resultado ` +
          `dos ordenes de magnitud.`,
        { espaciamientoEfectivo, espaciamientoMinimoPlausible }
      )
    );
  }

  return {
    valores: {
      areaM2,
      hectareasPorTabla,
      tramosPorTabla,
      espaciamientoDerivado,
      espaciamientoCapturado,
      espaciamientoEfectivo,
      discrepanciaEspaciamientoPct,
    },
    desglose: [
      paso(
        'Área por tabla',
        'largo_tabla * ancho_barra',
        `${redondeoLegible(largoTabla)} * ${redondeoLegible(anchoBarra)}`,
        areaM2,
        'm2'
      ),
      paso(
        'Hectáreas por tabla',
        'área / 10000',
        `${redondeoLegible(areaM2)} / ${M2_POR_HA}`,
        hectareasPorTabla,
        'ha'
      ),
      paso(
        'Tramos por tabla',
        'largo_tabla / distancia_referencia',
        `${redondeoLegible(largoTabla)} / ${redondeoLegible(distanciaReferencia)}`,
        tramosPorTabla,
        'tramos'
      ),
      paso(
        'Espaciamiento derivado',
        'ancho_barra / num_boquillas',
        `${redondeoLegible(anchoBarra)} / ${numBoquillas}`,
        espaciamientoDerivado,
        'm'
      ),
    ],
    avisos,
  };
}

// ---------------------------------------------------------------------
// Cuadricula de marchas y busqueda inversa
// ---------------------------------------------------------------------

// Lista plana de marchas de un tractor, generada desde numRangos y
// marchasPorRango (nunca codificada para el caso 3x3). Une la tabla de
// velocidades guardada; si falta una fila, la marcha aparece pendiente.
export function marchasDeTractor(tractor) {
  const filas = [];
  for (let r = 0; r < tractor.numRangos; r += 1) {
    const etiquetaRango = tractor.etiquetasRango?.[r] ?? String(r + 1);
    for (let m = 1; m <= tractor.marchasPorRango; m += 1) {
      const fila = tractor.velocidades.find((v) => v.rango === r && v.marcha === m) ?? null;
      filas.push({
        rango: r,
        etiquetaRango,
        marcha: m,
        etiqueta: `${etiquetaRango}${m}`,
        kmhNominal: fila ? fila.kmhNominal : null,
        origen: fila ? fila.origen : 'pendiente',
        fecha: fila ? (fila.fecha ?? null) : null,
      });
    }
  }
  return filas;
}

// Que marchas reproducen una velocidad medida y a que rpm. Marca las que
// exigen un regimen fuera del rango de trabajo del motor.
export function marchasParaVelocidad({ tractor, velocidadObjetivoKmh }) {
  requierePositivo('la velocidad objetivo', velocidadObjetivoKmh);
  return marchasDeTractor(tractor)
    .filter((m) => m.kmhNominal !== null)
    .map((m) => {
      const rpm = rpmParaVelocidad({
        velocidadObjetivoKmh,
        kmhNominal: m.kmhNominal,
        regimenNominal: tractor.regimenNominal,
      });
      return {
        ...m,
        rpmRequeridas: rpm,
        fueraDeRango: rpm < tractor.regimenMinimo || rpm > tractor.regimenMaximo,
      };
    });
}

// Aviso de regimen fuera del rango de trabajo del tractor.
export function validarRegimen({ rpm, tractor }) {
  requierePositivo('el régimen del motor', rpm);
  const avisos = [];
  if (rpm < tractor.regimenMinimo || rpm > tractor.regimenMaximo) {
    avisos.push(
      aviso(
        'advertencia',
        'regimen-fuera-de-rango',
        `${redondeoLegible(rpm)} rpm queda fuera del rango de trabajo del ` +
          `${tractor.nombre} (${tractor.regimenMinimo} a ${tractor.regimenMaximo} rpm). ` +
          `Puede no ser sostenible con carga.`,
        { rpm, regimenMinimo: tractor.regimenMinimo, regimenMaximo: tractor.regimenMaximo }
      )
    );
  }
  return avisos;
}

// ---------------------------------------------------------------------
// Factores de desviacion medidos en campo (patinaje e instrumento)
//
// mediciones: [{ rpm, factor }] del MISMO tractor. Nunca se extrapola
// fuera del rango medido: se pide una medicion.
// ---------------------------------------------------------------------

export function factorDesviacion({ mediciones, rpm }) {
  requierePositivo('el régimen del motor', rpm);
  const avisos = [];
  const lista = (mediciones ?? [])
    .filter((m) => Number.isFinite(m.rpm) && Number.isFinite(m.factor))
    .sort((a, b) => a.rpm - b.rpm);

  if (lista.length === 0) {
    avisos.push(
      aviso(
        'advertencia',
        'sin-mediciones-desviacion',
        'No hay mediciones de desviación para este tractor: la velocidad mostrada es ' +
          'teórica sin verificar (factor 1.0). El patinaje no se predice con fórmula; se mide.',
        null
      )
    );
    return { factor: 1.0, estado: 'sin-mediciones', avisos };
  }

  const exacta = lista.find((m) => Math.abs(m.rpm - rpm) <= TOLERANCIA_RPM_COINCIDENCIA);
  if (exacta) {
    return { factor: exacta.factor, estado: 'medido', medicion: exacta, avisos };
  }

  const menor = [...lista].reverse().find((m) => m.rpm < rpm);
  const mayor = lista.find((m) => m.rpm > rpm);

  if (menor && mayor) {
    const proporcion = (rpm - menor.rpm) / (mayor.rpm - menor.rpm);
    const factor = menor.factor + proporcion * (mayor.factor - menor.factor);
    avisos.push(
      aviso(
        'info',
        'factor-interpolado',
        `Factor interpolado linealmente entre las mediciones de ${menor.rpm} y ${mayor.rpm} rpm.`,
        { rpmInferior: menor.rpm, rpmSuperior: mayor.rpm }
      )
    );
    return { factor, estado: 'interpolado', entre: [menor, mayor], avisos };
  }

  avisos.push(
    aviso(
      'advertencia',
      'sin-medicion-en-rango',
      `No hay medición de desviación que cubra ${redondeoLegible(rpm)} rpm ` +
        `(rango medido: ${lista[0].rpm} a ${lista[lista.length - 1].rpm} rpm). ` +
        'No se extrapola: haz una medición a ese régimen para poder corregir.',
      { rpm, rpmMinimoMedido: lista[0].rpm, rpmMaximoMedido: lista[lista.length - 1].rpm }
    )
  );
  return { factor: null, estado: 'fuera-de-rango', avisos };
}

// Factor resultante de una medicion individual de campo.
export function factorDeMedicion({ velocidadTeoricaKmh, velocidadMedidaKmh }) {
  requierePositivo('la velocidad teórica', velocidadTeoricaKmh);
  requierePositivo('la velocidad medida', velocidadMedidaKmh);
  return velocidadMedidaKmh / velocidadTeoricaKmh;
}

// Velocidad teorica y corregida, siempre juntas, con porcentaje de
// desviacion y alerta sobre umbral configurable.
export function velocidadCorregida({ velocidadTeoricaKmh, factor, umbralDesviacionPct }) {
  requierePositivo('la velocidad teórica', velocidadTeoricaKmh);
  const avisos = [];
  if (factor === null || factor === undefined) {
    return {
      valores: {
        velocidadTeoricaKmh,
        velocidadCorregidaKmh: null,
        desviacionPct: null,
      },
      avisos,
    };
  }
  requierePositivo('el factor de desviación', factor);
  const corregida = velocidadTeoricaKmh * factor;
  const desviacionPct = (1 - factor) * PORCIENTO;
  if (
    umbralDesviacionPct !== undefined &&
    Math.abs(desviacionPct) > umbralDesviacionPct
  ) {
    avisos.push(
      aviso(
        'advertencia',
        'desviacion-excesiva',
        `La desviación entre velocidad teórica y medida es ${redondeoLegible(Math.abs(desviacionPct))} %, ` +
          `mayor que el umbral de ${redondeoLegible(umbralDesviacionPct)} %. El patinaje excesivo ` +
          'también es un síntoma mecanico, no solo un número a corregir.',
        { desviacionPct, umbralDesviacionPct }
      )
    );
  }
  return {
    valores: {
      velocidadTeoricaKmh,
      velocidadCorregidaKmh: corregida,
      desviacionPct,
    },
    avisos,
  };
}

// ---------------------------------------------------------------------
// Velocidad heredada de la pantalla de Avance
// ---------------------------------------------------------------------

// La velocidad de trabajo se captura UNA sola vez, en Avance, y las
// demas pantallas la heredan: es el mismo numero, y copiarlo a mano de
// una pantalla a otra es la via mas corta a calibrar con una velocidad
// que ya no es la del tractor.
//
// Reproduce lo que Avance esta mostrando a partir de su captura: manda
// el modo elegido ahi y, si ese modo no tiene datos, se intenta el otro.
// La falta de datos NO es un error: devuelve velocidadKmh en null para
// que la pantalla que hereda pida la captura. Solo lanza si la
// configuracion es invalida (distancia de referencia, regimen nominal).
//
//   captura: borrador de la pestana Avance ({ modo, marcha, rpm,
//            segundosPorTramo })
//   mediciones: factores de desviacion MEDIDOS de ese mismo tractor
export function velocidadDeAvance({
  captura,
  tractor,
  mediciones = [],
  distanciaReferencia,
  umbralDesviacionPct,
}) {
  const sinDatos = { velocidadKmh: null, origen: null, etiqueta: null, marcha: null, avisos: [] };
  const c = captura ?? {};
  if (!tractor) return sinDatos;

  const hayReporte = Number.isFinite(c.segundosPorTramo) && c.segundosPorTramo > 0;
  const hayMarcha = Boolean(c.marcha) && Number.isFinite(c.rpm) && c.rpm > 0;
  // El modo elegido en Avance manda; el otro queda como respaldo.
  const orden = c.modo === 'reporte' ? ['reporte', 'marcha'] : ['marcha', 'reporte'];

  for (const fuente of orden) {
    if (fuente === 'reporte' && hayReporte) {
      return {
        velocidadKmh: velocidadDesdeReporte({
          segundosPorTramo: c.segundosPorTramo,
          distanciaReferencia,
        }),
        origen: 'reporte',
        etiqueta: 'del reporte de campo',
        marcha: null,
        avisos: [],
      };
    }
    if (fuente === 'marcha' && hayMarcha) {
      const fila = marchasDeTractor(tractor).find(
        (f) => f.rango === c.marcha.rango && f.marcha === c.marcha.marcha
      );
      // Marcha pendiente de velocidad: no hay de donde heredar, se
      // intenta la otra fuente.
      if (!fila || fila.kmhNominal === null) continue;
      const teorica = velocidadEfectiva({
        kmhNominal: fila.kmhNominal,
        rpm: c.rpm,
        regimenNominal: tractor.regimenNominal,
      });
      const factor = factorDesviacion({ mediciones, rpm: c.rpm });
      const corregida = velocidadCorregida({
        velocidadTeoricaKmh: teorica,
        factor: factor.factor,
        umbralDesviacionPct,
      });
      // Lo que decide si la velocidad esta respaldada es el ESTADO del
      // factor, no que la correccion devuelva numero: sin mediciones el
      // factor vale 1.0 y la corregida sale identica a la teorica, que
      // no es lo mismo que estar medida.
      const medida =
        (factor.estado === 'medido' || factor.estado === 'interpolado') &&
        corregida.valores.velocidadCorregidaKmh !== null;
      return {
        velocidadKmh: medida ? corregida.valores.velocidadCorregidaKmh : teorica,
        origen: medida ? 'marcha-corregida' : 'marcha-teorica',
        etiqueta: medida
          ? `de la marcha ${fila.etiqueta} con factor medido`
          : `de la marcha ${fila.etiqueta} (teórica sin verificar)`,
        marcha: fila.etiqueta,
        avisos: [...factor.avisos, ...corregida.avisos],
      };
    }
  }
  return sinDatos;
}
