// Contratos entre la INTERFAZ y el DOMINIO.
//
// Por que existe este archivo: la capa de dominio esta fuertemente
// probada —ruta redundante SI, ida y vuelta, propiedades, bordes— y la
// auditoria no encontro ni un numero mal calculado en ella. Los defectos
// que si aparecieron viven todos en la FRONTERA: la interfaz leia una
// clave que el dominio no expone (`cvPct` en vez de `cvPoblacionalPct`),
// un campo que la tabla de datos no tiene (`iso.iso` en vez de
// `iso.tamano`), escribia un dato compartido en el borrador de una
// pantalla en vez de en la jornada, y omitia un argumento que cambia el
// resultado (`dosis.unidad`).
//
// Los cuatro pasaban `npm test` en verde, porque ninguna prueba mira esa
// frontera. Estas si: son declarativas, corren sin DOM y fallan en el
// momento en que un nombre deja de corresponder.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { DATOS, clavesDeJornada } from '../assets/js/domain/datos.js';
import { estadisticaCaptura } from '../assets/js/domain/capture.js';
import { mezclaTanque } from '../assets/js/domain/mix.js';
import { estadoBombaARegimen, contrasteVolumenPorRegimen } from '../assets/js/domain/pump.js';
import { avance, geometria, completarTrioBarra } from '../assets/js/domain/speed.js';
import { ambosMetodos, volumenConBoquilla } from '../assets/js/domain/water.js';
import { forzamientoDesdeObjetivo } from '../assets/js/domain/forcing.js';
import { filaIso, TABLA_ISO_10625 } from '../assets/js/data/iso-colors.js';
import { CATALOGO_SIEMBRA } from '../assets/js/data/nozzle-catalog.js';
import { estiloBadgeIso } from '../assets/js/ui/color.js';
import { aNumero, esGrupoAmbiguo } from '../assets/js/ui/formato.js';
import { MAGNITUDES } from '../assets/js/domain/units.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const leer = (ruta) => readFileSync(`${raiz}${ruta}`, 'utf8');

// ---------------------------------------------------------------------
// 1. Toda clave que la interfaz lee existe en lo que el dominio devuelve
// ---------------------------------------------------------------------

test('capture.js expone las claves que leen la pestaña y el asistente', () => {
  const r = estadisticaCaptura({
    volumenesMl: [500, 520, 495],
    tiempoS: 60,
    umbralAtipicasPct: 10,
    velocidadKmh: 2.6,
    espaciamientoM: 0.5,
    lhaObjetivo: 575,
  });
  // `cvPct` NO existe y nunca existio: el asistente lo leia y el CV de la
  // barra —el criterio de aceptacion de un aforo— salia siempre vacio.
  for (const clave of [
    'n',
    'mediaLmin',
    'dePoblacional',
    'deMuestral',
    'cvPoblacionalPct',
    'cvMuestralPct',
    'porBoquilla',
    'atipicas',
    'desgastePct',
    'lhaRealMedido',
    'comparacionObjetivoPct',
  ]) {
    assert.ok(clave in r.valores, `capture.js dejo de exponer ${clave}`);
  }
  assert.ok(!('cvPct' in r.valores), 'si aparece cvPct, alguien lo agrego: revisa el nombre');
});

test('mix.js expone las claves que leen Mezcla y la hoja del asistente', () => {
  const r = mezclaTanque({
    volumenTanqueL: 2000,
    lhaAplicacion: 575,
    dosis: { modo: 'por-ha', cantidad: 2.5, unidad: 'L' },
    areaObjetivoHa: 10,
  });
  for (const clave of [
    'hectareasPorCarga',
    'dosisPorHa',
    'dosisPor100L',
    'productoPorCarga',
    'aguaPorCarga',
    'plan',
  ]) {
    assert.ok(clave in r.valores, `mix.js dejo de exponer ${clave}`);
  }
  for (const clave of [
    'caldoTotalL',
    'cargasCompletas',
    'caldoParcialL',
    'hectareasParciales',
    'productoParcial',
    'tanquesNecesarios',
  ]) {
    assert.ok(clave in r.valores.plan, `mix.js dejo de exponer plan.${clave}`);
  }
});

