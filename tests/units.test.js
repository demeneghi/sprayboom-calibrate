// Conversion de unidades: ida y vuelta sin deriva y valores de control.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAGNITUDES,
  aImperial,
  aMetrico,
  aSistema,
  deSistema,
  entreSistemas,
  equivalenteAlterno,
  esConvertible,
  magnitudDeUnidad,
  otroSistema,
  unidad,
  barAKpa,
  kpaABar,
} from '../assets/js/domain/units.js';
import { cercano, cercanoRel, generadorDeterminista, uniforme } from './helpers.js';

test('ida y vuelta metrico-imperial-metrico sin deriva en toda magnitud', () => {
  const gen = generadorDeterminista(20260730);
  for (const magnitud of Object.keys(MAGNITUDES)) {
    for (let i = 0; i < 50; i += 1) {
      const valor = uniforme(gen, 0.001, 10000);
      const vuelta = aMetrico(magnitud, aImperial(magnitud, valor));
      cercanoRel(vuelta, valor, 1e-12, `magnitud ${magnitud}`);
      const vuelta2 = aImperial(magnitud, aMetrico(magnitud, valor));
      cercanoRel(vuelta2, valor, 1e-12, `magnitud ${magnitud} (inversa)`);
    }
  }
});

test('valores de control de conversion', () => {
  cercano(aMetrico('caudal', 1), 3.785411784, 1e-9, '1 GPM en L/min');
  cercano(aImperial('presion', 1), 14.5037738, 1e-7, '1 bar en psi');
  cercano(aMetrico('velocidad', 1), 1.609344, 1e-9, '1 mph en km/h');
  cercano(aMetrico('distancia', 1), 0.3048, 1e-9, '1 ft en m');
  cercano(aMetrico('distanciaCorta', 1), 0.0254, 1e-9, '1 in en m');
  cercano(aMetrico('superficie', 1), 0.4046856, 1e-9, '1 acre en ha');
  cercano(aMetrico('masaGrande', 1), 0.45359237, 1e-9, '1 lb en kg');
  // 1 gal/acre = 3.785411784 L / 0.4046856 ha = 9.35396 L/ha
  cercano(aMetrico('volumenAplicacion', 1), 9.35396, 5e-5, '1 GPA en L/ha');
});

test('presion metrica en bar y kPa', () => {
  assert.equal(barAKpa(3), 300);
  assert.equal(kpaABar(300), 3);
});

test('aSistema y deSistema son identidad en metrico y conversion en imperial', () => {
  assert.equal(aSistema('velocidad', 10, 'metrico'), 10);
  assert.equal(deSistema('velocidad', 10, 'metrico'), 10);
  cercanoRel(aSistema('velocidad', 1.609344, 'imperial'), 1, 1e-9);
  cercanoRel(deSistema('velocidad', 1, 'imperial'), 1.609344, 1e-9);
});

test('etiquetas de unidad por sistema', () => {
  assert.equal(unidad('volumenAplicacion', 'metrico'), 'L/ha');
  assert.equal(unidad('volumenAplicacion', 'imperial'), 'gal/acre');
  assert.equal(unidad('presion', 'metrico'), 'bar');
  assert.equal(unidad('presion', 'imperial'), 'psi');
});

test('los valores nulos pasan sin tocarse (campos vacios)', () => {
  assert.equal(aImperial('caudal', null), null);
  assert.equal(aMetrico('caudal', undefined), undefined);
});

test('magnitud desconocida truena con mensaje claro', () => {
  assert.throws(() => aImperial('inexistente', 1), /Magnitud desconocida/);
});

// ---------------------------------------------------------------------
// Boton de unidades de un campo: lo que usa ui/campos.js para convertir
// lo capturado sin tocar el sistema de la aplicacion.
// ---------------------------------------------------------------------

test('otroSistema devuelve siempre el contrario', () => {
  assert.equal(otroSistema('metrico'), 'imperial');
  assert.equal(otroSistema('imperial'), 'metrico');
});

test('toda magnitud declarada es convertible; lo que no existe no lo es', () => {
  for (const magnitud of Object.keys(MAGNITUDES)) {
    assert.ok(esConvertible(magnitud), `${magnitud} deberia ser convertible`);
  }
  // Un campo sin magnitud —segundos, rpm, por ciento— no lleva boton.
  assert.equal(esConvertible(null), false);
  assert.equal(esConvertible('inexistente'), false);
});

test('entreSistemas convierte por la base metrica y la vuelta no deriva', () => {
  const gen = generadorDeterminista(20260801);
  for (const magnitud of Object.keys(MAGNITUDES)) {
    for (let i = 0; i < 20; i += 1) {
      const valor = uniforme(gen, 0.001, 10000);
      const ida = entreSistemas(magnitud, valor, 'metrico', 'imperial');
      cercanoRel(ida, aImperial(magnitud, valor), 1e-12, `magnitud ${magnitud}`);
      const vuelta = entreSistemas(magnitud, ida, 'imperial', 'metrico');
      cercanoRel(vuelta, valor, 1e-12, `magnitud ${magnitud} (vuelta)`);
    }
  }
});

