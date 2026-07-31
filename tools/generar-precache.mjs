// Herramienta SOLO de desarrollo: reescribe precache.js con la lista de
// archivos reales del sitio. El precache.js commiteado queda estatico:
// el sitio publicado no requiere esta herramienta.
//
// La lista vive en SU PROPIO ARCHIVO, y no dentro de sw.js, por dos
// razones. Es contenido 100% generado, asi que resolver a mano un
// conflicto en el es trabajo tirado; y separada puede llevar
// `merge=union` en .gitattributes, con lo que dos ramas que agregan
// archivos distintos dejan de chocar. La union puede dejar la lista
// duplicada o desordenada: correr esta herramienta la deja canonica otra
// vez, y el job `estatico` de CI verifica que asi quedo.
//
// Uso: node tools/generar-precache.mjs
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const raiz = new URL('..', import.meta.url).pathname;
const archivos = execSync(
  "find assets -type f \\( -name '*.js' -o -name '*.css' -o -name '*.woff2' -o -name '*.svg' -o -name '*.png' -o -name '*.txt' \\) | sort",
  { cwd: raiz, encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .map((ruta) => `./${ruta}`);

// La raiz del sitio y sus paginas: no viven bajo assets/, se listan
// aqui. `precache.js` se precachea a si mismo, igual que `version.js`:
// sin eso el service worker no podria reinstalarse sin conexion.
const fijos = [
  './',
  './404.html',
  './componentes.html',
  './index.html',
  './manifest.webmanifest',
  './precache.js',
  './version.js',
];

const rutas = [...fijos, ...archivos];
const lineas = rutas.map((ruta) => `  '${ruta}',`).join('\n');

const contenido = `// Lista de precache del service worker: GENERADA, no se edita a mano.
// Se reescribe con: node tools/generar-precache.mjs
//
// Script clasico a proposito (sin export): lo consume sw.js via
// importScripts, igual que version.js.
//
// Lleva merge=union en .gitattributes. Si un merge la deja duplicada o
// desordenada, no se resuelve a mano: se corre la herramienta.
self.SPRAYBOOM_PRECACHE = [
${lineas}
];
`;

writeFileSync(`${raiz}precache.js`, contenido);
console.log(`precache.js actualizado con ${rutas.length} rutas.`);
