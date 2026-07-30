// Casos de borde: deben manejarse sin romper, sin NaN y sin Infinity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometria } from '../assets/js/domain/speed.js';
import { lhaPorBoquilla, presionRequerida } from '../assets/js/domain/water.js';
import { seleccionarBoquillas } from '../assets/js/domain/nozzles.js';
import { despejePresion, despejeScfm } from '../assets/js/domain/flowmeter.js';
import { estadisticaCaptura } from '../assets/js/domain/capture.js';
import { mezclaTanque } from '../assets/js/domain/mix.js';
import { validarValor, requierePositivo } from '../assets/js/domain/validate.js';
import { cercano } from './helpers.js';

const BOQUILLA_04 = {
  id: 'iso04',
  caudalRefLmin: 1.6,
  presionRefBar: 3,
  exponente: 0.5,
  presionMinBar: 1,
  presionMaxBar: 4,
  clasesGota: [],
};

test('espaciamiento sospechoso de centimetros: advertencia explicita', () => {
  const g = geometria({
    largoTabla: 646,
    anchoBarra: 15.47,
    numBoquillas: 24,
    distanciaReferencia: 100,
    espaciamientoCapturado: 0.045,
    espaciamientoMinimoPlausible: 0.05,
    umbralDiscrepanciaPct: 1,
  });
  assert.ok(g.avisos.some((a) => a.codigo === 'espaciamiento-sospechoso-cm'));
});

test('espaciamiento capturado distinto del derivado: advertencia con magnitud, sin elegir', () => {
  const g = geometria({
    largoTabla: 646,
    anchoBarra: 15.47,
    numBoquillas: 24,
    distanciaReferencia: 100,
    espaciamientoCapturado: 0.6,
    espaciamientoMinimoPlausible: 0.05,
    umbralDiscrepanciaPct: 1,
  });
  const avisoDiscrepancia = g.avisos.find((a) => a.codigo === 'espaciamiento-discrepante');
  assert.ok(avisoDiscrepancia, 'hay advertencia');
  cercano(avisoDiscrepancia.datos.discrepanciaEspaciamientoPct, 6.92, 0.05);
  // Los dos numeros quedan disponibles: no se elige en silencio.
  cercano(g.valores.espaciamientoCapturado, 0.6, 1e-12);
  cercano(g.valores.espaciamientoDerivado, 0.6446, 0.0001);
});

test('presion requerida fuera del rango de la boquilla: advertencia con el rango', () => {
  const r = presionRequerida({
    lhaObjetivo: 1500,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    boquilla: BOQUILLA_04,
  });
  const a = r.avisos.find((x) => x.codigo === 'presion-fuera-de-rango');
  assert.ok(a, 'advertencia presente');
  assert.equal(a.datos.presionMinBar, 1);
  assert.equal(a.datos.presionMaxBar, 4);
  assert.ok(Number.isFinite(r.valores.presionRequeridaBar), 'el numero real se entrega igual');
});

test('ninguna boquilla logra el objetivo: mensaje con sugerencia, no lista vacia muda', () => {
  const r = seleccionarBoquillas({
    catalogo: [BOQUILLA_04],
    caudalRequeridoLmin: 19.48,
  });
  assert.equal(r.candidatas.length, 0);
  const a = r.avisos.find((x) => x.codigo === 'sin-candidatas');
  assert.ok(a);
  assert.match(a.mensaje, /velocidad|espaciamiento/);
  // Las fuera de rango se entregan para poder mostrarlas marcadas.
  assert.equal(r.fueraDeRango.length, 1);
});

test('objetivo de gas por debajo de la presion atmosferica: advertencia explicativa', () => {
  const r = despejePresion({
    masaObjetivoG: 100,
    scfm: 2.0,
    tiempoS: 898,
    gPorScf: 32.9,
    presionEstandarCalibracion: 14.7,
    presionAtmosfericaLocal: 14.7,
  });
  assert.ok(r.valores.psiManometrica < 0);
  assert.ok(r.avisos.some((a) => a.codigo === 'objetivo-bajo-atmosferica'));
});

