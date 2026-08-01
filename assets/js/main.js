// Arranque de la aplicacion: almacen, encabezado con selectores
// siempre visibles (tractor, equipo, unidades), navegacion inferior de
// tres secciones con subnavegacion por tabs, y enrutado por hash
// (#/seccion/tab) porque GitHub Pages no tiene rewrites de servidor.

import { crearAlmacen } from './storage.js';
import { presionAtmosfericaEfectiva } from './domain/atmosphere.js';
import { avance, velocidadDeAvance } from './domain/speed.js';
import { el, limpiar } from './ui/dom.js';
import { crearTabs } from './ui/tabs.js';
import { mostrarAvisoPersistente, mostrarToast } from './ui/toast.js';
import { confirmar } from './ui/dialog.js';
import { estadoReinstalacion, iniciarServiceWorker, versionInstalada } from './ui/actualizar.js';
import {
  armarUrlCompartir,
  compartirUrl,
  decodificarEstadoCompartido,
} from './ui/compartir.js';

import { crearTiraReceta } from './ui/receta.js';

import * as tabGuia from './ui/tabs/guia.js';
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
      // La guia va primera y es la ruta por defecto: es la unica
      // pantalla que dice por donde empezar y en que orden se encadenan
      // las demas. No captura nada, asi que entrar por aqui no cuesta un
      // paso a quien ya sabe a que pestana va.
      { id: 'guia', etiqueta: 'Guía', modulo: tabGuia },
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

