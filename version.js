// Version de la cache del service worker. SUBE este numero en cada
// despliegue que cambie archivos: el SW instala la nueva cache, borra
// las viejas en activate y la aplicacion avisa "nueva version
// disponible". GitHub Pages cachea ~10 minutos en CDN; esta version
// explicita es lo que garantiza la invalidacion correcta en el
// telefono.
//
// Script clasico a proposito (sin export): lo consume sw.js via
// importScripts.
self.SPRAYBOOM_VERSION = '2026-07-31.5';
