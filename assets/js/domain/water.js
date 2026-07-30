// Dominio B: gasto de agua en L/ha. Formulas maestras canonicas de la
// practica agricola, calculo directo e inverso, siempre con verificacion
// redundante por la ruta SI y con ida y vuelta en los despejes.

import { FACTOR_LHA, PORCIENTO } from './constants.js';
import { aviso, requierePositivo } from './validate.js';
import { paso, redondeoLegible } from './speed.js';
import { presionParaCaudal, caudalAPresion } from './nozzles.js';
import {
  lhaRutaSI,
  compararRutas,
  verificarIdaVuelta,
} from './verify.js';

function avisoRedundante(comparacion) {
  return aviso(
    'error',
    'calculo-no-verificado',
    'Las dos rutas de calculo no coinciden: el resultado no esta verificado y no debe ' +
      'usarse. Reporta este error.',
    comparacion
  );
}

// ---------------------------------------------------------------------
// Metodo por boquilla: L/ha = caudal * 600 / (velocidad * espaciamiento)
// ---------------------------------------------------------------------
export function lhaPorBoquilla({ caudalLmin, velocidadKmh, espaciamientoM }) {
  requierePositivo('el caudal por boquilla', caudalLmin);
  requierePositivo('la velocidad', velocidadKmh);
  requierePositivo('el espaciamiento', espaciamientoM);

  const lha = (caudalLmin * FACTOR_LHA) / (velocidadKmh * espaciamientoM);
  const redundante = compararRutas(lha, lhaRutaSI({ caudalLmin, velocidadKmh, espaciamientoM }));
  const avisos = redundante.ok ? [] : [avisoRedundante(redundante)];

  return {
    valores: { lha },
    desglose: [
      paso(
        'L/ha por el metodo por boquilla',
        'caudal_boquilla * 600 / (velocidad * espaciamiento)',
        `${redondeoLegible(caudalLmin)} * ${FACTOR_LHA} / (${redondeoLegible(velocidadKmh)} * ${redondeoLegible(espaciamientoM)})`,
        lha,
        'L/ha'
      ),
    ],
    avisos,
    verificacion: { redundante },
  };
}

// ---------------------------------------------------------------------
// Metodo por barra completa: L/ha = caudal_total * 600 / (velocidad * ancho)
// ---------------------------------------------------------------------
export function lhaPorBarra({ caudalTotalLmin, velocidadKmh, anchoBarraM }) {
  requierePositivo('el caudal total de la barra', caudalTotalLmin);
  requierePositivo('la velocidad', velocidadKmh);
  requierePositivo('el ancho de barra', anchoBarraM);

  const lha = (caudalTotalLmin * FACTOR_LHA) / (velocidadKmh * anchoBarraM);
  // La ruta SI trata el ancho como "espaciamiento" de una sola boquilla
  // equivalente: mismo analisis dimensional.
  const redundante = compararRutas(
    lha,
    lhaRutaSI({ caudalLmin: caudalTotalLmin, velocidadKmh, espaciamientoM: anchoBarraM })
  );
  const avisos = redundante.ok ? [] : [avisoRedundante(redundante)];

  return {
    valores: { lha },
    desglose: [
      paso(
        'L/ha por el metodo por barra',
        'caudal_total * 600 / (velocidad * ancho_barra)',
        `${redondeoLegible(caudalTotalLmin)} * ${FACTOR_LHA} / (${redondeoLegible(velocidadKmh)} * ${redondeoLegible(anchoBarraM)})`,
        lha,
        'L/ha'
      ),
    ],
    avisos,
    verificacion: { redundante },
  };
}

// ---------------------------------------------------------------------
// Los dos metodos SIEMPRE juntos. Si difieren, hay una inconsistencia
// fisica real en el equipo o en los datos capturados.
// ---------------------------------------------------------------------
export function ambosMetodos({
  caudalBoquillaLmin,
  numBoquillas,
  caudalTotalLmin = null,
  velocidadKmh,
  espaciamientoM,
  anchoBarraM,
  umbralDiscrepanciaPct,
}) {
  requierePositivo('el numero de boquillas', numBoquillas);
  const total =
    caudalTotalLmin === null || caudalTotalLmin === undefined
      ? caudalBoquillaLmin * numBoquillas
      : caudalTotalLmin;

  const porBoquilla = lhaPorBoquilla({ caudalLmin: caudalBoquillaLmin, velocidadKmh, espaciamientoM });
  const porBarra = lhaPorBarra({ caudalTotalLmin: total, velocidadKmh, anchoBarraM });

  const a = porBoquilla.valores.lha;
  const b = porBarra.valores.lha;
  const discrepanciaPct = (Math.abs(a - b) / ((a + b) / 2)) * PORCIENTO;

  const avisos = [...porBoquilla.avisos, ...porBarra.avisos];
  if (umbralDiscrepanciaPct !== undefined && discrepanciaPct > umbralDiscrepanciaPct) {
    avisos.push(
      aviso(
        'advertencia',
        'metodos-discrepantes',
        `Los dos metodos difieren ${redondeoLegible(discrepanciaPct)} %: por boquilla ` +
          `${redondeoLegible(a)} L/ha contra por barra ${redondeoLegible(b)} L/ha. El ` +
          `espaciamiento por el numero de boquillas no cuadra con el ancho de barra: hay una ` +
          'inconsistencia fisica en el equipo o en los datos capturados.',
        { porBoquilla: a, porBarra: b, discrepanciaPct }
      )
    );
  }

  return {
    valores: {
      lhaPorBoquilla: a,
      lhaPorBarra: b,
      caudalTotalLmin: total,
      discrepanciaPct,
    },
    desglose: [...porBoquilla.desglose, ...porBarra.desglose],
    avisos,
    verificacion: {
      redundante: porBoquilla.verificacion.redundante.ok
        ? porBarra.verificacion.redundante
        : porBoquilla.verificacion.redundante,
    },
  };
}

