// Dominio C: gas etileno por rotametro. Tabla de aceptacion del
// documento.
//
// Nota de interpretacion (documentada en el plan): el caso de consumo
// "1,899.7 g con tolerancia 0.1" solo sale con g/SCF = 32.90 exacto (el
// valor redondeado), asi que esa prueba lo pasa via la anulacion manual,
// ejercitando ese camino. Los casos de parametrizacion con presion
// atmosferica distinta (47.41 / 45.91 psi) solo salen con el valor
// derivado completo (32.9038...), y usan la derivacion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gPorScfDerivado, gPorScfEfectivo } from '../assets/js/domain/gas.js';
import {
  factorPresion,
  masaGas,
  despejePresion,
  despejeTiempo,
  despejeScfm,
} from '../assets/js/domain/flowmeter.js';
import { forzamientoDesdeAjuste, forzamientoDesdeObjetivo } from '../assets/js/domain/forcing.js';
import { cercano } from './helpers.js';

const PRESIONES = { presionAtmosfericaLocal: 14.7, presionEstandarCalibracion: 14.7 };
const G_SCF_REDONDEADO = 32.9;

test('derivacion de g/SCF: PM 28.05 a 14.7 psia y 70 F da 32.90', () => {
  const r = gPorScfDerivado({
    pesoMolecular: 28.05,
    presionEstandarPsia: 14.7,
    temperaturaEstandarF: 70,
  });
  cercano(r.valores.gPorScf, 32.9, 0.05);
  assert.equal(r.verificacion.redundante.ok, true, 'ruta SI del gas ideal coincide');
});

test('factor de correccion a 40 psi', () => {
  cercano(factorPresion({ psiManometrica: 40, ...PRESIONES }), 1.929, 0.001);
});

test('factor a presion atmosferica (0 psi manometrica)', () => {
  cercano(factorPresion({ psiManometrica: 0, ...PRESIONES }), 1.0, 1e-12);
});

test('consumo: 2.0 SCFM a 40 psi por 898 s con g/SCF anulado a 32.90', () => {
  const gas = {
    pesoMolecular: 28.05,
    presionEstandarPsia: 14.7,
    temperaturaEstandarF: 70,
    gPorScfManual: G_SCF_REDONDEADO,
  };
  const efectivo = gPorScfEfectivo({ gas });
  assert.equal(efectivo.valores.anulado, true, 'la anulacion manual gana');
  const r = masaGas({
    scfm: 2.0,
    psiManometrica: 40,
    tiempoS: 898,
    gPorScf: efectivo.valores.gPorScf,
    ...PRESIONES,
  });
  cercano(r.valores.masaG, 1899.7, 0.1);
  assert.equal(r.verificacion.redundante.ok, true);
});

test('presion requerida: 2.0 SCFM, 898 s, objetivo 2000 g', () => {
  const r = despejePresion({
    masaObjetivoG: 2000,
    scfm: 2.0,
    tiempoS: 898,
    gPorScf: G_SCF_REDONDEADO,
    ...PRESIONES,
  });
  cercano(r.valores.psiManometrica, 45.9, 0.05);
  assert.equal(r.verificacion.idaVuelta.ok, true);
});

test('tiempo requerido: 2.0 SCFM a 40 psi, objetivo 2000 g', () => {
  const r = despejeTiempo({
    masaObjetivoG: 2000,
    scfm: 2.0,
    psiManometrica: 40,
    gPorScf: G_SCF_REDONDEADO,
    ...PRESIONES,
  });
  cercano(r.valores.tiempoS, 945, 0.5);
  assert.equal(r.verificacion.idaVuelta.ok, true);
});

test('lectura de flotador: 40 psi, 898 s, objetivo 2000 g', () => {
  const r = despejeScfm({
    masaObjetivoG: 2000,
    psiManometrica: 40,
    tiempoS: 898,
    gPorScf: G_SCF_REDONDEADO,
    ...PRESIONES,
  });
  cercano(r.valores.scfm, 2.106, 0.001);
  assert.equal(r.verificacion.idaVuelta.ok, true);
});

test('dosis por hectarea: 1899.7 g por tabla sobre 0.999362 ha dan 1901 g/ha', () => {
  const r = forzamientoDesdeAjuste({
    scfm: 2.0,
    psiManometrica: 40,
    tiempoPorTablaS: 898,
    hectareasPorTabla: 0.999362,
    gPorScf: G_SCF_REDONDEADO,
    ...PRESIONES,
  });
  cercano(r.valores.masaPorTablaG, 1899.7, 0.1);
  cercano(r.valores.dosisGha, 1901, 0.5);
  // La advertencia de solubilidad esta siempre presente en forzamiento.
  assert.ok(r.avisos.some((a) => a.codigo === 'solubilidad-etileno'));
});

test('ida y vuelta: la presion despejada reproduce el objetivo dentro de 1 g', () => {
  const psi = despejePresion({
    masaObjetivoG: 2000,
    scfm: 2.0,
    tiempoS: 898,
    gPorScf: G_SCF_REDONDEADO,
    ...PRESIONES,
  }).valores.psiManometrica;
  const masa = masaGas({
    scfm: 2.0,
    psiManometrica: psi,
    tiempoS: 898,
    gPorScf: G_SCF_REDONDEADO,
    ...PRESIONES,
  }).valores.masaG;
  cercano(masa, 2000, 1);
});

test('forzamiento desde objetivo entrega el encadenamiento completo', () => {
  const r = forzamientoDesdeObjetivo({
    dosisObjetivoGha: 2090,
    volumenAguaLha: 7000,
    hectareasPorTabla: 0.999362,
    tiempoPorTablaS: 898,
    gPorScf: G_SCF_REDONDEADO,
    ...PRESIONES,
    modoDespeje: 'scfm',
    psiDado: 40,
    dosisReferenciaGha: 2272,
    toleranciaAlertaPct: 15,
  });
  // masa = 2090 * 0.999362 = 2088.67 g
  cercano(r.valores.masaPorTablaG, 2088.67, 0.05);
  // volumen por tabla = 7000 * 0.999362 = 6995.5 L; concentracion ~ 0.2986 g/L
  cercano(r.valores.concentracionGL, 0.2986, 0.0005);
  // dosis propia 2090 contra referencia 2272: -8 %, dentro de la tolerancia de 15
  assert.ok(!r.avisos.some((a) => a.codigo === 'dosis-fuera-de-referencia'));
  assert.ok(r.avisos.some((a) => a.codigo === 'solubilidad-etileno'));
  assert.equal(r.verificacion.idaVuelta.ok, true);
});
