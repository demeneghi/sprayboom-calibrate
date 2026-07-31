// Herramienta SOLO de desarrollo: regenera la lista de precache de
// sw.js entre los marcadores <precache> y </precache> a partir de los
// archivos reales del sitio. El sw.js commiteado queda estatico: el
// sitio publicado no requiere esta herramienta.
// Uso: node tools/generar-precache.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;
const archivos = execSync(
  "find assets -type f \\( -name '*.js' -o -name '*.css' -o -name '*.woff2' -o -name '*.svg' -o -name '*.png' -o -name '*.txt' \\) | sort",
  { cwd: raiz, encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .map((ruta) => `./${ruta}`);

const fijos = [
  './',
  './404.html',
  './componentes.html',
  './index.html',
  './manifest.webmanifest',
  './version.js',
];

const lineas = [...fijos, ...archivos].map((ruta) => `  '${ruta}',`).join('\n');
const rutaSw = `${raiz}sw.js`;
const contenido = readFileSync(rutaSw, 'utf8');
const nuevo = contenido.replace(
  /(\/\/ <precache>\n)[\s\S]*?(\n\s*\/\/ <\/precache>)/,
  `$1${lineas}$2`
);
writeFileSync(rutaSw, nuevo);
console.log(`sw.js actualizado con ${fijos.length + archivos.length} rutas.`);
