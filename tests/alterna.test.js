// La linea de equivalencia que va bajo cada cifra. Es solo texto —el
// factor lo pone `domain/units.js`—, pero de nada sirve una conversion
// exacta que en pantalla se lee "0.0".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimalesAlternos, textoAlterno } from '../assets/js/ui/alterna.js';

test('la equivalencia se escribe con el signo de igual y su unidad', () => {
  assert.equal(textoAlterno(2.07, 'bar', { decimales: 2 }), '= 30.02 psi');
  assert.equal(textoAlterno(2.81, 'km/h', { decimales: 2 }), '= 1.75 mph');
  // Con el rancho en imperial, la equivalencia es la metrica.
  assert.equal(textoAlterno(40, 'psi', { decimales: 2 }), '= 2.76 bar');
});

test('lo que no se convierte no imprime nada', () => {
  assert.equal(textoAlterno(12, 's'), null);
  assert.equal(textoAlterno(540, 'rpm'), null);
  assert.equal(textoAlterno(3.9, '%'), null);
  assert.equal(textoAlterno(2.5, 'SCFM'), null);
  assert.equal(textoAlterno(null, 'bar'), null);
});

test("la magnitud desempata la unidad 'm'", () => {
  assert.equal(textoAlterno(1, 'm', { decimales: 2 }), '= 3.28 ft');
  assert.equal(textoAlterno(1, 'm', { decimales: 2, magnitud: 'distanciaCorta' }), '= 39.37 in');
});

test('se suben decimales hasta conservar tres digitos significativos', () => {
  assert.equal(decimalesAlternos(333.35, 2), 2);
  assert.equal(decimalesAlternos(43.51, 2), 2);
  assert.equal(decimalesAlternos(2.07, 0), 2);
  assert.equal(decimalesAlternos(0.169, 1), 3);
  assert.equal(decimalesAlternos(0.0084, 1), 4);
  // El tope de cuatro solo limita lo que se SUBE: los decimales del dato
  // son el piso y se conservan siempre.
  assert.equal(decimalesAlternos(0.111196, 6), 6);
  assert.equal(decimalesAlternos(19.685, 4), 4);
  // Cero y no numericos se quedan con los del dato.
  assert.equal(decimalesAlternos(0, 3), 3);
  assert.equal(decimalesAlternos(Number.NaN, 3), 3);
});

test('una cifra chica no se redondea hasta desaparecer', () => {
  // 5 mL son 0.169 oz fl: con un decimal se leerian como "0.2".
  assert.equal(textoAlterno(5, 'mL', { decimales: 1 }), '= 0.169 oz fl');
  // La fila de captura del gas cuenta los psi de uno en uno; sus 30 psi
  // no pueden salir como "2 bar".
  assert.equal(textoAlterno(30, 'psi', { decimales: 0 }), '= 2.07 bar');
});
