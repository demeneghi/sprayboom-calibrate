// Consistencia interna de las constantes nombradas, incluida la
// consistencia cruzada entre el grupo canonico y el grupo SI de la ruta
// redundante: un error de dedo en cualquiera de los dos grupos debe
// reventar aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../assets/js/domain/constants.js';
import { cercanoRel } from './helpers.js';

test('FACTOR_LHA sale de la conversion entre L/min, km/h, metros y hectareas', () => {
  // 10000 m2/ha * 60 min/h / 1000 m/km = 600
  assert.equal((C.M2_POR_HA * C.MIN_POR_HORA) / C.M_POR_KM, C.FACTOR_LHA);
});

test('KMH_A_MS es coherente con segundos por hora y metros por km', () => {
  assert.equal(C.SEG_POR_HORA / C.M_POR_KM, C.KMH_A_MS);
});

test('FACTOR_GPA es dimensionalmente consistente con FACTOR_LHA', () => {
  // GPA = GPM * X / (mph * in). Derivando X desde la ruta metrica:
  // X = FACTOR_LHA * HA_POR_ACRE / (KM_POR_MILLA * M_POR_PULGADA)
  const implicito =
    (C.FACTOR_LHA * C.HA_POR_ACRE) / (C.KM_POR_MILLA * C.M_POR_PULGADA);
  cercanoRel(implicito, C.FACTOR_GPA, 1e-4, 'factor imperial 5940');
});

test('la pulgada es un doceavo del pie', () => {
  cercanoRel(C.M_POR_PIE / C.PULGADAS_POR_PIE, C.M_POR_PULGADA, 1e-12);
});

test('grupo SI: duplicados identicos a los canonicos', () => {
  assert.equal(C.SI_SEG_POR_MIN, C.SEG_POR_MIN);
  assert.equal(C.SI_SEG_POR_HORA, C.SEG_POR_HORA);
  assert.equal(C.SI_M_POR_KM, C.M_POR_KM);
  assert.equal(C.SI_M2_POR_HA, C.M2_POR_HA);
  assert.equal(C.SI_L_POR_M3, C.L_POR_M3);
  assert.equal(C.SI_ML_POR_L, C.ML_POR_L);
});

test('grupo SI: pascal por psi coherente con psi por bar', () => {
  // 1 bar = 100 kPa = 100000 Pa. PSI_POR_BAR viene redondeado a 7
  // decimales en la especificacion, de ahi la tolerancia de 1e-8.
  const paPorBar = 100000;
  cercanoRel(C.SI_PA_POR_PSI, paPorBar / C.PSI_POR_BAR, 1e-8);
});

test('grupo SI: metro cubico por pie cubico es el cubo del pie', () => {
  cercanoRel(C.SI_M3_POR_FT3, C.M_POR_PIE ** 3, 1e-12);
});

test('R_GAS imperial coherente con la R universal SI', () => {
  // R universal en psi*ft3/(lbmol*R):
  // Pa*m3/(mol*K) -> psi*ft3/(mol*K) -> por lbmol -> por grado Rankine
  const derivada =
    (C.SI_R_UNIVERSAL / C.SI_PA_POR_PSI / C.SI_M3_POR_FT3) *
    C.LBMOL_A_MOL *
    C.SI_F_A_C_FACTOR;
  cercanoRel(derivada, C.R_GAS, 5e-4, 'R_GAS 10.7316');
});

test('el exponente de la ISA sale de la gravedad, el aire y la R universal', () => {
  // exponente = gravedad * masa_molar_aire / (R_universal * gradiente).
  // El valor canonico esta publicado redondeado a seis cifras, de ahi la
  // tolerancia de 2e-5.
  const derivado =
    (C.SI_GRAVEDAD * C.SI_MASA_MOLAR_AIRE) /
    (C.SI_R_UNIVERSAL * C.SI_GRADIENTE_TERMICO_K_POR_M);
  cercanoRel(derivado, C.EXPONENTE_ISA, 2e-5, 'EXPONENTE_ISA 5.25588');
});

test('el gradiente de la ISA es el termico entre la temperatura al nivel del mar', () => {
  const derivado = C.SI_GRADIENTE_TERMICO_K_POR_M / C.SI_TEMPERATURA_NIVEL_MAR_K;
  cercanoRel(derivado, C.GRADIENTE_ISA_POR_M, 1e-5, 'GRADIENTE_ISA_POR_M');
});

test('la presion al nivel del mar es la misma en psia y en pascales', () => {
  cercanoRel(
    C.SI_PRESION_NIVEL_MAR_PA / C.SI_PA_POR_PSI,
    C.PRESION_NIVEL_MAR_PSIA,
    1e-5,
    'PRESION_NIVEL_MAR_PSIA 14.6959'
  );
});

test('offset Rankine coherente con offsets SI', () => {
  // 0 F = 459.67 R; 0 C = 273.15 K; 0 C = 32 F; K y R difieren en escala 5/9
  const derivado = C.SI_K_OFFSET_CELSIUS / C.SI_F_A_C_FACTOR - C.SI_F_A_C_RESTA;
  cercanoRel(derivado, C.OFFSET_RANKINE, 1e-9);
});
