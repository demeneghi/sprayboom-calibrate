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
  ['calibrar', 'guia'],
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
    // El documento puede no irse de lado y aun asi haber contenido
    // CORTADO adentro: el panel recorta lo que se sale y la columna
    // derecha de una rejilla desaparece contra el borde sin que nada se
    // note desde afuera. Se mide la caja real de cada nodo contra el
    // borde del panel; el area tactil de un boton no cuenta, porque vive
    // en un pseudo-elemento y no en la caja.
    //
    // Las tablas anchas SI se desplazan a proposito, dentro de
    // `.scroll-x`, y los globos de ayuda flotan fuera del flujo: los dos
    // quedan fuera de la medicion.
    const cortados = await pagina.evaluate(() => {
      const panel = document.getElementById('panel');
      if (!panel) return [];
      const borde = panel.getBoundingClientRect().right;
      return [...panel.querySelectorAll('*')]
        .filter((nodo) => {
          if (nodo.closest('.scroll-x') || nodo.closest('[popover]')) return false;
          const caja = nodo.getBoundingClientRect();
          return caja.width > 0 && caja.right > borde + 1;
        })
        .map((nodo) => `${nodo.tagName.toLowerCase()}.${nodo.className}`.trim().slice(0, 60));
    });
    if (cortados.length > 0) {
      problemas.push(
        `[${nombre}] ${seccion}/${tab}: contenido cortado contra el borde del panel (${cortados
          .slice(0, 4)
          .join(', ')})`
      );
    }
    // La navegacion inferior se queda pegada al borde de la pantalla y
    // el encabezado con los selectores, pegado arriba: las dos anclas
    // se revisan DESPLAZANDO hasta el final, que es donde se rompen.
    //
    // Van dos comprobaciones porque fallan por motivos distintos:
    //
    // 1. Que sigan en su sitio despues de bajar. Esto atrapa el caso que
    //    rompe en cualquier navegador: un ancestro con `transform`,
    //    `filter` o `contain` se vuelve el contenedor de lo fijo.
    // 2. Que ni <html> ni <body> escondan con `overflow: hidden`. Eso
    //    hace de la raiz un contenedor de scroll: el encabezado pegajoso
    //    se despega aqui mismo —lo atrapa la comprobacion 1—, pero la
    //    barra fija solo se va con el contenido en Safari de iPhone, y
    //    Chromium no lo reproduce. Como ese lado NO se puede medir desde
    //    esta prueba, se prohibe la causa.
    const anclas = await pagina.evaluate(async () => {
      const raiz = getComputedStyle(document.documentElement).overflowX;
      const cuerpo = getComputedStyle(document.body).overflowX;
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const barra = document.querySelector('.nav-inferior').getBoundingClientRect();
      const cabecera = document.querySelector('.encabezado').getBoundingClientRect();
      const bajado = window.scrollY;
      window.scrollTo(0, 0);
      return {
        raiz,
        cuerpo,
        bajado,
        barra: window.innerHeight - barra.bottom,
        cabecera: cabecera.top,
      };
    });
    for (const [donde, valor] of [['html', anclas.raiz], ['body', anclas.cuerpo]]) {
      if (valor === 'hidden') {
        problemas.push(
          `[${nombre}] ${seccion}/${tab}: ${donde} lleva overflow-x: hidden; usa clip, o en iPhone la barra inferior y el encabezado se van con el scroll`
        );
      }
    }
    // Con menos de 8px de recorrido no hay nada que probar: la pestana
    // cabe entera en la pantalla y las anclas no se han movido de sitio.
    if (anclas.bajado > 8) {
      if (Math.abs(anclas.barra) > 1) {
        problemas.push(
          `[${nombre}] ${seccion}/${tab}: la navegacion inferior se despego ${Math.round(anclas.barra)}px del borde al desplazar`
        );
      }
      if (Math.abs(anclas.cabecera) > 1) {
        problemas.push(
          `[${nombre}] ${seccion}/${tab}: el encabezado se despego ${Math.round(anclas.cabecera)}px de arriba al desplazar`
        );
      }
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
console.log(
  `Humo en verde: ${RUTAS.length} rutas x 2 viewports sin errores ni scroll horizontal.`
);
