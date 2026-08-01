// Sanidad de los datos sembrados: tabla ISO 10625, clases de gota S572 y
// catalogo de boquillas. El catalogo con numeros inventados es peor que
// un catalogo vacio: estas pruebas verifican consistencia interna y
// concordancia con la tabla ISO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TABLA_ISO_10625,
  PRESION_NOMINAL_ISO_BAR,
  filaIso,
} from '../assets/js/data/iso-colors.js';
import {
  CLASES_S572_1,
  CLASES_S572_3,
  ORDEN_CLASES,
} from '../assets/js/data/droplet-classes.js';
import { CATALOGO_SIEMBRA } from '../assets/js/data/nozzle-catalog.js';
import { validarContraIso, clasificarGota, caudalAPresion } from '../assets/js/domain/nozzles.js';
import { cercanoRel } from './helpers.js';

test('tabla ISO: caudales estrictamente crecientes y hex bien formados', () => {
  for (let i = 1; i < TABLA_ISO_10625.length; i += 1) {
    assert.ok(
      TABLA_ISO_10625[i].caudalLmin > TABLA_ISO_10625[i - 1].caudalLmin,
      `caudal no creciente en ${TABLA_ISO_10625[i].tamano}`
    );
  }
  for (const fila of TABLA_ISO_10625) {
    if (fila.verificado === true) {
      assert.match(fila.hex, /^#[0-9A-F]{6}$/i, `hex de ${fila.tamano}`);
      assert.ok(fila.colorEs, `nombre de color de ${fila.tamano}`);
      assert.match(fila.ral, /^\d{4}-P$/, `RAL de ${fila.tamano}`);
    }
  }
});

test('tabla ISO: el tamano 20 tiene caudal verificado y color pendiente, no inventado', () => {
  const fila = filaIso('20');
  assert.equal(fila.caudalLmin, 8.0);
  assert.equal(fila.verificado, 'parcial');
  assert.equal(fila.hex, null);
  assert.equal(fila.ral, null);
});

test('tabla ISO: el 035 trae el color 2018 (3004-P) con nota del cambio', () => {
  const fila = filaIso('035');
  assert.equal(fila.ral, '3004-P');
  assert.match(fila.nota, /3011/);
});

test('clases de gota: ocho categorias en orden en ambas ediciones', () => {
  for (const edicion of [CLASES_S572_1, CLASES_S572_3]) {
    assert.equal(edicion.categorias.length, 8, edicion.edicion);
    assert.deepEqual(
      edicion.categorias.map((c) => c.simbolo),
      ORDEN_CLASES,
      edicion.edicion
    );
  }
});

test('clases de gota: la inversion de colores C/VC entre ediciones', () => {
  const c1 = CLASES_S572_1.categorias.find((c) => c.simbolo === 'C');
  const vc1 = CLASES_S572_1.categorias.find((c) => c.simbolo === 'VC');
  const c3 = CLASES_S572_3.categorias.find((c) => c.simbolo === 'C');
  const vc3 = CLASES_S572_3.categorias.find((c) => c.simbolo === 'VC');
  assert.equal(c1.color, 'azul');
  assert.equal(vc1.color, 'verde');
  assert.equal(c3.color, 'verde');
  assert.equal(vc3.color, 'azul');
});

test('catalogo: ids unicos y campos completos', () => {
  const ids = new Set();
  for (const b of CATALOGO_SIEMBRA) {
    assert.ok(!ids.has(b.id), `id repetido ${b.id}`);
    ids.add(b.id);
    assert.ok(b.fabricante && b.modelo && b.fuente, `${b.id} sin metadatos`);
    assert.ok(b.caudalRefLmin > 0, `${b.id} caudal`);
    assert.ok(b.presionMinBar < b.presionMaxBar, `${b.id} rango de presion`);
    assert.ok(
      b.presionRefBar >= b.presionMinBar && b.presionRefBar <= b.presionMaxBar,
      `${b.id} presion de referencia dentro del rango`
    );
    assert.ok(b.exponente > 0.3 && b.exponente < 0.7, `${b.id} exponente`);
  }
  assert.ok(CATALOGO_SIEMBRA.length >= 40, 'catalogo con siembra sustancial');
});

test('catalogo: rangos de clase de gota contiguos y dentro del rango de presion', () => {
  for (const b of CATALOGO_SIEMBRA) {
    const rangos = b.clasesGota;
    for (let i = 0; i < rangos.length; i += 1) {
      const r = rangos[i];
      assert.ok(r.presionMinBar < r.presionMaxBar, `${b.id} rango ${i}`);
      assert.ok(ORDEN_CLASES.includes(r.clase), `${b.id} clase ${r.clase}`);
      if (i > 0) {
        assert.equal(
          r.presionMinBar,
          rangos[i - 1].presionMaxBar,
          `${b.id} rangos no contiguos en ${i}`
        );
      }
    }
    if (rangos.length > 0) {
      assert.equal(rangos[0].presionMinBar, b.presionMinBar, `${b.id} inicio`);
      assert.equal(rangos[rangos.length - 1].presionMaxBar, b.presionMaxBar, `${b.id} fin`);
    }
    if (b.edicionEstandar === null) {
      assert.equal(rangos.length, 0, `${b.id} sin edicion no debe traer clases`);
    }
  }
});

test('catalogo: todo caudal declarado con tamano ISO cae dentro de la tolerancia de la norma', () => {
  for (const b of CATALOGO_SIEMBRA) {
    if (!b.tamanoIso) continue;
    const r = validarContraIso({
      tamanoIso: b.tamanoIso,
      caudalRefLmin: b.caudalRefLmin,
      presionRefBar: b.presionRefBar,
      exponente: b.exponente,
      tablaIso: TABLA_ISO_10625,
      toleranciaPct: 5,
      presionNominalIsoBar: PRESION_NOMINAL_ISO_BAR,
    });
    assert.equal(r.ok, true, `${b.id}: ${r.desviacionPct?.toFixed(2)} % contra ISO ${b.tamanoIso}`);
  }
});

test('clasificarGota funciona con las fichas del catalogo', () => {
  const xr04 = CATALOGO_SIEMBRA.find((b) => b.id === 'xr11004');
  assert.equal(clasificarGota({ boquilla: xr04, presionBar: 2 }), 'M');
  assert.equal(clasificarGota({ boquilla: xr04, presionBar: 3 }), 'F');
  assert.equal(clasificarGota({ boquilla: xr04, presionBar: 8 }), null, 'fuera de rango');
});

test('catalogo: hay boquillas de varias marcas y para los tamanos ISO grandes', () => {
  const marcas = new Set(CATALOGO_SIEMBRA.map((b) => b.fabricante));
  for (const marca of ['TeeJet', 'Lechler', 'Hypro', 'Magnojet', 'Albuz']) {
    assert.ok(marcas.has(marca), `falta la marca ${marca}`);
  }
  // Los tamanos altos son los que se usan en volumenes grandes y en
  // fertilizante liquido: si se pierden, la seleccion se queda sin
  // candidatas justo en las aplicaciones mas gastadoras.
  for (const tamano of ['08', '10', '15', '20']) {
    assert.ok(
      CATALOGO_SIEMBRA.some((b) => b.tamanoIso === tamano),
      `ninguna boquilla del tamaño ISO ${tamano}`
    );
  }
});

test('la tabla de Lechler ID-120-10 se reproduce con exponente 0.5', () => {
  const id10 = CATALOGO_SIEMBRA.find((b) => b.id === 'id120-10');
  // Tabla Lechler 2025: 3.22 a 2 bar y 6.43 a 8 bar.
  const en = (presion) =>
    caudalAPresion({
      caudalRef: id10.caudalRefLmin,
      presionRef: id10.presionRefBar,
      presion,
      exponente: id10.exponente,
    });
  cercanoRel(en(2), 3.22, 0.01, 'ID-120-10 a 2 bar');
  cercanoRel(en(8), 6.43, 0.01, 'ID-120-10 a 8 bar');
  // Clase de gota publicada: extremadamente gruesa a 3 bar, muy gruesa a 6.
  assert.equal(clasificarGota({ boquilla: id10, presionBar: 3 }), 'XC');
  assert.equal(clasificarGota({ boquilla: id10, presionBar: 6 }), 'VC');
});

test('la tabla de Hypro ULD120-08 se reproduce con exponente 0.5', () => {
  const uld08 = CATALOGO_SIEMBRA.find((b) => b.id === 'uld120-08');
  // Guia Hypro: 2.613 a 2 bar y 4.131 a 5 bar.
  const en = (presion) =>
    caudalAPresion({
      caudalRef: uld08.caudalRefLmin,
      presionRef: uld08.presionRefBar,
      presion,
      exponente: uld08.exponente,
    });
  cercanoRel(en(2), 2.613, 0.01, 'ULD120-08 a 2 bar');
  cercanoRel(en(5), 4.131, 0.01, 'ULD120-08 a 5 bar');
  // El fabricante no publica clase por presion: la ficha no la inventa.
  assert.equal(uld08.edicionEstandar, null);
  assert.equal(clasificarGota({ boquilla: uld08, presionBar: 3 }), null);
});

test('el cono lleno y el chorro solido estan sembrados, y sin clase inventada', () => {
  const conoLleno = CATALOGO_SIEMBRA.filter((b) => b.tipoPatron === 'cono-lleno');
  const chorro = CATALOGO_SIEMBRA.filter((b) => b.tipoPatron === 'chorro');
  assert.ok(conoLleno.length > 0, 'ninguna boquilla de cono lleno');
  assert.ok(chorro.length > 0, 'ninguna boquilla de chorro');
  // El catalogo no publica tamaño de gota para estas series.
  for (const b of [...conoLleno, ...chorro]) {
    assert.equal(b.edicionEstandar, null, `${b.id} no debería declarar edición`);
    assert.deepEqual(b.clasesGota, [], `${b.id} no debería traer clase`);
  }
  // El chorro solido no abre abanico ni cono: no tiene angulo que declarar.
  for (const b of chorro) {
    assert.equal(b.anguloGrados, null, `${b.id} no debería tener ángulo`);
  }
  // La FullJet lleva su angulo de cono y NO lleva tamaño ISO: su numero
  // es capacidad propia de TeeJet, no el codigo de la norma.
  for (const b of conoLleno) {
    assert.equal(b.anguloGrados, 120, `${b.id} ángulo`);
    assert.equal(b.tamanoIso, null, `${b.id} no debería declarar tamaño ISO`);
  }
});

test('la tabla de las FullJet y las StreamJet se reproduce con su exponente', () => {
  const en = (id, presion) => {
    const b = CATALOGO_SIEMBRA.find((x) => x.id === id);
    return caudalAPresion({
      caudalRef: b.caudalRefLmin,
      presionRef: b.presionRefBar,
      presion,
      exponente: b.exponente,
    });
  };
  const T = 0.05;
  cercanoRel(en('fl-15', 1), 3.56, T, 'FL-15 a 1 bar');
  cercanoRel(en('fl-15', 2), 4.84, T, 'FL-15 a 2 bar');
  cercanoRel(en('sj3-20', 1.5), 5.58, T, 'SJ3-20 a 1,5 bar');
  cercanoRel(en('sj3-20', 4), 9.31, T, 'SJ3-20 a 4 bar');
  cercanoRel(en('sj7-06', 1.5), 1.77, T, 'SJ7-06 a 1,5 bar');
  cercanoRel(en('sj7-06', 4), 2.61, T, 'SJ7-06 a 4 bar');
  // La SJ7-015 queda al 5 % justo del nominal ISO, en el borde de la
  // tolerancia: por eso va sin tamaño ISO en vez de forzarlo.
  const sj7015 = CATALOGO_SIEMBRA.find((b) => b.id === 'sj7-015');
  assert.equal(sj7015.tamanoIso, null);
  assert.match(sj7015.notas, /tolerancia/);
});

test('las series de dos angulos traen el mismo caudal y la clase de SU angulo', () => {
  // El orificio no sabe de angulo: el caudal de la 80 y el de la 110 del
  // mismo tamaño tienen que coincidir. La clase de gota no: el catalogo
  // publica una columna por angulo y a igual presion el abanico de 80
  // grados da gota mas gruesa.
  const pares = [
    ['xr8004', 'xr11004'],
    ['xr8008', 'xr11008'],
    ['ai8006', 'ai11006'],
  ];
  for (const [id80, id110] of pares) {
    const a = CATALOGO_SIEMBRA.find((b) => b.id === id80);
    const b110 = CATALOGO_SIEMBRA.find((b) => b.id === id110);
    assert.ok(a && b110, `faltan ${id80} o ${id110}`);
    assert.equal(a.anguloGrados, 80);
    assert.equal(b110.anguloGrados, 110);
    assert.equal(a.caudalRefLmin, b110.caudalRefLmin, `${id80} y ${id110} deben dar el mismo caudal`);
    assert.equal(a.tamanoIso, b110.tamanoIso);
    assert.notDeepEqual(
      a.clasesGota,
      b110.clasesGota,
      `${id80} y ${id110} no pueden tener la misma clase: el catálogo las distingue`
    );
  }
  // El 035 de XR solo existe en 80 grados y no tiene par en 110.
  assert.ok(CATALOGO_SIEMBRA.some((b) => b.id === 'xr80035'));
  assert.equal(CATALOGO_SIEMBRA.find((b) => b.id === 'xr110035'), undefined);
});

test('las AD-IA de 80 grados salen de las de 110, sin numeros propios', () => {
  const en80 = CATALOGO_SIEMBRA.filter((b) => b.id.startsWith('mj-adia80-'));
  assert.equal(en80.length, 6, 'solo seis tamaños llevan código de 80 grados');
  for (const b of en80) {
    const base = CATALOGO_SIEMBRA.find((x) => x.id === b.id.replace('adia80-', 'adia-'));
    assert.ok(base, `${b.id} sin su ficha de 110 grados`);
    assert.equal(b.anguloGrados, 80);
    assert.equal(b.caudalRefLmin, base.caudalRefLmin);
    assert.equal(b.exponente, base.exponente);
    // Magnojet publica una sola columna de clase para los dos angulos.
    assert.deepEqual(b.clasesGota, base.clasesGota);
    assert.notEqual(b.clasesGota, base.clasesGota, 'los rangos deben ser copia, no el mismo arreglo');
  }
});

test('la tabla de Magnojet se reproduce con el exponente ajustado a cada ficha', () => {
  const en = (id, presion) => {
    const b = CATALOGO_SIEMBRA.find((x) => x.id === id);
    return caudalAPresion({
      caudalRef: b.caudalRefLmin,
      presionRef: b.presionRefBar,
      presion,
      exponente: b.exponente,
    });
  };
  // Los extremos publicados de cada serie, contra la curva que usa la
  // aplicacion. La tolerancia es el mismo 5 % de la compuerta contra ISO:
  // es el criterio con el que se decidio que boquilla se podia sembrar y
  // cual no, asi que aqui queda fijado.
  const T = 0.05;
  cercanoRel(en('mj-st-03', 1.4), 0.82, T, 'ST 03 a 1,4 bar');
  cercanoRel(en('mj-st-03', 6.2), 1.7, T, 'ST 03 a 6,2 bar');
  cercanoRel(en('mj-stia-04', 2), 1.33, T, 'ST-IA 04 a 2 bar');
  cercanoRel(en('mj-stia-04', 6.2), 2.32, T, 'ST-IA 04 a 6,2 bar');
  cercanoRel(en('mj-ad-05', 2), 1.67, T, 'AD 05 a 2 bar');
  cercanoRel(en('mj-ad-05', 4.1), 2.39, T, 'AD 05 a 4,1 bar');
  cercanoRel(en('mj-adia-08', 2), 2.65, T, 'AD-IA 08 a 2 bar');
  cercanoRel(en('mj-adia-08', 7.6), 5.05, T, 'AD-IA 08 a 7,6 bar');
  cercanoRel(en('mj-mug-05', 2), 1.64, T, 'MUG 05 a 2 bar');
  cercanoRel(en('mj-mug-05', 6.2), 2.87, T, 'MUG 05 a 6,2 bar');
});

test('no se sembraron las tres fichas Magnojet que la ley presion-caudal no reproduce', () => {
  // ST 005, ST 01 y ST-IA 005: su tabla publicada se aparta mas del 5 %
  // de cualquier curva de potencia anclada en su presion de referencia.
  for (const id of ['mj-st-005', 'mj-st-01', 'mj-stia-005']) {
    assert.equal(
      CATALOGO_SIEMBRA.find((b) => b.id === id),
      undefined,
      `${id} no debería estar sembrada`
    );
  }
  // Las vecinas de la misma serie sí están: no se descartó la serie entera.
  for (const id of ['mj-st-015', 'mj-stia-01']) {
    assert.ok(CATALOGO_SIEMBRA.some((b) => b.id === id), `falta ${id}`);
  }
});

test('las clases BCPC de Magnojet quedan traducidas a los simbolos de la aplicacion', () => {
  // MUG es "ultra grossa" en todo su rango; el simbolo de la aplicacion es UC.
  for (const b of CATALOGO_SIEMBRA.filter((x) => x.serie === 'MUG')) {
    assert.deepEqual(
      b.clasesGota.map((r) => r.clase),
      ['UC'],
      `${b.id} debería ser ultra gruesa en todo su rango`
    );
  }
  // AD 01: "M" (média) a 2 bar y "F" (fina) de 3,1 bar en adelante.
  const ad01 = CATALOGO_SIEMBRA.find((b) => b.id === 'mj-ad-01');
  assert.equal(clasificarGota({ boquilla: ad01, presionBar: 2 }), 'M');
  assert.equal(clasificarGota({ boquilla: ad01, presionBar: 4 }), 'F');
  // AD-IA 08: "EG" (extremamente grossa) = XC, y "MG" (muito grossa) = VC.
  const adia08 = CATALOGO_SIEMBRA.find((b) => b.id === 'mj-adia-08');
  assert.equal(clasificarGota({ boquilla: adia08, presionBar: 3.4 }), 'XC');
  assert.equal(clasificarGota({ boquilla: adia08, presionBar: 7 }), 'VC');
});

test('la tabla del ATR 80 del fabricante se reproduce con su exponente ajustado', () => {
  const rojo = CATALOGO_SIEMBRA.find((b) => b.id === 'atr80-rojo');
  // Tabla Albuz: 1.38 a 5 bar y 2.67 a 20 bar.
  const a5 = caudalAPresion({
    caudalRef: rojo.caudalRefLmin,
    presionRef: rojo.presionRefBar,
    presion: 5,
    exponente: rojo.exponente,
  });
  const a20 = caudalAPresion({
    caudalRef: rojo.caudalRefLmin,
    presionRef: rojo.presionRefBar,
    presion: 20,
    exponente: rojo.exponente,
  });
  cercanoRel(a5, 1.38, 0.02, 'ATR rojo a 5 bar');
  cercanoRel(a20, 2.67, 0.02, 'ATR rojo a 20 bar');
});