test('water.js, speed.js, pump.js y forcing.js exponen lo que pintan las pestañas', () => {
  const ambos = ambosMetodos({
    caudalBoquillaLmin: 1.2,
    numBoquillas: 24,
    velocidadKmh: 2.6,
    espaciamientoM: 0.64,
    anchoBarraM: 15.47,
    umbralDiscrepanciaPct: 1,
  });
  for (const clave of ['lhaPorBoquilla', 'lhaPorBarra', 'caudalTotalLmin', 'discrepanciaPct']) {
    assert.ok(clave in ambos.valores, `water.js dejo de exponer ${clave}`);
  }

  const a = avance({ velocidadKmh: 2.6, distanciaReferencia: 100, largoTabla: 646 });
  for (const clave of ['velocidadKmh', 'segundosPorTramo', 'tramosPorTabla', 'tiempoTotalS']) {
    assert.ok(clave in a.valores, `speed.js::avance dejo de exponer ${clave}`);
  }

  const g = geometria({
    largoTabla: 646,
    anchoBarra: 15.47,
    numBoquillas: 24,
    distanciaReferencia: 100,
    espaciamientoMinimoPlausible: 0.05,
    umbralDiscrepanciaPct: 1,
  });
  for (const clave of [
    'areaM2',
    'hectareasPorTabla',
    'tramosPorTabla',
    'espaciamientoDerivado',
    'espaciamientoEfectivo',
  ]) {
    assert.ok(clave in g.valores, `speed.js::geometria dejo de exponer ${clave}`);
  }

  const trio = completarTrioBarra({ anchoBarraM: 15.47, numBoquillas: 24, calcular: 'espaciamiento' });
  for (const clave of ['anchoBarraM', 'numBoquillas', 'espaciamientoM', 'calculado', 'discrepanciaPct']) {
    assert.ok(clave in trio.valores, `speed.js::completarTrioBarra dejo de exponer ${clave}`);
  }

  const bomba = estadoBombaARegimen({
    tipoBomba: 'positiva',
    conRegulador: true,
    rpmMotor: 1800,
    rpmCalibracion: 2000,
    presionCalibracionBar: 3,
    caudalCalibracionLmin: 1.2,
  });
  for (const clave of ['escenario', 'razonRegimen', 'presionEstimadaBar', 'caudalEstimadoLmin']) {
    assert.ok(clave in bomba.valores, `pump.js dejo de exponer ${clave}`);
  }

  const contraste = contrasteVolumenPorRegimen({
    tipoBomba: 'positiva',
    conRegulador: true,
    rpmTrabajo: 1800,
    rpmCalibracion: 2000,
    presionCalibracionBar: 3,
    caudalCalibracionLmin: 1.2,
    kmhNominalMarcha: 3.1,
    regimenNominalTractor: 2100,
    espaciamientoM: 0.64,
  });
  for (const clave of [
    'escenario',
    'razonRegimen',
    'velocidadCalibracionKmh',
    'velocidadTrabajoKmh',
    'volumenCalibracionLha',
    'volumenTrabajoLha',
    'factorVolumen',
    'desviacionPct',
  ]) {
    assert.ok(clave in contraste.valores, `pump.js::contraste dejo de exponer ${clave}`);
  }

  const forz = forzamientoDesdeObjetivo({
    dosisObjetivoGha: 2090,
    volumenAguaLha: 7000,
    hectareasPorTabla: 0.999,
    tiempoPorTablaS: 898,
    gPorScf: 32.9,
    presionAtmosfericaLocal: 14.7,
    presionEstandarCalibracion: 14.7,
    modoDespeje: 'scfm',
    psiDado: 30,
  });
  for (const clave of [
    'masaPorTablaG',
    'volumenAguaPorTablaL',
    'concentracionGL',
    'ajuste',
    'modoDespeje',
    'desviacionContraReferenciaPct',
  ]) {
    assert.ok(clave in forz.valores, `forcing.js dejo de exponer ${clave}`);
  }
  assert.ok('scfm' in forz.valores.ajuste, 'forcing.js dejo de exponer ajuste.scfm');
});

