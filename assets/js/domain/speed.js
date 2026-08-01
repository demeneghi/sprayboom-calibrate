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

// Sentido inverso del avance: que velocidad recorre una tabla completa
// en un tiempo dado. Es lo que conecta el TIEMPO DE INYECCION del gas
// con el avance del tractor: el rotametro despeja cuantos segundos hay
// que tener abierta la valvula para soltar la masa objetivo, y ese
// tiempo solo se cumple si la barra cruza la tabla a esta velocidad.
// Sin esto, el numero de segundos quedaba en pantalla sin decir como
// lograrlo.
//
// El tiempo por tabla no depende de la distancia de referencia —los
// tramos se cancelan con los segundos por tramo—, asi que la velocidad
// sale del largo de tabla y nada mas. La distancia de referencia entra
// solo para devolver, ademas, los segundos por tramo que se cronometran
// en campo.
export function velocidadParaTiempoPorTabla({ tiempoTotalS, largoTabla, distanciaReferencia }) {
  requierePositivo('el tiempo por tabla', tiempoTotalS);
  requierePositivo('el largo de tabla', largoTabla);
  requierePositivo('la distancia de referencia', distanciaReferencia);
  const velocidadKmh = (largoTabla * KMH_A_MS) / tiempoTotalS;
  const tramosPorTabla = largoTabla / distanciaReferencia;
  const segundos = tiempoTotalS / tramosPorTabla;
  return {
    valores: { velocidadKmh, segundosPorTramo: segundos, tramosPorTabla },
    desglose: [
      paso(
        'Velocidad que recorre la tabla en ese tiempo',
        'largo_tabla * 3.6 / tiempo_por_tabla',
        `${redondeoLegible(largoTabla)} * ${KMH_A_MS} / ${redondeoLegible(tiempoTotalS)}`,
        velocidadKmh,
        'km/h'
      ),
      paso(
        'Tramos por tabla',
        'largo_tabla / distancia_referencia',
        `${redondeoLegible(largoTabla)} / ${redondeoLegible(distanciaReferencia)}`,
        tramosPorTabla,
        'tramos'
      ),
      paso(
        'Segundos por tramo',
        'tiempo_por_tabla / tramos_por_tabla',
        `${redondeoLegible(tiempoTotalS)} / ${redondeoLegible(tramosPorTabla)}`,
        segundos,
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
// El trio de la barra: ancho, numero de boquillas y espaciamiento
//
// Los tres datos NO son independientes. Una barra con las boquillas
// parejas cumple:
//
//     ancho = numero_de_boquillas * espaciamiento
//
// Asi que basta capturar DOS para que el tercero salga solo, en
// cualquiera de las tres direcciones. Antes solo existia una: el
// espaciamiento derivado del ancho entre el numero de boquillas. Quien
// mide con el flexometro la distancia entre dos boquillas y las cuenta
// —que es lo que se puede hacer parado junto a la barra— tenia que
// multiplicar a mano para llegar al ancho, con la calculadora del mismo
// telefono. Ahi es justo donde se cuela el error que despues nadie
// encuentra.
//
// `calcular` dice CUAL de los tres se calcula, y es una eleccion
// explicita de quien captura, no una adivinanza a partir de que campo
// quedo vacio:
//
//   'anchoBarra' | 'numBoquillas' | 'espaciamiento' | 'ninguno'
//
// 'ninguno' captura los tres y NO se pierde la señal de diagnostico: si
// el ancho no cuadra con el numero por el espaciamiento, se avisa. Esa
// discrepancia es sintoma de que el ancho efectivo no es el que se cree,
// y con un trio siempre amarrado jamas aparecerria.
//
// La funcion NO truena por datos faltantes: mientras se captura, dos de
// los tres campos estan vacios. Devuelve lo que hay, con `calculado` en
// null cuando todavia no alcanza para calcular.
// ---------------------------------------------------------------------

export const MODOS_GEOMETRIA_BARRA = [
  'anchoBarra',
  'numBoquillas',
  'espaciamiento',
  'ninguno',
];

// Cual de los tres calcula una barra guardada. Las barras viejas no
// traen la marca: ahi el espaciamiento vacio significa —como siempre
// significo— que se deriva del ancho entre el numero de boquillas.
export function modoGeometriaDe(equipo) {
  const guardado = equipo?.geometriaCalculada;
  if (MODOS_GEOMETRIA_BARRA.includes(guardado)) return guardado;
  return Number.isFinite(equipo?.espaciamientoCapturado) ? 'ninguno' : 'espaciamiento';
}

function positivoONulo(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? valor : null;
}

export function completarTrioBarra({
  anchoBarraM = null,
  numBoquillas = null,
  espaciamientoM = null,
  calcular = 'espaciamiento',
  umbralDiscrepanciaPct = null,
  espaciamientoMinimoPlausible = null,
} = {}) {
  let ancho = positivoONulo(anchoBarraM);
  let numero = positivoONulo(numBoquillas);
  let espaciamiento = positivoONulo(espaciamientoM);

  const avisos = [];
  const desglose = [];
  let calculado = null;

  if (calcular === 'espaciamiento' && ancho !== null && numero !== null) {
    espaciamiento = ancho / numero;
    calculado = 'espaciamiento';
    desglose.push(
      paso(
        'Espaciamiento entre boquillas',
        'ancho_barra / num_boquillas',
        `${redondeoLegible(ancho)} / ${redondeoLegible(numero)}`,
        espaciamiento,
        'm'
      )
    );
  } else if (calcular === 'anchoBarra' && numero !== null && espaciamiento !== null) {
    ancho = numero * espaciamiento;
    calculado = 'anchoBarra';
    desglose.push(
      paso(
        'Ancho de la barra',
        'num_boquillas * espaciamiento',
        `${redondeoLegible(numero)} * ${redondeoLegible(espaciamiento)}`,
        ancho,
        'm'
      )
    );
  } else if (calcular === 'numBoquillas' && ancho !== null && espaciamiento !== null) {
    const crudo = ancho / espaciamiento;
    const entero = Math.round(crudo);
    if (entero < 1) {
      // El espaciamiento es mayor que la barra entera: no hay un numero
      // de boquillas que cuadre, y devolver 1 (o 0) seria inventar un
      // dato. Se avisa y el campo se queda sin calcular.
      avisos.push(
        aviso(
          'advertencia',
          'espaciamiento-mayor-que-la-barra',
          `El espaciamiento (${redondeoLegible(espaciamiento)} m) es mayor que el ancho de la ` +
            `barra (${redondeoLegible(ancho)} m): con esos dos datos no sale un número de ` +
            `boquillas. Revisa cuál de los dos está mal capturado.`,
          { anchoBarraM: ancho, espaciamientoM: espaciamiento }
        )
      );
    } else {
      numero = entero;
      calculado = 'numBoquillas';
      desglose.push(
        paso(
          'Número de boquillas',
          'ancho_barra / espaciamiento',
          `${redondeoLegible(ancho)} / ${redondeoLegible(espaciamiento)}`,
          numero,
          'boquillas'
        )
      );
      // Las boquillas se cuentan de una en una: el cociente casi nunca
      // cae exacto y el redondeo se dice, con el ancho que implica. Sin
      // esto, 15.47 m entre 0.5 m se leeria como 31 boquillas justas.
      if (Math.abs(crudo - entero) > 0.01) {
        avisos.push(
          aviso(
            'info',
            'boquillas-redondeadas',
            `El ancho entre el espaciamiento da ${redondeoLegible(crudo)} boquillas: se tomó ` +
              `${entero}. Con ${entero} boquillas a ${redondeoLegible(espaciamiento)} m la barra ` +
              `mediría ${redondeoLegible(entero * espaciamiento)} m; si mide ` +
              `${redondeoLegible(ancho)} m, uno de los dos datos viene redondeado.`,
            { crudo, numBoquillas: entero, anchoImplicadoM: entero * espaciamiento }
          )
        );
      }
    }
  }

  // Discrepancia del trio: con los tres numeros a la vista se compara el
  // ancho capturado contra el que implican las boquillas por su
  // espaciamiento. Es cero por construccion cuando uno se calculo de los
  // otros dos (salvo el redondeo del numero de boquillas), y es la señal
  // de diagnostico cuando se capturan los tres.
  let discrepanciaPct = null;
  if (ancho !== null && numero !== null && espaciamiento !== null) {
    const anchoImplicado = numero * espaciamiento;
    discrepanciaPct = (Math.abs(ancho - anchoImplicado) / anchoImplicado) * PORCIENTO;
    if (
      umbralDiscrepanciaPct !== null &&
      umbralDiscrepanciaPct !== undefined &&
      discrepanciaPct > umbralDiscrepanciaPct
    ) {
      avisos.push(
        aviso(
          'advertencia',
          'geometria-barra-discrepante',
          `El ancho capturado (${redondeoLegible(ancho)} m) difiere ` +
            `${redondeoLegible(discrepanciaPct)} % del que dan ${redondeoLegible(numero)} ` +
            `boquillas a ${redondeoLegible(espaciamiento)} m (${redondeoLegible(anchoImplicado)} m). ` +
            `Es síntoma de que el ancho efectivo no es el que se cree; revisa la barra en vez de ` +
            `confiar en uno de los tres números.`,
          { anchoBarraM: ancho, anchoImplicadoM: anchoImplicado, discrepanciaPct }
        )
      );
    }
  }

  if (
    espaciamiento !== null &&
    espaciamientoMinimoPlausible !== null &&
    espaciamientoMinimoPlausible !== undefined &&
    espaciamiento < espaciamientoMinimoPlausible
  ) {
    avisos.push(
      aviso(
        'advertencia',
        'espaciamiento-sospechoso-cm',
        `El espaciamiento (${redondeoLegible(espaciamiento)} m) es menor que ` +
          `${redondeoLegible(espaciamientoMinimoPlausible)} m. Parece capturado en centímetros: ` +
          `el espaciamiento va en METROS. Un error así cambia el resultado dos órdenes de ` +
          `magnitud.`,
        { espaciamientoM: espaciamiento, espaciamientoMinimoPlausible }
      )
    );
  }

  return {
    valores: {
      anchoBarraM: ancho,
      numBoquillas: numero,
      espaciamientoM: espaciamiento,
      calculado,
      discrepanciaPct,
    },
    desglose,
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

// Marcha de trabajo del tractor: la ultima que se eligio en Avance,
// guardada en el tractor y no en el borrador de la pantalla.
//
// Vive con el tractor por dos razones. La primera es que la marcha se
// identifica por POSICION, asi que el borrador solo puede recordar una a
// la vez: cambiar de tractor y volver borraba la del primero, y la
// pantalla quedaba sin velocidad sin decir por que. La segunda es que un
// tractor SI tiene una marcha con la que se trabaja, y darla por sabida
// es lo que dejaba el tiempo de inyeccion en blanco la primera vez que
// se abria Gas etileno.
//
// Devuelve la fila completa, o null si no hay marcha guardada, si apunta
// a una posicion que ya no existe (se redujo la transmision) o si esa
// marcha esta pendiente de velocidad.
export function marchaHabitualDe(tractor) {
  const guardada = tractor?.marchaHabitual;
  if (!guardada || !Number.isInteger(guardada.rango) || !Number.isInteger(guardada.marcha)) {
    return null;
  }
  const fila = marchasDeTractor(tractor).find(
    (f) => f.rango === guardada.rango && f.marcha === guardada.marcha
  );
  return fila && fila.kmhNominal !== null ? fila : null;
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
// Cuando NINGUNO de los dos modos tiene datos queda un ultimo respaldo:
// la marcha de trabajo guardada del tractor (ver marchaHabitualDe), con
// su aviso. Sale al final, nunca por encima de una captura de hoy.
//
//   captura: borrador de la pestana Avance ({ modo, marcha, rpm,
//            segundosPorTramo })
//   mediciones: factores de desviacion MEDIDOS de ese mismo tractor
//   rpmRespaldo: regimen que Avance PRECARGA en su campo (el habitual del
//            tractor). Avance calcula con ese numero en cuanto se abre la
//            pantalla, asi que quien hereda tiene que poder hacer lo
//            mismo: sin esto, elegir una marcha y aceptar el regimen que
//            ya venia puesto dejaba a las demas pantallas sin velocidad
//            —o heredando un reporte de campo viejo— mientras Avance
//            mostraba la de la marcha.
export function velocidadDeAvance({
  captura,
  tractor,
  mediciones = [],
  distanciaReferencia,
  umbralDesviacionPct,
  rpmRespaldo = null,
}) {
  const sinDatos = { velocidadKmh: null, origen: null, etiqueta: null, marcha: null, avisos: [] };
  const c = captura ?? {};
  if (!tractor) return sinDatos;

  const rpm = Number.isFinite(c.rpm) && c.rpm > 0
    ? c.rpm
    : Number.isFinite(rpmRespaldo) && rpmRespaldo > 0
      ? rpmRespaldo
      : null;
  const hayReporte = Number.isFinite(c.segundosPorTramo) && c.segundosPorTramo > 0;
  // Las marchas se identifican por POSICION, asi que una marcha guardada
  // para otro tractor apunta a una velocidad nominal distinta: no se
  // hereda. Un borrador anterior a este sello no trae tractorId y se
  // acepta, porque el caso normal es que sea el del tractor activo.
  const marchaDeEsteTractor =
    Boolean(c.marcha) &&
    (c.marcha.tractorId === undefined || c.marcha.tractorId === tractor.id);
  const hayMarcha = marchaDeEsteTractor && rpm !== null;
  // El modo elegido en Avance manda; el otro queda como respaldo.
  const modoElegido = c.modo === 'reporte' ? 'reporte' : 'marcha';
  const orden = modoElegido === 'reporte' ? ['reporte', 'marcha'] : ['marcha', 'reporte'];

  // Cuando la velocidad NO sale del modo elegido en Avance, el respaldo
  // se declara. Callarlo es lo que dejaba a una pantalla calibrando con
  // el reporte de campo de la semana pasada mientras Avance mostraba la
  // marcha de hoy, sin nada que lo delatara.
  function avisosDeFuente(fuente) {
    if (fuente === modoElegido) return [];
    return [
      aviso(
        'advertencia',
        'fuente-distinta-al-modo',
        fuente === 'reporte'
          ? 'En Avance está elegido el modo de marcha y régimen, pero esa captura está ' +
            'incompleta: esta velocidad sale del reporte de campo guardado. Elige la marcha ' +
            'en Avance, o borra el reporte si ya no es el de hoy.'
          : 'En Avance está elegido el modo de reporte de campo, pero no hay segundos por ' +
            'tramo capturados: esta velocidad sale de la marcha y el régimen guardados.',
        { modoElegido, fuenteUsada: fuente }
      ),
    ];
  }

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
        avisos: avisosDeFuente('reporte'),
      };
    }
    if (fuente === 'marcha' && hayMarcha) {
      const fila = marchasDeTractor(tractor).find(
        (f) => f.rango === c.marcha.rango && f.marcha === c.marcha.marcha
      );
      // Marcha pendiente de velocidad: no hay de donde heredar, se
      // intenta la otra fuente.
      if (!fila || fila.kmhNominal === null) continue;
      return desdeMarcha(fila, 'marcha', avisosDeFuente('marcha'));
    }
  }

  // Ultimo respaldo: la marcha de TRABAJO del tractor, la que se eligio
  // la vez pasada en Avance. No es una captura de hoy y por eso va al
  // final —despues del reporte de campo y de la marcha elegida— y sale
  // con su aviso, pero es lo que evita que Gas etileno y Forzamiento
  // aparezcan sin tiempo de inyeccion cada vez que se abre la aplicacion
  // sin haber pasado antes por Avance. Un tractor tiene una marcha con
  // la que se trabaja; darla por olvidada era pedir dos veces el mismo
  // dato.
  const habitual = marchaHabitualDe(tractor);
  if (habitual && rpm !== null) {
    return desdeMarcha(habitual, 'marcha de trabajo', [
      aviso(
        'info',
        'marcha-de-trabajo-del-tractor',
        `En Avance no hay marcha elegida ni reporte de campo: se usa la marcha de trabajo ` +
          `guardada del ${tractor.nombre} (${habitual.etiqueta}). Confírmala en Avance si hoy ` +
          `vas en otra.`,
        { marcha: habitual.etiqueta }
      ),
    ]);
  }
  return sinDatos;

  // Velocidad a partir de una fila de marcha, con el regimen vigente y
  // los factores medidos. Lo comparten la marcha elegida en Avance y la
  // marcha de trabajo del tractor: es el mismo calculo y solo cambia de
  // donde salio la marcha. `comoSeLlama` entra en la etiqueta porque esa
  // frase viaja al chip de procedencia de las pantallas que heredan, y
  // ahi tiene que quedar claro si el numero es de hoy o del tractor.
  function desdeMarcha(fila, comoSeLlama, avisosDeOrigen) {
    const teorica = velocidadEfectiva({
      kmhNominal: fila.kmhNominal,
      rpm,
      regimenNominal: tractor.regimenNominal,
    });
    const factor = factorDesviacion({ mediciones, rpm });
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
        ? `de la ${comoSeLlama} ${fila.etiqueta} con factor medido`
        : `de la ${comoSeLlama} ${fila.etiqueta} (teórica sin verificar)`,
      marcha: fila.etiqueta,
      avisos: [...avisosDeOrigen, ...factor.avisos, ...corregida.avisos],
    };
  }
}
