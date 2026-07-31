// Regresiones de la auditoria adversarial: cada prueba fija un hallazgo
// confirmado para que no vuelva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sembrarEstado,
  crearAlmacen,
  exportarJSON,
  importarJSON,
  CLAVE_ALMACEN,
  VERSION_ESQUEMA,
} from '../assets/js/storage.js';
import {
  caudalAPresionDetallado,
  caudalConDensidadDetallado,
  seleccionarBoquillas,
  caudalAPresion,
  caudalConDensidad,
} from '../assets/js/domain/nozzles.js';
import { estadisticaCaptura } from '../assets/js/domain/capture.js';
import { estadoBombaARegimen } from '../assets/js/domain/pump.js';
import { aSistema, aMetrico, unidad } from '../assets/js/domain/units.js';
import { validarValor } from '../assets/js/domain/validate.js';
import { COTAS_BOQUILLA, BOQUILLA_NUEVA } from '../assets/js/domain/defaults.js';
import { cercano, cercanoRel } from './helpers.js';

function backendFalso() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    _mapa: mapa,
  };
}

test('hallazgo 9: version desconocida NO pisa lo guardado y deja respaldo', () => {
  const backend = backendFalso();
  const cargaAjena = JSON.stringify({ version: 99, tesoro: 'datos del futuro' });
  backend.setItem(CLAVE_ALMACEN, cargaAjena);
  const almacen = crearAlmacen({ backend });
  // La clave original queda INTACTA hasta la primera edicion.
  assert.equal(backend._mapa.get(CLAVE_ALMACEN), cargaAjena, 'clave original intacta');
  assert.equal(backend._mapa.get(`${CLAVE_ALMACEN}.respaldo`), cargaAjena, 'respaldo creado');
  assert.match(almacen.erroresDeCarga[0], /respaldo/);
  // La primera edicion del usuario si persiste la siembra nueva.
  almacen.actualizar((estado) => {
    estado.parametros.geometria.largoTabla = 500;
  });
  assert.notEqual(backend._mapa.get(CLAVE_ALMACEN), cargaAjena);
  assert.equal(backend._mapa.get(`${CLAVE_ALMACEN}.respaldo`), cargaAjena, 'respaldo sobrevive');
});

test('hallazgo 9b: JSON corrupto guardado tambien queda respaldado', () => {
  const backend = backendFalso();
  backend.setItem(CLAVE_ALMACEN, '{roto');
  const almacen = crearAlmacen({ backend });
  assert.equal(backend._mapa.get(CLAVE_ALMACEN), '{roto', 'no se piso');
  assert.equal(backend._mapa.get(`${CLAVE_ALMACEN}.respaldo`), '{roto');
  assert.ok(almacen.erroresDeCarga.length > 0);
});

test('baja: fusion profunda al cargar: campos anidados nuevos aparecen con su default', () => {
  const backend = backendFalso();
  const guardado = sembrarEstado();
  delete guardado.parametros.umbrales.umbralDiscrepanciaMetodos; // campo "viejo" sin el dato
  backend.setItem(CLAVE_ALMACEN, JSON.stringify(guardado));
  const almacen = crearAlmacen({ backend });
  assert.equal(
    almacen.obtener().parametros.umbrales.umbralDiscrepanciaMetodos,
    1,
    'el campo nuevo del esquema aparece con su default'
  );
});

test('baja: la importacion convierte numeros en cadena a Number', () => {
  const estado = sembrarEstado();
  const json = JSON.parse(exportarJSON(estado));
  json.exportado.parametros.geometria.largoTabla = '500';
  json.exportado.catalogo[0].caudalRefLmin = String(json.exportado.catalogo[0].caudalRefLmin);
  const resultado = importarJSON(JSON.stringify(json), estado);
  assert.equal(resultado.ok, true);
  assert.strictEqual(resultado.estado.parametros.geometria.largoTabla, 500);
  assert.strictEqual(typeof resultado.estado.catalogo[0].caudalRefLmin, 'number');
});