// ---------------------------------------------------------------------
// 2. Cada dato compartido se escribe donde su registro dice
// ---------------------------------------------------------------------

test('el registro de datos declara donde vive cada dato', () => {
  for (const [id, d] of Object.entries(DATOS)) {
    if (d.guarda === undefined) continue;
    assert.equal(typeof d.guarda.tab, 'string', `${id}: guarda.tab`);
    assert.equal(typeof d.guarda.clave, 'string', `${id}: guarda.clave`);
  }
});

test('ninguna pantalla escribe un dato de la JORNADA en el borrador de una pestaña', () => {
  // Este es el defecto que tenia el boton «Usar en Gasto de agua»: los
  // datos sin `guarda` viven en `estado.jornada`, y escribirlos con
  // `guardarBorrador` no precargaba nada —el toast decia que si—.
  const deJornada = new Set(
    Object.entries(DATOS)
      .filter(([, d]) => d.guarda === undefined)
      .map(([id]) => id)
  );
  const archivos = [
    'assets/js/main.js',
    'assets/js/ui/dato.js',
    'assets/js/ui/heredado.js',
    'assets/js/ui/tabs/guia.js',
    'assets/js/ui/tabs/guia/pasos.js',
    'assets/js/ui/tabs/avance.js',
    'assets/js/ui/tabs/gasto.js',
    'assets/js/ui/tabs/boquillas.js',
    'assets/js/ui/tabs/gas.js',
    'assets/js/ui/tabs/forzamiento.js',
    'assets/js/ui/tabs/mezcla.js',
    'assets/js/ui/tabs/captura.js',
    'assets/js/ui/tabs/bitacora.js',
    'assets/js/ui/tabs/configuracion.js',
  ];
  const problemas = [];
  for (const ruta of archivos) {
    const texto = leer(ruta);
    // Cada llamada a guardarBorrador y el objeto literal que le sigue.
    for (const m of texto.matchAll(/guardarBorrador\([^,]+,\s*\{([^}]*)\}/g)) {
      for (const clave of deJornada) {
        // Clave al principio del objeto o tras una coma, seguida de dos
        // puntos: `{ presionBar: … }`.
        if (new RegExp(`(^|[\\s,])${clave}\\s*:`).test(m[1])) {
          problemas.push(`${ruta}: guardarBorrador escribe «${clave}», que vive en la jornada`);
        }
      }
    }
  }
  assert.deepEqual(problemas, [], problemas.join('\n'));
});

test('las claves que viajan en un enlace compartido son las del registro', () => {
  const claves = clavesDeJornada();
  for (const [id, d] of Object.entries(DATOS)) {
    if (d.guarda !== undefined) continue;
    assert.ok(claves.includes(id), `${id} no viaja en el enlace compartido`);
    if (d.manual) assert.ok(claves.includes(d.manual), `${d.manual} no viaja en el enlace`);
  }
});

// ---------------------------------------------------------------------
// 3. La tabla ISO y el chip que la pinta
// ---------------------------------------------------------------------

test('cada tamaño ISO sembrado tiene fila, y la fila se nombra `tamano`', () => {
  for (const b of CATALOGO_SIEMBRA.filter((x) => x.tamanoIso)) {
    const fila = filaIso(b.tamanoIso);
    assert.ok(fila, `${b.id}: tamaño ISO ${b.tamanoIso} sin fila en la tabla`);
    assert.equal(fila.tamano, b.tamanoIso, `${b.id}: el campo de la fila es \`tamano\``);
    assert.ok(!('iso' in fila), 'si aparece `iso`, revisa los consumidores del chip');
  }
});