test('lectura de flotador fuera de la escala del rotametro: numero real con advertencia', () => {
  const rotametro = { modelo: 'Blue-White F-550', escalaMin: 0.5, escalaMax: 4.5 };
  const r = despejeScfm({
    masaObjetivoG: 20000,
    psiManometrica: 40,
    tiempoS: 898,
    gPorScf: 32.9,
    presionEstandarCalibracion: 14.7,
    presionAtmosfericaLocal: 14.7,
    rotametro,
  });
  assert.ok(r.valores.scfm > 4.5, 'el numero no se recorta');
  assert.ok(r.avisos.some((a) => a.codigo === 'fuera-de-escala-rotametro'));
});

test('prueba de captura con una sola boquilla ya cubierta; con cero truena claro', () => {
  assert.throws(() => estadisticaCaptura({ caudalesLmin: [], umbralAtipicasPct: 10 }), /capturas/);
});

test('division entre cero: mensaje claro, no Infinity', () => {
  assert.throws(
    () => lhaPorBoquilla({ caudalLmin: 1.6, velocidadKmh: 0, espaciamientoM: 0.6446 }),
    /la velocidad debe ser mayor que cero/
  );
  assert.throws(
    () => lhaPorBoquilla({ caudalLmin: 1.6, velocidadKmh: 2.59, espaciamientoM: 0 }),
    /el espaciamiento debe ser mayor que cero/
  );
});

test('campos vacios o no numericos: rechazo con mensaje, sin NaN', () => {
  assert.throws(() => requierePositivo('la velocidad', NaN), /debe ser un número/);
  assert.throws(() => requierePositivo('la velocidad', null), /debe ser un número/);
  const def = { etiqueta: 'Velocidad', unidad: 'km/h', min: 0.1, max: 60 };
  assert.equal(validarValor(def, 'abc').ok, false);
  assert.match(validarValor(def, 'abc').mensaje, /debe ser un número/);
  assert.equal(validarValor(def, '').ok, false, 'vacio no opcional es obligatorio');
});

test('producto que excede el tanque: advertencia', () => {
  const r = mezclaTanque({
    volumenTanqueL: 100,
    lhaAplicacion: 100,
    dosis: { modo: 'por-ha', cantidad: 200, unidad: 'L' },
  });
  assert.ok(r.avisos.some((a) => a.codigo === 'producto-excede-tanque'));
});

test('carga parcial del ultimo tanque', () => {
  const r = mezclaTanque({
    volumenTanqueL: 2000,
    lhaAplicacion: 7000,
    dosis: { modo: 'por-ha', cantidad: 2, unidad: 'L' },
    areaObjetivoHa: 1,
  });
  // 7000 L totales = 3 cargas completas de 2000 + 1000 L parciales
  assert.equal(r.valores.plan.cargasCompletas, 3);
  cercano(r.valores.plan.caldoParcialL, 1000, 1e-6);
  cercano(r.valores.plan.hectareasParciales, 1000 / 7000, 1e-9);
  cercano(r.valores.plan.productoParcial, 2 * (1000 / 7000), 1e-9);
  assert.equal(r.valores.plan.tanquesNecesarios, 4);
});

test('dosis por cada 100 L muestra el equivalente por hectarea', () => {
  const r = mezclaTanque({
    volumenTanqueL: 2000,
    lhaAplicacion: 500,
    dosis: { modo: 'por-100L', cantidad: 3, unidad: 'L' },
  });
  // 3 L/100L a 500 L/ha = 15 L/ha; por carga de 4 ha = 60 L
  cercano(r.valores.dosisPorHa, 15, 1e-9);
  cercano(r.valores.productoPorCarga, 60, 1e-9);
  cercano(r.valores.aguaPorCarga, 1940, 1e-9);
  assert.equal(r.verificacion.redundante.ok, true, 'las dos rutas del producto coinciden');
});
