// Dominio A: TDF y escenarios de bomba a regimen reducido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tdfRpm,
  estadoBombaARegimen,
  contrasteVolumenPorRegimen,
  ESCENARIOS_BOMBA,
} from '../assets/js/domain/pump.js';
import { cercano } from './helpers.js';

test('TDF a regimen reducido: 540 nominales a 2017 rpm, motor a 1500', () => {
  const r = tdfRpm({ tdfNominal: 540, rpmMotor: 1500, rpmMotorTdfNominal: 2017 });
  cercano(r.valores.tdfRpm, 402, 0.5, 'TDF rpm');
  cercano(r.valores.porcentajeNominal, 74.4, 0.05, 'porcentaje');
});

test('TDF a regimen reducido: mismo caso con motor a 1800', () => {
  const r = tdfRpm({ tdfNominal: 540, rpmMotor: 1800, rpmMotorTdfNominal: 2017 });
  cercano(r.valores.tdfRpm, 482, 0.5, 'TDF rpm');
  cercano(r.valores.porcentajeNominal, 89.2, 0.05, 'porcentaje');
});

test('bomba positiva con regulador: calibrada a 2100, operando a 1500, +40 % de volumen', () => {
  const r = contrasteVolumenPorRegimen({
    tipoBomba: 'positiva',
    conRegulador: true,
    rpmTrabajo: 1500,
    rpmCalibracion: 2100,
    presionCalibracionBar: 3,
    caudalCalibracionLmin: 1.6,
    kmhNominalMarcha: 2.4,
    regimenNominalTractor: 2100,
    espaciamientoM: 0.6446,
  });
  assert.equal(r.valores.escenario, ESCENARIOS_BOMBA.PRESION_SOSTENIDA);
  cercano(r.valores.factorVolumen, 1.4, 0.001, 'factor de volumen');
  cercano(r.valores.desviacionPct, 40.0, 0.05, 'desviacion porcentual');
  // La presion no delata nada: sigue en la de calibracion.
  cercano(r.valores.presionEstimadaBar, 3, 1e-9);
});

test('bomba centrifuga sin regulacion: mismo caso, volumen sin cambio dentro de 0.5 %', () => {
  const r = contrasteVolumenPorRegimen({
    tipoBomba: 'centrifuga',
    conRegulador: false,
    rpmTrabajo: 1500,
    rpmCalibracion: 2100,
    presionCalibracionBar: 3,
    caudalCalibracionLmin: 1.6,
    kmhNominalMarcha: 2.4,
    regimenNominalTractor: 2100,
    espaciamientoM: 0.6446,
  });
  assert.equal(r.valores.escenario, ESCENARIOS_BOMBA.CENTRIFUGA_SIN_REGULACION);
  cercano(r.valores.desviacionPct, 0, 0.5, 'volumen casi constante');
  // La presion si cae con el cuadrado del regimen: 3 * (1500/2100)^2
  cercano(r.valores.presionEstimadaBar, 3 * (1500 / 2100) ** 2, 1e-9, 'presion estimada');
});

test('los dos escenarios difieren 40 puntos porcentuales de dosis', () => {
  const base = {
    rpmTrabajo: 1500,
    rpmCalibracion: 2100,
    presionCalibracionBar: 3,
    caudalCalibracionLmin: 1.6,
    kmhNominalMarcha: 2.4,
    regimenNominalTractor: 2100,
    espaciamientoM: 0.6446,
  };
  const positiva = contrasteVolumenPorRegimen({ ...base, tipoBomba: 'positiva', conRegulador: true });
  const centrifuga = contrasteVolumenPorRegimen({
    ...base,
    tipoBomba: 'centrifuga',
    conRegulador: false,
  });
  cercano(positiva.valores.desviacionPct - centrifuga.valores.desviacionPct, 40, 0.5);
});

test('sin calibracion registrada no se estima y se avisa', () => {
  const r = estadoBombaARegimen({
    tipoBomba: 'positiva',
    conRegulador: true,
    rpmMotor: 1500,
    rpmCalibracion: null,
    presionCalibracionBar: null,
    caudalCalibracionLmin: null,
  });
  assert.equal(r.valores.escenario, null);
  assert.ok(r.avisos.some((a) => a.codigo === 'sin-calibracion-de-presion'));
});

test('operar a regimen distinto del de calibracion produce advertencia', () => {
  const r = estadoBombaARegimen({
    tipoBomba: 'positiva',
    conRegulador: true,
    rpmMotor: 1500,
    rpmCalibracion: 2100,
    presionCalibracionBar: 3,
    caudalCalibracionLmin: 1.6,
  });
  assert.ok(r.avisos.some((a) => a.codigo === 'regimen-distinto-a-calibracion'));
});
