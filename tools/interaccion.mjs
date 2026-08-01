// Herramienta SOLO de desarrollo: prueba de interaccion real en
// viewport de telefono, servida bajo subdirectorio simulado.
// Ejercita el flujo completo: marcha + rpm -> resultado, reporte de
// campo, gasto de agua con ambos metodos, cambio de unidades, gas por
// rotametro, service worker y RECARGA SIN CONEXION.
//
// Uso: CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/interaccion.mjs

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = new URL('..', import.meta.url).pathname;
const SUB = '/sprayboom-calibrate';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const servidor = createServer(async (peticion, respuesta) => {
  try {
    let ruta = decodeURIComponent(new URL(peticion.url, 'http://x').pathname);
    if (!ruta.startsWith(SUB)) return void (respuesta.writeHead(404), respuesta.end());
    ruta = ruta.slice(SUB.length) || '/';
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(normalize(RAIZ))) return void (respuesta.writeHead(403), respuesta.end());
    const contenido = await readFile(archivo);
    respuesta.writeHead(200, { 'content-type': MIME[extname(archivo)] ?? 'application/octet-stream' });
    respuesta.end(contenido);
  } catch {
    respuesta.writeHead(404);
    respuesta.end();
  }
});
await new Promise((r) => servidor.listen(0, r));
const puerto = servidor.address().port;
// El service worker exige contexto seguro: localhost lo es.
const base = `http://localhost:${puerto}${SUB}/`;

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  locale: 'es-MX',
});
const pagina = await contexto.newPage();
const problemas = [];
pagina.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
pagina.on('console', (m) => {
  if (m.type() === 'error') problemas.push(`consola: ${m.text()}`);
});

function verificar(condicion, mensaje) {
  if (!condicion) problemas.push(`FALLA: ${mensaje}`);
  else console.log('OK:', mensaje);
}

