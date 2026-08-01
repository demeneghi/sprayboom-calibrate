// Dominio A: velocidad y avance. Tabla de aceptacion del documento.
// Cada prueba recibe los parametros como argumento explicito; ninguna
// depende de un valor global ni del DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  velocidadEfectiva,
  factorRegimen,
  avance,
  avanceDesdeReporte,
  velocidadDesdeReporte,
  calibrarMarcha,
  geometria,
  completarTrioBarra,
  modoGeometriaDe,
  factorDesviacion,
  factorDeMedicion,
  velocidadCorregida,
  marchasDeTractor,
  marchaHabitualDe,
  marchasParaVelocidad,
  validarRegimen,
  velocidadDeAvance,
  velocidadParaTiempoPorTabla,
} from '../assets/js/domain/speed.js';
import { cercano } from './helpers.js';

test('avance desde reporte: 139 s/100m dan 2.59 km/h y 898 s por tabla', () => {
  const r = avanceDesdeReporte({
    segundosPorTramo: 139,
    distanciaReferencia: 100,
    largoTabla: 646,
  });
  cercano(r.valores.velocidadKmh, 2.59, 0.005, 'velocidad');
  cercano(r.valores.tiempoTotalS, 898, 0.5, 'tiempo por tabla');
});

test('avance desde marcha: A1 nominal 2.4 a 2100 rpm con nominal 2400', () => {
  const v = velocidadEfectiva({ kmhNominal: 2.4, rpm: 2100, regimenNominal: 2400 });
  cercano(v, 2.1, 1e-9, 'velocidad efectiva');
  const r = avance({ velocidadKmh: v, distanciaReferencia: 100, largoTabla: 646 });
  cercano(r.valores.segundosPorTramo, 171.4, 0.05, 'segundos por tramo');
  cercano(r.valores.tiempoTotalS, 1107, 0.5, 'tiempo total');
});

test('mismo caso con nominal 2100: la marcha entrega su velocidad nominal', () => {
  const v = velocidadEfectiva({ kmhNominal: 2.4, rpm: 2100, regimenNominal: 2100 });
  cercano(v, 2.4, 1e-9);
});

test('calibracion de marcha: 139 s/100m medidos a 1600 rpm con nominal 2400', () => {
  const medida = velocidadDesdeReporte({ segundosPorTramo: 139, distanciaReferencia: 100 });
  const nominal = calibrarMarcha({
    velocidadMedidaKmh: medida,
    rpmMedidas: 1600,
    regimenNominal: 2400,
  });
  cercano(nominal, 3.88, 0.005, 'kmh nominal calibrada');
});

test('factores de regimen reducido', () => {
  cercano(factorRegimen({ rpm: 1500, regimenNominal: 2400 }), 0.625, 1e-9, '5715 a 1500');
  cercano(factorRegimen({ rpm: 1500, regimenNominal: 2100 }), 0.7143, 0.0001, '6603 a 1500');
  cercano(factorRegimen({ rpm: 1800, regimenNominal: 2100 }), 0.8571, 0.0001, '6603 a 1800');
});

test('misma marcha de 2.4 nominal a 1500 rpm difiere entre tractores', () => {
  const v5715 = velocidadEfectiva({ kmhNominal: 2.4, rpm: 1500, regimenNominal: 2400 });
  const v6603 = velocidadEfectiva({ kmhNominal: 2.4, rpm: 1500, regimenNominal: 2100 });
  cercano(v5715, 1.5, 0.005, '5715');
  cercano(v6603, 1.71, 0.005, '6603');
  // Trasladar el ajuste sin recalcular es un error de mas del 12 %.
  assert.ok((v6603 - v5715) / v5715 > 0.12);
});

