// Dominio B: boquillas. Relacion presion-caudal, clasificacion de gota,
// seleccion de candidatas y validacion contra la tabla ISO 10625.
//
// El exponente presion-caudal es un parametro POR BOQUILLA (default 0.5
// en defaults del catalogo): las de induccion de aire y las de patron
// regulable pueden desviarse.

import { L_POR_GALON_US, PSI_POR_BAR, PORCIENTO } from './constants.js';
import { aviso, requierePositivo } from './validate.js';
import { paso, redondeoLegible } from './speed.js';

// caudal_2 = caudal_1 * (presion_2 / presion_1) ^ exponente
export function caudalAPresion({ caudalRef, presionRef, presion, exponente }) {
  requierePositivo('el caudal de referencia', caudalRef);
  requierePositivo('la presión de referencia', presionRef);
  requierePositivo('la presión', presion);
  requierePositivo('el exponente presión-caudal', exponente);
  return caudalRef * (presion / presionRef) ** exponente;
}

// Variante con desglose auditable del escalado presion-caudal, para que
// la interfaz pueda mostrar el paso con los numeros sustituidos.
export function caudalAPresionDetallado({ caudalRef, presionRef, presion, exponente }) {
  const caudal = caudalAPresion({ caudalRef, presionRef, presion, exponente });
  return {
    valores: { caudalLmin: caudal },
    desglose: [
      paso(
        'Caudal a la presión de trabajo',
        'caudal_ref * (presión / presión_ref) ^ exponente',
        `${redondeoLegible(caudalRef)} * (${redondeoLegible(presion)} / ${redondeoLegible(presionRef)}) ^ ${exponente}`,
        caudal,
        'L/min'
      ),
    ],
    avisos: [],
  };
}

// Variante con desglose de la correccion por densidad del caldo.
export function caudalConDensidadDetallado({ caudalAguaLmin, densidadRelativa }) {
  const caudal = caudalConDensidad({ caudalAguaLmin, densidadRelativa });
  return {
    valores: { caudalCaldoLmin: caudal },
    desglose: [
      paso(
        'Caudal con el caldo (más denso sale más despacio)',
        'q_caldo = q_agua / raíz(densidad_relativa)',
        `${redondeoLegible(caudalAguaLmin)} / raíz(${redondeoLegible(densidadRelativa)})`,
        caudal,
        'L/min'
      ),
    ],
    avisos: [],
  };
}

// Despeje: presion que produce un caudal dado.
export function presionParaCaudal({ caudalRef, presionRef, caudal, exponente }) {
  requierePositivo('el caudal de referencia', caudalRef);
  requierePositivo('la presión de referencia', presionRef);
  requierePositivo('el caudal requerido', caudal);
  requierePositivo('el exponente presión-caudal', exponente);
  return presionRef * (caudal / caudalRef) ** (1 / exponente);
}

// Correccion por densidad del caldo: un caldo mas denso sale mas
// despacio por la misma boquilla a la misma presion.
export function caudalConDensidad({ caudalAguaLmin, densidadRelativa }) {
  requierePositivo('el caudal con agua', caudalAguaLmin);
  requierePositivo('la densidad relativa', densidadRelativa);
  return caudalAguaLmin / Math.sqrt(densidadRelativa);
}

// Sentido de calibracion: volumen objetivo equivalente si se calibra con
// agua para aplicar un caldo mas denso.
export function volumenEquivalenteEnAgua({ volumenCaldoLha, densidadRelativa }) {
  requierePositivo('el volumen del caldo', volumenCaldoLha);
  requierePositivo('la densidad relativa', densidadRelativa);
  return volumenCaldoLha * Math.sqrt(densidadRelativa);
}

// Clasificacion de gota a una presion dada. La clasificacion depende de
// la presion, asi que el catalogo la registra por rango:
// boquilla.clasesGota = [{ presionMinBar, presionMaxBar, clase }]
// junto con boquilla.edicionEstandar ('S572.1' | 'S572.3').
export function clasificarGota({ boquilla, presionBar }) {
  requierePositivo('la presión', presionBar);
  const rangos = boquilla.clasesGota ?? [];
  const encontrado = rangos.find(
    (r) => presionBar >= r.presionMinBar && presionBar <= r.presionMaxBar
  );
  return encontrado ? encontrado.clase : null;
}