test('hallazgo 8: las cotas del formulario de boquilla son las mismas de la importacion', () => {
  // exponente 0.9 y presion 60 quedan fuera en AMBOS caminos, con el
  // mismo mensaje generado por la misma funcion.
  const vExp = validarValor(COTAS_BOQUILLA.exponente, 0.9);
  assert.equal(vExp.ok, false);
  const vPres = validarValor(COTAS_BOQUILLA.presionMaxBar, 60);
  assert.equal(vPres.ok, false);
  // La semilla del formulario vive en defaults y cumple sus propias cotas.
  for (const [campo, cota] of Object.entries(COTAS_BOQUILLA)) {
    if (campo in BOQUILLA_NUEVA) {
      assert.equal(validarValor(cota, BOQUILLA_NUEVA[campo]).ok, true, campo);
    }
  }
});

test('hallazgo 4: el escalado presion-caudal tiene variante con desglose auditable', () => {
  const r = caudalAPresionDetallado({ caudalRef: 1.6, presionRef: 3, presion: 2, exponente: 0.5 });
  cercano(r.valores.caudalLmin, caudalAPresion({ caudalRef: 1.6, presionRef: 3, presion: 2, exponente: 0.5 }), 1e-12);
  assert.equal(r.desglose.length, 1);
  assert.match(r.desglose[0].sustitucion, /1\.6/);
  const d = caudalConDensidadDetallado({ caudalAguaLmin: 1.6, densidadRelativa: 1.2 });
  cercano(d.valores.caudalCaldoLmin, caudalConDensidad({ caudalAguaLmin: 1.6, densidadRelativa: 1.2 }), 1e-12);
  assert.match(d.desglose[0].sustitucion, /1\.2/);
});

test('baja: sin candidatas por el filtro de clase, el mensaje dice la verdad', () => {
  const boquilla = {
    id: 'x',
    caudalRefLmin: 1.6,
    presionRefBar: 3,
    exponente: 0.5,
    presionMinBar: 1,
    presionMaxBar: 4,
    edicionEstandar: 'S572.1',
    clasesGota: [{ presionMinBar: 1, presionMaxBar: 4, clase: 'F' }],
  };
  const r = seleccionarBoquillas({
    catalogo: [boquilla],
    caudalRequeridoLmin: 1.6,
    claseDeseada: 'UC',
  });
  assert.equal(r.candidatas.length, 0);
  const a = r.avisos.find((x) => x.codigo === 'sin-candidatas');
  assert.match(a.mensaje, /clase de gota pedida/);
  assert.equal(a.datos.enRangoSinFiltro, 1);
});

test('baja: el caudal por debajo del teorico (taponamiento) tambien alerta', () => {
  const r = estadisticaCaptura({
    caudalesLmin: [1.3, 1.31, 1.29],
    umbralAtipicasPct: 10,
    caudalTeoricoLmin: 1.6,
  });
  assert.ok(r.valores.desgastePct < -15);
  assert.ok(r.avisos.some((a) => a.codigo === 'caudal-bajo-teorico'));
  assert.match(r.avisos.find((a) => a.codigo === 'caudal-bajo-teorico').mensaje, /taponamiento/i);
});

test('baja: el desglose de bomba sin calibracion no imprime null', () => {
  const r = estadoBombaARegimen({
    tipoBomba: 'positiva',
    conRegulador: true,
    rpmMotor: 1500,
    rpmCalibracion: 2100,
    presionCalibracionBar: null,
    caudalCalibracionLmin: null,
  });
  for (const paso of r.desglose) {
    assert.ok(!String(paso.sustitucion).includes('null'), paso.sustitucion);
  }
});

test('hallazgo 2: existe la magnitud de area chica para convertir m2 a ft2', () => {
  assert.equal(unidad('areaChica', 'metrico'), 'm2');
  assert.equal(unidad('areaChica', 'imperial'), 'ft2');
  // 1 m2 = 10.7639 ft2
  cercanoRel(aSistema('areaChica', 1, 'imperial'), 10.7639, 1e-4);
  cercanoRel(aMetrico('areaChica', 10.7639), 1, 1e-4);
});

test('el esquema de version sigue siendo el 1 (los respaldos dependen de esto)', () => {
  assert.equal(VERSION_ESQUEMA, 1);
});
