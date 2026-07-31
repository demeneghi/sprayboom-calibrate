// Persistencia: siembra, autosave, fallo de escritura sin romper,
// exportacion/importacion validada con los MISMOS mensajes que los
// formularios, y CSV con BOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sembrarEstado,
  crearAlmacen,
  adoptarVelocidadesDeFabrica,
  exportarJSON,
  exportarCatalogoJSON,
  importarJSON,
  importarCatalogoJSON,
  aCSV,
  CLAVE_ALMACEN,
  VERSION_ESQUEMA,
} from '../assets/js/storage.js';
import { validarValor } from '../assets/js/domain/validate.js';
import { defCampo } from '../assets/js/domain/defaults.js';

function backendFalso() {
  const mapa = new Map();
  return {
    getItem: (k) => (mapa.has(k) ? mapa.get(k) : null),
    setItem: (k, v) => mapa.set(k, String(v)),
    _mapa: mapa,
  };
}

test('primer arranque: siembra defaults y los persiste', () => {
  const backend = backendFalso();
  const almacen = crearAlmacen({ backend });
  const estado = almacen.obtener();
  assert.equal(estado.version, VERSION_ESQUEMA);
  assert.equal(estado.parametros.geometria.largoTabla, 646);
  assert.equal(estado.tractores.length, 2);
  assert.ok(estado.catalogo.length >= 40);
  assert.ok(backend._mapa.has(CLAVE_ALMACEN), 'siembra persistida');
});

test('recarga: lo guardado sobrevive y gana sobre la siembra', () => {
  const backend = backendFalso();
  const a1 = crearAlmacen({ backend });
  a1.actualizar((estado) => {
    estado.parametros.geometria.largoTabla = 500;
  });
  const a2 = crearAlmacen({ backend });
  assert.equal(a2.obtener().parametros.geometria.largoTabla, 500);
});

test('recarga: una tabla vieja marcada estimacion adopta la de fabrica', () => {
  const backend = backendFalso();
  const guardado = sembrarEstado();
  const jd5715 = guardado.tractores.find((t) => t.id === 'jd5715');
  // Como quedo en el telefono de campo antes de corregir las tablas.
  jd5715.velocidades = jd5715.velocidades.map((v) => ({
    ...v,
    kmhNominal: 99,
    origen: 'estimacion',
  }));
  backend.setItem(CLAVE_ALMACEN, JSON.stringify(guardado));

  const recargado = crearAlmacen({ backend }).obtener();
  const marchas = recargado.tractores.find((t) => t.id === 'jd5715').velocidades;
  const b2 = marchas.find((v) => v.rango === 1 && v.marcha === 2);
  assert.equal(b2.kmhNominal, 7.2, 'B2 debe tomar la velocidad de fabrica');
  assert.equal(b2.origen, 'capturado');
  assert.ok(marchas.every((v) => v.kmhNominal !== 99), 'ninguna fila vieja sobrevive');
});

test('recarga: lo capturado y lo calibrado por el usuario NUNCA se pisa', () => {
  const backend = backendFalso();
  const guardado = sembrarEstado();
  const jd6603 = guardado.tractores.find((t) => t.id === 'jd6603');
  jd6603.velocidades = jd6603.velocidades.map((v) => {
    if (v.rango === 0 && v.marcha === 1) {
      return { ...v, kmhNominal: 3.4, origen: 'calibrado', fecha: '2026-01-15T00:00:00.000Z' };
    }
    if (v.rango === 0 && v.marcha === 2) {
      return { ...v, kmhNominal: 4.7, origen: 'capturado' };
    }
    return { ...v, kmhNominal: 99, origen: 'estimacion' };
  });
  backend.setItem(CLAVE_ALMACEN, JSON.stringify(guardado));

  const marchas = crearAlmacen({ backend })
    .obtener()
    .tractores.find((t) => t.id === 'jd6603').velocidades;
  const a1 = marchas.find((v) => v.rango === 0 && v.marcha === 1);
  const a2 = marchas.find((v) => v.rango === 0 && v.marcha === 2);
  const a3 = marchas.find((v) => v.rango === 0 && v.marcha === 3);
  assert.equal(a1.kmhNominal, 3.4, 'lo calibrado en esta unidad manda');
  assert.equal(a1.origen, 'calibrado');
  assert.equal(a2.kmhNominal, 4.7, 'lo capturado por el usuario manda');
  assert.equal(a3.kmhNominal, 5.3, 'solo la estimacion adopta la tabla de fabrica');
});

