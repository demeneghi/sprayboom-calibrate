// Pruebas de parametrizacion: demuestran que no quedaron valores
// incrustados en las funciones de calculo. Cambiar un parametro cambia
// el resultado exactamente como dicta la fisica, y nada mas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gPorScfDerivado, gPorScfEfectivo } from '../assets/js/domain/gas.js';
import { masaGas, despejePresion } from '../assets/js/domain/flowmeter.js';
import {
  velocidadEfectiva,
  geometria,
  avance,
  marchasDeTractor,
} from '../assets/js/domain/speed.js';
import { TRACTORES_SIEMBRA } from '../assets/js/domain/defaults.js';
import { validarValor } from '../assets/js/domain/validate.js';
import { cercano, cercanoRel } from './helpers.js';

test('peso molecular 44.01 (CO2) da 51.63 g/SCF y el consumo escala 1.569', () => {
  const co2 = gPorScfDerivado({
    pesoMolecular: 44.01,
    presionEstandarPsia: 14.7,
    temperaturaEstandarF: 70,
  });
  cercano(co2.valores.gPorScf, 51.63, 0.01, 'g/SCF del CO2');

  const etileno = gPorScfDerivado({
    pesoMolecular: 28.05,
    presionEstandarPsia: 14.7,
    temperaturaEstandarF: 70,
  });
  const base = { scfm: 2.0, psiManometrica: 40, tiempoS: 898, presionAtmosfericaLocal: 14.7, presionEstandarCalibracion: 14.7 };
  const masaCo2 = masaGas({ ...base, gPorScf: co2.valores.gPorScf }).valores.masaG;
  const masaEtileno = masaGas({ ...base, gPorScf: etileno.valores.gPorScf }).valores.masaG;
  cercano(masaCo2 / masaEtileno, 1.569, 0.001, 'el consumo escala por el mismo factor');
  cercanoRel(masaCo2 / masaEtileno, 44.01 / 28.05, 1e-9, 'que es el cociente de pesos moleculares');
});

test('largo de tabla 500 m cambia tiempo y area, no la velocidad', () => {
  const con646 = avance({ velocidadKmh: 2.59, distanciaReferencia: 100, largoTabla: 646 });
  const con500 = avance({ velocidadKmh: 2.59, distanciaReferencia: 100, largoTabla: 500 });
  assert.equal(con646.valores.velocidadKmh, con500.valores.velocidadKmh);
  assert.equal(con646.valores.segundosPorTramo, con500.valores.segundosPorTramo);
  cercanoRel(con500.valores.tiempoTotalS, con646.valores.tiempoTotalS * (500 / 646), 1e-12);

  const g646 = geometria({ largoTabla: 646, anchoBarra: 15.47, numBoquillas: 24, distanciaReferencia: 100 });
  const g500 = geometria({ largoTabla: 500, anchoBarra: 15.47, numBoquillas: 24, distanciaReferencia: 100 });
  cercano(g500.valores.areaM2, 500 * 15.47, 1e-9);
  assert.equal(g646.valores.espaciamientoDerivado, g500.valores.espaciamientoDerivado);
});

test('distancia de referencia 50 m duplica tramos sin cambiar el tiempo total', () => {
  const con100 = avance({ velocidadKmh: 2.59, distanciaReferencia: 100, largoTabla: 646 });
  const con50 = avance({ velocidadKmh: 2.59, distanciaReferencia: 50, largoTabla: 646 });
  cercanoRel(con50.valores.tramosPorTabla, con100.valores.tramosPorTabla * 2, 1e-12);
  cercanoRel(con50.valores.tiempoTotalS, con100.valores.tiempoTotalS, 1e-12);
});

test('cambiar el regimen nominal altera la velocidad efectiva sin tocar las nominales', () => {
  const jd5715 = TRACTORES_SIEMBRA.find((t) => t.id === 'jd5715');
  const marchaA1 = jd5715.velocidades.find((v) => v.rango === 0 && v.marcha === 1);
  const antes = marchaA1.kmhNominal;

  const con2400 = velocidadEfectiva({ kmhNominal: antes, rpm: 1800, regimenNominal: 2400 });
  const con2200 = velocidadEfectiva({ kmhNominal: antes, rpm: 1800, regimenNominal: 2200 });
  assert.notEqual(con2400, con2200);
  cercanoRel(con2200, antes * (1800 / 2200), 1e-12);
  // La tabla guardada no se toca: las funciones son puras.
  assert.equal(marchaA1.kmhNominal, antes);
});