test('estiloBadgeIso no revienta con un color pendiente', () => {
  // La fila del tamaño 20 trae `hex: null` a proposito: su color vive en la
  // Tabla 2 de la norma y no se rellena por extrapolacion. Un consumidor
  // sin guarda tumbaba el paso de candidatas del asistente con un
  // TypeError, y el mensaje culpaba a datos que si estaban capturados.
  const pendientes = TABLA_ISO_10625.filter((f) => !f.hex);
  assert.ok(pendientes.length > 0, 'la tabla ya no tiene filas con color pendiente');
  for (const fila of pendientes) {
    assert.deepEqual(estiloBadgeIso(fila.hex), {}, `ISO ${fila.tamano}`);
  }
  const conColor = TABLA_ISO_10625.find((f) => f.hex);
  assert.equal(estiloBadgeIso(conColor.hex).backgroundColor, conColor.hex);
});

// ---------------------------------------------------------------------
// 4. La frontera de captura: texto a numero
// ---------------------------------------------------------------------

test('aNumero acepta la coma decimal y no confunde la de miles', () => {
  assert.equal(aNumero('2,5'), 2.5, 'coma decimal');
  assert.equal(aNumero('2.5'), 2.5, 'punto decimal');
  assert.equal(aNumero('1,234.56'), 1234.56, 'coma de miles con punto decimal');
  assert.equal(aNumero('1,234,567'), 1234567, 'dos comas de miles');
  assert.equal(aNumero(''), null);
  assert.equal(aNumero('abc'), null);
  // La forma ambigua no se adivina: null en vez de una de las dos lecturas.
  assert.equal(aNumero('2,000'), null, 'grupo ambiguo');
  assert.equal(aNumero('15,470'), null, 'grupo ambiguo de cinco digitos');
});

test('el grupo ambiguo se declara ambiguo en vez de valer mil veces menos', () => {
  // «2,000» puede ser dos mil o dos. La forma vieja devolvia 2 en silencio:
  // un tanque de 2,000 L capturado como 2 L pasa todas las cotas.
  for (const texto of ['2,000', '1,000', '646,000']) {
    assert.equal(esGrupoAmbiguo(texto), true, texto);
  }
  for (const texto of ['2,5', '2.5', '1,234.56', '1,234,567', '15470']) {
    assert.equal(esGrupoAmbiguo(texto), false, texto);
  }
  for (const texto of ['15,470']) {
    assert.equal(esGrupoAmbiguo(texto), true, texto);
  }
});

// ---------------------------------------------------------------------
// 5. Toda cifra que se pinta lleva su ayuda (regla dura del sistema)
// ---------------------------------------------------------------------

