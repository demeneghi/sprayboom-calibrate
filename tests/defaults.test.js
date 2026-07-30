// Sanidad del contrato de parametros: cotas coherentes, defaults dentro
// de cotas, metadatos completos y tablas de tractor bien formadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARAMETROS,
  TRACTORES_SIEMBRA,
  EQUIPOS_SIEMBRA,
  GASES_SIEMBRA,
  ROTAMETROS_SIEMBRA,
  COTAS_TRACTOR,
  COTAS_EQUIPO,
  COTAS_GAS,
  COTAS_ROTAMETRO,
  ORIGENES_VELOCIDAD,
  TIPOS_BOMBA,
  ACCIONAMIENTOS,
} from '../assets/js/domain/defaults.js';
import { MAGNITUDES } from '../assets/js/domain/units.js';

test('todo campo de parametro tiene metadatos completos y default dentro de cotas', () => {
  for (const [nombreGrupo, grupo] of Object.entries(PARAMETROS)) {
    assert.ok(grupo.etiqueta, `grupo ${nombreGrupo} sin etiqueta`);
    for (const [nombreCampo, campo] of Object.entries(grupo.campos)) {
      const ruta = `${nombreGrupo}.${nombreCampo}`;
      assert.ok(campo.etiqueta, `${ruta} sin etiqueta`);
      assert.ok(campo.origen, `${ruta} sin origen (ayuda contextual)`);
      assert.ok(Number.isFinite(campo.min), `${ruta} sin cota minima`);
      assert.ok(Number.isFinite(campo.max), `${ruta} sin cota maxima`);
      assert.ok(campo.min < campo.max, `${ruta} cotas invertidas`);
      if (campo.magnitud !== null) {
        assert.ok(
          MAGNITUDES[campo.magnitud],
          `${ruta} refiere magnitud inexistente ${campo.magnitud}`
        );
      }
      if (campo.valor === null) {
        assert.ok(campo.opcional, `${ruta} es null pero no esta marcado opcional`);
      } else {
        assert.ok(
          campo.valor >= campo.min && campo.valor <= campo.max,
          `${ruta} default ${campo.valor} fuera de cotas [${campo.min}, ${campo.max}]`
        );
        if (campo.entero) {
          assert.ok(Number.isInteger(campo.valor), `${ruta} debe ser entero`);
        }
      }
    }
  }
});

test('tractores de siembra: tabla de velocidades completa y regimenes coherentes', () => {
  assert.equal(TRACTORES_SIEMBRA.length, 2);
  for (const tractor of TRACTORES_SIEMBRA) {
    const filasEsperadas = tractor.numRangos * tractor.marchasPorRango;
    assert.equal(
      tractor.velocidades.length,
      filasEsperadas,
      `${tractor.id}: filas de velocidades`
    );
    assert.equal(
      tractor.etiquetasRango.length,
      tractor.numRangos,
      `${tractor.id}: etiquetas de rango`
    );
    for (const [campo, cota] of Object.entries(COTAS_TRACTOR)) {
      const valor = tractor[campo];
      assert.ok(
        valor >= cota.min && valor <= cota.max,
        `${tractor.id}.${campo} = ${valor} fuera de [${cota.min}, ${cota.max}]`
      );
    }
    assert.ok(
      tractor.regimenHabitual >= tractor.regimenMinimo &&
        tractor.regimenHabitual <= tractor.regimenMaximo,
      `${tractor.id}: regimen habitual fuera del rango de trabajo`
    );
    for (const fila of tractor.velocidades) {
      assert.ok(
        ORIGENES_VELOCIDAD.includes(fila.origen),
        `${tractor.id}: origen invalido ${fila.origen}`
      );
      assert.ok(fila.kmhNominal > 0, `${tractor.id}: velocidad no positiva`);
      assert.ok(
        fila.rango >= 0 && fila.rango < tractor.numRangos,
        `${tractor.id}: rango fuera de indice`
      );
      assert.ok(
        fila.marcha >= 1 && fila.marcha <= tractor.marchasPorRango,
        `${tractor.id}: marcha fuera de indice`
      );
    }
    // Dentro de un rango las marchas van de menor a mayor velocidad.
    for (let r = 0; r < tractor.numRangos; r += 1) {
      const marchas = tractor.velocidades
        .filter((v) => v.rango === r)
        .sort((a, b) => a.marcha - b.marcha);
      for (let i = 1; i < marchas.length; i += 1) {
        assert.ok(
          marchas[i].kmhNominal > marchas[i - 1].kmhNominal,
          `${tractor.id}: velocidades no crecientes en rango ${r}`
        );
      }
    }
  }
  // El nominal del 5715 esta pendiente de confirmar; el del 6603 verificado.
  const jd5715 = TRACTORES_SIEMBRA.find((t) => t.id === 'jd5715');
  const jd6603 = TRACTORES_SIEMBRA.find((t) => t.id === 'jd6603');
  assert.equal(jd5715.regimenNominalVerificado, 'pendiente');
  assert.equal(jd6603.regimenNominalVerificado, true);
  assert.equal(jd6603.regimenNominal, 2100);
});

test('equipos de siembra dentro de cotas y con enums validos', () => {
  for (const equipo of EQUIPOS_SIEMBRA) {
    assert.ok(TIPOS_BOMBA.includes(equipo.tipoBomba));
    assert.ok(ACCIONAMIENTOS.includes(equipo.accionamiento));
    for (const [campo, cota] of Object.entries(COTAS_EQUIPO)) {
      const valor = equipo[campo];
      if (valor === null || valor === undefined) {
        assert.ok(cota.opcional, `${equipo.id}.${campo} null sin ser opcional`);
      } else {
        assert.ok(
          valor >= cota.min && valor <= cota.max,
          `${equipo.id}.${campo} = ${valor} fuera de cotas`
        );
      }
    }
    // La calibracion de presion esta por capturar: no se inventa.
    assert.equal(equipo.rpmCalibracion, null);
    assert.equal(equipo.presionCalibracion, null);
  }
});

test('gases y rotametros de siembra dentro de cotas', () => {
  for (const gas of GASES_SIEMBRA) {
    for (const [campo, cota] of Object.entries(COTAS_GAS)) {
      const valor = gas[campo];
      if (valor === null || valor === undefined) {
        assert.ok(cota.opcional, `${gas.id}.${campo} null sin ser opcional`);
      } else {
        assert.ok(valor >= cota.min && valor <= cota.max, `${gas.id}.${campo}`);
      }
    }
  }
  for (const rotametro of ROTAMETROS_SIEMBRA) {
    for (const [campo, cota] of Object.entries(COTAS_ROTAMETRO)) {
      const valor = rotametro[campo];
      assert.ok(valor >= cota.min && valor <= cota.max, `${rotametro.id}.${campo}`);
    }
    assert.ok(rotametro.escalaMin < rotametro.escalaMax);
  }
});

test('el volumen de agua objetivo propio esta pendiente, no inventado', () => {
  const campo = PARAMETROS.agronomicos.campos.volumenAguaObjetivo;
  assert.equal(campo.valor, null);
  assert.equal(campo.verificado, 'pendiente');
});
