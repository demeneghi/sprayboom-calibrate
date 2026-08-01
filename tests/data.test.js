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
  for (const marca of ['TeeJet', 'Lechler', 'Hypro', 'Albuz']) {
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