// Que tan lejos del centro de su rango de presion trabajaria la
// boquilla: 0 = centro exacto, 1 = en el borde, > 1 = fuera de rango.
export function distanciaAlCentroDeRango({ presion, presionMin, presionMax }) {
  requierePositivo('la presión', presion);
  requierePositivo('la presión mínima', presionMin);
  requierePositivo('la presión máxima', presionMax);
  const centro = (presionMin + presionMax) / 2;
  const medioAncho = (presionMax - presionMin) / 2;
  if (medioAncho <= 0) return presion === centro ? 0 : Infinity;
  return Math.abs(presion - centro) / medioAncho;
}

// Seleccion de boquillas candidatas para un caudal requerido por
// boquilla. Se filtra por clase de gota ANTES de ordenar (la clase es
// criterio de primer nivel), y se ordena por cercania al centro del
// rango de presion: trabajar a media presion da estabilidad de gasto y
// de tamano de gota.
//
// No compara clases entre ediciones distintas del estandar: si se pide
// clase deseada, solo participan boquillas clasificadas con la edicion
// indicada (o con cualquiera si no se especifica edicion).
export function seleccionarBoquillas({
  catalogo,
  caudalRequeridoLmin,
  claseDeseada = null,
  edicionEstandar = null,
}) {
  requierePositivo('el caudal requerido por boquilla', caudalRequeridoLmin);
  const avisos = [];

  const evaluadas = (catalogo ?? []).map((boquilla) => {
    const presionRequerida = presionParaCaudal({
      caudalRef: boquilla.caudalRefLmin,
      presionRef: boquilla.presionRefBar,
      caudal: caudalRequeridoLmin,
      exponente: boquilla.exponente,
    });
    const dentroDeRango =
      presionRequerida >= boquilla.presionMinBar && presionRequerida <= boquilla.presionMaxBar;
    const clase = clasificarGota({ boquilla, presionBar: presionRequerida });
    return {
      boquilla,
      presionRequeridaBar: presionRequerida,
      dentroDeRango,
      clase,
      distanciaAlCentro: distanciaAlCentroDeRango({
        presion: presionRequerida,
        presionMin: boquilla.presionMinBar,
        presionMax: boquilla.presionMaxBar,
      }),
    };
  });

  let consideradas = evaluadas;
  if (claseDeseada) {
    consideradas = consideradas.filter((c) => {
      if (edicionEstandar && c.boquilla.edicionEstandar !== edicionEstandar) return false;
      return c.clase === claseDeseada;
    });
  }

  const candidatas = consideradas
    .filter((c) => c.dentroDeRango)
    .sort((a, b) => a.distanciaAlCentro - b.distanciaAlCentro);

  const fueraDeRango = consideradas
    .filter((c) => !c.dentroDeRango)
    .sort((a, b) => a.distanciaAlCentro - b.distanciaAlCentro);

  if (candidatas.length === 0) {
    const enRangoSinFiltro = evaluadas.filter((c) => c.dentroDeRango).length;
    const mensaje =
      claseDeseada && enRangoSinFiltro > 0
        ? `Con la clase de gota pedida (${claseDeseada}) ninguna boquilla logra el caudal ` +
          `dentro de su rango de presión; sin ese filtro habría ${enRangoSinFiltro} candidata(s). ` +
          'Cambia la clase deseada, la velocidad o el espaciamiento.'
        : 'Ninguna boquilla del catálogo logra el caudal requerido dentro de su rango de ' +
          'presión. Cambiar de tamaño de boquilla es más efectivo que forzar la presión; ' +
          'también puedes bajar la velocidad o cerrar el espaciamiento para reducir el ' +
          'caudal requerido por boquilla.';
    avisos.push(aviso('advertencia', 'sin-candidatas', mensaje, { caudalRequeridoLmin, enRangoSinFiltro }));
  }

  return { candidatas, fueraDeRango, avisos };
}

