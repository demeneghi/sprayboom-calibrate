// Actualizar la aplicacion a mano.
//
// Instalada en la pantalla de inicio de un iPhone, esta aplicacion corre
// sin barra de direcciones: no hay boton de recargar, ni "recarga
// forzada", ni forma de borrar la cache del sitio desde ahi. Si el
// service worker no alcanza a ver la version nueva, el telefono se queda
// con la vieja y quien calibra en el lote no tiene salida. Este modulo es
// esa salida: registra el service worker, avisa cuando hay version nueva,
// la busca a peticion del usuario y, como ultimo recurso, borra la cache
// y reinstala.
//
// Los datos (configuracion, bitacora, pruebas) NO viven en la cache sino
// en localStorage: nada de lo que hace este modulo los toca.

import { mostrarToast } from './toast.js';

// Cuanto se espera a que termine de instalarse una version nueva antes
// de decirle al usuario que siga esperando. En datos moviles flojos el
// precache completo tarda.
const LIMITE_INSTALACION_MS = 30000;

// Cuanto se espera, tras una reinstalacion, a que el trabajador nuevo
// tome el control y dispare la segunda recarga. Mas largo que el
// anterior porque aqui se baja el sitio COMPLETO, no una diferencia.
const LIMITE_REINSTALACION_MS = 45000;

// Marca de una reinstalacion en curso. Vive en sessionStorage porque
// tiene que sobrevivir a la recarga (es un proceso de dos recargas) y
// morir al cerrar la aplicacion: si algo se tuerce, abrirla de nuevo la
// limpia. No toca los datos del usuario, que viven en localStorage.
const MARCA_REINSTALACION = 'sprayboom:reinstalacion';

function leerMarca() {
  try {
    return sessionStorage.getItem(MARCA_REINSTALACION);
  } catch {
    return null;
  }
}

function escribirMarca(valor) {
  try {
    if (valor === null) sessionStorage.removeItem(MARCA_REINSTALACION);
    else sessionStorage.setItem(MARCA_REINSTALACION, valor);
  } catch {
    // Sin sessionStorage (modo privado viejo) la reinstalacion se hace
    // igual; solo se queda sin la segunda recarga y sin el aviso.
  }
}

let registro = null;
// Una sola recarga: el cambio de controlador y la red de seguridad
// pueden dispararse casi a la vez.
let recargando = false;
// Mientras el usuario busca a mano, el aviso automatico se calla: el
// boton ya lleva el hilo de la conversacion.
let buscandoAMano = false;

function recargarUnaVez() {
  if (recargando) return;
  recargando = true;
  location.reload();
}

// Version del paquete que este navegador tiene cargado. La estampa
// version.js, que index.html carga como script clasico y el service
// worker precachea: si la pagina viene de la cache vieja, aqui se ve la
// version vieja, que es justo lo que hay que mostrar.
export function versionInstalada() {
  const version = self.SPRAYBOOM_VERSION;
  return typeof version === 'string' && version !== '' ? version : null;
}

// Sin controlador, el que "espera" es la PRIMERA instalacion, no una
// version nueva: no hay nada que actualizar.
function trabajadorEsperando() {
  if (!navigator.serviceWorker.controller) return null;
  return registro?.waiting ?? null;
}

function aplicar(trabajador) {
  trabajador.postMessage('SALTAR_ESPERA');
  // Red de seguridad: si 'controllerchange' no llega —pasa en algunas
  // versiones de iOS— se recarga de todos modos. Si el trabajador nuevo
  // ya tomo el control, la recarga trae la version nueva; si no, la
  // recarga es inofensiva.
  setTimeout(recargarUnaVez, 3000);
}

function avisarVersionNueva(trabajador) {
  if (buscandoAMano) return;
  mostrarToast('Hay una versión nueva de la aplicación.', {
    duracionMs: 0,
    accionTexto: 'Actualizar',
    alAccionar: () => aplicar(trabajador),
  });
}