test('geometria: espaciamiento derivado y area por tabla', () => {
  const g = geometria({
    largoTabla: 646,
    anchoBarra: 15.47,
    numBoquillas: 24,
    distanciaReferencia: 100,
  });
  cercano(g.valores.espaciamientoDerivado, 0.6446, 0.0001, 'espaciamiento');
  cercano(g.valores.areaM2, 9993.62, 0.005, 'area m2');
  cercano(g.valores.hectareasPorTabla, 0.999362, 5e-7, 'hectareas');
  cercano(g.valores.tramosPorTabla, 6.46, 1e-9, 'tramos');
});

// ---------------------------------------------------------------------
// El trio de la barra: ancho, numero de boquillas y espaciamiento
// ---------------------------------------------------------------------

test('trio de la barra: el espaciamiento sale del ancho entre las boquillas', () => {
  const r = completarTrioBarra({
    anchoBarraM: 15.47,
    numBoquillas: 24,
    calcular: 'espaciamiento',
  });
  assert.equal(r.valores.calculado, 'espaciamiento');
  cercano(r.valores.espaciamientoM, 0.6446, 0.0001, 'espaciamiento');
  cercano(r.valores.discrepanciaPct, 0, 1e-9, 'discrepancia');
  assert.equal(r.avisos.length, 0);
});

test('trio de la barra: el ancho sale de las boquillas por su espaciamiento', () => {
  const r = completarTrioBarra({
    numBoquillas: 46,
    espaciamientoM: 0.5,
    calcular: 'anchoBarra',
  });
  assert.equal(r.valores.calculado, 'anchoBarra');
  cercano(r.valores.anchoBarraM, 23, 1e-9, 'ancho');
});

test('trio de la barra: el numero de boquillas sale del ancho entre el espaciamiento', () => {
  const r = completarTrioBarra({
    anchoBarraM: 12,
    espaciamientoM: 0.5,
    calcular: 'numBoquillas',
  });
  assert.equal(r.valores.calculado, 'numBoquillas');
  assert.equal(r.valores.numBoquillas, 24);
  assert.equal(r.avisos.length, 0);
});

test('trio de la barra: las boquillas se cuentan enteras y el redondeo se dice', () => {
  // 15.47 / 0.5 = 30.94 boquillas: no hay boquillas fraccionarias.
  const r = completarTrioBarra({
    anchoBarraM: 15.47,
    espaciamientoM: 0.5,
    calcular: 'numBoquillas',
  });
  assert.equal(r.valores.numBoquillas, 31);
  assert.ok(r.avisos.some((a) => a.codigo === 'boquillas-redondeadas'));
  // Con 31 boquillas a 0.5 m la barra mediria 15.5 m, no 15.47.
  cercano(r.avisos.find((a) => a.codigo === 'boquillas-redondeadas').datos.anchoImplicadoM, 15.5, 1e-9, 'ancho implicado');
});

test('trio de la barra: un espaciamiento mayor que la barra no inventa boquillas', () => {
  const r = completarTrioBarra({
    anchoBarraM: 0.4,
    espaciamientoM: 1,
    calcular: 'numBoquillas',
  });
  assert.equal(r.valores.calculado, null);
  assert.equal(r.valores.numBoquillas, null);
  assert.ok(r.avisos.some((a) => a.codigo === 'espaciamiento-mayor-que-la-barra'));
});

test('trio de la barra: con los tres capturados se avisa si no cuadran', () => {
  const r = completarTrioBarra({
    anchoBarraM: 15.47,
    numBoquillas: 24,
    espaciamientoM: 0.5,
    calcular: 'ninguno',
    umbralDiscrepanciaPct: 5,
  });
  assert.equal(r.valores.calculado, null);
  // 24 boquillas a 0.5 m dan 12 m, no 15.47: 28.9 % de discrepancia.
  cercano(r.valores.discrepanciaPct, 28.9, 0.1, 'discrepancia');
  assert.ok(r.avisos.some((a) => a.codigo === 'geometria-barra-discrepante'));
});

