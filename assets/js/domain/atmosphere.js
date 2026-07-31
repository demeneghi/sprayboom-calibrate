// Dominio: presion atmosferica del SITIO a partir de su altitud.
//
// El rotametro se corrige con la presion ABSOLUTA del gas, que es la
// lectura del manometro mas la presion del aire del lugar
// (domain/flowmeter.js). Ese segundo sumando es un dato del sitio, no
// del equipo: al nivel del mar vale 14.7 psia, pero a 2000 m vale 11.5 y
// dejar el 14.7 se traduce en un 3% de error en la masa de gas
// inyectada.
//
// Nadie trae un barometro al lote, pero la altitud si se sabe (o la da
// el GPS del telefono). De ahi sale la presion con la ley de potencia de
// la atmosfera estandar internacional (ISA) para la troposfera:
//
//   P = P0 * (1 - gradiente * h)^exponente
//
// Sensibilidad, para saber cuanta precision hace falta: cerca del nivel
// del mar la presion baja 0.0017 psi por metro, o sea 1 psi cada 574 m.
// Equivocarse 30 m —lo que yerra un GPS de telefono— mueve el resultado
// 0.05 psi; poner el 14.7 estando a 2000 m lo mueve 3.2 psi. La altitud
// aproximada le gana por mucho al default.
//
// La ISA es una atmosfera PROMEDIO: el clima del dia mueve la presion
// real +-0.3 psi respecto a ella. Es un orden de magnitud menos que el
// error de no corregir por altitud, asi que se acepta y se declara; quien
// tenga una lectura barometrica del dia la captura como anulacion manual.

import {
  PRESION_NIVEL_MAR_PSIA,
  GRADIENTE_ISA_POR_M,
  EXPONENTE_ISA,
} from './constants.js';
import { aviso, requiereFinito, requierePositivo } from './validate.js';
import { paso, redondeoLegible } from './speed.js';
import {
  presionAtmosfericaRutaSI,
  compararRutas,
  TOLERANCIA_REDUNDANTE_ATMOSFERA,
} from './verify.js';

// Presion absoluta del aire a una altitud dada, en psia.
export function presionPorAltitud({ altitudM }) {
  requiereFinito('la altitud del sitio', altitudM);

  const razonTemperaturas = 1 - GRADIENTE_ISA_POR_M * altitudM;
  // La ley de potencia solo vale mientras la troposfera conserve
  // temperatura positiva; fuera de ahi el resultado seria imaginario o
  // absurdo, y es mejor un mensaje claro que un NaN.
  requierePositivo('la temperatura de la atmósfera a esa altitud', razonTemperaturas);
  const presionPsia = PRESION_NIVEL_MAR_PSIA * razonTemperaturas ** EXPONENTE_ISA;

  const redundante = compararRutas(
    presionPsia,
    presionAtmosfericaRutaSI({ altitudM }),
    TOLERANCIA_REDUNDANTE_ATMOSFERA
  );
  const avisos = redundante.ok
    ? []
    : [
        aviso(
          'error',
          'calculo-no-verificado',
          'Las dos rutas de cálculo de la presión atmosférica no coinciden: el resultado no está ' +
            'verificado y no debe usarse. Reporta este error.',
          redundante
        ),
      ];

  return {
    valores: { presionPsia, razonTemperaturas },
    desglose: [
      paso(
        'Razón de temperaturas de la atmósfera estándar',
        '1 - gradiente_isa * altitud',
        `1 - ${GRADIENTE_ISA_POR_M} * ${redondeoLegible(altitudM)}`,
        razonTemperaturas,
        ''
      ),
      paso(
        'Presión atmosférica del sitio',
        'presion_nivel_mar * razon_temperaturas^exponente_isa',
        `${PRESION_NIVEL_MAR_PSIA} * ${redondeoLegible(razonTemperaturas)}^${EXPONENTE_ISA}`,
        presionPsia,
        'psia'
      ),
    ],
    avisos,
    verificacion: { redundante },
  };
}

// Presion atmosferica local EFECTIVA del sitio: la anulacion manual gana
// sobre la derivada de la altitud y la interfaz debe indicar que esta
// anulada. Al vaciarla, vuelve a derivarse. Es el mismo patron que
// gPorScfEfectivo en domain/gas.js.
//
// sitio: { altitudM, presionAtmosfericaLocal }
export function presionAtmosfericaEfectiva({ sitio }) {
  const manual = sitio?.presionAtmosfericaLocal;
  if (manual !== null && manual !== undefined) {
    requierePositivo('la presión atmosférica local manual', manual);
    return {
      valores: { presionPsia: manual, anulado: true },
      desglose: [
        paso(
          'Presión atmosférica local (anulación manual)',
          'valor capturado por el usuario',
          `${redondeoLegible(manual)}`,
          manual,
          'psia'
        ),
      ],
      avisos: [
        aviso(
          'info',
          'presion-atmosferica-anulada',
          'La presión atmosférica local está anulada manualmente; la que se deriva de la altitud ' +
            'del sitio no se está usando.',
          { presionAtmosfericaLocal: manual }
        ),
      ],
      verificacion: null,
    };
  }

  const derivada = presionPorAltitud({ altitudM: sitio?.altitudM });
  return {
    valores: { presionPsia: derivada.valores.presionPsia, anulado: false },
    desglose: derivada.desglose,
    avisos: derivada.avisos,
    verificacion: derivada.verificacion,
  };
}
