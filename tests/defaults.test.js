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
  COTAS_VELOCIDAD_MARCHA,
  COTAS_BARRA,
  COTAS_EQUIPO,
  COTAS_GAS,
  COTAS_BOQUILLA,
  COTAS_ROTAMETRO,
  COTAS_FACTOR_DESVIACION,
  ORIGENES_VELOCIDAD,
  TIPOS_BOMBA,
  ACCIONAMIENTOS,
} from '../assets/js/domain/defaults.js';
import { MAGNITUDES, unidad } from '../assets/js/domain/units.js';

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

// La magnitud es lo que decide si un campo lleva boton de conversion y
// con que factor convierte. Declararla mal —o declarar una unidad que no
// es la metrica de esa magnitud— pondria el boton a convertir con el
// factor de otra cosa, y eso sale en el lote, no en pantalla.
test('cotas y parametros: la magnitud declarada coincide con su unidad metrica', () => {
  const grupos = {
    PARAMETROS: Object.fromEntries(
      Object.entries(PARAMETROS).flatMap(([grupo, def]) =>
        Object.entries(def.campos).map(([campo, d]) => [`${grupo}.${campo}`, d])
      )
    ),
    COTAS_TRACTOR,
    COTAS_VELOCIDAD_MARCHA,
    COTAS_BARRA,
    COTAS_EQUIPO,
    COTAS_GAS,
    COTAS_BOQUILLA,
    COTAS_ROTAMETRO,
    COTAS_FACTOR_DESVIACION,
  };
  for (const [nombreGrupo, grupo] of Object.entries(grupos)) {
    for (const [campo, def] of Object.entries(grupo)) {
      const ruta = `${nombreGrupo}.${campo}`;
      assert.ok('magnitud' in def, `${ruta} no declara magnitud (usa null si no convierte)`);
      if (def.magnitud === null) continue;
      assert.ok(MAGNITUDES[def.magnitud], `${ruta} refiere magnitud inexistente ${def.magnitud}`);
      assert.equal(
        def.unidad,
        unidad(def.magnitud, 'metrico'),
        `${ruta}: la unidad declarada no es la metrica de ${def.magnitud}`
      );
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
  // Los dos regimenes nominales estan verificados contra fuente citada.
  const jd5715 = TRACTORES_SIEMBRA.find((t) => t.id === 'jd5715');
  const jd6603 = TRACTORES_SIEMBRA.find((t) => t.id === 'jd6603');
  assert.equal(jd5715.regimenNominalVerificado, true);
  assert.equal(jd5715.regimenNominal, 2400);
  assert.equal(jd6603.regimenNominalVerificado, true);
  assert.equal(jd6603.regimenNominal, 2100);
  for (const tractor of [jd5715, jd6603]) {
    assert.ok(
      typeof tractor.regimenNominalOrigen === 'string' &&
        tractor.regimenNominalOrigen.length > 0,
      `${tractor.id}: el regimen nominal verificado exige citar su origen`
    );
  }
});

// Las tablas son del fabricante, no estimaciones: si alguien las vuelve a
// tocar, esta prueba dice exactamente que numero cambio.
test('tractores de siembra: tablas de fabrica exactas y marcadas como capturado', () => {
  const esperado = {
    jd5715: {
      regimenNominal: 2400,
      kmh: [
        [2.1, 3.1, 4.5],
        [5.0, 7.2, 10.8],
        [13.7, 19.8, 29.8],
      ],
    },
    jd6603: {
      regimenNominal: 2100,
      kmh: [
        [3.1, 4.3, 5.3],
        [6.6, 9.0, 11.3],
        [18.3, 25.1, 31.2],
      ],
    },
  };
  for (const [id, ref] of Object.entries(esperado)) {
    const tractor = TRACTORES_SIEMBRA.find((t) => t.id === id);
    assert.ok(tractor, `falta el tractor ${id}`);
    assert.equal(tractor.regimenNominal, ref.regimenNominal, `${id}: regimen nominal`);
    ref.kmh.forEach((marchas, rango) =>
      marchas.forEach((kmh, indice) => {
        const fila = tractor.velocidades.find(
          (v) => v.rango === rango && v.marcha === indice + 1
        );
        const etiqueta = `${tractor.etiquetasRango[rango]}${indice + 1}`;
        assert.ok(fila, `${id}: falta la marcha ${etiqueta}`);
        assert.equal(fila.kmhNominal, kmh, `${id} ${etiqueta}: km/h nominales`);
        assert.equal(fila.origen, 'capturado', `${id} ${etiqueta}: origen`);
      })
    );
  }
});

// El salto entre rangos de una caja real es constante: es la comprobacion
// que delata una tabla inventada a ojo.
test('tractores de siembra: los saltos de rango son coherentes entre si', () => {
  for (const tractor of TRACTORES_SIEMBRA) {
    const kmh = (rango, marcha) =>
      tractor.velocidades.find((v) => v.rango === rango && v.marcha === marcha).kmhNominal;
    for (let rango = 1; rango < tractor.numRangos; rango += 1) {
      const saltos = [];
      for (let marcha = 1; marcha <= tractor.marchasPorRango; marcha += 1) {
        saltos.push(kmh(rango, marcha) / kmh(rango - 1, marcha));
      }
      const menor = Math.min(...saltos);
      const mayor = Math.max(...saltos);
      assert.ok(
        (mayor - menor) / menor < 0.06,
        `${tractor.id}: el salto al rango ${tractor.etiquetasRango[rango]} no es constante ` +
          `(${saltos.map((s) => s.toFixed(3)).join(', ')})`
      );
    }
  }
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