// Espera a que el trabajador que se esta instalando llegue a 'installed'.
// Devuelve el estado en palabras, no el objeto crudo.
function esperarInstalacion() {
  return new Promise((resolver) => {
    const listo = trabajadorEsperando();
    if (listo) {
      resolver({ estado: 'lista', trabajador: listo });
      return;
    }
    const nuevo = registro.installing;
    if (!nuevo) {
      resolver({ estado: 'al-dia' });
      return;
    }
    let terminado = false;
    const terminar = (resultado) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(reloj);
      nuevo.removeEventListener('statechange', alCambiar);
      resolver(resultado);
    };
    const alCambiar = () => {
      if (nuevo.state === 'installed') {
        terminar(
          navigator.serviceWorker.controller
            ? { estado: 'lista', trabajador: nuevo }
            : { estado: 'al-dia' }
        );
      } else if (nuevo.state === 'redundant') {
        terminar({ estado: 'error' });
      }
    };
    const reloj = setTimeout(() => terminar({ estado: 'descargando' }), LIMITE_INSTALACION_MS);
    nuevo.addEventListener('statechange', alCambiar);
  });
}

// Pregunta al servidor si hay version nueva. Devuelve el estado y, si la
// hay, la funcion que la aplica (tras aplicarla la pagina se recarga
// sola, asi que no hay nada que hacer despues).
export async function buscarActualizacion() {
  // Por http:// el navegador ni siquiera expone el service worker. No es
  // que al telefono le falte soporte: es que el sitio se abrio por una
  // direccion insegura, y ahi la aplicacion no se instala ni guarda nada
  // para el lote. Se distingue de 'sin-soporte' porque el remedio es
  // otro: abrirlo por https://. La comparacion es con `=== false` para
  // no confundir con un navegador viejo que no conoce esta propiedad.
  if (self.isSecureContext === false) return { estado: 'sin-https' };
  if (!('serviceWorker' in navigator)) return { estado: 'sin-soporte' };
  if (!registro) {
    registro = (await navigator.serviceWorker.getRegistration()) ?? null;
  }
  if (!registro) return { estado: 'sin-soporte' };

  // Version nueva que quedo esperando de una visita anterior: no hace
  // falta molestar al servidor.
  const yaEsperaba = trabajadorEsperando();
  if (yaEsperaba) return { estado: 'lista', aplicar: () => aplicar(yaEsperaba) };

  if (navigator.onLine === false) return { estado: 'sin-conexion' };

  buscandoAMano = true;
  try {
    await registro.update();
  } catch {
    buscandoAMano = false;
    return { estado: 'sin-conexion' };
  }
  const resultado = await esperarInstalacion();
  buscandoAMano = false;
  if (resultado.estado === 'lista') {
    const { trabajador } = resultado;
    return { estado: 'lista', aplicar: () => aplicar(trabajador) };
  }
  return { estado: resultado.estado };
}

// Ultimo recurso: quita el service worker, borra TODA la cache del sitio
// y recarga. Es el equivalente a "borrar los datos del sitio" que iOS no
// ofrece dentro de una aplicacion instalada. Requiere conexion: despues
// de esto no queda nada guardado con que arrancar.
//
// Son DOS recargas, y hacen falta las dos:
//
//   1. La de aqui. Llega sin service worker, asi que el navegador sirve
//      index.html y version.js desde su PROPIA cache HTTP —el CDN de
//      Pages la sostiene ~10 minutos—: la pantalla seguiria mostrando la
//      version vieja. Lo que si sale a la red es sw.js con sus
//      importScripts (por `updateViaCache: 'none'`), asi que el service
//      worker nuevo se instala con la version buena y precachea de la
//      red (`cache: 'reload'` en sw.js).
//   2. La que dispara `controllerchange` cuando ese trabajador nuevo
//      toma el control. Ahi la pagina ya se sirve del precache recien
//      bajado, y es la que hace que el usuario VEA la version nueva.
//
// Sin la segunda, el boton borraba y volvia a escribir lo mismo: no
// hacia nada visible, que es justo lo contrario de un ultimo recurso.
export async function reinstalar() {
  // Borrar es irreversible y deja al telefono SIN aplicacion hasta que
  // termine de bajar. Sin conexion no se toca nada: en el lote, la copia
  // guardada es lo unico con lo que la aplicacion abre.
  if (navigator.onLine === false) return { estado: 'sin-conexion' };

  const conServiceWorker = 'serviceWorker' in navigator;
  // Sin service worker no hay segunda recarga que esperar: la
  // reinstalacion termina en la primera.
  escribirMarca(conServiceWorker ? 'pendiente' : 'terminada');
  try {
    if (conServiceWorker) {
      const registros = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registros.map((uno) => uno.unregister()));
      registro = null;
    }
    if ('caches' in self) {
      const nombres = await caches.keys();
      await Promise.all(nombres.map((nombre) => caches.delete(nombre)));
    }
  } catch (error) {
    escribirMarca(null);
    throw error;
  }
  recargarUnaVez();
  return { estado: 'reinstalando' };
}

