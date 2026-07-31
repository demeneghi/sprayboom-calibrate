// Presion atmosferica del sitio derivada de su altitud.
//
// Estas pruebas cubren tres cosas distintas: que el numero coincida con
// la tabla publicada de la atmosfera estandar, que la anulacion manual
// mande cuando esta llena, y —lo que de verdad justifica la funcion— que
// el error de suponer el nivel del mar sea grande frente al error de un
// GPS de telefono.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presionPorAltitud, presionAtmosfericaEfectiva } from '../assets/js/domain/atmosphere.js';
import { factorPresion } from '../assets/js/domain/flowmeter.js';
import { SI_PA_POR_PSI } from '../assets/js/domain/constants.js';
import { cercano, cercanoRel } from './helpers.js';

// Tabla publicada de la ISA, en pascales por altitud en metros.
const TABLA_ISA_PA = {
  0: 101325,
  1000: 89876,
  2000: 79501,
  3000: 70121,
  4000: 61660,
  5000: 54048,
};

// La tabla publicada esta tabulada en altitud GEOPOTENCIAL y la formula
// de aqui recibe altitud geometrica (la que da el GPS y la que sabe el
// usuario). La diferencia crece con la altura y llega a 5e-4 relativo a
// los 5000 m; en presion son 0.004 psi, que en el factor del rotametro
// no se ven. Se declara la tolerancia en vez de fingir que coinciden.
const TOLERANCIA_TABLA = 1e-3;

test('la presion por altitud reproduce la tabla de la atmosfera estandar', () => {
  for (const [altitud, pascales] of Object.entries(TABLA_ISA_PA)) {
    const calculada = presionPorAltitud({ altitudM: Number(altitud) }).valores.presionPsia;
    cercanoRel(calculada, pascales / SI_PA_POR_PSI, TOLERANCIA_TABLA, `${altitud} m`);
  }
});

test('al nivel del mar da los 14.7 psia de siempre', () => {
  const p = presionPorAltitud({ altitudM: 0 }).valores.presionPsia;
  cercano(p, 14.7, 0.01, 'presión al nivel del mar');
});

test('la presion baja de forma monotona con la altitud', () => {
  let anterior = Infinity;
  for (let h = -500; h <= 5000; h += 100) {
    const p = presionPorAltitud({ altitudM: h }).valores.presionPsia;
    assert.ok(p < anterior, `a ${h} m la presión no bajó: ${p} >= ${anterior}`);
    anterior = p;
  }
});

test('las dos rutas de calculo coinciden en todo el rango admitido', () => {
  for (let h = -500; h <= 5000; h += 50) {
    const r = presionPorAltitud({ altitudM: h });
    assert.ok(r.verificacion.redundante.ok, `las rutas discrepan a ${h} m`);
    assert.deepEqual(r.avisos, []);
  }
});

test('una altitud que no es numero truena con mensaje claro', () => {
  assert.throws(() => presionPorAltitud({ altitudM: null }), /altitud del sitio/);
  assert.throws(() => presionPorAltitud({ altitudM: NaN }), /altitud del sitio/);
});

test('la anulacion manual gana y al vaciarla vuelve la derivacion', () => {
  const anulado = presionAtmosfericaEfectiva({
    sitio: { altitudM: 2000, presionAtmosfericaLocal: 11.9 },
  });
  assert.equal(anulado.valores.presionPsia, 11.9);
  assert.equal(anulado.valores.anulado, true);
  assert.ok(anulado.avisos.some((a) => a.codigo === 'presion-atmosferica-anulada'));

  const derivado = presionAtmosfericaEfectiva({
    sitio: { altitudM: 2000, presionAtmosfericaLocal: null },
  });
  assert.equal(derivado.valores.anulado, false);
  cercano(derivado.valores.presionPsia, 11.53, 0.01, 'presión derivada a 2000 m');
  assert.deepEqual(derivado.avisos, []);
});

// El motivo de todo esto: cuanto se equivoca quien deja el default.
test('suponer el nivel del mar a 2000 m desvia la masa de gas un 3%', () => {
  const comunes = { psiManometrica: 40, presionEstandarCalibracion: 14.7 };
  const correcto = factorPresion({
    ...comunes,
    presionAtmosfericaLocal: presionPorAltitud({ altitudM: 2000 }).valores.presionPsia,
  });
  const suponiendoNivelDelMar = factorPresion({ ...comunes, presionAtmosfericaLocal: 14.7 });
  const desvio = suponiendoNivelDelMar / correcto - 1;
  cercano(desvio, 0.031, 0.005, 'desvío por no corregir la altitud');
});

// Y por que basta con el GPS: su error de altitud es despreciable al
// lado del anterior. 30 m es el peor caso tipico de un telefono.
test('un error de 30 m del GPS mueve la masa de gas menos del 0.1%', () => {
  const comunes = { psiManometrica: 40, presionEstandarCalibracion: 14.7 };
  const factorEn = (h) =>
    factorPresion({
      ...comunes,
      presionAtmosfericaLocal: presionPorAltitud({ altitudM: h }).valores.presionPsia,
    });
  const desvio = factorEn(1970) / factorEn(2030) - 1;
  assert.ok(
    Math.abs(desvio) < 0.001,
    `un error de 30 m movió la masa ${(desvio * 100).toFixed(3)}%, se esperaba menos de 0.1%`
  );
});