test('entreSistemas con el mismo sistema no toca el valor', () => {
  assert.equal(entreSistemas('presion', 3, 'metrico', 'metrico'), 3);
  assert.equal(entreSistemas('presion', 40, 'imperial', 'imperial'), 40);
});

test('entreSistemas deja pasar el campo vacio', () => {
  assert.equal(entreSistemas('presion', null, 'metrico', 'imperial'), null);
  assert.equal(entreSistemas('presion', undefined, 'metrico', 'imperial'), undefined);
});

// ---------------------------------------------------------------------
// La equivalencia que se pinta bajo cada cifra: la misma cantidad en el
// sistema que NO esta elegido.
// ---------------------------------------------------------------------

test('toda unidad declarada se reconoce y devuelve su magnitud', () => {
  for (const [magnitud, def] of Object.entries(MAGNITUDES)) {
    for (const sistema of ['metrico', 'imperial']) {
      const encontrada = magnitudDeUnidad(def[sistema], magnitud);
      assert.deepEqual(encontrada, { magnitud, sistema }, `${magnitud} en ${sistema}`);
    }
  }
});

test("la unidad 'm' repetida se resuelve como tramo, y la magnitud desempata", () => {
  assert.deepEqual(magnitudDeUnidad('m'), { magnitud: 'distancia', sistema: 'metrico' });
  assert.deepEqual(magnitudDeUnidad('m', 'distanciaCorta'), {
    magnitud: 'distanciaCorta',
    sistema: 'metrico',
  });
  // Un espaciamiento en metros sale en pulgadas; un tramo, en pies.
  assert.equal(equivalenteAlterno(1, 'm').unidad, 'ft');
  assert.equal(equivalenteAlterno(1, 'm', 'distanciaCorta').unidad, 'in');
});

test('la equivalencia es la misma cantidad, escrita en el otro sistema', () => {
  const presion = equivalenteAlterno(2.07, 'bar');
  assert.equal(presion.unidad, 'psi');
  cercano(presion.valor, 30.022, 1e-3);

  const volumen = equivalenteAlterno(3118.2, 'L/ha');
  assert.equal(volumen.unidad, 'gal/acre');
  cercano(volumen.valor, 333.35, 1e-2);

  // Y de regreso: con el rancho en imperial, la equivalencia es metrica.
  const enMetrico = equivalenteAlterno(30.022, 'psi');
  assert.equal(enMetrico.unidad, 'bar');
  cercano(enMetrico.valor, 2.07, 1e-4);

  // La dosis de un solido y la presion absoluta del gas tambien.
  cercano(equivalenteAlterno(1, 'kg/ha').valor, 0.892179, 1e-6);
  assert.equal(equivalenteAlterno(1, 'kg/ha').unidad, 'lb/acre');
  assert.equal(equivalenteAlterno(14.7, 'psia').unidad, 'bar abs');
});

test('la equivalencia no inventa un factor: es el mismo de la magnitud', () => {
  const gen = generadorDeterminista(20260802);
  for (const [magnitud, def] of Object.entries(MAGNITUDES)) {
    if (magnitud === 'distanciaCorta') continue; // 'm' lo resuelve `distancia`
    for (let i = 0; i < 20; i += 1) {
      const valor = uniforme(gen, 0.001, 10000);
      const ida = equivalenteAlterno(valor, def.metrico, magnitud);
      cercanoRel(ida.valor, aImperial(magnitud, valor), 1e-12, `magnitud ${magnitud}`);
      const vuelta = equivalenteAlterno(ida.valor, ida.unidad, magnitud);
      cercanoRel(vuelta.valor, valor, 1e-12, `magnitud ${magnitud} (vuelta)`);
    }
  }
});

test('lo que no tiene otro sistema no lleva equivalencia', () => {
  // Segundos, rpm, por ciento y las unidades propias del rotametro.
  for (const texto of ['s', 'rpm', '%', 'SCFM', 'g/SCF', 'L/100 L', '', null, undefined]) {
    assert.equal(magnitudDeUnidad(texto), null, `unidad ${texto}`);
    assert.equal(equivalenteAlterno(1, texto), null, `unidad ${texto}`);
  }
});

test('sin cifra no hay equivalencia (campo vacio o calculo sin resolver)', () => {
  assert.equal(equivalenteAlterno(null, 'bar'), null);
  assert.equal(equivalenteAlterno(undefined, 'bar'), null);
  assert.equal(equivalenteAlterno(Number.NaN, 'bar'), null);
  assert.equal(equivalenteAlterno(Number.POSITIVE_INFINITY, 'bar'), null);
});

test('valores de control del boton, tal como los ve quien calibra', () => {
  // 3 bar en el manometro de la barra son 43.5 psi.
  cercano(entreSistemas('presion', 3, 'metrico', 'imperial'), 43.5113, 1e-4);
  // Un tanque de 600 L rotulado en galones.
  cercano(entreSistemas('volumen', 600, 'metrico', 'imperial'), 158.503, 1e-3);
  // La ficha americana de una boquilla: 0.4 GPM en L/min.
  cercano(entreSistemas('caudal', 0.4, 'imperial', 'metrico'), 1.51416, 1e-5);
});
