// Pruebas de propiedad deterministas (semilla fija): barren
// combinaciones de parametros verificando que la ruta canonica y la SI
// coinciden y que todos los ciclos inversos cierran. Son la red de
// seguridad del mecanismo de calculo redundante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lhaPorBoquilla,
  caudalRequerido,
  velocidadRequerida,
  espaciamientoRequerido,
} from '../assets/js/domain/water.js';
import { caudalAPresion, presionParaCaudal } from '../assets/js/domain/nozzles.js';
import { masaGas, despejePresion, despejeTiempo, despejeScfm } from '../assets/js/domain/flowmeter.js';
import { gPorScfDerivado } from '../assets/js/domain/gas.js';
import { mezclaTanque } from '../assets/js/domain/mix.js';
import { generadorDeterminista, uniforme } from './helpers.js';

const RONDAS = 200;

test('propiedad: L/ha canonico y ruta SI coinciden en todo el espacio razonable', () => {
  const gen = generadorDeterminista(1001);
  for (let i = 0; i < RONDAS; i += 1) {
    const r = lhaPorBoquilla({
      caudalLmin: uniforme(gen, 0.05, 30),
      velocidadKmh: uniforme(gen, 0.3, 30),
      espaciamientoM: uniforme(gen, 0.1, 2),
    });
    assert.equal(r.verificacion.redundante.ok, true, `ronda ${i}`);
  }
});

test('propiedad: los despejes de agua cierran la ida y vuelta', () => {
  const gen = generadorDeterminista(1002);
  for (let i = 0; i < RONDAS; i += 1) {
    const lha = uniforme(gen, 50, 10000);
    const v = uniforme(gen, 0.3, 30);
    const e = uniforme(gen, 0.1, 2);
    const q = uniforme(gen, 0.05, 30);
    assert.equal(caudalRequerido({ lhaObjetivo: lha, velocidadKmh: v, espaciamientoM: e }).verificacion.idaVuelta.ok, true);
    assert.equal(velocidadRequerida({ caudalLmin: q, lhaObjetivo: lha, espaciamientoM: e }).verificacion.idaVuelta.ok, true);
    assert.equal(espaciamientoRequerido({ caudalLmin: q, lhaObjetivo: lha, velocidadKmh: v }).verificacion.idaVuelta.ok, true);
  }
});

test('propiedad: presion-caudal cierra el ciclo con exponentes diversos', () => {
  const gen = generadorDeterminista(1003);
  for (let i = 0; i < RONDAS; i += 1) {
    const caudalRef = uniforme(gen, 0.2, 8);
    const presionRef = uniforme(gen, 1, 5);
    const exponente = uniforme(gen, 0.3, 0.7);
    const presion = uniforme(gen, 0.5, 10);
    const caudal = caudalAPresion({ caudalRef, presionRef, presion, exponente });
    const presionVuelta = presionParaCaudal({ caudalRef, presionRef, caudal, exponente });
    const rel = Math.abs(presionVuelta - presion) / presion;
    assert.ok(rel < 1e-9, `ronda ${i}: rel ${rel}`);
  }
});

test('propiedad: masa de gas canonica y recompuesta coinciden; despejes cierran', () => {
  const gen = generadorDeterminista(1004);
  for (let i = 0; i < RONDAS; i += 1) {
    const params = {
      gPorScf: uniforme(gen, 5, 100),
      presionEstandarCalibracion: uniforme(gen, 10, 18),
      presionAtmosfericaLocal: uniforme(gen, 9, 16),
    };
    const scfm = uniforme(gen, 0.2, 6);
    const psi = uniforme(gen, 0, 120);
    const t = uniforme(gen, 30, 3600);

    const masa = masaGas({ scfm, psiManometrica: psi, tiempoS: t, ...params });
    assert.equal(masa.verificacion.redundante.ok, true, `masa ronda ${i}`);

    const objetivo = masa.valores.masaG;
    assert.equal(
      despejeTiempo({ masaObjetivoG: objetivo, scfm, psiManometrica: psi, ...params }).verificacion.idaVuelta.ok,
      true,
      `tiempo ronda ${i}`
    );
    assert.equal(
      despejeScfm({ masaObjetivoG: objetivo, psiManometrica: psi, tiempoS: t, ...params }).verificacion.idaVuelta.ok,
      true,
      `scfm ronda ${i}`
    );
    const presion = despejePresion({ masaObjetivoG: objetivo, scfm, tiempoS: t, ...params });
    if (presion.valores.psiManometrica >= 0) {
      assert.equal(presion.verificacion.idaVuelta.ok, true, `presion ronda ${i}`);
    }
  }
});

test('propiedad: derivacion de g/SCF coincide con la ruta SI para gases diversos', () => {
  const gen = generadorDeterminista(1005);
  for (let i = 0; i < RONDAS; i += 1) {
    const r = gPorScfDerivado({
      pesoMolecular: uniforme(gen, 2, 150),
      presionEstandarPsia: uniforme(gen, 8, 18),
      temperaturaEstandarF: uniforme(gen, 32, 120),
    });
    assert.equal(r.verificacion.redundante.ok, true, `ronda ${i}`);
  }
});

test('propiedad: el producto por carga coincide por sus dos rutas', () => {
  const gen = generadorDeterminista(1006);
  for (let i = 0; i < RONDAS; i += 1) {
    const modo = gen() < 0.5 ? 'por-ha' : 'por-100L';
    const r = mezclaTanque({
      volumenTanqueL: uniforme(gen, 100, 10000),
      lhaAplicacion: uniforme(gen, 50, 10000),
      dosis: { modo, cantidad: uniforme(gen, 0.01, 20), unidad: 'L' },
    });
    assert.equal(r.verificacion.redundante.ok, true, `ronda ${i}`);
  }
});
