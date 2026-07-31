// Dominio C: propiedades del gas. Derivacion de la masa por pie cubico
// estandar (g/SCF) a partir del peso molecular y las condiciones
// estandar de calibracion del rotametro, con verificacion redundante por
// la ruta SI (R universal) y anulacion manual que gana cuando esta llena.

import { R_GAS, OFFSET_RANKINE, LBMOL_A_MOL } from './constants.js';
import { aviso, requierePositivo } from './validate.js';
import { paso, redondeoLegible } from './speed.js';
import { gPorScfRutaSI, compararRutas, TOLERANCIA_REDUNDANTE_GAS } from './verify.js';

// Masa por pie cubico estandar, derivada del gas ideal en unidades
// imperiales. R_GAS trabaja en libras-mol: omitir LBMOL_A_MOL dejaria el
// resultado tres ordenes de magnitud abajo.
export function gPorScfDerivado({ pesoMolecular, presionEstandarPsia, temperaturaEstandarF }) {
  requierePositivo('el peso molecular', pesoMolecular);
  requierePositivo('la presión estándar de calibración', presionEstandarPsia);
  requierePositivo(
    'la temperatura estándar en Rankine',
    temperaturaEstandarF + OFFSET_RANKINE
  );

  const temperaturaRankine = temperaturaEstandarF + OFFSET_RANKINE;
  const lbmolPorFt3 = presionEstandarPsia / (R_GAS * temperaturaRankine);
  const gPorScf = lbmolPorFt3 * LBMOL_A_MOL * pesoMolecular;

  const redundante = compararRutas(
    gPorScf,
    gPorScfRutaSI({ pesoMolecular, presionEstandarPsia, temperaturaEstandarF }),
    TOLERANCIA_REDUNDANTE_GAS
  );
  const avisos = redundante.ok
    ? []
    : [
        aviso(
          'error',
          'calculo-no-verificado',
          'Las dos rutas de cálculo de g/SCF no coinciden: el resultado no está verificado ' +
            'y no debe usarse. Reporta este error.',
          redundante
        ),
      ];

  return {
    valores: { gPorScf, lbmolPorFt3, temperaturaRankine },
    desglose: [
      paso(
        'Temperatura en Rankine',
        'T_F + 459.67',
        `${redondeoLegible(temperaturaEstandarF)} + ${OFFSET_RANKINE}`,
        temperaturaRankine,
        'R'
      ),
      paso(
        'Libras-mol por pie cúbico',
        'P_estandar / (R_GAS * T_Rankine)',
        `${redondeoLegible(presionEstandarPsia)} / (${R_GAS} * ${redondeoLegible(temperaturaRankine)})`,
        lbmolPorFt3,
        'lbmol/ft3'
      ),
      paso(
        'Gramos por pie cúbico estándar',
        'lbmol_por_ft3 * 453.592 * peso_molecular',
        `${redondeoLegible(lbmolPorFt3)} * ${LBMOL_A_MOL} * ${redondeoLegible(pesoMolecular)}`,
        gPorScf,
        'g/SCF'
      ),
    ],
    avisos,
    verificacion: { redundante },
  };
}

// Valor efectivo de g/SCF de un gas: la anulacion manual gana sobre el
// derivado y la interfaz debe indicar que esta anulado. Al vaciarla,
// vuelve a derivarse.
export function gPorScfEfectivo({ gas }) {
  if (gas.gPorScfManual !== null && gas.gPorScfManual !== undefined) {
    requierePositivo('la masa por pie cúbico manual', gas.gPorScfManual);
    return {
      valores: { gPorScf: gas.gPorScfManual, anulado: true },
      desglose: [
        paso(
          'Masa por pie cúbico estándar (anulación manual)',
          'valor de tabla del proveedor',
          `${redondeoLegible(gas.gPorScfManual)}`,
          gas.gPorScfManual,
          'g/SCF'
        ),
      ],
      avisos: [
        aviso(
          'info',
          'g-scf-anulado',
          'La masa por pie cúbico estándar está anulada manualmente con un valor de tabla ' +
            'del proveedor; el valor derivado del peso molecular no se esta usando.',
          { gPorScfManual: gas.gPorScfManual }
        ),
      ],
      verificacion: null,
    };
  }

  const derivado = gPorScfDerivado({
    pesoMolecular: gas.pesoMolecular,
    presionEstandarPsia: gas.presionEstandarPsia,
    temperaturaEstandarF: gas.temperaturaEstandarF,
  });
  return {
    valores: { gPorScf: derivado.valores.gPorScf, anulado: false },
    desglose: derivado.desglose,
    avisos: derivado.avisos,
    verificacion: derivado.verificacion,
  };
}
