// Arranque de la aplicacion: almacen, encabezado con selectores
// siempre visibles (tractor, equipo, unidades), navegacion inferior de
// tres secciones con subnavegacion por tabs, y enrutado por hash
// (#/seccion/tab) porque GitHub Pages no tiene rewrites de servidor.

import { crearAlmacen } from './storage.js';
import { el, limpiar } from './ui/dom.js';
import { crearTabs } from './ui/tabs.js';
import { mostrarAvisoPersistente, mostrarToast } from './ui/toast.js';
import { confirmar } from './ui/dialog.js';
import {
  armarUrlCompartir,
  compartirUrl,
  decodificarEstadoCompartido,
} from './ui/compartir.js';

import * as tabAvance from './ui/tabs/avance.js';
import * as tabGasto from './ui/tabs/gasto.js';
import * as tabBoquillas from './ui/tabs/boquillas.js';
import * as tabGas from './ui/tabs/gas.js';
import * as tabForzamiento from './ui/tabs/forzamiento.js';
import * as tabMezcla from './ui/tabs/mezcla.js';
import * as tabCaptura from './ui/tabs/captura.js';
import * as tabBitacora from './ui/tabs/bitacora.js';
import * as tabConfiguracion from './ui/tabs/configuracion.js';
import * as tabMetodologia from './ui/tabs/metodologia.js';

// Propuesta de navegacion aprobada: tres secciones de primer nivel con
// subnavegacion, porque diez tabs no caben en una barra de telefono.
export const SECCIONES = [
  {
    id: 'calibrar',
    etiqueta: 'Calibrar',
    tabs: [
      { id: 'avance', etiqueta: 'Avance', modulo: tabAvance },
      { id: 'gasto', etiqueta: 'Gasto de agua', modulo: tabGasto },
      { id: 'boquillas', etiqueta: 'Boquillas', modulo: tabBoquillas },
      { id: 'gas', etiqueta: 'Gas etileno', modulo: tabGas },
      { id: 'forzamiento', etiqueta: 'Forzamiento', modulo: tabForzamiento },
      { id: 'mezcla', etiqueta: 'Mezcla', modulo: tabMezcla },
    ],
  },
  {
    id: 'registrar',
    etiqueta: 'Registrar',
    tabs: [
      { id: 'captura', etiqueta: 'Prueba de captura', modulo: tabCaptura },
      { id: 'bitacora', etiqueta: 'Bitácora', modulo: tabBitacora },
    ],
  },
  {
    id: 'sistema',
    etiqueta: 'Sistema',
    tabs: [
      { id: 'configuracion', etiqueta: 'Configuración', modulo: tabConfiguracion },
      { id: 'metodologia', etiqueta: 'Metodología', modulo: tabMetodologia },
    ],
  },
];

const RUTA_DEFAULT = { seccion: 'calibrar', tab: 'avance' };

function leerHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [ruta, consulta = ''] = hash.split('?');
  const [seccionId, tabId] = ruta.split('/');
  const seccion = SECCIONES.find((s) => s.id === seccionId);
  if (!seccion) return { ...RUTA_DEFAULT, consulta };
  const tab = seccion.tabs.find((t) => t.id === tabId) ?? seccion.tabs[0];
  return { seccion: seccion.id, tab: tab.id, consulta };
}

function escribirHash(seccionId, tabId) {
  const nuevo = `#/${seccionId}/${tabId}`;
  if (location.hash !== nuevo) {
    location.hash = nuevo;
  }
}

// ---------------------------------------------------------------------
// Almacen y contexto compartido de las pestanas
// ---------------------------------------------------------------------
const franja = document.getElementById('franja-almacen');

const almacen = crearAlmacen({
  alFallarEscritura: () => {
    if (franja) franja.classList.remove('oculto');
    mostrarAvisoPersistente(
      'No se pudo guardar en este navegador (almacenamiento lleno o modo privado). ' +
        'La aplicación sigue funcionando en memoria: exporta tus datos antes de cerrar.'
    );
  },
});

if (!almacen.disponible && franja) {
  franja.classList.remove('oculto');
}
for (const error of almacen.erroresDeCarga) {
  mostrarToast(error, { tipo: 'destructivo', duracionMs: 8000 });
}