test('trio de la barra: los tres capturados que SI cuadran no molestan', () => {
  const r = completarTrioBarra({
    anchoBarraM: 12,
    numBoquillas: 24,
    espaciamientoM: 0.5,
    calcular: 'ninguno',
    umbralDiscrepanciaPct: 5,
  });
  cercano(r.valores.discrepanciaPct, 0, 1e-9, 'discrepancia');
  assert.equal(r.avisos.length, 0);
});

test('trio de la barra: sin datos suficientes no calcula ni truena', () => {
  const r = completarTrioBarra({ anchoBarraM: 15.47, calcular: 'espaciamiento' });
  assert.equal(r.valores.calculado, null);
  assert.equal(r.valores.espaciamientoM, null);
  assert.equal(r.valores.numBoquillas, null);
  assert.equal(r.avisos.length, 0);
});

test('trio de la barra: un espaciamiento implausible se delata, igual que en geometria', () => {
  const r = completarTrioBarra({
    numBoquillas: 24,
    espaciamientoM: 0.045,
    calcular: 'anchoBarra',
    espaciamientoMinimoPlausible: 0.05,
  });
  assert.ok(r.avisos.some((a) => a.codigo === 'espaciamiento-sospechoso-cm'));
});

test('modo de geometria: la barra vieja sin marca conserva su significado', () => {
  // Sin marca y sin espaciamiento capturado: el de siempre, derivado.
  assert.equal(modoGeometriaDe({ espaciamientoCapturado: null }), 'espaciamiento');
  // Sin marca pero con espaciamiento capturado: los tres a mano.
  assert.equal(modoGeometriaDe({ espaciamientoCapturado: 0.5 }), 'ninguno');
  // Con marca, manda la marca.
  assert.equal(
    modoGeometriaDe({ espaciamientoCapturado: 0.5, geometriaCalculada: 'anchoBarra' }),
    'anchoBarra'
  );
  assert.equal(modoGeometriaDe(null), 'espaciamiento');
});

test('factor de desviacion medido: teorica 2.10 y medida 1.95', () => {
  const factor = factorDeMedicion({ velocidadTeoricaKmh: 2.1, velocidadMedidaKmh: 1.95 });
  cercano(factor, 0.9286, 0.0001, 'factor');
  const r = velocidadCorregida({
    velocidadTeoricaKmh: 2.1,
    factor,
    umbralDesviacionPct: 8,
  });
  cercano(r.valores.desviacionPct, 7.1, 0.05, 'desviacion');
  // 7.1 % esta bajo el umbral de 8 %: sin alerta.
  assert.equal(r.avisos.length, 0);
});

test('interpolacion de desviacion entre 1500 y 1800 rpm consultada a 1650', () => {
  const r = factorDesviacion({
    mediciones: [
      { rpm: 1500, factor: 0.93 },
      { rpm: 1800, factor: 0.96 },
    ],
    rpm: 1650,
  });
  cercano(r.factor, 0.945, 1e-9, 'factor interpolado');
  assert.equal(r.estado, 'interpolado');
  assert.ok(r.avisos.some((a) => a.codigo === 'factor-interpolado'));
});

test('extrapolacion rechazada: consulta a 2100 con mediciones solo hasta 1800', () => {
  const r = factorDesviacion({
    mediciones: [
      { rpm: 1500, factor: 0.93 },
      { rpm: 1800, factor: 0.96 },
    ],
    rpm: 2100,
  });
  assert.equal(r.factor, null);
  assert.equal(r.estado, 'fuera-de-rango');
  assert.ok(r.avisos.some((a) => a.codigo === 'sin-medicion-en-rango'));
});

test('sin mediciones: factor 1.0 con aviso de velocidad teorica', () => {
  const r = factorDesviacion({ mediciones: [], rpm: 1700 });
  assert.equal(r.factor, 1.0);
  assert.equal(r.estado, 'sin-mediciones');
  assert.ok(r.avisos.some((a) => a.codigo === 'sin-mediciones-desviacion'));
});

