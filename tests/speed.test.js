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
  factorDesviacion,
  factorDeMedicion,
  velocidadCorregida,
  marchasDeTractor,
  marchasParaVelocidad,
  validarRegimen,
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
