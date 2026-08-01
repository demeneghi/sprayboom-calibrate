// Recetas de la guia por objetivo: orden de los pasos, estado de cada
// uno y avance. Es dominio puro, asi que se prueba sin DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECETAS,
  REQUISITOS,
  recetaPorId,
  estadoDePaso,
  progresoDeReceta,
  posicionEnReceta,
  esDeOtroDia,
} from '../assets/js/domain/recetas.js';
import { volumenConBoquilla, ambosMetodos } from '../assets/js/domain/water.js';
import { caudalAPresion, caudalConDensidad } from '../assets/js/domain/nozzles.js';
import { cercanoRel } from './helpers.js';

const AHORA = '2026-08-01T15:00:00.000Z';

// Instantanea vacia: nada capturado todavia.
function vacia(extra = {}) {
  return {
    ahora: AHORA,
    velocidad: { velocidadKmh: null, etiqueta: null },
    lhaObjetivo: null,
    lhaCalculado: null,
    lhaMedido: null,
    masaPorTablaG: null,
    dosisMezcla: null,
    flujoGas: null,
    ...extra,
  };
}

const VELOCIDAD_LISTA = { velocidadKmh: 2.59, etiqueta: 'de la marcha B1 a 1 800 rpm' };

test('cada paso de cada receta apunta a un requisito que existe', () => {
  for (const receta of RECETAS) {
    assert.ok(receta.pasos.length > 0, `${receta.id} sin pasos`);
    for (const paso of receta.pasos) {
      assert.ok(
        typeof REQUISITOS[paso.requisito] === 'function',
        `${receta.id}/${paso.id}: requisito desconocido ${paso.requisito}`
      );
      assert.ok(paso.seccion && paso.tab, `${receta.id}/${paso.id} sin destino`);
    }
  }
});

test('los identificadores de receta y de paso no se repiten', () => {
  const ids = RECETAS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'ids de receta repetidos');
  for (const receta of RECETAS) {
    const pasos = receta.pasos.map((p) => p.id);
    assert.equal(new Set(pasos).size, pasos.length, `pasos repetidos en ${receta.id}`);
    // La tira de avance ubica la pantalla por (seccion, tab): si un tab
    // apareciera dos veces en la misma receta, no sabria en cual esta.
    const destinos = receta.pasos.map((p) => `${p.seccion}/${p.tab}`);
    assert.equal(new Set(destinos).size, destinos.length, `tab repetido en ${receta.id}`);
  }
});

test('sin nada capturado, el primer paso pendiente es el primero de la receta', () => {
  const receta = recetaPorId('gasto-agua');
  const avance = progresoDeReceta(receta, vacia());
  assert.equal(avance.listos, 0);
  assert.equal(avance.completa, false);
  assert.equal(avance.siguiente.id, 'velocidad');
  // Un paso pendiente dice QUE capturar, no solo que falta.
  assert.match(avance.pasos[0].detalle, /segundos por tramo/);
});

test('el paso opcional no cuenta para el total ni impide completar', () => {
  const receta = recetaPorId('gasto-agua');
  const avance = progresoDeReceta(
    receta,
    vacia({
      velocidad: VELOCIDAD_LISTA,
      lhaCalculado: { valor: 575, fecha: AHORA, detalle: 'calculada en Gasto de agua' },
    })
  );
  assert.equal(avance.total, 2, 'el aforo es opcional y no cuenta');
  assert.equal(avance.listos, 2);
  assert.equal(avance.completa, true);
  // Completa, pero el aforo sigue ofreciendose como siguiente.
  assert.equal(avance.siguiente.id, 'aforo');
});

test('un paso listo dice de donde salio el numero', () => {
  const paso = recetaPorId('gasto-agua').pasos[0];
  const estado = estadoDePaso(paso, vacia({ velocidad: VELOCIDAD_LISTA }));
  assert.equal(estado.listo, true);
  assert.equal(estado.detalle, 'de la marcha B1 a 1 800 rpm');
});

test('un resultado de otro dia queda marcado como viejo, pero listo', () => {
  const receta = recetaPorId('gasto-agua');
  const avance = progresoDeReceta(
    receta,
    vacia({
      velocidad: VELOCIDAD_LISTA,
      lhaCalculado: { valor: 575, fecha: '2026-07-24T18:00:00.000Z', detalle: 'de Gasto de agua' },
    })
  );
  const calculo = avance.pasos.find((p) => p.id === 'calculo');
  assert.equal(calculo.listo, true, 'un dato viejo no se invalida solo');
  assert.equal(calculo.viejo, true);
  assert.equal(avance.hayViejos, true);
  assert.equal(avance.completa, true);
});

test('esDeOtroDia compara el dia, no la hora', () => {
  assert.equal(esDeOtroDia('2026-08-01T06:00:00.000Z', AHORA), false);
  assert.equal(esDeOtroDia('2026-07-31T23:59:00.000Z', AHORA), true);
  assert.equal(esDeOtroDia(null, AHORA), false, 'sin fecha no se marca nada');
});

test('el volumen vigente prefiere lo aforado sobre lo calculado', () => {
  const soloCalculado = REQUISITOS.volumenVigente(
    vacia({ lhaCalculado: { valor: 575, fecha: AHORA, detalle: 'de Gasto de agua' } })
  );
  assert.equal(soloCalculado.listo, true);
  assert.equal(soloCalculado.detalle, 'de Gasto de agua');

  const conAforo = REQUISITOS.volumenVigente(
    vacia({
      lhaCalculado: { valor: 575, fecha: AHORA, detalle: 'de Gasto de agua' },
      lhaMedido: { valor: 604, fecha: AHORA, detalle: 'aforada en la prueba de captura' },
    })
  );
  assert.equal(conAforo.detalle, 'aforada en la prueba de captura');
});

