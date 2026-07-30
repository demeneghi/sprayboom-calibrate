// Capa de calculo redundante.
//
// Una calibracion mal calculada tiene consecuencias graves en el
// cultivo, asi que los resultados criticos se calculan por DOS rutas
// deliberadamente independientes:
//
//   - la formula canonica de la practica agricola, con sus constantes
//     nombradas (FACTOR_LHA = 600, R_GAS imperial, etc.), y
//   - una segunda implementacion por analisis dimensional en unidades
//     SI base (m3/s, m/s, m2, Pa, K) que usa el grupo de constantes SI_*
//     de constants.js, duplicado a proposito.
//
// Si ambas rutas no coinciden dentro de la tolerancia, la interfaz NO
// muestra el numero: muestra "calculo no verificado". Ademas, todo
// despeje inverso se verifica en ida y vuelta contra la formula directa.

import {
  SI_SEG_POR_MIN,
  SI_SEG_POR_HORA,
  SI_M_POR_KM,
  SI_M2_POR_HA,
  SI_L_POR_M3,
  SI_PA_POR_PSI,
  SI_M3_POR_FT3,
  SI_R_UNIVERSAL,
  SI_K_OFFSET_CELSIUS,
  SI_F_A_C_RESTA,
  SI_F_A_C_FACTOR,
} from './constants.js';

// Tolerancia relativa para dos rutas que deberian ser matematicamente
// identicas (solo difieren por redondeo de punto flotante).
export const TOLERANCIA_REDUNDANTE = 1e-9;

// Tolerancia relativa cuando una ruta usa constantes fisicas redondeadas
// (R_GAS imperial a 6 cifras contra la R universal SI): la diferencia
// legitima es del orden de 1e-4.
export const TOLERANCIA_REDUNDANTE_GAS = 5e-4;

export function errorRelativo(a, b) {
  const base = Math.max(Math.abs(a), Math.abs(b), Number.MIN_VALUE);
  return Math.abs(a - b) / base;
}

// Compara la ruta canonica contra la redundante.
export function compararRutas(canonico, redundante, tolerancia = TOLERANCIA_REDUNDANTE) {
  const rel = errorRelativo(canonico, redundante);
  return {
    ok: Number.isFinite(canonico) && Number.isFinite(redundante) && rel <= tolerancia,
    canonico,
    redundante,
    errorRelativo: rel,
    tolerancia,
  };
}

// Verificacion de ida y vuelta de un despeje inverso: el resultado se
// reinyecta en la formula directa y debe reproducir el objetivo.
export function verificarIdaVuelta(objetivo, reproducido, tolerancia = TOLERANCIA_REDUNDANTE) {
  const rel = errorRelativo(objetivo, reproducido);
  return {
    ok: Number.isFinite(reproducido) && rel <= tolerancia,
    objetivo,
    reproducido,
    errorRelativo: rel,
    tolerancia,
  };
}

// ---------------------------------------------------------------------
// Rutas redundantes en SI puro
// ---------------------------------------------------------------------

// L/ha por analisis dimensional: caudal en m3/s entre el area barrida en
// m2/s da m3/m2, que se reescala a litros por hectarea. No usa el factor
// 600 ni ninguna constante de la ruta canonica.
export function lhaRutaSI({ caudalLmin, velocidadKmh, espaciamientoM }) {
  const caudalM3PorSeg = caudalLmin / SI_L_POR_M3 / SI_SEG_POR_MIN;
  const velocidadMPorSeg = (velocidadKmh * SI_M_POR_KM) / SI_SEG_POR_HORA;
  const areaM2PorSeg = velocidadMPorSeg * espaciamientoM;
  const m3PorM2 = caudalM3PorSeg / areaM2PorSeg;
  return m3PorM2 * SI_L_POR_M3 * SI_M2_POR_HA;
}

// Masa por pie cubico estandar via la R universal SI: presion en Pa y
// temperatura en K dan mol/m3, que se reescala a mol por pie cubico y a
// gramos con el peso molecular. No usa R_GAS imperial ni libras-mol.
export function gPorScfRutaSI({ pesoMolecular, presionEstandarPsia, temperaturaEstandarF }) {
  const presionPa = presionEstandarPsia * SI_PA_POR_PSI;
  const temperaturaK =
    (temperaturaEstandarF - SI_F_A_C_RESTA) * SI_F_A_C_FACTOR + SI_K_OFFSET_CELSIUS;
  const molPorM3 = presionPa / (SI_R_UNIVERSAL * temperaturaK);
  const molPorScf = molPorM3 * SI_M3_POR_FT3;
  return molPorScf * pesoMolecular;
}

// Masa de gas recompuesta: el factor de presion se recalcula pasando por
// pascales y los pies cubicos totales se componen en otro orden. Cuando
// la masa por SCF viene de la anulacion manual del usuario, esta es la
// unica verificacion posible (no hay peso molecular que derivar).
export function masaGasRutaSI({
  scfm,
  psiManometrica,
  presionAtmosfericaLocalPsia,
  presionEstandarCalibracionPsia,
  tiempoS,
  gPorScf,
}) {
  const presionAbsolutaPa = (psiManometrica + presionAtmosfericaLocalPsia) * SI_PA_POR_PSI;
  const presionEstandarPa = presionEstandarCalibracionPsia * SI_PA_POR_PSI;
  const factor = Math.sqrt(presionAbsolutaPa / presionEstandarPa);
  const piesCubicosTotales = (tiempoS * scfm) / SI_SEG_POR_MIN;
  return piesCubicosTotales * factor * gPorScf;
}
