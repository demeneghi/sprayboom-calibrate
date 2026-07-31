// Herramienta SOLO de desarrollo: prueba de humo en viewport de
// telefono, servida bajo subdirectorio simulado como en GitHub Pages.
//
// Uso: node tools/humo.mjs [--capturas]
// Sale con codigo 1 si hay errores de consola o de pagina, si alguna
// vista produce scroll horizontal, o si una pantalla no pinta.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = new URL('..', import.meta.url).pathname;
const SUBDIRECTORIO = '/sprayboom-calibrate';
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
    if (!ruta.startsWith(SUBDIRECTORIO)) {
      respuesta.writeHead(404);
      respuesta.end('fuera del subdirectorio');
      return;
    }
    ruta = ruta.slice(SUBDIRECTORIO.length) || '/';
    if (ruta.endsWith('/')) ruta += 'index.html';
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(normalize(RAIZ))) {
      respuesta.writeHead(403);
      respuesta.end();
      return;
    }
    const contenido = await readFile(archivo);
    respuesta.writeHead(200, { 'content-type': MIME[extname(archivo)] ?? 'application/octet-stream' });
    respuesta.end(contenido);
  } catch {
    respuesta.writeHead(404);
    respuesta.end('no encontrado');
  }
});

await new Promise((resolver) => servidor.listen(0, resolver));
const puerto = servidor.address().port;
const base = `http://127.0.0.1:${puerto}${SUBDIRECTORIO}/`;
console.log('Sirviendo', base);

const capturas = process.argv.includes('--capturas');
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const problemas = [];

const RUTAS = [
  ['calibrar', 'avance'],
  ['calibrar', 'gasto'],
  ['calibrar', 'boquillas'],
  ['calibrar', 'gas'],
  ['calibrar', 'forzamiento'],
  ['calibrar', 'mezcla'],
  ['registrar', 'captura'],
  ['registrar', 'bitacora'],
  ['sistema', 'configuracion'],
  ['sistema', 'metodologia'],
];

for (const [ancho, alto, nombre] of [[390, 844, 'iphone'], [360, 740, 'gama-baja']]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    locale: 'es-MX',
  });
  const pagina = await contexto.newPage();
  pagina.on('console', (mensaje) => {
    if (mensaje.type() === 'error') {
      problemas.push(`[consola ${nombre}] ${mensaje.text()}`);
    }
  });
  pagina.on('pageerror', (error) => {
    problemas.push(`[pagina ${nombre}] ${error.message}`);
  });

  for (const [seccion, tab] of RUTAS) {
    await pagina.goto(`${base}#/${seccion}/${tab}`, { waitUntil: 'networkidle' });
    // Espera por condicion con tope, no por tiempo fijo: en un runner
    // lento la pestana mas pesada puede tardar mas que cualquier pausa
    // arbitraria y la prueba se volveria fragil.
    let pinto = true;
    try {
      await pagina.locator('#panel .card').first().waitFor({ state: 'attached', timeout: 15000 });
    } catch {
      pinto = false;
    }
    if (!pinto) {
      problemas.push(`[${nombre}] ${seccion}/${tab}: el panel no pinto ninguna tarjeta en 15 s`);
    }
    await pagina.waitForTimeout(120);
    const scrollHorizontal = await pagina.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (scrollHorizontal > 1) {
      problemas.push(`[${nombre}] ${seccion}/${tab}: scroll horizontal de ${scrollHorizontal}px`);
    }
    if (capturas && nombre === 'iphone') {
      await pagina.screenshot({
        path: new URL(`../capturas/${seccion}-${tab}.png`, import.meta.url).pathname,
        fullPage: false,
      });
    }
  }
  await contexto.close();
}

await navegador.close();
servidor.close();

if (problemas.length > 0) {
  console.error(`\n${problemas.length} problemas:`);
  for (const p of problemas) console.error(' -', p);
  process.exit(1);
}
console.log('Humo en verde: 10 rutas x 2 viewports sin errores ni scroll horizontal.');
