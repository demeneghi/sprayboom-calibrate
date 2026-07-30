// Utilidades compartidas de las pruebas. No es un archivo de pruebas.
import assert from 'node:assert/strict';

// Igualdad numerica con tolerancia absoluta.
export function cercano(actual, esperado, tolerancia, mensaje = '') {
  assert.ok(
    Number.isFinite(actual),
    `${mensaje} valor no finito: ${actual}`.trim()
  );
  const diferencia = Math.abs(actual - esperado);
  assert.ok(
    diferencia <= tolerancia,
    `${mensaje} esperado ${esperado} +/- ${tolerancia}, se obtuvo ${actual} (dif ${diferencia})`.trim()
  );
}

// Igualdad numerica con tolerancia relativa.
export function cercanoRel(actual, esperado, toleranciaRel, mensaje = '') {
  assert.ok(
    Number.isFinite(actual),
    `${mensaje} valor no finito: ${actual}`.trim()
  );
  const base = Math.max(Math.abs(esperado), Number.EPSILON);
  const rel = Math.abs(actual - esperado) / base;
  assert.ok(
    rel <= toleranciaRel,
    `${mensaje} esperado ${esperado} (rel ${toleranciaRel}), se obtuvo ${actual} (rel ${rel})`.trim()
  );
}

// Generador congruente lineal determinista para pruebas de propiedad.
// (Math.random no se usa: las corridas deben ser reproducibles.)
export function generadorDeterminista(semilla) {
  let estado = semilla >>> 0;
  return function siguiente() {
    // Constantes de Numerical Recipes (LCG de 32 bits).
    estado = (Math.imul(1664525, estado) + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

// Valor uniforme en [min, max] a partir del generador.
export function uniforme(gen, min, max) {
  return min + gen() * (max - min);
}