// Validacion del catalogo contra la tabla ISO 10625: el caudal declarado
// a su presion de referencia debe corresponder al tamano ISO dentro de
// la tolerancia. Advierte sin bloquear: hay boquillas legitimas fuera de
// norma.
export function validarContraIso({
  tamanoIso,
  caudalRefLmin,
  presionRefBar,
  exponente,
  tablaIso,
  toleranciaPct,
  presionNominalIsoBar,
}) {
  requierePositivo('el caudal de referencia', caudalRefLmin);
  requierePositivo('la presión de referencia', presionRefBar);
  const fila = (tablaIso ?? []).find((f) => f.tamano === tamanoIso);
  if (!fila) {
    return {
      ok: null,
      avisos: [
        aviso(
          'info',
          'tamano-iso-desconocido',
          `El tamaño ISO ${tamanoIso} no está en la tabla de referencia; no se puede validar el caudal.`,
          { tamanoIso }
        ),
      ],
    };
  }
  // Caudal esperado a la presion de referencia de la boquilla, escalando
  // el caudal normativo (a la presion nominal ISO) con el exponente.
  const esperado = caudalAPresion({
    caudalRef: fila.caudalLmin,
    presionRef: presionNominalIsoBar,
    presion: presionRefBar,
    exponente,
  });
  const desviacionPct = ((caudalRefLmin - esperado) / esperado) * PORCIENTO;
  const ok = Math.abs(desviacionPct) <= toleranciaPct;
  const avisos = ok
    ? []
    : [
        aviso(
          'advertencia',
          'caudal-fuera-de-tolerancia-iso',
          `El caudal declarado (${redondeoLegible(caudalRefLmin)} L/min a ` +
            `${redondeoLegible(presionRefBar)} bar) se desvia ${redondeoLegible(desviacionPct)} % ` +
            `del que corresponde al tamaño ISO ${tamanoIso} ` +
            `(${redondeoLegible(esperado)} L/min); la tolerancia de la norma es ` +
            `${redondeoLegible(toleranciaPct)} %. Hay boquillas legitimas fuera de norma, pero ` +
            'revisa que el tamaño declarado sea el correcto.',
          { tamanoIso, esperado, desviacionPct, toleranciaPct }
        ),
      ];
  return { ok, esperadoLmin: esperado, desviacionPct, avisos };
}

// Reconciliacion de las dos nomenclaturas: la convencion norteamericana
// (GPM a una presion en psi) escalada a una presion objetivo en bar.
// Demuestra que ISO y US son consistentes entre si.
export function caudalDesdeConvencionUs({ gpm, psiReferencia, presionObjetivoBar, exponente }) {
  requierePositivo('el caudal en GPM', gpm);
  requierePositivo('la presión de referencia en psi', psiReferencia);
  const caudalRefLmin = gpm * L_POR_GALON_US;
  const presionRefBar = psiReferencia / PSI_POR_BAR;
  const caudal = caudalAPresion({
    caudalRef: caudalRefLmin,
    presionRef: presionRefBar,
    presion: presionObjetivoBar,
    exponente,
  });
  return {
    valores: { caudalLmin: caudal, caudalRefLmin, presionRefBar },
    desglose: [
      paso(
        'Caudal de referencia en L/min',
        'GPM * 3.785411784',
        `${redondeoLegible(gpm)} * ${L_POR_GALON_US}`,
        caudalRefLmin,
        'L/min'
      ),
      paso(
        'Presión de referencia en bar',
        'psi / 14.5037738',
        `${redondeoLegible(psiReferencia)} / ${PSI_POR_BAR}`,
        presionRefBar,
        'bar'
      ),
      paso(
        'Caudal escalado a la presión objetivo',
        'caudal_ref * (presion_objetivo / presion_ref) ^ exponente',
        `${redondeoLegible(caudalRefLmin)} * (${redondeoLegible(presionObjetivoBar)} / ` +
          `${redondeoLegible(presionRefBar)}) ^ ${exponente}`,
        caudal,
        'L/min'
      ),
    ],
    avisos: [],
  };
}
