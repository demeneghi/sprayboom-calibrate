// Service worker: precache versionado del sitio completo para que la
// aplicacion funcione SIN CONEXION tras la primera carga (uso en campo
// con conectividad intermitente). GitHub Pages no permite cabeceras
// propias y su CDN cachea ~10 minutos: la invalidacion correcta la da
// la version explicita de version.js.
//
// Estrategia: cache primero con revalidacion en segundo plano
// (stale-while-revalidate) para recursos del mismo origen. Nunca se
// piden recursos externos: todo es autohospedado.

// La lista de precache vive en su propio archivo generado: separada de
// esta logica puede llevar merge=union y deja de producir conflictos
// cuando dos ramas agregan archivos distintos.
importScripts('./version.js', './precache.js');

const NOMBRE_CACHE = `sprayboom-${self.SPRAYBOOM_VERSION}`;

const PRECACHE = self.SPRAYBOOM_PRECACHE;

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