export const ctx = {
  almacen,
  estado: () => almacen.obtener(),
  sistema: () => almacen.obtener().preferencias.unidades,
  tractorActivo() {
    const estado = almacen.obtener();
    return estado.tractores.find((t) => t.id === estado.tractorActivoId) ?? estado.tractores[0];
  },
  equipoActivo() {
    const estado = almacen.obtener();
    return estado.equipos.find((e) => e.id === estado.equipoActivoId) ?? estado.equipos[0];
  },
  gasActivo() {
    const estado = almacen.obtener();
    return estado.gases.find((g) => g.id === estado.gasActivoId) ?? estado.gases[0];
  },
  rotametroActivo() {
    const estado = almacen.obtener();
    return (
      estado.rotametros.find((r) => r.id === estado.rotametroActivoId) ?? estado.rotametros[0]
    );
  },
  navegarA(seccionId, tabId) {
    escribirHash(seccionId, tabId);
  },
  // Autosave de capturas en curso: los navegadores moviles matan
  // pestanas sin avisar. Cada tab guarda su borrador con debounce.
  borrador(tabId) {
    return almacen.obtener().borradores?.[tabId] ?? {};
  },
  guardarBorrador(tabId, datos) {
    almacen.actualizar((estado) => {
      estado.borradores[tabId] = { ...(estado.borradores[tabId] ?? {}), ...datos };
    }, 'borrador');
  },
};

// ---------------------------------------------------------------------
// Tema
// ---------------------------------------------------------------------
function aplicarTema() {
  document.documentElement.dataset.theme = almacen.obtener().preferencias.tema;
}
aplicarTema();

// ---------------------------------------------------------------------
// Encabezado: selectores siempre visibles; cambiar recalcula en vivo
// ---------------------------------------------------------------------
const selectTractor = document.getElementById('selector-tractor');
const selectEquipo = document.getElementById('selector-equipo');
const selectUnidades = document.getElementById('selector-unidades');

function llenarSelectoresEncabezado() {
  const estado = almacen.obtener();
  limpiar(selectTractor);
  for (const tractor of estado.tractores) {
    selectTractor.append(el('option', { value: tractor.id }, tractor.nombre));
  }
  selectTractor.value = estado.tractorActivoId;

  limpiar(selectEquipo);
  for (const equipo of estado.equipos) {
    selectEquipo.append(el('option', { value: equipo.id }, equipo.nombre));
  }
  selectEquipo.value = estado.equipoActivoId;

  selectUnidades.value = estado.preferencias.unidades;
}

selectTractor.addEventListener('change', () => {
  almacen.actualizar((estado) => {
    estado.tractorActivoId = selectTractor.value;
  }, 'contexto');
});
selectEquipo.addEventListener('change', () => {
  almacen.actualizar((estado) => {
    estado.equipoActivoId = selectEquipo.value;
  }, 'contexto');
});
selectUnidades.addEventListener('change', () => {
  almacen.actualizar((estado) => {
    estado.preferencias.unidades = selectUnidades.value;
  }, 'contexto');
});

// ---------------------------------------------------------------------
// Navegacion inferior y subnavegacion
// ---------------------------------------------------------------------
const botonesSeccion = Array.from(document.querySelectorAll('.nav-inferior__boton'));
const zonaSubnav = document.getElementById('subnav');
const panel = document.getElementById('panel');

let rutaActual = leerHash();
let tabsActuales = null;
let seccionPintada = null;

function renderizar({ conservarPosicion = false } = {}) {
  const seccion = SECCIONES.find((s) => s.id === rutaActual.seccion);
  const tab = seccion.tabs.find((t) => t.id === rutaActual.tab);

  for (const boton of botonesSeccion) {
    const activo = boton.dataset.seccion === seccion.id;
    boton.setAttribute('aria-current', activo ? 'true' : 'false');
  }

  // La tablist se conserva VIVA mientras la seccion no cambie: asi la
  // navegacion por teclado (flechas) no pierde el foco al cambiar de
  // pestana, y el roving tabindex sigue funcionando.
  if (seccionPintada !== seccion.id || !tabsActuales) {
    limpiar(zonaSubnav);
    tabsActuales = crearTabs({
      id: `subnav-${seccion.id}`,
      tabs: seccion.tabs,
      activoId: tab.id,
      idPanel: 'panel',
      alCambiar: (tabId) => escribirHash(seccion.id, tabId),
    });
    zonaSubnav.append(tabsActuales.elemento);
    seccionPintada = seccion.id;
  } else {
    tabsActuales.activarPorId(tab.id);
  }

  const scrollPrevio = window.scrollY;
  const idEnfocado = conservarPosicion ? document.activeElement?.id : null;

  panel.setAttribute('aria-labelledby', `subnav-${seccion.id}-tab-${tab.id}`);
  limpiar(panel);
  try {
    tab.modulo.render(panel, ctx);
  } catch (error) {
    panel.append(
      el(
        'div',
        { clase: 'alerta alerta--destructiva', role: 'alert' },
        el('p', { clase: 'alerta__titulo' }, 'Esta pantalla no pudo pintarse'),
        el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
      )
    );
  }
  if (conservarPosicion) {
    // Re-render por cambio de contexto (tractor, equipo, unidades):
    // conserva el punto de lectura y, si se puede, el foco.
    window.scrollTo({ top: scrollPrevio });
    if (idEnfocado) document.getElementById(idEnfocado)?.focus();
  } else {
    window.scrollTo({ top: 0 });
  }
}