test('la receta de forzamiento encadena velocidad, volumen, masa y rotametro', () => {
  const receta = recetaPorId('forzamiento-etileno');
  assert.deepEqual(
    receta.pasos.map((p) => p.tab),
    ['avance', 'gasto', 'forzamiento', 'gas']
  );
  const avance = progresoDeReceta(
    receta,
    vacia({
      velocidad: VELOCIDAD_LISTA,
      lhaCalculado: { valor: 575, fecha: AHORA, detalle: 'de Gasto de agua' },
    })
  );
  assert.equal(avance.listos, 2);
  assert.equal(avance.siguiente.id, 'masa');
});

test('posicionEnReceta ubica la pantalla y sus vecinas', () => {
  const receta = recetaPorId('forzamiento-etileno');
  const posicion = posicionEnReceta(receta, { seccion: 'calibrar', tab: 'forzamiento' });
  assert.equal(posicion.numero, 3);
  assert.equal(posicion.total, 4);
  assert.equal(posicion.anterior.tab, 'gasto');
  assert.equal(posicion.siguiente.tab, 'gas');
  // Una pantalla fuera de la receta no pinta tira.
  assert.equal(posicionEnReceta(receta, { seccion: 'sistema', tab: 'configuracion' }), null);
});

test('solo las recetas cuyo resultado ES el L/ha ofrecen perillas', () => {
  const conPerilla = RECETAS.filter((r) => r.ajustes.length > 0).map((r) => r.id);
  assert.deepEqual(conPerilla, ['gasto-agua', 'elegir-boquilla']);
  for (const receta of RECETAS) {
    for (const ajuste of receta.ajustes) {
      assert.ok(['presion', 'velocidad'].includes(ajuste), `perilla inesperada: ${ajuste}`);
    }
  }
});

// ---------------------------------------------------------------------
// El atajo que usa la hoja de resultado tiene que dar EXACTAMENTE lo
// mismo que la cadena larga de la pantalla de Gasto de agua. Es la
// unica forma de que mover la perilla no conteste otro numero.
// ---------------------------------------------------------------------
const BOQUILLA = {
  caudalRefLmin: 1.6,
  presionRefBar: 3,
  exponente: 0.5,
  presionMinBar: 1,
  presionMaxBar: 5,
};

test('volumenConBoquilla reproduce la cadena larga de Gasto de agua', () => {
  const entrada = {
    presionBar: 2.8,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    anchoBarraM: 15.47,
    numBoquillas: 24,
    densidadRelativa: 1.05,
    umbralDiscrepanciaPct: 1,
  };
  const atajo = volumenConBoquilla({ boquilla: BOQUILLA, ...entrada });

  const caudalAgua = caudalAPresion({
    caudalRef: BOQUILLA.caudalRefLmin,
    presionRef: BOQUILLA.presionRefBar,
    presion: entrada.presionBar,
    exponente: BOQUILLA.exponente,
  });
  const caudalCaldo = caudalConDensidad({
    caudalAguaLmin: caudalAgua,
    densidadRelativa: entrada.densidadRelativa,
  });
  const largo = ambosMetodos({ caudalBoquillaLmin: caudalCaldo, ...entrada });

  assert.equal(atajo.valores.lhaPorBoquilla, largo.valores.lhaPorBoquilla);
  assert.equal(atajo.valores.lhaPorBarra, largo.valores.lhaPorBarra);
  assert.equal(atajo.valores.caudalCaldoLmin, caudalCaldo);
  assert.equal(atajo.verificacion.redundante.ok, true);
});

test('con agua limpia no se aplica correccion de densidad', () => {
  const r = volumenConBoquilla({
    boquilla: BOQUILLA,
    presionBar: 3,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    anchoBarraM: 15.47,
    numBoquillas: 24,
    densidadRelativa: 1,
    umbralDiscrepanciaPct: 1,
  });
  assert.equal(r.valores.caudalAguaLmin, r.valores.caudalCaldoLmin);
  // A la presion de referencia, el caudal es el de la ficha.
  cercanoRel(r.valores.caudalAguaLmin, 1.6, 1e-12);
  cercanoRel(r.valores.lhaPorBoquilla, 575.0, 2e-3);
});

test('subir la presion sube el L/ha y bajar la velocidad tambien', () => {
  const base = {
    boquilla: BOQUILLA,
    presionBar: 3,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    anchoBarraM: 15.47,
    numBoquillas: 24,
    umbralDiscrepanciaPct: 1,
  };
  const inicial = volumenConBoquilla(base).valores.lhaPorBoquilla;
  const masPresion = volumenConBoquilla({ ...base, presionBar: 3.5 }).valores.lhaPorBoquilla;
  const menosVelocidad = volumenConBoquilla({ ...base, velocidadKmh: 2.2 }).valores.lhaPorBoquilla;
  assert.ok(masPresion > inicial, 'más presión, más volumen');
  assert.ok(menosVelocidad > inicial, 'más despacio, más volumen');
});

test('una presion o una velocidad no positivas se rechazan, no dan NaN', () => {
  const base = {
    boquilla: BOQUILLA,
    presionBar: 3,
    velocidadKmh: 2.59,
    espaciamientoM: 0.6446,
    anchoBarraM: 15.47,
    numBoquillas: 24,
    umbralDiscrepanciaPct: 1,
  };
  assert.throws(() => volumenConBoquilla({ ...base, presionBar: 0 }));
  assert.throws(() => volumenConBoquilla({ ...base, velocidadKmh: -1 }));
  assert.throws(() => volumenConBoquilla({ ...base, boquilla: null }));
});