test('medicion exacta se aplica tal cual', () => {
  const r = factorDesviacion({
    mediciones: [{ rpm: 1500, factor: 0.93 }],
    rpm: 1500,
  });
  assert.equal(r.estado, 'medido');
  cercano(r.factor, 0.93, 1e-12);
});

test('alerta de desviacion sobre el umbral configurable', () => {
  const r = velocidadCorregida({
    velocidadTeoricaKmh: 2.1,
    factor: 0.9,
    umbralDesviacionPct: 8,
  });
  cercano(r.valores.desviacionPct, 10, 1e-9);
  assert.ok(r.avisos.some((a) => a.codigo === 'desviacion-excesiva'));
});

test('cuadricula de marchas generada desde la transmision, sin caso 3x3 fijo', () => {
  const tractor = {
    id: 'prueba',
    nombre: 'Tractor de prueba',
    regimenNominal: 2200,
    regimenMinimo: 1200,
    regimenMaximo: 2400,
    regimenHabitual: 1700,
    numRangos: 2,
    marchasPorRango: 4,
    etiquetasRango: ['L', 'H'],
    velocidades: [0, 1].flatMap((r) =>
      [1, 2, 3, 4].map((m) => ({
        rango: r,
        marcha: m,
        kmhNominal: (r * 4 + m) * 2,
        origen: 'estimacion',
        fecha: null,
      }))
    ),
  };
  const filas = marchasDeTractor(tractor);
  assert.equal(filas.length, 8, '2 rangos x 4 marchas = 8 filas');
  assert.equal(filas[0].etiqueta, 'L1');
  assert.equal(filas[7].etiqueta, 'H4');
});

test('marchas que reproducen una velocidad, marcando las fuera de rango de motor', () => {
  const tractor = {
    id: 'jd',
    nombre: 'JD',
    regimenNominal: 2400,
    regimenMinimo: 1400,
    regimenMaximo: 2400,
    regimenHabitual: 1800,
    numRangos: 1,
    marchasPorRango: 2,
    etiquetasRango: ['A'],
    velocidades: [
      { rango: 0, marcha: 1, kmhNominal: 2.4, origen: 'estimacion', fecha: null },
      { rango: 0, marcha: 2, kmhNominal: 6.0, origen: 'estimacion', fecha: null },
    ],
  };
  const filas = marchasParaVelocidad({ tractor, velocidadObjetivoKmh: 2.59 });
  // A1: rpm = 2400 * 2.59 / 2.4 = 2590 -> fuera de rango (max 2400)
  cercano(filas[0].rpmRequeridas, 2590, 0.5);
  assert.equal(filas[0].fueraDeRango, true);
  // A2: rpm = 2400 * 2.59 / 6.0 = 1036 -> fuera de rango (min 1400)
  cercano(filas[1].rpmRequeridas, 1036, 0.5);
  assert.equal(filas[1].fueraDeRango, true);
});

test('regimen fuera del rango de trabajo del tractor produce advertencia', () => {
  const tractor = {
    nombre: 'JD 6603',
    regimenMinimo: 1400,
    regimenMaximo: 2400,
  };
  assert.equal(validarRegimen({ rpm: 1800, tractor }).length, 0);
  const avisos = validarRegimen({ rpm: 1000, tractor });
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0].codigo, 'regimen-fuera-de-rango');
});

// -----------------------------------------------------------------
// Velocidad heredada de Avance (precarga de las demas pantallas)
// -----------------------------------------------------------------

const TRACTOR_HERENCIA = {
  id: 'jd',
  nombre: 'JD',
  regimenNominal: 2400,
  regimenMinimo: 1400,
  regimenMaximo: 2400,
  regimenHabitual: 1800,
  numRangos: 1,
  marchasPorRango: 2,
  etiquetasRango: ['A'],
  velocidades: [
    { rango: 0, marcha: 1, kmhNominal: 2.4, origen: 'estimacion', fecha: null },
    { rango: 0, marcha: 2, kmhNominal: null, origen: 'pendiente', fecha: null },
  ],
};