test('todo pintarResultado lleva su ayuda', () => {
  const archivos = [
    'assets/js/ui/marchas.js',
    'assets/js/ui/tabs/guia.js',
    'assets/js/ui/tabs/guia/pasos.js',
    'assets/js/ui/tabs/avance.js',
    'assets/js/ui/tabs/gasto.js',
    'assets/js/ui/tabs/boquillas.js',
    'assets/js/ui/tabs/gas.js',
    'assets/js/ui/tabs/forzamiento.js',
    'assets/js/ui/tabs/mezcla.js',
    'assets/js/ui/tabs/captura.js',
    'assets/js/ui/tabs/metodologia.js',
  ];
  const sinAyuda = [];
  for (const ruta of archivos) {
    const texto = leer(ruta);
    let i = 0;
    while ((i = texto.indexOf('pintarResultado({', i)) !== -1 && i !== -1) {
      const abre = texto.indexOf('{', i);
      let profundidad = 0;
      let j = abre;
      for (; j < texto.length; j += 1) {
        if (texto[j] === '{') profundidad += 1;
        else if (texto[j] === '}') {
          profundidad -= 1;
          if (profundidad === 0) {
            j += 1;
            break;
          }
        }
      }
      const bloque = texto.slice(abre, j);
      if (!/\bayuda:/.test(bloque)) {
        const linea = texto.slice(0, i).split('\n').length;
        const etiqueta = (bloque.match(/etiqueta:\s*(`[^`]*`|'[^']*')/) ?? [])[1] ?? '?';
        sinAyuda.push(`${ruta}:${linea} ${etiqueta}`);
      }
      i = j;
    }
  }
  assert.deepEqual(
    sinAyuda,
    [],
    `Una cifra sin «ayuda» no dice que es. Faltan:\n${sinAyuda.join('\n')}`
  );
});

// ---------------------------------------------------------------------
// 6. La equivalencia en el otro sistema, para las unidades que se pintan
// ---------------------------------------------------------------------

test('las unidades compuestas que pinta la interfaz existen en el registro de magnitudes', () => {
  // `.alterna` convierte a partir del TEXTO de la unidad. Estas son las que
  // las pantallas pintan esperando equivalencia; si una desaparece del
  // registro, la cifra se queda sin su conversion y nadie lo nota.
  const textos = new Set();
  for (const def of Object.values(MAGNITUDES)) {
    textos.add(def.metrico);
    textos.add(def.imperial);
  }
  for (const unidadTexto of ['L/ha', 'gal/acre', 'L/min', 'bar', 'psi', 'km/h', 'm', 'ha', 'L', 'mL', 'g', 'kg', 'kg/ha']) {
    assert.ok(textos.has(unidadTexto), `la magnitud de «${unidadTexto}» ya no esta declarada`);
  }
});

// ---------------------------------------------------------------------
// 7. La dosis solida no se trata como liquida
// ---------------------------------------------------------------------

test('mezclaTanque distingue producto solido de liquido, y la unidad no es opcional en la practica', () => {
  const base = { volumenTanqueL: 2000, lhaAplicacion: 575 };
  const liquido = mezclaTanque({ ...base, dosis: { modo: 'por-ha', cantidad: 2.5, unidad: 'L' } });
  const solido = mezclaTanque({ ...base, dosis: { modo: 'por-ha', cantidad: 2.5, unidad: 'kg' } });
  assert.ok(liquido.valores.aguaPorCarga < 2000, 'el liquido se le resta al agua');
  assert.equal(solido.valores.aguaPorCarga, 2000, 'el solido no');
  assert.ok(
    solido.avisos.some((a) => a.codigo === 'producto-solido'),
    'el solido lleva su aviso'
  );
  // La hoja del asistente omitia `unidad` y caia al default liquido, asi
  // que daba otro agua por carga que la pestaña Mezcla para la MISMA
  // captura. Esta comprobacion fija que los dos caminos difieren de verdad.
  const sinUnidad = mezclaTanque({ ...base, dosis: { modo: 'por-ha', cantidad: 2.5 } });
  assert.notEqual(
    sinUnidad.valores.aguaPorCarga,
    solido.valores.aguaPorCarga,
    'omitir la unidad NO es inocuo: quien llame a mezclaTanque tiene que pasarla'
  );
});

// ---------------------------------------------------------------------
// 8. El atajo de la hoja de resultado y la cadena larga dan lo mismo
// ---------------------------------------------------------------------

test('volumenConBoquilla reproduce el metodo por boquilla de la cadena larga', () => {
  const boquilla = CATALOGO_SIEMBRA.find((b) => b.tamanoIso === '04') ?? CATALOGO_SIEMBRA[0];
  const atajo = volumenConBoquilla({
    boquilla,
    presionBar: 3,
    velocidadKmh: 2.6,
    espaciamientoM: 0.64,
    anchoBarraM: 15.36,
    numBoquillas: 24,
    umbralDiscrepanciaPct: 1,
  });
  assert.ok(Number.isFinite(atajo.valores.lhaPorBoquilla));
  assert.ok('caudalAguaLmin' in atajo.valores, 'la hoja lee caudalAguaLmin');
  assert.ok('caudalCaldoLmin' in atajo.valores, 'la hoja lee caudalCaldoLmin');
});
