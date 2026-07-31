// Dominio B: gasto de agua. Tabla de aceptacion del documento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lhaPorBoquilla,
  lhaPorBarra,
  ambosMetodos,
  caudalRequerido,
  caudalTotalRequerido,
  velocidadRequerida,
  espaciamientoRequerido,
  presionRequerida,
} from '../assets/js/domain/water.js';
import {
  caudalAPresion,
  presionParaCaudal,
  caudalDesdeConvencionUs,
  caudalConDensidad,
  volumenEquivalenteEnAgua,
} from '../assets/js/domain/nozzles.js';
import { mezclaTanque } from '../assets/js/domain/mix.js';
import { cercano, cercanoRel } from './helpers.js';

test('L/ha por boquilla: 1.6 L/min, 0.6446 m, 2.59 km/h dan 575.0', () => {
  const r = lhaPorBoquilla({ caudalLmin: 1.6, velocidadKmh: 2.59, espaciamientoM: 0.6446 });
  cercano(r.valores.lha, 575.0, 0.05);
  assert.equal(r.verificacion.redundante.ok, true, 'ruta SI coincide');
});

test('L/ha por barra: 38.4 L/min total, 15.47 m, 2.59 km/h dan 575.0', () => {
  const r = lhaPorBarra({ caudalTotalLmin: 38.4, velocidadKmh: 2.59, anchoBarraM: 15.47 });
  cercano(r.valores.lha, 575.0, 0.2);
  assert.equal(r.verificacion.redundante.ok, true);
});

test('concordancia de metodos: diferencia menor a 0.1 L/ha', () => {
  const r = ambosMetodos({
    caudalBoquillaLmin: 1.6,
    numBoquillas: 24,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    anchoBarraM: 15.47,
    umbralDiscrepanciaPct: 1,
  });
  assert.ok(Math.abs(r.valores.lhaPorBoquilla - r.valores.lhaPorBarra) < 0.1);
  assert.ok(!r.avisos.some((a) => a.codigo === 'metodos-discrepantes'));
});

test('caudal requerido para 7000 L/ha: 467.5 total y 19.48 por boquilla', () => {
  const r = caudalTotalRequerido({
    lhaObjetivo: 7000,
    velocidadKmh: 2.59,
    anchoBarraM: 15.47,
    numBoquillas: 24,
  });
  cercano(r.valores.caudalTotalLmin, 467.5, 0.06, 'caudal total');
  cercano(r.valores.caudalPorBoquillaLmin, 19.48, 0.005, 'por boquilla');
  assert.equal(r.verificacion.idaVuelta.ok, true);
});

test('presion a la baja: ISO 04 de 1.6 L/min a 3 bar, bajando a 2 bar', () => {
  const c = caudalAPresion({ caudalRef: 1.6, presionRef: 3, presion: 2, exponente: 0.5 });
  cercano(c, 1.306, 0.001);
});

test('presion al alza: subiendo a 4 bar', () => {
  const c = caudalAPresion({ caudalRef: 1.6, presionRef: 3, presion: 4, exponente: 0.5 });
  cercano(c, 1.848, 0.001);
});

test('cuadruplicar la presion apenas duplica el caudal', () => {
  const c = caudalAPresion({ caudalRef: 1.6, presionRef: 3, presion: 12, exponente: 0.5 });
  cercano(c, 3.2, 1e-9, 'el doble exacto');
});

test('reconciliacion ISO contra US: 0.4 GPM a 40 psi escalado a 3 bar', () => {
  const r = caudalDesdeConvencionUs({
    gpm: 0.4,
    psiReferencia: 40,
    presionObjetivoBar: 3,
    exponente: 0.5,
  });
  cercano(r.valores.caudalLmin, 1.579, 0.001, 'caudal a 3 bar');
  // 1.3 % abajo del 1.6 de la tabla ISO: dentro de la tolerancia de 5 %.
  const desviacionPct = ((r.valores.caudalLmin - 1.6) / 1.6) * 100;
  cercano(desviacionPct, -1.3, 0.05, 'desviacion contra ISO');
});

test('despeje de presion valida contra el rango de la boquilla', () => {
  const boquilla = {
    caudalRefLmin: 1.6,
    presionRefBar: 3,
    exponente: 0.5,
    presionMinBar: 1,
    presionMaxBar: 4,
  };
  const dentro = presionRequerida({
    lhaObjetivo: 575,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    boquilla,
  });
  cercano(dentro.valores.presionRequeridaBar, 3, 0.01, 'presion cerca de 3 bar');
  assert.equal(dentro.valores.dentroDeRango, true);
  assert.equal(dentro.verificacion.idaVuelta.ok, true);

  const fuera = presionRequerida({
    lhaObjetivo: 1200,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    boquilla,
  });
  assert.equal(fuera.valores.dentroDeRango, false);
  assert.ok(fuera.avisos.some((a) => a.codigo === 'presion-fuera-de-rango'));
});

test('velocidad y espaciamiento requeridos cierran la ida y vuelta', () => {
  const v = velocidadRequerida({ caudalLmin: 1.6, lhaObjetivo: 575, espaciamientoM: 0.6446 });
  assert.equal(v.verificacion.idaVuelta.ok, true);
  cercano(v.valores.velocidadKmh, 2.59, 0.005);

  const e = espaciamientoRequerido({ caudalLmin: 1.6, lhaObjetivo: 575, velocidadKmh: 2.59 });
  assert.equal(e.verificacion.idaVuelta.ok, true);
  cercano(e.valores.espaciamientoM, 0.6446, 0.0001);
});

test('correccion por densidad del caldo en ambos sentidos', () => {
  // Un caldo de densidad 1.2 sale mas despacio por la misma boquilla.
  const caudalCaldo = caudalConDensidad({ caudalAguaLmin: 1.6, densidadRelativa: 1.2 });
  cercanoRel(caudalCaldo, 1.6 / Math.sqrt(1.2), 1e-12);
  // Sentido de calibracion: para aplicar 500 L/ha de caldo, calibrar con
  // agua a 500 * raiz(1.2).
  const enAgua = volumenEquivalenteEnAgua({ volumenCaldoLha: 500, densidadRelativa: 1.2 });
  cercanoRel(enAgua, 500 * Math.sqrt(1.2), 1e-12);
  // Con densidad 1.0 no cambia nada.
  cercanoRel(caudalConDensidad({ caudalAguaLmin: 1.6, densidadRelativa: 1 }), 1.6, 1e-12);
});

test('hectareas por carga: tanque de 2000 L a 7000 L/ha', () => {
  const r = mezclaTanque({ volumenTanqueL: 2000, lhaAplicacion: 7000 });
  cercano(r.valores.hectareasPorCarga, 0.2857, 0.0001);
});

test('el exponente presion-caudal es por boquilla y el ciclo inverso cierra', () => {
  const exponente = 0.42; // boquilla de induccion de aire hipotetica
  const caudal = caudalAPresion({ caudalRef: 1.6, presionRef: 3, presion: 4, exponente });
  const presion = presionParaCaudal({ caudalRef: 1.6, presionRef: 3, caudal, exponente });
  cercanoRel(presion, 4, 1e-9, 'ciclo cerrado con exponente distinto de 0.5');
  const caudalMedio = caudalAPresion({ caudalRef: 1.6, presionRef: 3, presion: 4, exponente: 0.5 });
  assert.notEqual(caudal, caudalMedio, 'el exponente cambia el escalado');
});