function heredar(captura, extra = {}) {
  return velocidadDeAvance({
    captura,
    tractor: TRACTOR_HERENCIA,
    distanciaReferencia: 100,
    umbralDesviacionPct: 15,
    ...extra,
  });
}

test('velocidad heredada: sin captura en Avance no hay velocidad ni error', () => {
  const r = heredar({});
  assert.equal(r.velocidadKmh, null);
  assert.equal(r.origen, null);
  assert.equal(heredar(undefined).velocidadKmh, null, 'borrador ausente tampoco lanza');
});

test('velocidad heredada: el modo reporte trae la velocidad del reporte de campo', () => {
  const r = heredar({ modo: 'reporte', segundosPorTramo: 139 });
  cercano(r.velocidadKmh, 2.59, 0.005, 'velocidad del reporte');
  assert.equal(r.origen, 'reporte');
});

test('velocidad heredada: el modo marcha manda aunque haya un reporte viejo', () => {
  const r = heredar({
    modo: 'marcha',
    marcha: { rango: 0, marcha: 1 },
    rpm: 2100,
    segundosPorTramo: 139,
  });
  cercano(r.velocidadKmh, 2.1, 1e-9, 'velocidad de la marcha');
  assert.equal(r.origen, 'marcha-teorica');
  assert.match(r.etiqueta, /A1/);
});

test('velocidad heredada: el factor medido corrige la velocidad de la marcha', () => {
  const r = heredar(
    { modo: 'marcha', marcha: { rango: 0, marcha: 1 }, rpm: 2100 },
    { mediciones: [{ rpm: 2100, factor: 0.9 }] }
  );
  cercano(r.velocidadKmh, 1.89, 1e-9, 'velocidad corregida');
  assert.equal(r.origen, 'marcha-corregida');
});

test('velocidad heredada: marcha sin velocidad registrada cae al reporte', () => {
  const r = heredar({
    modo: 'marcha',
    marcha: { rango: 0, marcha: 2 },
    rpm: 2100,
    segundosPorTramo: 139,
  });
  cercano(r.velocidadKmh, 2.59, 0.005, 'respaldo del reporte');
  assert.equal(r.origen, 'reporte');
});

test('velocidad heredada: marcha pendiente y sin reporte no inventa velocidad', () => {
  const r = heredar({ modo: 'marcha', marcha: { rango: 0, marcha: 2 }, rpm: 2100 });
  assert.equal(r.velocidadKmh, null);
});

// El regimen que Avance PRECARGA cuenta como capturado: la pantalla ya
// calcula con el. Mientras no fue asi, elegir una marcha y aceptar el
// regimen que venia puesto dejaba a las demas pantallas sin velocidad
// —o heredando un reporte viejo— con Avance mostrando otra cosa.
test('velocidad heredada: sin rpm capturado se usa el regimen habitual del tractor', () => {
  const r = heredar(
    { modo: 'marcha', marcha: { rango: 0, marcha: 1 } },
    { rpmRespaldo: TRACTOR_HERENCIA.regimenHabitual }
  );
  cercano(r.velocidadKmh, 1.8, 1e-9, '2.4 km/h nominales a 1800 de 2400 rpm');
  assert.equal(r.origen, 'marcha-teorica');
});

test('velocidad heredada: el rpm capturado gana sobre el regimen habitual', () => {
  const r = heredar(
    { modo: 'marcha', marcha: { rango: 0, marcha: 1 }, rpm: 2400 },
    { rpmRespaldo: TRACTOR_HERENCIA.regimenHabitual }
  );
  cercano(r.velocidadKmh, 2.4, 1e-9, 'manda el regimen tecleado');
});