// ---------------------------------------------------------------------
// Despejes (calculo inverso), todos con ida y vuelta verificada.
// ---------------------------------------------------------------------

// Caudal por boquilla requerido para un volumen objetivo.
export function caudalRequerido({ lhaObjetivo, velocidadKmh, espaciamientoM }) {
  requierePositivo('el volumen objetivo', lhaObjetivo);
  requierePositivo('la velocidad', velocidadKmh);
  requierePositivo('el espaciamiento', espaciamientoM);

  const caudal = (lhaObjetivo * velocidadKmh * espaciamientoM) / FACTOR_LHA;
  const reproducido = lhaPorBoquilla({ caudalLmin: caudal, velocidadKmh, espaciamientoM });
  const idaVuelta = verificarIdaVuelta(lhaObjetivo, reproducido.valores.lha);

  return {
    valores: { caudalLmin: caudal },
    desglose: [
      paso(
        'Caudal requerido por boquilla',
        'L/ha_objetivo * velocidad * espaciamiento / 600',
        `${redondeoLegible(lhaObjetivo)} * ${redondeoLegible(velocidadKmh)} * ${redondeoLegible(espaciamientoM)} / ${FACTOR_LHA}`,
        caudal,
        'L/min'
      ),
    ],
    avisos: idaVuelta.ok ? [] : [avisoRedundante(idaVuelta)],
    verificacion: { idaVuelta, redundante: reproducido.verificacion.redundante },
  };
}

// Caudal total de barra requerido (y por boquilla si se da el numero).
export function caudalTotalRequerido({ lhaObjetivo, velocidadKmh, anchoBarraM, numBoquillas = null }) {
  requierePositivo('el volumen objetivo', lhaObjetivo);
  requierePositivo('la velocidad', velocidadKmh);
  requierePositivo('el ancho de barra', anchoBarraM);

  const total = (lhaObjetivo * velocidadKmh * anchoBarraM) / FACTOR_LHA;
  const porBoquilla = numBoquillas ? total / requierePositivo('el numero de boquillas', numBoquillas) : null;
  const reproducido = lhaPorBarra({ caudalTotalLmin: total, velocidadKmh, anchoBarraM });
  const idaVuelta = verificarIdaVuelta(lhaObjetivo, reproducido.valores.lha);

  const desglose = [
    paso(
      'Caudal total requerido en la barra',
      'L/ha_objetivo * velocidad * ancho_barra / 600',
      `${redondeoLegible(lhaObjetivo)} * ${redondeoLegible(velocidadKmh)} * ${redondeoLegible(anchoBarraM)} / ${FACTOR_LHA}`,
      total,
      'L/min'
    ),
  ];
  if (porBoquilla !== null) {
    desglose.push(
      paso(
        'Caudal requerido por boquilla',
        'caudal_total / num_boquillas',
        `${redondeoLegible(total)} / ${numBoquillas}`,
        porBoquilla,
        'L/min'
      )
    );
  }

  return {
    valores: { caudalTotalLmin: total, caudalPorBoquillaLmin: porBoquilla },
    desglose,
    avisos: idaVuelta.ok ? [] : [avisoRedundante(idaVuelta)],
    verificacion: { idaVuelta, redundante: reproducido.verificacion.redundante },
  };
}

// Velocidad requerida para un volumen objetivo con un caudal dado.
export function velocidadRequerida({ caudalLmin, lhaObjetivo, espaciamientoM }) {
  requierePositivo('el caudal por boquilla', caudalLmin);
  requierePositivo('el volumen objetivo', lhaObjetivo);
  requierePositivo('el espaciamiento', espaciamientoM);

  const velocidad = (caudalLmin * FACTOR_LHA) / (lhaObjetivo * espaciamientoM);
  const reproducido = lhaPorBoquilla({ caudalLmin, velocidadKmh: velocidad, espaciamientoM });
  const idaVuelta = verificarIdaVuelta(lhaObjetivo, reproducido.valores.lha);

  return {
    valores: { velocidadKmh: velocidad },
    desglose: [
      paso(
        'Velocidad requerida',
        'caudal * 600 / (L/ha_objetivo * espaciamiento)',
        `${redondeoLegible(caudalLmin)} * ${FACTOR_LHA} / (${redondeoLegible(lhaObjetivo)} * ${redondeoLegible(espaciamientoM)})`,
        velocidad,
        'km/h'
      ),
    ],
    avisos: idaVuelta.ok ? [] : [avisoRedundante(idaVuelta)],
    verificacion: { idaVuelta, redundante: reproducido.verificacion.redundante },
  };
}

