// Herramienta de DESPLIEGUE: copia a `_sitio/` exactamente lo que el
// sitio sirve, y nada mas.
//
// Antes el despliegue empaquetaba la raiz del repositorio (`path: .`). La
// accion excluye `.git` y `.github`, pero todo lo demas quedaba servido en
// el sitio publicado: `.claude/` con las reglas del proyecto, `CLAUDE.md`,
// `docs/`, las 19 baterias de `tests/`, las 8 herramientas de `tools/` y
// `package.json`. No hay secretos en ninguno —esta auditado—, asi que la
// exposicion era de material de desarrollo; pero la superficie publicada
// no tiene por que ser mayor que la necesaria, y si el repositorio pasara
// a privado conservando Pages publico, se publicaria sin que nadie lo
// hubiera decidido.
//
// La lista NO se escribe aqui: sale de `precache.js`, que ya es la lista
// generada de los archivos del sitio y la que el service worker precachea.
// Con dos listas separadas, una de las dos se queda vieja; con una sola,
// publicar una ruta que el precache no conoce —o precachear una que no se
// publica— es imposible, y esta herramienta lo comprueba.
//
// Uso: node tools/empaquetar-sitio.mjs [destino]

import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const destino = `${raiz}${process.argv[2] ?? '_sitio'}/`;

// `precache.js` es un script clasico que estampa `self.SPRAYBOOM_PRECACHE`:
// se evalua con un `self` de mentiras en vez de parsearlo con regex.
const contexto = { SPRAYBOOM_PRECACHE: null };
const fuente = readFileSync(`${raiz}precache.js`, 'utf8');
new Function('self', fuente)(contexto);
const rutas = contexto.SPRAYBOOM_PRECACHE;
if (!Array.isArray(rutas) || rutas.length === 0) {
  console.error('precache.js no declaro SPRAYBOOM_PRECACHE: corre node tools/generar-precache.mjs');
  process.exit(1);
}

// Lo que el precache NO lista y el sitio si necesita: el service worker
// (no se precachea a si mismo) y la marca que le dice a Pages que no pase
// el sitio por Jekyll (sin ella, los directorios con punto no se sirven).
const ADEMAS = ['sw.js', '.nojekyll'];

rmSync(destino, { recursive: true, force: true });
mkdirSync(destino, { recursive: true });

const faltantes = [];
let copiados = 0;
for (const ruta of [...rutas, ...ADEMAS]) {
  // './' es la raiz del sitio, que se sirve con index.html: no es archivo.
  const relativa = ruta.replace(/^\.\//, '');
  if (relativa === '') continue;
  const origen = `${raiz}${relativa}`;
  if (!existsSync(origen) || !statSync(origen).isFile()) {
    faltantes.push(relativa);
    continue;
  }
  mkdirSync(dirname(`${destino}${relativa}`), { recursive: true });
  cpSync(origen, `${destino}${relativa}`);
  copiados += 1;
}

if (faltantes.length > 0) {
  console.error(`\n${faltantes.length} rutas listadas que NO existen:`);
  for (const f of faltantes) console.error(' -', f);
  console.error('\nCorre node tools/generar-precache.mjs y commitea el resultado.');
  process.exit(1);
}

console.log(`Sitio empaquetado en ${process.argv[2] ?? '_sitio'}/: ${copiados} archivos.`);