test('velocidad heredada: sin rpm capturado la marcha gana al reporte viejo', () => {
  const r = heredar(
    { modo: 'marcha', marcha: { rango: 0, marcha: 1 }, segundosPorTramo: 139 },
    { rpmRespaldo: TRACTOR_HERENCIA.regimenHabitual }
  );
  cercano(r.velocidadKmh, 1.8, 1e-9, 'la marcha, no los 2.59 km/h del reporte');
  assert.equal(r.origen, 'marcha-teorica');
});

test('velocidad heredada: el respaldo del otro modo se declara con un aviso', () => {
  const respaldo = heredar({ modo: 'reporte', marcha: { rango: 0, marcha: 1 }, rpm: 2400 });
  assert.equal(respaldo.origen, 'marcha-teorica', 'sin reporte cae a la marcha');
  assert.ok(
    respaldo.avisos.some((a) => a.codigo === 'fuente-distinta-al-modo'),
    'y lo dice, en vez de callarlo'
  );

  const enSuModo = heredar({ modo: 'reporte', segundosPorTramo: 139 });
  assert.ok(
    !enSuModo.avisos.some((a) => a.codigo === 'fuente-distinta-al-modo'),
    'sin aviso cuando la fuente SI es el modo elegido'
  );
});

test('velocidad heredada: la marcha de otro tractor no se hereda', () => {
  const otro = heredar({
    modo: 'marcha',
    marcha: { rango: 0, marcha: 1, tractorId: 'otro-tractor' },
    rpm: 2400,
    segundosPorTramo: 139,
  });
  cercano(otro.velocidadKmh, 2.59, 0.005, 'cae al reporte en vez de usar la casilla equivalente');
  assert.equal(otro.origen, 'reporte');

  const propio = heredar({
    modo: 'marcha',
    marcha: { rango: 0, marcha: 1, tractorId: TRACTOR_HERENCIA.id },
    rpm: 2400,
  });
  cercano(propio.velocidadKmh, 2.4, 1e-9, 'la del tractor activo si se hereda');
});

// -----------------------------------------------------------------
// Marcha de trabajo del tractor (ultimo respaldo de la velocidad)
// -----------------------------------------------------------------

const conMarchaHabitual = (marchaHabitual) => ({ ...TRACTOR_HERENCIA, marchaHabitual });

test('marcha de trabajo: se resuelve a la fila completa del tractor', () => {
  const fila = marchaHabitualDe(conMarchaHabitual({ rango: 0, marcha: 1 }));
  assert.equal(fila.etiqueta, 'A1');
  assert.equal(fila.kmhNominal, 2.4);
});

test('marcha de trabajo: sin guardar, apuntando fuera o a una marcha pendiente da null', () => {
  assert.equal(marchaHabitualDe(TRACTOR_HERENCIA), null, 'sin marcha guardada');
  assert.equal(marchaHabitualDe(conMarchaHabitual(null)), null, 'guardada en null');
  assert.equal(
    marchaHabitualDe(conMarchaHabitual({ rango: 3, marcha: 9 })),
    null,
    'posicion que ya no existe tras encoger la transmision'
  );
  assert.equal(
    marchaHabitualDe(conMarchaHabitual({ rango: 0, marcha: 2 })),
    null,
    'marcha sin velocidad nominal capturada'
  );
});

// Sin este respaldo, abrir Gas etileno o Forzamiento sin haber pasado
// antes por Avance dejaba el tiempo de inyeccion en blanco, y el mismo
// dato habia que volver a darlo cada vez.
test('velocidad heredada: sin nada capturado se usa la marcha de trabajo del tractor', () => {
  const r = heredar({}, {
    tractor: conMarchaHabitual({ rango: 0, marcha: 1 }),
    rpmRespaldo: TRACTOR_HERENCIA.regimenHabitual,
  });
  cercano(r.velocidadKmh, 1.8, 1e-9, '2.4 km/h nominales a 1800 de 2400 rpm');
  assert.equal(r.origen, 'marcha-teorica');
  assert.ok(
    r.avisos.some((a) => a.codigo === 'marcha-de-trabajo-del-tractor'),
    'y dice que no salio de una captura de hoy'
  );
});