test('adoptar velocidades: tolera tractores propios y datos incompletos', () => {
  const semilla = sembrarEstado().tractores;
  const propio = { id: 'tractor-del-rancho', velocidades: [{ rango: 0, marcha: 1, kmhNominal: 4, origen: 'estimacion', fecha: null }] };
  const roto = { id: 'jd5715' };
  const resultado = adoptarVelocidadesDeFabrica([propio, roto], semilla);
  assert.equal(resultado[0].velocidades[0].kmhNominal, 4, 'un tractor sin semilla no se toca');
  assert.deepEqual(resultado[1], roto, 'un tractor sin tabla no truena');
  assert.equal(adoptarVelocidadesDeFabrica(null, semilla), null);
});

test('version de esquema desconocida: se siembra y se reporta, sin tronar', () => {
  const backend = backendFalso();
  backend.setItem(CLAVE_ALMACEN, JSON.stringify({ version: 99 }));
  const almacen = crearAlmacen({ backend });
  assert.equal(almacen.obtener().version, VERSION_ESQUEMA);
  assert.ok(almacen.erroresDeCarga.length > 0);
});

test('JSON corrupto guardado: se siembra y se reporta, sin tronar', () => {
  const backend = backendFalso();
  backend.setItem(CLAVE_ALMACEN, '{esto no es json');
  const almacen = crearAlmacen({ backend });
  assert.equal(almacen.obtener().parametros.geometria.largoTabla, 646);
  assert.ok(almacen.erroresDeCarga.length > 0);
});

test('escritura que falla: la aplicacion sigue en memoria y avisa una vez', () => {
  let avisos = 0;
  const backend = {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  const almacen = crearAlmacen({ backend, alFallarEscritura: () => { avisos += 1; } });
  almacen.actualizar((estado) => {
    estado.parametros.geometria.largoTabla = 400;
  });
  almacen.actualizar((estado) => {
    estado.parametros.geometria.largoTabla = 300;
  });
  assert.equal(almacen.obtener().parametros.geometria.largoTabla, 300, 'sigue en memoria');
  assert.equal(avisos, 1, 'un solo aviso, no lluvia');
  assert.equal(almacen.disponible, false);
});

test('exportar e importar: ida y vuelta completa', () => {
  const estado = sembrarEstado();
  estado.parametros.geometria.largoTabla = 555;
  estado.factoresDesviacion.push({ id: 'f1', tractorId: 'jd6603', rpm: 1500, factor: 0.93 });
  const json = exportarJSON(estado);
  const resultado = importarJSON(json, sembrarEstado());
  assert.equal(resultado.ok, true);
  assert.equal(resultado.rechazos.length, 0);
  assert.equal(resultado.estado.parametros.geometria.largoTabla, 555);
  assert.equal(resultado.estado.factoresDesviacion.length, 1);
});

test('importacion: campo fuera de cotas rechazado con el MISMO mensaje del formulario', () => {
  const estado = sembrarEstado();
  const json = JSON.parse(exportarJSON(estado));
  json.exportado.parametros.geometria.largoTabla = 9999; // cota max 5000
  const resultado = importarJSON(JSON.stringify(json), estado);
  assert.equal(resultado.ok, true, 'rechazo por campo, no total');
  assert.equal(resultado.estado.parametros.geometria.largoTabla, 646, 'conserva el vigente');
  const rechazo = resultado.rechazos.find((r) => r.ruta === 'parametros.geometria.largoTabla');
  assert.ok(rechazo);
  const mensajeFormulario = validarValor(defCampo('geometria', 'largoTabla'), 9999).mensaje;
  assert.equal(rechazo.mensaje, mensajeFormulario, 'mismo mensaje en ambos caminos');
});

test('importacion: JSON corrupto o de version desconocida se rechaza completo', () => {
  const estado = sembrarEstado();
  assert.equal(importarJSON('{no es json', estado).ok, false);
  const otro = { tipo: 'sprayboom-configuracion', version: 42, exportado: {} };
  const resultado = importarJSON(JSON.stringify(otro), estado);
  assert.equal(resultado.ok, false);
  assert.match(resultado.errores[0], /Versión de esquema desconocida/);
  const ajeno = { tipo: 'otra-cosa', version: 1 };
  assert.equal(importarJSON(JSON.stringify(ajeno), estado).ok, false);
});

test('catalogo por separado: exportar, importar y rechazar entradas invalidas', () => {
  const estado = sembrarEstado();
  const json = JSON.parse(exportarCatalogoJSON(estado));
  json.catalogo[0].caudalRefLmin = -5; // invalido
  json.catalogo[1].presionMinBar = 10;
  json.catalogo[1].presionMaxBar = 2; // min >= max
  const resultado = importarCatalogoJSON(JSON.stringify(json), estado);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.estado.catalogo.length, estado.catalogo.length - 2);
  assert.equal(resultado.rechazos.length >= 2, true);
});