for (const boton of botonesSeccion) {
  boton.addEventListener('click', () => {
    const seccion = SECCIONES.find((s) => s.id === boton.dataset.seccion);
    escribirHash(seccion.id, seccion.tabs[0].id);
  });
}

window.addEventListener('hashchange', () => {
  rutaActual = leerHash();
  renderizar();
  if (rutaActual.consulta) {
    aplicarEstadoCompartido(rutaActual.consulta);
  }
});

// Cambios de contexto (tractor, equipo, unidades, tema) recalculan todo
// en vivo re-pintando la pestana activa. Los borradores no re-pintan.
almacen.suscribir(({ tipo }) => {
  if (tipo === 'contexto') {
    aplicarTema();
    llenarSelectoresEncabezado();
    renderizar({ conservarPosicion: true });
  }
});

// ---------------------------------------------------------------------
// Compartir por URL: el estado de la pantalla activa viaja en el hash
// ---------------------------------------------------------------------
const botonCompartir = document.getElementById('boton-compartir');
if (botonCompartir) {
  botonCompartir.addEventListener('click', async () => {
    const estado = almacen.obtener();
    const url = armarUrlCompartir({
      seccion: rutaActual.seccion,
      tab: rutaActual.tab,
      borrador: estado.borradores?.[rutaActual.tab] ?? {},
      contexto: {
        tractorActivoId: estado.tractorActivoId,
        equipoActivoId: estado.equipoActivoId,
        unidades: estado.preferencias.unidades,
      },
    });
    const resultado = await compartirUrl(url, 'Calibracion agricola MD2');
    if (resultado === 'copiado') {
      mostrarToast('Enlace copiado al portapapeles: pegalo en un mensaje.');
    } else if (resultado === 'sin-soporte') {
      mostrarToast(url, { duracionMs: 12000 });
    }
  });
}

async function aplicarEstadoCompartido(consulta) {
  const parametros = new URLSearchParams(consulta);
  const codigo = parametros.get('e');
  if (!codigo) return;
  const carga = decodificarEstadoCompartido(codigo);
  if (!carga) {
    mostrarToast('El enlace compartido no se pudo leer.', { tipo: 'destructivo' });
    escribirHash(rutaActual.seccion, rutaActual.tab);
    return;
  }
  const ok = await confirmar({
    titulo: 'Cargar calibración compartida',
    descripcion:
      'Este enlace trae los valores capturados de una pantalla y su contexto (tractor, equipo y unidades). Se cargan en la pantalla correspondiente; tu configuración guardada no se toca.',
    confirmarTexto: 'Cargar',
  });
  if (ok) {
    almacen.actualizar((estado) => {
      estado.borradores[carga.tab] = carga.borrador ?? {};
      const contexto = carga.contexto ?? {};
      if (contexto.tractorActivoId && estado.tractores.some((t) => t.id === contexto.tractorActivoId)) {
        estado.tractorActivoId = contexto.tractorActivoId;
      }
      if (contexto.equipoActivoId && estado.equipos.some((e) => e.id === contexto.equipoActivoId)) {
        estado.equipoActivoId = contexto.equipoActivoId;
      }
      if (contexto.unidades === 'metrico' || contexto.unidades === 'imperial') {
        estado.preferencias.unidades = contexto.unidades;
      }
    }, 'contexto');
  }
  // Limpia el parametro del hash conservando la ruta.
  history.replaceState(null, '', `#/${carga.seccion}/${carga.tab}`);
  rutaActual = leerHash();
  llenarSelectoresEncabezado();
  renderizar();
}

// ---------------------------------------------------------------------
// Service worker: sitio completo sin conexion tras la primera carga
// ---------------------------------------------------------------------
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((registro) => {
      // Si ya habia una version nueva esperando desde una visita
      // anterior, avisar de inmediato.
      if (registro.waiting && navigator.serviceWorker.controller) {
        const esperando = registro.waiting;
        mostrarToast('Hay una versión nueva de la aplicación.', {
          duracionMs: 0,
          accionTexto: 'Actualizar',
          alAccionar: () => esperando.postMessage('SALTAR_ESPERA'),
        });
      }
      registro.addEventListener('updatefound', () => {
        const nuevo = registro.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
            mostrarToast('Hay una versión nueva de la aplicación.', {
              duracionMs: 0,
              accionTexto: 'Actualizar',
              alAccionar: () => nuevo.postMessage('SALTAR_ESPERA'),
            });
          }
        });
      });
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando) return;
        recargando = true;
        location.reload();
      });
    })
    .catch(() => {
      // Sin service worker la aplicacion funciona igual; solo pierde el
      // uso sin conexion.
    });
}

// Arranque
llenarSelectoresEncabezado();
if (!location.hash) {
  escribirHash(RUTA_DEFAULT.seccion, RUTA_DEFAULT.tab);
}
rutaActual = leerHash();
renderizar();
if (rutaActual.consulta) {
  aplicarEstadoCompartido(rutaActual.consulta);
}
registrarServiceWorker();