test('presion atmosferica local distinta de la estandar: 47.41 psi contra 45.91', () => {
  // Estos valores solo salen con el g/SCF derivado completo (32.9038...),
  // no con el redondeado: usa la derivacion.
  const g = gPorScfDerivado({
    pesoMolecular: 28.05,
    presionEstandarPsia: 14.7,
    temperaturaEstandarF: 70,
  }).valores.gPorScf;

  const conAltitud = despejePresion({
    masaObjetivoG: 2000,
    scfm: 2.0,
    tiempoS: 898,
    gPorScf: g,
    presionEstandarCalibracion: 14.7,
    presionAtmosfericaLocal: 13.2,
  });
  cercano(conAltitud.valores.psiManometrica, 47.41, 0.01, 'con atmosferica 13.2');

  const alNivelDelMar = despejePresion({
    masaObjetivoG: 2000,
    scfm: 2.0,
    tiempoS: 898,
    gPorScf: g,
    presionEstandarCalibracion: 14.7,
    presionAtmosfericaLocal: 14.7,
  });
  cercano(alNivelDelMar.valores.psiManometrica, 45.91, 0.01, 'con atmosferica 14.7');

  // La ida y vuelta cierra dentro de 1 g en los dos casos.
  for (const caso of [
    { psi: conAltitud.valores.psiManometrica, atm: 13.2 },
    { psi: alNivelDelMar.valores.psiManometrica, atm: 14.7 },
  ]) {
    const masa = masaGas({
      scfm: 2.0,
      psiManometrica: caso.psi,
      tiempoS: 898,
      gPorScf: g,
      presionEstandarCalibracion: 14.7,
      presionAtmosfericaLocal: caso.atm,
    }).valores.masaG;
    cercano(masa, 2000, 1, `ida y vuelta con atmosferica ${caso.atm}`);
  }
});

test('un tractor de 2 rangos y 4 marchas produce 8 filas sin codigo especial', () => {
  const tractor = {
    id: 'otro',
    nombre: 'Otro tractor',
    regimenNominal: 2000,
    regimenMinimo: 1000,
    regimenMaximo: 2200,
    regimenHabitual: 1600,
    numRangos: 2,
    marchasPorRango: 4,
    etiquetasRango: ['A', 'B'],
    velocidades: [0, 1].flatMap((r) =>
      [1, 2, 3, 4].map((m) => ({ rango: r, marcha: m, kmhNominal: r * 10 + m, origen: 'capturado', fecha: null }))
    ),
  };
  const filas = marchasDeTractor(tractor);
  assert.equal(filas.length, 8);
  assert.deepEqual(
    filas.map((f) => f.etiqueta),
    ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4']
  );
});

test('anulacion manual de g/SCF gana y al vaciarla vuelve la derivacion', () => {
  const gasBase = {
    pesoMolecular: 28.05,
    presionEstandarPsia: 14.7,
    temperaturaEstandarF: 70,
  };
  const anulado = gPorScfEfectivo({ gas: { ...gasBase, gPorScfManual: 30 } });
  assert.equal(anulado.valores.anulado, true);
  assert.equal(anulado.valores.gPorScf, 30);
  assert.ok(anulado.avisos.some((a) => a.codigo === 'g-scf-anulado'));

  const derivado = gPorScfEfectivo({ gas: { ...gasBase, gPorScfManual: null } });
  assert.equal(derivado.valores.anulado, false);
  cercano(derivado.valores.gPorScf, 32.9, 0.05);
});

test('un valor fuera de cotas produce el mismo mensaje en formulario e importacion', () => {
  const def = {
    etiqueta: 'Largo de tabla',
    unidad: 'm',
    min: 1,
    max: 5000,
  };
  // El formulario y la importacion llaman a la MISMA funcion: el mensaje
  // es identico por construccion. Aqui se fija el texto esperado.
  const desdeFormulario = validarValor(def, 9999);
  const desdeImportacion = validarValor(def, 9999);
  assert.equal(desdeFormulario.ok, false);
  assert.equal(desdeFormulario.mensaje, 'Largo de tabla: debe estar entre 1 y 5000 m.');
  assert.equal(desdeFormulario.mensaje, desdeImportacion.mensaje);
});
