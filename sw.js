// Service worker: precache versionado del sitio completo para que la
// aplicacion funcione SIN CONEXION tras la primera carga (uso en campo
// con conectividad intermitente). GitHub Pages no permite cabeceras
// propias y su CDN cachea ~10 minutos: la invalidacion correcta la da
// la version explicita de version.js.
//
// Estrategia: cache primero con revalidacion en segundo plano
// (stale-while-revalidate) para recursos del mismo origen. Nunca se
// piden recursos externos: todo es autohospedado.

importScripts('./version.js');

const NOMBRE_CACHE = `sprayboom-${self.SPRAYBOOM_VERSION}`;

// Lista generada con: node tools/generar-precache.mjs
// (reescribe este bloque entre los marcadores).
const PRECACHE = [
  // <precache>
  './',
  './404.html',
  './componentes.html',
  './index.html',
  './manifest.webmanifest',
  './version.js',
  './assets/css/base.css',
  './assets/css/components.css',
  './assets/css/tokens.css',
  './assets/fonts/OFL.txt',
  './assets/fonts/ibm-plex-mono-latin-400.woff2',
  './assets/fonts/ibm-plex-mono-latin-600.woff2',
  './assets/fonts/inter-latin-variable.woff2',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon.svg',
  './assets/js/data/droplet-classes.js',
  './assets/js/data/iso-colors.js',
  './assets/js/data/nozzle-catalog.js',
  './assets/js/domain/capture.js',
  './assets/js/domain/constants.js',
  './assets/js/domain/defaults.js',
  './assets/js/domain/flowmeter.js',
  './assets/js/domain/forcing.js',
  './assets/js/domain/gas.js',
  './assets/js/domain/index.js',
  './assets/js/domain/mix.js',
  './assets/js/domain/nozzles.js',
  './assets/js/domain/pump.js',
  './assets/js/domain/speed.js',
  './assets/js/domain/units.js',
  './assets/js/domain/validate.js',
  './assets/js/domain/verify.js',
  './assets/js/domain/water.js',
  './assets/js/main.js',
  './assets/js/storage.js',
  './assets/js/ui/campos.js',
  './assets/js/ui/color.js',
  './assets/js/ui/combobox.js',
  './assets/js/ui/compartir.js',
  './assets/js/ui/cronometro.js',
  './assets/js/ui/dialog.js',
  './assets/js/ui/dom.js',
  './assets/js/ui/formato.js',
  './assets/js/ui/render.js',
  './assets/js/ui/tabs.js',
  './assets/js/ui/tabs/avance.js',
  './assets/js/ui/tabs/bitacora.js',
  './assets/js/ui/tabs/boquillas.js',
  './assets/js/ui/tabs/captura.js',
  './assets/js/ui/tabs/configuracion.js',
  './assets/js/ui/tabs/forzamiento.js',
  './assets/js/ui/tabs/gas.js',
  './assets/js/ui/tabs/gasto.js',
  './assets/js/ui/tabs/metodologia.js',
  './assets/js/ui/tabs/mezcla.js',
  './assets/js/ui/toast.js',
  './assets/js/ui/velocidad.js',
  // </precache>
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith('sprayboom-') && nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'SALTAR_ESPERA') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  // Navegaciones: servir la pagina cacheada que corresponde a la RUTA
  // pedida. El shell ('./index.html') solo se usa (y solo se
  // revalida) para la raiz del sitio; otras paginas precacheadas
  // (componentes.html, 404.html) responden y revalidan bajo SU clave,
  // nunca bajo la del shell.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        const cache = await caches.open(NOMBRE_CACHE);
        const esShell = url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
        const clave = esShell ? './index.html' : peticion;
        const cacheado = await cache.match(clave);
        const revalidar = fetch(peticion)
          .then((respuesta) => {
            if (respuesta.ok) cache.put(clave, respuesta.clone());
            return respuesta;
          })
          .catch(() => null);
        if (cacheado) {
          evento.waitUntil(revalidar);
          return cacheado;
        }
        const red = await revalidar;
        if (red) return red;
        // Sin conexion y ruta desconocida: cae al shell (la app enruta
        // por hash), que si esta precacheado.
        const shell = await cache.match('./index.html');
        if (shell) return shell;
        return new Response('Sin conexion.', {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      })()
    );
    return;
  }

  // Recursos: cache primero, revalidando en segundo plano.
  evento.respondWith(
    (async () => {
      const cache = await caches.open(NOMBRE_CACHE);
      const cacheado = await cache.match(peticion);
      const red = fetch(peticion)
        .then((respuesta) => {
          if (respuesta.ok) cache.put(peticion, respuesta.clone());
          return respuesta;
        })
        .catch(() => null);
      if (cacheado) {
        evento.waitUntil(red);
        return cacheado;
      }
      const respuesta = await red;
      if (respuesta) return respuesta;
      return new Response('Sin conexion y sin cache para este recurso.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    })()
  );
});