// ---------- Avance: marcha + rpm ----------
await pagina.goto(`${base}#/calibrar/avance`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(200);
await pagina.locator('.marcha', { hasText: 'A1' }).first().click();
const campoRpm = pagina.locator('input.entrada').first();
await campoRpm.fill('2100');
await pagina.waitForTimeout(150);
let texto = await pagina.locator('#panel').innerText();
// A1 de fabrica son 2.1 km/h a 2400 rpm: a 2100 rpm toca 1.84 km/h.
verificar(/1\.84|1,84/.test(texto), 'Avance: A1 a 2100 rpm muestra 1.84 km/h (nominal 2400)');
// Las tablas son del fabricante: la alerta de ESTIMACIÓN no debe salir, y
// en su lugar manda el aviso de que sin mediciones la velocidad no está
// verificada en campo.
verificar(
  !/ESTIMACIÓN no verificada/i.test(texto),
  'Avance: la tabla de fábrica no se anuncia como estimación'
);
verificar(
  /teórica sin verificar/i.test(texto),
  'Avance: sin mediciones de desviación se advierte que la velocidad es teórica'
);
verificar(texto.includes('TDF'), 'Avance: tarjeta de TDF presente');

// ---------- Avance: reporte de campo ----------
await pagina.getByRole('button', { name: 'Desde reporte de campo' }).click();
await pagina.locator('input.entrada:visible').first().fill('139');
await pagina.waitForTimeout(150);
texto = await pagina.locator('#panel').innerText();
verificar(/2\.59|2,59/.test(texto), 'Reporte: 139 s/100 m dan 2.59 km/h');
verificar(/898/.test(texto), 'Reporte: tiempo por tabla 898 s');
verificar(/rpm requeridas|Marchas que reproducen/i.test(texto), 'Reporte: lista de marchas presente');

// ---------- La velocidad heredada SIGUE al modo elegido en Avance ----
// Este es el fallo que motivo la sincronizacion entre pestanas: cambiar
// de modo en Avance no cambiaba lo que veian las demas pantallas, y el
// chip seguia diciendo «de Avance» sobre un numero de otro dia. En este
// punto Avance tiene el reporte (139 s) Y la marcha A1 a 2100 rpm.
async function velocidadEnGasto() {
  await pagina.goto(`${base}#/calibrar/gasto`, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(250);
  return pagina.locator('#panel').innerText();
}

let enGasto = await velocidadEnGasto();
verificar(
  /2[.,]59/.test(enGasto) && /del reporte de campo/i.test(enGasto),
  'Herencia: con Avance en modo reporte, Gasto hereda 2.59 km/h del reporte'
);

await pagina.goto(`${base}#/calibrar/avance`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
await pagina.getByRole('button', { name: 'Desde marcha y rpm' }).click();
await pagina.waitForTimeout(200);
enGasto = await velocidadEnGasto();
verificar(
  /1[.,]84/.test(enGasto) && /de la marcha A1/i.test(enGasto),
  'Herencia: al volver a modo marcha, Gasto pasa a 1.84 km/h de la marcha A1'
);
verificar(
  !/2[.,]59\s*km\/h/.test(enGasto),
  'Herencia: el reporte de campo viejo ya no se cuela en Gasto'
);

// El tiempo por tabla de Gas etileno sale del MISMO derivado: con la
// marcha elegida ya no puede traer el tiempo del reporte.
await pagina.goto(`${base}#/calibrar/gas`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
const enGas = await pagina.locator('#panel').innerText();
verificar(
  /de la marcha A1/i.test(enGas) && !/898/.test(enGas),
  'Herencia: el tiempo por tabla de Gas etileno también sigue a la marcha, no al reporte'
);

// El caso de estreno, que es el que mas se da en campo: se elige la
// marcha y se ACEPTA el regimen que la pantalla ya trae precargado, sin
// teclearlo. Avance calcula con el desde que se abre; hasta que Avance
// no lo persistio, las demas pantallas se quedaban sin velocidad.
await pagina.evaluate(() => {
  const clave = 'sprayboom.v1';
  const estado = JSON.parse(localStorage.getItem(clave));
  estado.borradores = {};
  localStorage.setItem(clave, JSON.stringify(estado));
});
await pagina.goto(`${base}#/calibrar/avance`, { waitUntil: 'networkidle' });
// Recarga de verdad: cambiar el hash no vuelve a arrancar los modulos, y
// el estado en memoria seguiria trayendo el borrador que se acaba de
// borrar del almacenamiento.
await pagina.reload({ waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
await pagina.locator('.marcha', { hasText: 'A1' }).first().click();
await pagina.waitForTimeout(200);
const enAvanceEstreno = await pagina.locator('#panel').innerText();
// A1 son 2.1 km/h a 2400 rpm nominales; el habitual precargado son 1800.
verificar(
  /1[.,]58/.test(enAvanceEstreno),
  'Estreno: Avance calcula con el régimen habitual precargado (1.58 km/h)'
);
enGasto = await velocidadEnGasto();
verificar(
  /1[.,]58/.test(enGasto) && /de la marcha A1/i.test(enGasto),
  'Estreno: Gasto hereda ese mismo número sin que nadie teclee el régimen'
);
verificar(
  !/sin dato en Avance/i.test(enGasto),
  'Estreno: Gasto ya no se queda sin velocidad con Avance mostrando una'
);

// ---------- Gasto de agua: ambos metodos ----------
await pagina.goto(`${base}#/calibrar/gasto`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
const comboGasto = pagina.locator('input[role="combobox"]').first();
await comboGasto.click();
await comboGasto.fill('XR11004');
await pagina.waitForTimeout(200);
await pagina.locator('.combobox__opcion').first().click();
await pagina.waitForTimeout(120);
// presion 3 bar y velocidad 2.59 en los campos visibles
const campos = pagina.locator('input.entrada:visible');
const cantidad = await campos.count();
for (let i = 0; i < cantidad; i += 1) {
  const etiqueta = await campos.nth(i).evaluate((n) => {
    const l = n.labels && n.labels[0] ? n.labels[0].textContent : '';
    return l || n.getAttribute('aria-label') || '';
  });
  if (/Presión|Presion/.test(etiqueta) && !/referencia|mínima|máxima/i.test(etiqueta)) {
    await campos.nth(i).fill('3');
  } else if (/^Velocidad/.test(etiqueta.trim())) {
    await campos.nth(i).fill('2.59');
  }
}
await pagina.waitForTimeout(250);
texto = await pagina.locator('#panel').innerText();
verificar(/por boquilla/i.test(texto) && /por barra/i.test(texto), 'Gasto: ambos métodos lado a lado');
verificar(/Verificado por dos rutas|verificación/i.test(texto), 'Gasto: verificación redundante visible');
verificar(/desglose/i.test(texto), 'Gasto: desglose paso a paso disponible');

// ---------- Boton de unidades: convierte el CAMPO, no la aplicacion ----------
// El manometro de la barra viene rotulado en psi y la aplicacion trabaja
// en bar: antes ese numero se convertia a mano, de pie en el lote.
const botonAPsi = pagina.getByRole('button', { name: /^Presión en la boquilla en bar\./ });
verificar((await botonAPsi.count()) === 1, 'Unidades: el campo de presión trae su botón');
const entradaPresion = pagina.getByRole('textbox', { name: 'Presión en la boquilla' });
await botonAPsi.click();
verificar(
  (await entradaPresion.inputValue()) === '43.5113',
  `Unidades: 3 bar se escriben como 43.5113 psi (se obtuvo ${await entradaPresion.inputValue()})`
);
verificar(
  (await pagina.locator('.campo__unidad[data-convertido="true"]').count()) === 1,
  'Unidades: el campo convertido queda marcado con el acento'
);
// El sistema de la aplicacion NO se movio: el resultado sigue en metrico.
verificar(
  /L\/ha/.test(await pagina.locator('#panel').innerText()),
  'Unidades: convertir un campo no cambia el sistema de la pantalla'
);
const botonABar = pagina.getByRole('button', { name: /^Presión en la boquilla en psi\./ });
await botonABar.click();
verificar(
  (await entradaPresion.inputValue()) === '3',
  `Unidades: la vuelta devuelve el 3 original, no el reconvertido (se obtuvo ${await entradaPresion.inputValue()})`
);
verificar(
  (await pagina.locator('.campo__unidad[data-convertido="true"]').count()) === 0,
  'Unidades: de vuelta en las unidades de la aplicación, sin marca'
);

// ---------- El volumen de aplicación llega solo a Mezcla ----------
// Toda la mezcla depende de este número y antes había que copiarlo a
// mano de una pantalla a otra: la ayuda pedía traerlo de aquí sin que
// hubiera forma de hacerlo.
const lhaCalculado = (texto.match(/Método por boquilla\s+([\d.,]+)/) ?? [])[1] ?? null;
verificar(lhaCalculado !== null, 'Gasto: el método por boquilla da un número');
await pagina.goto(`${base}#/calibrar/mezcla`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
const enMezcla = await pagina.locator('#panel').innerText();
verificar(
  /de Gasto de agua/i.test(enMezcla) && /calculada en Gasto de agua/i.test(enMezcla),
  'Mezcla: el volumen de aplicación se hereda con su procedencia a la vista'
);
verificar(
  lhaCalculado !== null && enMezcla.includes(lhaCalculado),
  `Mezcla: hereda el mismo ${lhaCalculado} L/ha que calculó Gasto de agua`
);

// ---------- Cambio de unidades: vive SOLO en Configuración ----------
verificar(
  (await pagina.locator('#selector-unidades').count()) === 0,
  'Encabezado: el selector de unidades ya no está ahí'
);

async function fijarUnidades(valor) {
  await pagina.goto(`${base}#/sistema/configuracion`, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(300);
  // exact: el boton de ayuda del campo se llama "Ayuda sobre Sistema de unidades".
  await pagina.getByLabel('Sistema de unidades', { exact: true }).selectOption(valor);
  await pagina.waitForTimeout(300);
  await pagina.goto(`${base}#/calibrar/gasto`, { waitUntil: 'networkidle' });
  await pagina.waitForTimeout(400);
}

await fijarUnidades('imperial');
texto = await pagina.locator('#panel').innerText();
verificar(/gal\/acre|GPA|gal\/min|psi/i.test(texto), 'Imperial: la pantalla muestra unidades imperiales');
await fijarUnidades('metrico');

// ---------- Boquillas: candidatas ----------
await pagina.goto(`${base}#/calibrar/boquillas`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
const camposB = pagina.locator('input.entrada:visible');
const nB = await camposB.count();
for (let i = 0; i < nB; i += 1) {
  const etiqueta = await camposB.nth(i).evaluate((n) => (n.labels && n.labels[0] ? n.labels[0].textContent : '') || '');
  if (/Volumen objetivo|objetivo/i.test(etiqueta)) await camposB.nth(i).fill('575');
  else if (/^Velocidad/.test(etiqueta.trim())) await camposB.nth(i).fill('2.59');
}
await pagina.waitForTimeout(300);
texto = await pagina.locator('#panel').innerText();
verificar(/XR11004|TT11004|candidata/i.test(texto), 'Boquillas: aparecen candidatas para 575 L/ha a 2.59 km/h');

// ---------- Gas: consumo del caso de aceptacion ----------
await pagina.goto(`${base}#/calibrar/gas`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
texto = await pagina.locator('#panel').innerText();
verificar(/g\/SCF/.test(texto), 'Gas: g/SCF visible (derivado del gas activo)');
verificar(/32\.9|32,9/.test(texto), 'Gas: derivación cerca de 32.90 g/SCF');

// ---------- Metodologia ----------
await pagina.goto(`${base}#/sistema/metodologia`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(250);
texto = await pagina.locator('#panel').innerText();
verificar(/600/.test(texto) && /ISO 10625/.test(texto), 'Metodología: factor 600 y tabla ISO presentes');
verificar(/S572/.test(texto), 'Metodología: ediciones S572 presentes');
verificar(/exporta|respaldo|navegador/i.test(texto), 'Metodología: limitación de datos locales declarada');

// ---------- Sitio: la presion atmosferica sale de la altitud ----------
await pagina.goto(`${base}#/sistema/configuracion`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
const campoAltitud = pagina.getByRole('textbox', { name: 'Altitud del sitio' });
verificar((await campoAltitud.count()) === 1, 'Sitio: el campo de altitud existe');
const presionEnUso = pagina.locator('.resultado', { hasText: 'Presión atmosférica local en uso' }).first();
await campoAltitud.fill('2000');
await pagina.waitForTimeout(300);
let lecturaPresion = await presionEnUso.innerText();
verificar(
  /11[.,]53/.test(lecturaPresion),
  `Sitio: 2000 m dan 11.53 psia (${lecturaPresion.replace(/\n/g, ' ')})`
);
verificar(
  /Derivada de 2,?000 m/.test(await pagina.locator('#panel').innerText()),
  'Sitio: la pantalla dice de dónde sale la presión'
);

// La anulacion manual gana, y al vaciarla vuelve la derivacion.
const campoPresion = pagina.getByRole('textbox', { name: 'Presión atmosférica local' });
await campoPresion.fill('12');
await pagina.waitForTimeout(300);
lecturaPresion = await presionEnUso.innerText();
verificar(/12[.,]00/.test(lecturaPresion), 'Sitio: la anulación manual gana sobre la altitud');
verificar(
  /Anulada a mano/.test(await pagina.locator('#panel').innerText()),
  'Sitio: se dice que la altitud dejó de usarse'
);
await campoPresion.fill('');
await pagina.waitForTimeout(300);
lecturaPresion = await presionEnUso.innerText();
verificar(/11[.,]53/.test(lecturaPresion), 'Sitio: al vaciar la anulación vuelve la derivación');

// El GPS: Playwright entrega posicion SIN altitud, que es justo el caso
// del telefono que ubica por wifi. Debe decirlo, no romperse.
const botonGps = pagina.getByRole('button', { name: 'Usar la altitud del GPS' });
verificar((await botonGps.count()) === 1, 'Sitio: el botón del GPS existe');
await contexto.grantPermissions(['geolocation']);
await contexto.setGeolocation({ latitude: 20.6736, longitude: -103.344, accuracy: 12 });
await botonGps.click();
await pagina.waitForTimeout(1500);
verificar(
  /no la altitud/i.test(await pagina.locator('body').innerText()),
  'Sitio: sin altitud del GPS se explica por qué, en vez de fallar'
);
await campoAltitud.fill('0');
await pagina.waitForTimeout(300);

// ---------- Barras de aplicacion: alta y geometria propia ----------
await pagina.goto(`${base}#/sistema/configuracion`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
texto = await pagina.locator('#panel').innerText();
verificar(/Barras de aplicación/.test(texto), 'Configuración: la sección se llama Barras de aplicación');
verificar(
  /Ancho de barra de aplicación/.test(texto) && /Número de boquillas instaladas/.test(texto),
  'Barra: el ancho y el número de boquillas son campos de la barra'
);
const botonAgregarBarra = pagina.getByRole('button', { name: 'Agregar barra' });
verificar((await botonAgregarBarra.count()) === 1, 'Barra: el botón de agregar existe');
await botonAgregarBarra.click();
await pagina.waitForTimeout(500);
const opcionesBarra = await pagina.locator('#selector-equipo option').count();
verificar(opcionesBarra === 2, `Barra: la nueva aparece en el selector del encabezado (${opcionesBarra})`);
await pagina.getByRole('textbox', { name: 'Ancho de barra de aplicación' }).fill('8');
await pagina.getByRole('textbox', { name: 'Número de boquillas instaladas' }).fill('16');
await pagina.waitForTimeout(400);
const derivado = await pagina
  .locator('.resultado', { hasText: 'Espaciamiento derivado' })
  .first()
  .innerText();
verificar(
  /0[.,]5/.test(derivado),
  `Barra: el espaciamiento derivado sigue a la geometría de ESTA barra, 8 / 16 = 0.5 m (${derivado.replace(/\n/g, ' ')})`
);
await pagina.getByRole('button', { name: 'Eliminar esta barra' }).click();
await pagina.waitForTimeout(300);
await pagina.getByRole('button', { name: 'Eliminar', exact: true }).click();
await pagina.waitForTimeout(500);
verificar(
  (await pagina.locator('#selector-equipo option').count()) === 1,
  'Barra: se puede eliminar y el selector vuelve a una sola'
);

// ---------- Service worker y recarga sin conexion ----------
await pagina.goto(base, { waitUntil: 'networkidle' });
const registrado = await pagina.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'sin-soporte';
  const listo = await Promise.race([
    navigator.serviceWorker.ready.then(() => 'listo'),
    new Promise((r) => setTimeout(() => r('tiempo-agotado'), 15000)),
  ]);
  return listo;
});
verificar(registrado === 'listo', `Service worker instalado (${registrado})`);
if (registrado === 'listo') {
  await pagina.waitForTimeout(1200); // deja terminar el precache
  await contexto.setOffline(true);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(800);
  const tarjetasOffline = await pagina.locator('#panel .card').count();
  verificar(tarjetasOffline > 0, `Sin conexión: la aplicación recarga y pinta (${tarjetasOffline} tarjetas)`);
  await contexto.setOffline(false);
}

// ---------- Actualizar la aplicacion a mano ----------
// Es la unica salida de un iPhone instalado en pantalla de inicio: sin
// barra de direcciones no hay recargar ni borrar cache.
await pagina.goto(`${base}#/sistema/configuracion`, { waitUntil: 'networkidle' });
await pagina.waitForTimeout(400);
texto = await pagina.locator('#panel').innerText();
verificar(/Versión instalada/.test(texto), 'Actualizar: la versión instalada se muestra');
const botonBuscar = pagina.getByRole('button', { name: 'Buscar actualización' });
verificar((await botonBuscar.count()) === 1, 'Actualizar: el botón de buscar actualización existe');
await botonBuscar.click();
await pagina.waitForTimeout(2500);
texto = await pagina.locator('#panel').innerText();
verificar(
  /última versión publicada/i.test(texto),
  'Actualizar: sin versión nueva en el servidor, informa que ya está al día'
);
verificar(
  (await pagina.getByRole('button', { name: 'Reinstalar desde cero' }).count()) === 1,
  'Actualizar: el botón de reinstalar desde cero existe'
);

// ---------- Reinstalar desde cero ----------
// Es el ultimo recurso cuando el telefono se quedo con la version
// vieja: si este boton no hace nada, no hay salida en el lote.
await pagina.getByRole('button', { name: 'Reinstalar desde cero' }).click();
await pagina.waitForTimeout(400);
const dialogo = pagina.locator('dialog.dialogo');
const textoDialogo = await dialogo.innerText();
// `dialogo.append(cuerpo)` con cuerpo ausente pintaba la palabra "null"
// bajo la descripcion, en todos los dialogos de la aplicacion.
verificar(!/\bnull\b/.test(textoDialogo), 'Diálogo: sin la palabra «null» cuando no hay cuerpo');
verificar(/Se borra la copia guardada/.test(textoDialogo), 'Diálogo: la descripción se pinta');

// Sin conexión NO se borra nada: la copia guardada es lo único con lo
// que la aplicación abre en el lote.
await contexto.setOffline(true);
await pagina.getByRole('button', { name: 'Reinstalar', exact: true }).click();
await pagina.waitForTimeout(1000);
const cachesSinConexion = await pagina.evaluate(() => caches.keys());
verificar(cachesSinConexion.length > 0, 'Reinstalar: sin conexión no se borra la copia guardada');
texto = await pagina.locator('#panel').innerText();
verificar(/Sin conexión: no se borró nada/.test(texto), 'Reinstalar: sin conexión lo dice y no miente');
verificar(
  await pagina.getByRole('button', { name: 'Reinstalar desde cero' }).isEnabled(),
  'Reinstalar: sin conexión el botón vuelve a quedar disponible'
);
await contexto.setOffline(false);

// Con conexión: borra, recarga las dos veces y avisa al terminar. Sin
// el aviso, la reinstalación es invisible y parece que no hizo nada.
await pagina.getByRole('button', { name: 'Reinstalar desde cero' }).click();
await pagina.waitForTimeout(400);
await pagina.getByRole('button', { name: 'Reinstalar', exact: true }).click();
// El aviso se autodescarta a los 9 s: hay que esperarlo, no medir el
// reloj. Aparece tras la SEGUNDA recarga, la que trae la versión nueva.
const aviso = pagina.locator('.toast', { hasText: /reinstalada/i });
const avisoSalio = await aviso
  .waitFor({ state: 'attached', timeout: 25000 })
  .then(() => true)
  .catch(() => false);
verificar(avisoSalio, 'Reinstalar: al terminar avisa al usuario');
await pagina.waitForTimeout(500);
verificar(
  (await pagina.evaluate(() => sessionStorage.getItem('sprayboom:reinstalacion'))) === null,
  'Reinstalar: la marca de reinstalación se consume (no se repite el aviso)'
);
const cachesTrasReinstalar = await pagina.evaluate(() => caches.keys());
verificar(
  cachesTrasReinstalar.length > 0,
  `Reinstalar: la copia guardada queda rehecha (${JSON.stringify(cachesTrasReinstalar)})`
);
verificar(
  (await pagina.locator('#panel .card').count()) > 0,
  'Reinstalar: la aplicación queda usable tras reinstalar'
);

await contexto.close();
await navegador.close();
servidor.close();

if (problemas.length > 0) {
  console.error(`\n${problemas.length} problemas:`);
  for (const p of problemas) console.error(' -', p);
  process.exit(1);
}
console.log('\nInteracción en verde.');
