// Asistente por objetivo: los pasos son DATOS, no pantallas. Es dominio
// puro, asi que se prueba sin DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECETAS,
  PASOS,
  recetaPorId,
  pasoPorId,
  pasosDeReceta,
  estadoDePaso,
  progresoDeReceta,
  indiceDelSiguiente,
} from '../assets/js/domain/recetas.js';
import { DATOS, dato, clavesDeJornada } from '../assets/js/domain/datos.js';
import { migrarJornada } from '../assets/js/storage.js';
import { volumenConBoquilla, ambosMetodos } from '../assets/js/domain/water.js';
import { caudalAPresion, caudalConDensidad } from '../assets/js/domain/nozzles.js';
import { cercanoRel } from './helpers.js';

function instantanea(datos = {}, extra = {}) {
  return { datos, vistos: [], lhaMedido: null, ...extra };
}

// ---------------------------------------------------------------------
// Coherencia del registro y de las recetas
// ---------------------------------------------------------------------
test('cada paso pide datos que existen en el registro', () => {
  for (const paso of Object.values(PASOS)) {
    for (const id of paso.datos) {
      assert.ok(DATOS[id], `${paso.id} pide un dato desconocido: ${id}`);
      assert.ok(dato(id).etiqueta, `${id} sin etiqueta`);
    }
  }
});

test('cada receta apunta a pasos declarados y sin repetir', () => {
  const ids = RECETAS.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'ids de receta repetidos');
  for (const receta of RECETAS) {
    assert.ok(receta.pasos.length > 0, `${receta.id} sin pasos`);
    assert.equal(
      new Set(receta.pasos).size,
      receta.pasos.length,
      `${receta.id} repite un paso`
    );
    for (const id of receta.pasos) assert.doesNotThrow(() => pasoPorId(id));
  }
});

// Esta es LA prueba del cambio de rumbo: si un dato apareciera en dos
// pasos de la misma receta, el asistente lo pediria dos veces y
// volveriamos al defecto que se vio en campo.
test('ninguna receta pide el mismo dato dos veces', () => {
  for (const receta of RECETAS) {
    const pedidos = pasosDeReceta(receta).flatMap((p) => p.datos);
    const repetidos = pedidos.filter((id, i) => pedidos.indexOf(id) !== i);
    assert.deepEqual(repetidos, [], `${receta.id} pide dos veces: ${repetidos.join(', ')}`);
  }
});

test('un dato compartido se declara en un solo sitio', () => {
  // Los datos sin `guarda` viven en la jornada; los que la tienen, en el
  // borrador de SU pantalla. Dos datos distintos no pueden apuntar al
  // mismo sitio, o volverian a pisarse.
  const sitios = new Set();
  for (const [id, declaracion] of Object.entries(DATOS)) {
    const sitio = declaracion.guarda
      ? `${declaracion.guarda.tab}.${declaracion.guarda.clave}`
      : `jornada.${id}`;
    assert.ok(!sitios.has(sitio), `dos datos guardan en ${sitio}`);
    sitios.add(sitio);
  }
});

test('las claves de la jornada incluyen las marcas de captura manual', () => {
  const claves = clavesDeJornada();
  assert.ok(claves.includes('velocidadKmh'));
  assert.ok(claves.includes('velocidadManual'));
  assert.ok(claves.includes('espaciamientoManual'));
});

// ---------------------------------------------------------------------
// Estado de los pasos
// ---------------------------------------------------------------------
test('un paso esta resuelto cuando TODOS sus datos tienen valor', () => {
  const paso = pasoPorId('boquilla');
  const sinPresion = estadoDePaso(paso, instantanea({ boquillaId: 'xr11004', presionBar: null }));
  assert.equal(sinPresion.resuelto, false);
  assert.deepEqual(sinPresion.faltantes, ['presionBar']);

  const completo = estadoDePaso(paso, instantanea({ boquillaId: 'xr11004', presionBar: 3 }));
  assert.equal(completo.resuelto, true);
  assert.deepEqual(completo.faltantes, []);
});

test('un paso de confirmacion no se da por resuelto hasta haberlo visto', () => {
  const paso = pasoPorId('barra');
  const datos = { anchoBarraM: 15.47, numBoquillas: 24, espaciamientoM: 0.6446 };
  // Los tres salen de la barra configurada: estarian resueltos desde el
  // primer segundo y el asistente los saltaria sin que nadie los mirara.
  assert.equal(estadoDePaso(paso, instantanea(datos)).resuelto, false);
  assert.equal(estadoDePaso(paso, instantanea(datos, { vistos: ['barra'] })).resuelto, true);
});

test('el paso opcional no cuenta para el total ni impide completar', () => {
  const receta = recetaPorId('gasto-agua');
  const avance = progresoDeReceta(
    receta,
    instantanea(
      {
        velocidadKmh: 2.59,
        anchoBarraM: 15.47,
        numBoquillas: 24,
        espaciamientoM: 0.6446,
        boquillaId: 'xr11004',
        presionBar: 3,
        lhaObjetivo: 575,
      },
      { vistos: ['barra'] }
    )
  );
  assert.equal(avance.total, 4, 'el aforo es opcional y no cuenta');
  assert.equal(avance.resueltos, 4);
  assert.equal(avance.completa, true);
  // Completa, pero el aforo se sigue ofreciendo.
  assert.equal(avance.siguiente.id, 'aforo');
});

