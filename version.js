// Version de la cache del service worker: la ESTAMPA el despliegue.
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
self.SPRAYBOOM_VERSION = 'dev';