// ---------------------------------------------------------------------
// Migracion: la geometria de la barra bajo de parametros.geometria a
// cada barra. Un telefono de campo tiene guardado el esquema viejo; si
// la migracion falla, la barra queda sin ancho y el volumen por hectarea
// revienta al abrir la aplicacion.
// ---------------------------------------------------------------------
function estadoConGeometriaGlobal({ anchoBarra, numBoquillas, espaciamientoCapturado = null }) {
  const guardado = sembrarEstado();
  guardado.parametros.geometria = {
    largoTabla: 646,
    distanciaReferencia: 100,
    anchoBarra,
    numBoquillas,
    espaciamientoCapturado,
  };
  guardado.equipos = guardado.equipos.map((equipo) => {
    const viejo = { ...equipo };
    delete viejo.anchoBarra;
    delete viejo.numBoquillas;
    delete viejo.espaciamientoCapturado;
    return viejo;
  });
  return guardado;
}

test('migracion: la geometria global guardada se copia a cada barra', () => {
  const backend = backendFalso();
  backend.setItem(
    CLAVE_ALMACEN,
    JSON.stringify(estadoConGeometriaGlobal({ anchoBarra: 12.4, numBoquillas: 18, espaciamientoCapturado: 0.7 }))
  );
  const barra = crearAlmacen({ backend }).obtener().equipos[0];
  assert.equal(barra.anchoBarra, 12.4, 'el ancho capturado por el usuario NO se pierde');
  assert.equal(barra.numBoquillas, 18);
  assert.equal(barra.espaciamientoCapturado, 0.7);
});

test('migracion: sin geometria guardada la barra toma la de la siembra', () => {
  const backend = backendFalso();
  const guardado = estadoConGeometriaGlobal({ anchoBarra: 1, numBoquillas: 1 });
  delete guardado.parametros.geometria.anchoBarra;
  delete guardado.parametros.geometria.numBoquillas;
  delete guardado.parametros.geometria.espaciamientoCapturado;
  backend.setItem(CLAVE_ALMACEN, JSON.stringify(guardado));
  const barra = crearAlmacen({ backend }).obtener().equipos[0];
  assert.equal(barra.anchoBarra, sembrarEstado().equipos[0].anchoBarra);
  assert.equal(barra.numBoquillas, sembrarEstado().equipos[0].numBoquillas);
  assert.equal(barra.espaciamientoCapturado, null);
});

test('migracion: un respaldo exportado con el esquema viejo se importa entero', () => {
  const estado = sembrarEstado();
  const json = {
    tipo: 'sprayboom-configuracion',
    version: VERSION_ESQUEMA,
    exportado: estadoConGeometriaGlobal({ anchoBarra: 9.5, numBoquillas: 16 }),
  };
  const resultado = importarJSON(JSON.stringify(json), estado);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.rechazos.length, 0, 'ninguna barra rechazada por los campos nuevos');
  assert.equal(resultado.estado.equipos[0].anchoBarra, 9.5);
  assert.equal(resultado.estado.equipos[0].numBoquillas, 16);
});

