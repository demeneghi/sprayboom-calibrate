// Herramienta de DESPLIEGUE: escribe version.js con la version real que
// se publica. La corre pages.yml justo antes de empaquetar el sitio.
//
// Por que la version no se edita a mano:
//
// La compuerta anterior exigia que TODO pull request que tocara
// archivos del sitio subiera esa unica linea. Dos ramas en paralelo
// chocaban ahi siempre —era el conflicto de git mas frecuente del
// repositorio— y la garantia dependia de que nadie se saltara la
// compuerta. Estampandola en el despliegue, cada publicacion recibe una
// version distinta POR CONSTRUCCION: es una garantia mas fuerte, no mas
// debil.
//
// Que ve el navegador de un telefono en campo: el service worker
// revalida los archivos que trae por importScripts, asi que cambiar
// SOLO version.js —con sw.js byte a byte identico— basta para que
// detecte el service worker nuevo, lo instale y cree la cache nueva.
// Esta comprobado en Chromium real, no supuesto.
//
// En el repositorio version.js queda con la marca de desarrollo. Eso es
// lo que ven las herramientas que sirven el sitio desde el disco
// (humo.mjs, interaccion.mjs) y quien lo abra en local: la cache se
// llama sprayboom-dev y se comporta igual.
//
// Ojo con los DOS consumidores: sw.js lo trae por importScripts, e
// index.html lo carga como script clasico para que la pantalla de
// Configuracion muestre "Version instalada". En local esa pantalla dice
// 'dev', que es lo correcto: ese navegador no tiene un paquete
// publicado. El texto se muestra tal cual, sin interpretar el formato.
//
// Uso: node tools/sellar-version.mjs <sello>
import { writeFileSync } from 'node:fs';

const sello = process.argv[2];
if (!sello || !/^[A-Za-z0-9._-]+$/.test(sello)) {
  console.error('Uso: node tools/sellar-version.mjs <sello>');
  console.error('El sello solo admite letras, digitos, punto, guion y guion bajo.');
  process.exit(1);
}

const raiz = new URL('..', import.meta.url).pathname;
const contenido = `// Version de la cache del service worker: la ESTAMPA el despliegue.
//
// No se edita a mano y no hace falta subirla en un pull request: lo hace
// tools/sellar-version.mjs desde pages.yml, con la fecha y el commit que
// se publica. Asi cada despliegue invalida la cache por construccion y
// dos ramas dejan de chocar en esta linea.
//
// El valor commiteado es la marca de desarrollo: es la que ven las
// herramientas que sirven el sitio desde el disco.
//
// Script clasico a proposito (sin export): lo consume sw.js via
// importScripts.
self.SPRAYBOOM_VERSION = '${sello}';
`;

writeFileSync(`${raiz}version.js`, contenido);
console.log(`version.js sellado como '${sello}'.`);