const RUTA_DEFAULT = { seccion: 'calibrar', tab: 'guia' };

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
  // Argumentos de domain/speed.js::geometria, armados de DOS fuentes: la
  // tabla (largo y distancia de referencia, parametros del rancho) y la
  // BARRA activa (ancho, boquillas y espaciamiento, propios de cada
  // barra). Vive aqui y no repetido en cada pestana porque siete
  // pantallas lo pedian identico y bastaba olvidar una para que esa
  // calculara con la barra equivocada.
  parametrosGeometria() {
    const estado = almacen.obtener();
    const p = estado.parametros;
    const barra = estado.equipos.find((e) => e.id === estado.equipoActivoId) ?? estado.equipos[0];
    return {
      largoTabla: p.geometria.largoTabla,
      distanciaReferencia: p.geometria.distanciaReferencia,
      anchoBarra: barra?.anchoBarra ?? null,
      numBoquillas: barra?.numBoquillas ?? null,
      espaciamientoCapturado: barra?.espaciamientoCapturado ?? null,
      espaciamientoMinimoPlausible: p.umbrales.espaciamientoMinimoPlausible,
      umbralDiscrepanciaPct: p.umbrales.umbralDiscrepanciaMetodos,
    };
  },
  gasActivo() {
    const estado = almacen.obtener();
    return estado.gases.find((g) => g.id === estado.gasActivoId) ?? estado.gases[0];
  },
  // Presion atmosferica local EFECTIVA del sitio, con su desglose y su
  // verificacion: derivada de la altitud, salvo que haya una anulacion
  // manual capturada. Vive aqui —y no repetida en cada pantalla— porque
  // cuatro pestanas la piden identica y bastaba olvidar una para que esa
  // siguiera leyendo el campo crudo y calculara con la presion
  // equivocada.
  atmosferaSitio() {
    return presionAtmosfericaEfectiva({ sitio: almacen.obtener().parametros.sitio });
  },
  presionAtmosfericaLocal() {
    return presionAtmosfericaEfectiva({ sitio: almacen.obtener().parametros.sitio }).valores
      .presionPsia;
  },
  rotametroActivo() {
    const estado = almacen.obtener();
    return (
      estado.rotametros.find((r) => r.id === estado.rotametroActivoId) ?? estado.rotametros[0]
    );
  },
  // Velocidad de trabajo que Avance tiene capturada AHORA MISMO, con su
  // origen. Vive aqui —y no repetida en cada pantalla— por el mismo
  // motivo que la geometria y la presion del sitio: cinco pantallas la
  // pedian, cada una la reconstruia a su manera y cuatro de esas cinco
  // copias ignoraban el modo elegido en Avance. Ninguna volvia a
  // coincidir con la otra en cuanto se cambiaba de modo.
  //
  // Nunca lanza: una configuracion invalida se trata igual que la falta
  // de datos, porque esto es una precarga y no puede tumbar la pantalla
  // que la usa.
  velocidadDeAvance() {
    try {
      const estado = almacen.obtener();
      const tractor = this.tractorActivo();
      return velocidadDeAvance({
        captura: this.borrador('avance'),
        tractor,
        mediciones: (estado.factoresDesviacion ?? [])
          .filter((m) => m.tractorId === tractor?.id)
          .map((m) => ({ rpm: m.rpm, factor: m.factor })),
        distanciaReferencia: estado.parametros.geometria.distanciaReferencia,
        umbralDesviacionPct: estado.parametros.umbrales.umbralDesviacionVelocidad,
        // El regimen que Avance PRECARGA en su campo: la pantalla ya
        // calcula con el sin que nadie lo teclee.
        rpmRespaldo: tractor?.regimenHabitual ?? null,
      });
    } catch {
      return { velocidadKmh: null, origen: null, etiqueta: null, marcha: null, avisos: [] };
    }
  },
  // Recorrido completo de una tabla con la velocidad de Avance: segundos
  // por tramo, tramos y tiempo total, con su desglose auditable. Es lo
  // que piden Gas etileno y Forzamiento como tiempo de inyeccion.
  // Devuelve `avance` en null cuando Avance no tiene con que calcular.
  avanceDeAvance() {
    const velocidad = this.velocidadDeAvance();
    if (!Number.isFinite(velocidad.velocidadKmh)) return { velocidad, avance: null };
    try {
      const g = almacen.obtener().parametros.geometria;
      return {
        velocidad,
        avance: avance({
          velocidadKmh: velocidad.velocidadKmh,
          distanciaReferencia: g.distanciaReferencia,
          largoTabla: g.largoTabla,
        }),
      };
    } catch {
      return { velocidad, avance: null };
    }
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
  // Resultados compartidos entre pantallas: lo que UNA pestana calculo y
  // OTRA necesita como entrada. Van aparte de los borradores porque no
  // son capturas de una pantalla, sino el numero que esa pantalla
  // produjo, con su procedencia y su fecha.
  //
  // El caso que obligo a esto es el volumen de aplicacion: Mezcla pedia a
  // mano el L/ha que Gasto de agua y Prueba de captura ya habian
  // calculado —y su propia ayuda decia que habia que traerlo de ahi—,
  // sobre un dato del que depende la dosis de producto en el tanque.
  //
  //   { valor, fecha, origen: <id de la pestana>, detalle: <texto corto> }
  resultado(clave) {
    return almacen.obtener().resultados?.[clave] ?? null;
  },
  // El volumen de aplicacion REAL vigente, con su procedencia. El aforo
  // manda sobre el calculo teorico —es regla del proyecto: lo medido en
  // campo tiene prioridad declarada— pero cual de los dos se esta usando
  // se dice siempre, con su fecha. Un aforo de hace un mes puede no ser
  // el de la barra de hoy, y esa decision es de quien calibra, no de la
  // aplicacion: por eso el campo que lo hereda deja capturar a mano.
  volumenAplicacionReal() {
    return this.resultado('lhaMedido') ?? this.resultado('lhaCalculado') ?? null;
  },
  // El volumen objetivo de la jornada: lo ultimo capturado en cualquiera
  // de las tres pantallas que lo piden y, si no hay, el objetivo propio
  // del rancho. Nunca la referencia de la literatura: ese numero se
  // muestra como cota de sanidad, no se usa para calcular.
  objetivoVolumenLha() {
    const compartido = this.resultado('lhaObjetivo');
    if (Number.isFinite(compartido?.valor)) return compartido.valor;
    return almacen.obtener().parametros.agronomicos.volumenAguaObjetivo ?? null;
  },
  guardarResultado(clave, datos) {
    if (!Number.isFinite(datos?.valor)) return;
    const vigente = this.resultado(clave);
    // Sin cambio no se reescribe: `recalcular()` corre en cada tecla y
    // esto persiste; reescribir la fecha en cada pulsacion haria que
    // "medido hace un momento" no significara nada.
    if (vigente && vigente.valor === datos.valor && vigente.origen === datos.origen) return;
    almacen.actualizar((estado) => {
      if (!estado.resultados) estado.resultados = {};
      estado.resultados[clave] = { fecha: new Date().toISOString(), ...datos };
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
//
// Solo van aqui los dos que cambian VARIAS veces en una jornada: el
// tractor y la barra. El sistema de unidades se elige una vez y vive en
// Configuración; en el encabezado solo robaba ancho a los dos selectores
// que si se usan.
// ---------------------------------------------------------------------
const selectTractor = document.getElementById('selector-tractor');
const selectEquipo = document.getElementById('selector-equipo');

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
  // El acento de color identifica al MODULO (la seccion), no a la
  // pantalla: `components.css` lee este dato para teñir la banda de
  // las tarjetas, la pestaña activa y el bloque de resultado. Va en
  // <html> —como el tema— porque la subnavegacion vive en el
  // encabezado y los dialogos cuelgan de <body>, fuera del panel. Las
  // diez pestañas NO tienen color propio a proposito.
  document.documentElement.dataset.seccion = seccion.id;
  limpiar(panel);
  try {
    // Tira de avance de la guia. Se pinta desde aqui —y no dentro de
    // cada pestana— porque las diez pantallas no saben nada de las
    // recetas y no tienen por que saberlo: la guia las ordena, no las
    // modifica. Solo aparece si hay receta activa y esta pantalla es uno
    // de sus pasos.
    const tira = crearTiraReceta(ctx, { seccion: seccion.id, tab: tab.id });
    if (tira) panel.append(tira);
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
      'Este enlace trae los valores capturados de una pantalla y su contexto (tractor, barra y unidades). Se cargan en la pantalla correspondiente; tu configuración guardada no se toca.',
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
// Service worker: sitio completo sin conexion tras la primera carga. El
// registro, el aviso de version nueva y la actualizacion a mano viven en
// ui/actualizar.js.
iniciarServiceWorker();

// Acuse de "Reinstalar desde cero". Sin esto, la reinstalacion es
// invisible: la pantalla vuelve identica y el usuario cree que el boton
// no hizo nada. El estado se lee DESPUES de iniciar el service worker,
// que es quien lo hace avanzar.
const reinstalacion = estadoReinstalacion();
if (reinstalacion === 'pendiente') {
  mostrarToast('Reinstalando la aplicación: se recarga sola al terminar. No la cierres.', {
    duracionMs: 25000,
  });
} else if (reinstalacion === 'terminada') {
  mostrarToast(`Aplicación reinstalada. Versión instalada: ${versionInstalada() ?? 'desconocida'}.`, {
    duracionMs: 9000,
  });
}
