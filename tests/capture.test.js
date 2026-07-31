// Dominio B: prueba de captura (aforo). Caso de aceptacion del documento.
//
// Nota de interpretacion acordada con el usuario: el caso marca como
// atipica la boquilla de 1.71 L/min (6.32 % de desviacion), lo cual solo
// ocurre con un umbral menor al default de 10 %. El umbral es parametro
// explicito de la funcion: esta prueba pasa 5 % para verificar el
// marcado, y el default de la aplicacion queda en 10 % (defaults.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadisticaCaptura, caudalDesdeVolumen } from '../assets/js/domain/capture.js';
import { valorDefault } from '../assets/js/domain/defaults.js';
import { cercano } from './helpers.js';

const CAUDALES = [1.58, 1.62, 1.6, 1.55, 1.71, 1.59];

test('prueba de captura: media, CV poblacional y muestral, atipica de 1.71', () => {
  const r = estadisticaCaptura({ caudalesLmin: CAUDALES, umbralAtipicasPct: 5 });
  cercano(r.valores.mediaLmin, 1.6083, 0.0005, 'media');
  cercano(r.valores.cvPoblacionalPct, 3.12, 0.005, 'CV poblacional');
  cercano(r.valores.cvMuestralPct, 3.41, 0.005, 'CV muestral');
  assert.equal(r.valores.atipicas.length, 1, 'solo la de 1.71');
  assert.equal(r.valores.atipicas[0].indice, 4);
  cercano(r.valores.atipicas[0].desviacionPct, 6.32, 0.005, 'desviacion de la atipica');
  assert.ok(r.avisos.some((a) => a.codigo === 'boquillas-atipicas'));
});

test('con el umbral default de la aplicacion (10 %) la de 1.71 no se marca', () => {
  const umbralDefault = valorDefault('umbrales', 'umbralAtipicas');
  assert.equal(umbralDefault, 10);
  const r = estadisticaCaptura({ caudalesLmin: CAUDALES, umbralAtipicasPct: umbralDefault });
  assert.equal(r.valores.atipicas.length, 0);
  // La desviacion por boquilla se reporta igual, se marque o no.
  cercano(r.valores.porBoquilla[4].desviacionPct, 6.32, 0.005);
});

test('volumenes en mililitros con tiempo de captura se convierten a L/min', () => {
  // 1600 mL en 60 s = 1.6 L/min
  cercano(caudalDesdeVolumen({ volumenMl: 1600, tiempoS: 60 }), 1.6, 1e-12);
  const r = estadisticaCaptura({
    volumenesMl: [1580, 1620, 1600, 1550, 1710, 1590],
    tiempoS: 60,
    umbralAtipicasPct: 5,
  });
  cercano(r.valores.mediaLmin, 1.6083, 0.0005);
  assert.equal(r.valores.atipicas.length, 1);
});

test('desgaste implicito contra el caudal teorico de catalogo', () => {
  const r = estadisticaCaptura({
    caudalesLmin: CAUDALES,
    umbralAtipicasPct: 10,
    caudalTeoricoLmin: 1.5,
  });
  // media 1.6083 contra 1.5 teorico: +7.2 % de desgaste
  cercano(r.valores.desgastePct, 7.22, 0.05);
});

test('L/ha real medido y comparacion contra objetivo', () => {
  const r = estadisticaCaptura({
    caudalesLmin: CAUDALES,
    umbralAtipicasPct: 10,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    lhaObjetivo: 575,
  });
  cercano(r.valores.lhaRealMedido, 578.0, 0.5, 'L/ha real con la media 1.6083');
  cercano(r.valores.comparacionObjetivoPct, 0.52, 0.05, 'contra objetivo');
  assert.equal(r.verificacion.redundante.ok, true);
});

test('una sola boquilla: sin CV, con explicacion', () => {
  const r = estadisticaCaptura({ caudalesLmin: [1.6], umbralAtipicasPct: 10 });
  assert.equal(r.valores.cvPoblacionalPct, null);
  assert.equal(r.valores.dePoblacional, null);
  assert.ok(r.avisos.some((a) => a.codigo === 'cv-indefinido'));
  cercano(r.valores.mediaLmin, 1.6, 1e-12);
});

test('sin capturas registradas truena con mensaje claro', () => {
  assert.throws(
    () => estadisticaCaptura({ caudalesLmin: [], umbralAtipicasPct: 10 }),
    /no hay capturas/
  );
});