// En que punto de una reinstalacion arranco esta carga:
//   'pendiente' — falta la segunda recarga; hay que avisar que espere.
//   'terminada' — ya esta; se avisa y la marca se borra (se consume).
//   null        — arranque normal.
export function estadoReinstalacion() {
  const marca = leerMarca();
  if (marca === 'terminada') escribirMarca(null);
  return marca === 'pendiente' || marca === 'terminada' ? marca : null;
}

// Registro del service worker: sitio completo sin conexion tras la
// primera carga.
export function iniciarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Red de seguridad de la reinstalacion: si el trabajador nuevo nunca
  // llega a tomar el control —registro fallido, instalacion cortada—,
  // la marca se borra en silencio. La aplicacion ya funciona (con la
  // version que haya); lo que se evita es que cada recarga posterior
  // vuelva a anunciar una reinstalacion que ya no esta en curso.
  if (leerMarca() === 'pendiente') {
    setTimeout(() => {
      if (leerMarca() === 'pendiente') escribirMarca(null);
    }, LIMITE_REINSTALACION_MS);
  }
  // updateViaCache: 'none' obliga a pedir sw.js Y version.js a la red en
  // cada revision. Con el default ('imports'), version.js saldria de la
  // cache HTTP —el CDN de Pages la sostiene ~10 minutos— y "Buscar
  // actualización" contestaria "ya estás al día" leyendo la version
  // vieja.
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((nuevoRegistro) => {
      registro = nuevoRegistro;
      // Si ya habia una version nueva esperando desde una visita
      // anterior, avisar de inmediato.
      if (registro.waiting && navigator.serviceWorker.controller) {
        avisarVersionNueva(registro.waiting);
      }
      registro.addEventListener('updatefound', () => {
        const nuevo = registro.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            avisarVersionNueva(nuevo);
          }
        });
      });
      // La primera toma de control (clients.claim en la primera visita)
      // no debe recargar: la página ya está servida completa y el
      // usuario puede estar a media captura. Solo se recarga cuando ya
      // había un controlador, es decir, en un cambio real de versión.
      //
      // La excepción es venir de "Reinstalar desde cero": esta carga
      // salió de la caché HTTP del navegador y muestra la versión vieja,
      // así que la primera toma de control SÍ tiene que recargar. Ver
      // `reinstalar()`.
      let teniaControlador = Boolean(navigator.serviceWorker.controller);
      const alTomarControl = () => {
        if (leerMarca() !== 'pendiente') return;
        escribirMarca('terminada');
        recargarUnaVez();
      };
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!teniaControlador) {
          teniaControlador = true;
          alTomarControl();
          return;
        }
        recargarUnaVez();
      });
      // Si el trabajador nuevo reclamó la página antes de que este
      // listener existiera, el evento ya pasó y nadie recargaría.
      if (teniaControlador) alTomarControl();
    })
    .catch(() => {
      // Sin service worker la aplicacion funciona igual; solo pierde el
      // uso sin conexion.
    });
}