// Espaciamiento requerido para un volumen objetivo con caudal y
// velocidad dados.
export function espaciamientoRequerido({ caudalLmin, lhaObjetivo, velocidadKmh }) {
  requierePositivo('el caudal por boquilla', caudalLmin);
  requierePositivo('el volumen objetivo', lhaObjetivo);
  requierePositivo('la velocidad', velocidadKmh);

  const espaciamiento = (caudalLmin * FACTOR_LHA) / (lhaObjetivo * velocidadKmh);
  const reproducido = lhaPorBoquilla({ caudalLmin, velocidadKmh, espaciamientoM: espaciamiento });
  const idaVuelta = verificarIdaVuelta(lhaObjetivo, reproducido.valores.lha);

  return {
    valores: { espaciamientoM: espaciamiento },
    desglose: [
      paso(
        'Espaciamiento requerido',
        'caudal * 600 / (L/ha_objetivo * velocidad)',
        `${redondeoLegible(caudalLmin)} * ${FACTOR_LHA} / (${redondeoLegible(lhaObjetivo)} * ${redondeoLegible(velocidadKmh)})`,
        espaciamiento,
        'm'
      ),
    ],
    avisos: idaVuelta.ok ? [] : [avisoRedundante(idaVuelta)],
    verificacion: { idaVuelta, redundante: reproducido.verificacion.redundante },
  };
}

// Presion requerida en una boquilla concreta para lograr el volumen
// objetivo. Valida el resultado contra el rango de operacion del
// fabricante: una presion matematicamente correcta pero fuera de rango
// produce un patron defectuoso y una gota inadecuada.
export function presionRequerida({ lhaObjetivo, velocidadKmh, espaciamientoM, boquilla }) {
  const caudal = caudalRequerido({ lhaObjetivo, velocidadKmh, espaciamientoM });
  const presion = presionParaCaudal({
    caudalRef: boquilla.caudalRefLmin,
    presionRef: boquilla.presionRefBar,
    caudal: caudal.valores.caudalLmin,
    exponente: boquilla.exponente,
  });

  // Ida y vuelta: con esa presion, el caudal y el L/ha se reproducen.
  const caudalReproducido = caudalAPresion({
    caudalRef: boquilla.caudalRefLmin,
    presionRef: boquilla.presionRefBar,
    presion,
    exponente: boquilla.exponente,
  });
  const lhaReproducido = lhaPorBoquilla({
    caudalLmin: caudalReproducido,
    velocidadKmh,
    espaciamientoM,
  });
  const idaVuelta = verificarIdaVuelta(lhaObjetivo, lhaReproducido.valores.lha);

  const avisos = [...caudal.avisos];
  if (!idaVuelta.ok) avisos.push(avisoRedundante(idaVuelta));
  const dentroDeRango =
    presion >= boquilla.presionMinBar && presion <= boquilla.presionMaxBar;
  if (!dentroDeRango) {
    avisos.push(
      aviso(
        'advertencia',
        'presion-fuera-de-rango',
        `La presion requerida (${redondeoLegible(presion)} bar) queda fuera del rango de ` +
          `operacion de la boquilla (${redondeoLegible(boquilla.presionMinBar)} a ` +
          `${redondeoLegible(boquilla.presionMaxBar)} bar). Aunque el caudal salga exacto, el ` +
          'patron de aspersion y el tamano de gota serian defectuosos. Cambiar de tamano de ' +
          'boquilla es mejor palanca que forzar la presion.',
        {
          presionRequeridaBar: presion,
          presionMinBar: boquilla.presionMinBar,
          presionMaxBar: boquilla.presionMaxBar,
        }
      )
    );
  }

  return {
    valores: {
      presionRequeridaBar: presion,
      caudalRequeridoLmin: caudal.valores.caudalLmin,
      dentroDeRango,
    },
    desglose: [
      ...caudal.desglose,
      paso(
        'Presion requerida',
        'presion_ref * (caudal_requerido / caudal_ref) ^ (1 / exponente)',
        `${redondeoLegible(boquilla.presionRefBar)} * (${redondeoLegible(caudal.valores.caudalLmin)} / ` +
          `${redondeoLegible(boquilla.caudalRefLmin)}) ^ (1 / ${boquilla.exponente})`,
        presion,
        'bar'
      ),
    ],
    avisos,
    verificacion: { idaVuelta, redundante: caudal.verificacion.redundante },
  };
}