test('cada barra guarda su propia geometria: la segunda no hereda la primera', () => {
  const backend = backendFalso();
  const almacen = crearAlmacen({ backend });
  almacen.actualizar((estado) => {
    const segunda = JSON.parse(JSON.stringify(estado.equipos[0]));
    segunda.id = 'barra-chica';
    segunda.nombre = 'Barra chica';
    segunda.anchoBarra = 6;
    segunda.numBoquillas = 10;
    estado.equipos.push(segunda);
  });
  const recargado = crearAlmacen({ backend }).obtener();
  assert.equal(recargado.equipos[0].anchoBarra, 15.47);
  assert.equal(recargado.equipos[1].anchoBarra, 6);
  assert.equal(recargado.equipos[1].numBoquillas, 10);
});

// La presion del sitio pasa de capturarse a derivarse de la altitud.
// Un telefono que ya uso la aplicacion trae el 14.7 de default guardado:
// si se leyera como anulacion manual, la altitud no serviria de nada en
// las unidades que ya estan en campo, y en silencio.
function estadoConPresionGuardada(presion) {
  const estado = sembrarEstado();
  estado.parametros.sitio = { presionAtmosfericaLocal: presion };
  return estado;
}

test('migracion: el 14.7 que nadie toco pasa a derivarse de la altitud', () => {
  const backend = backendFalso();
  backend.setItem(CLAVE_ALMACEN, JSON.stringify(estadoConPresionGuardada(14.7)));
  const sitio = crearAlmacen({ backend }).obtener().parametros.sitio;
  assert.equal(sitio.presionAtmosfericaLocal, null, 'deja de anular');
  assert.equal(sitio.altitudM, 0, 'la altitud aparece con su siembra');
});

test('migracion: una presion propia se conserva como anulacion manual', () => {
  const backend = backendFalso();
  backend.setItem(CLAVE_ALMACEN, JSON.stringify(estadoConPresionGuardada(12.3)));
  const sitio = crearAlmacen({ backend }).obtener().parametros.sitio;
  assert.equal(sitio.presionAtmosfericaLocal, 12.3, 'lo que el usuario decidió NO se pierde');
});

test('migracion: quien ya guardo altitud no se vuelve a migrar', () => {
  const backend = backendFalso();
  const guardado = sembrarEstado();
  guardado.parametros.sitio = { altitudM: 1500, presionAtmosfericaLocal: 14.7 };
  backend.setItem(CLAVE_ALMACEN, JSON.stringify(guardado));
  const sitio = crearAlmacen({ backend }).obtener().parametros.sitio;
  assert.equal(sitio.altitudM, 1500);
  assert.equal(sitio.presionAtmosfericaLocal, 14.7, 'con altitud presente el 14.7 es una decisión');
});

test('migracion: un respaldo viejo con el 14.7 tambien se limpia al importarlo', () => {
  const json = {
    tipo: 'sprayboom-configuracion',
    version: VERSION_ESQUEMA,
    exportado: estadoConPresionGuardada(14.7),
  };
  const resultado = importarJSON(JSON.stringify(json), sembrarEstado());
  assert.equal(resultado.ok, true);
  assert.equal(resultado.estado.parametros.sitio.presionAtmosfericaLocal, null);
});

test('CSV: BOM UTF-8, separador coma y escape de comillas', () => {
  const csv = aCSV(['Fecha', 'Nota'], [['2026-07-30', 'dice "aforo", con coma']]);
  assert.equal(csv.charCodeAt(0), 0xfeff, 'inicia con BOM');
  const lineas = csv.slice(1).split('\r\n');
  assert.equal(lineas[0], 'Fecha,Nota');
  assert.equal(lineas[1], '2026-07-30,"dice ""aforo"", con coma"');
});