test('el aforo se resuelve con el volumen medido, no con un dato capturado', () => {
  const paso = pasoPorId('aforo');
  assert.equal(estadoDePaso(paso, instantanea()).resuelto, false);
  assert.equal(
    estadoDePaso(paso, instantanea({}, { lhaMedido: { valor: 604 } })).resuelto,
    true
  );
});

test('se entra por el primer dato que falta, no por el paso uno', () => {
  const receta = recetaPorId('gasto-agua');
  // Nada capturado: se entra por la velocidad.
  assert.equal(indiceDelSiguiente(receta, instantanea()), 0);
  // Con la velocidad y la barra ya vistas, se entra por la boquilla.
  const conVelocidad = instantanea(
    { velocidadKmh: 2.59, anchoBarraM: 15.47, numBoquillas: 24, espaciamientoM: 0.6446 },
    { vistos: ['barra'] }
  );
  assert.equal(indiceDelSiguiente(receta, conVelocidad), 2);
});

test('con todo resuelto se entra directo a la hoja de resultado', () => {
  const receta = recetaPorId('mezcla-tanque');
  const todo = instantanea({
    volumenAplicacionLha: 575,
    volumenTanqueL: 2000,
    modoDosis: 'por-ha',
    dosisCantidad: 1.5,
    unidadProducto: 'L',
  });
  assert.equal(indiceDelSiguiente(receta, todo), pasosDeReceta(receta).length);
});

test('un dato opcional no bloquea su paso', () => {
  // La superficie objetivo se rotula «(opcional)» en su propia etiqueta.
  // Si contara para resolver el paso, el objetivo de la mezcla se
  // quedaria en «1 de 2» para siempre con todo lo demas capturado.
  assert.equal(dato('superficieObjetivoHa').opcional, true);
  const sinSuperficie = {
    datos: {
      volumenAplicacionLha: 575,
      volumenTanqueL: 2000,
      modoDosis: 'por-ha',
      dosisCantidad: 1.5,
      unidadProducto: 'L',
      superficieObjetivoHa: null,
    },
    vistos: [],
    lhaMedido: null,
  };
  const paso = estadoDePaso(pasoPorId('tanque'), sinSuperficie);
  assert.equal(paso.resuelto, true);
  assert.deepEqual(paso.faltantes, []);
  const avance = progresoDeReceta(recetaPorId('mezcla-tanque'), sinSuperficie);
  assert.equal(avance.completa, true, 'la mezcla se cierra sin la superficie');
});

test('solo las recetas cuyo resultado ES el volumen ofrecen perillas', () => {
  const conPerilla = RECETAS.filter((r) => r.ajustes.length > 0).map((r) => r.id);
  assert.deepEqual(conPerilla, ['gasto-agua', 'elegir-boquilla']);
  for (const receta of RECETAS) {
    for (const ajuste of receta.ajustes) {
      assert.ok(['presion', 'velocidad'].includes(ajuste), `perilla inesperada: ${ajuste}`);
    }
  }
});

// ---------------------------------------------------------------------
// Migracion: un telefono que ya venia usando la aplicacion
// ---------------------------------------------------------------------
test('los datos repartidos en los borradores suben a la jornada', () => {
  const jornada = migrarJornada(undefined, {
    gasto: { presionBar: 2.8, boquillaId: 'xr11004', anchoBarraM: 15.47, numBoquillas: 24 },
    captura: { presionBar: 3.5, espaciamientoM: 0.6446, lhaObjetivo: 575 },
  });
  // Gasto de agua es la pantalla central del volumen: su presion manda
  // sobre la que la Prueba de captura tenia guardada.
  assert.equal(jornada.presionBar, 2.8);
  assert.equal(jornada.boquillaId, 'xr11004');
  assert.equal(jornada.espaciamientoM, 0.6446);
  assert.equal(jornada.lhaObjetivo, 575);
});

test('una jornada ya guardada no se pisa con los borradores viejos', () => {
  const jornada = migrarJornada({ presionBar: 3.2 }, { gasto: { presionBar: 2.8 } });
  assert.equal(jornada.presionBar, 3.2);
});

test('el nombre viejo del objetivo en Gasto de agua no se pierde', () => {
  const jornada = migrarJornada({}, { gasto: { lhaObjetivoLha: 640 } });
  assert.equal(jornada.lhaObjetivo, 640);
});

// ---------------------------------------------------------------------
// El atajo de la hoja de resultado da lo mismo que la cadena larga
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
  assert.ok(volumenConBoquilla({ ...base, presionBar: 3.5 }).valores.lhaPorBoquilla > inicial);
  assert.ok(volumenConBoquilla({ ...base, velocidadKmh: 2.2 }).valores.lhaPorBoquilla > inicial);
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