test('velocidad heredada: la marcha de trabajo es el ULTIMO respaldo, nunca gana', () => {
  const tractor = conMarchaHabitual({ rango: 0, marcha: 1 });
  const conReporte = heredar({ modo: 'reporte', segundosPorTramo: 139 }, { tractor });
  cercano(conReporte.velocidadKmh, 2.59, 0.005, 'manda el reporte de campo de hoy');
  assert.equal(conReporte.origen, 'reporte');

  const conMarchaDeHoy = heredar(
    { modo: 'marcha', marcha: { rango: 0, marcha: 1 }, rpm: 2400 },
    { tractor }
  );
  cercano(conMarchaDeHoy.velocidadKmh, 2.4, 1e-9, 'manda la marcha elegida con su regimen');
  assert.ok(
    !conMarchaDeHoy.avisos.some((a) => a.codigo === 'marcha-de-trabajo-del-tractor'),
    'sin aviso cuando la marcha SI es la de hoy'
  );
});

test('velocidad heredada: la marcha de trabajo tampoco inventa velocidad sin regimen', () => {
  const r = heredar({}, { tractor: conMarchaHabitual({ rango: 0, marcha: 1 }) });
  assert.equal(r.velocidadKmh, null, 'sin rpm ni regimen habitual no hay de donde');
});

// -----------------------------------------------------------------
// Del tiempo por tabla a la velocidad (sentido inverso del avance)
// -----------------------------------------------------------------

test('velocidad para un tiempo por tabla: es el inverso exacto de avance()', () => {
  const ida = avance({ velocidadKmh: 2.59, distanciaReferencia: 100, largoTabla: 646 });
  const vuelta = velocidadParaTiempoPorTabla({
    tiempoTotalS: ida.valores.tiempoTotalS,
    largoTabla: 646,
    distanciaReferencia: 100,
  });
  cercano(vuelta.valores.velocidadKmh, 2.59, 1e-9, 'vuelve a la misma velocidad');
  cercano(
    vuelta.valores.segundosPorTramo,
    ida.valores.segundosPorTramo,
    1e-9,
    'y a los mismos segundos por tramo'
  );
  cercano(vuelta.valores.tramosPorTabla, 6.46, 1e-9);
});

test('velocidad para un tiempo por tabla: 646 m en 1477 s dan 1.575 km/h', () => {
  const r = velocidadParaTiempoPorTabla({
    tiempoTotalS: 1477,
    largoTabla: 646,
    distanciaReferencia: 100,
  });
  cercano(r.valores.velocidadKmh, 1.5745, 0.001, '646 * 3.6 / 1477');
  assert.equal(r.desglose.length, 3, 'el desglose auditable sale completo');
});

test('velocidad para un tiempo por tabla: un tiempo no positivo es error de dominio', () => {
  assert.throws(
    () => velocidadParaTiempoPorTabla({ tiempoTotalS: 0, largoTabla: 646, distanciaReferencia: 100 }),
    /tiempo por tabla/
  );
});

test('velocidad heredada: la etiqueta distingue la marcha de trabajo de la de hoy', () => {
  const tractor = conMarchaHabitual({ rango: 0, marcha: 1 });
  const deHoy = heredar({ modo: 'marcha', marcha: { rango: 0, marcha: 1 }, rpm: 2400 }, { tractor });
  assert.match(deHoy.etiqueta, /^de la marcha A1/);
  const respaldo = heredar({}, { tractor, rpmRespaldo: 1800 });
  assert.match(respaldo.etiqueta, /^de la marcha de trabajo A1/);
});
