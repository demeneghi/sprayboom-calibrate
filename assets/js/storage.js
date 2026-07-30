// Persistencia local: localStorage con espacio de nombres propio y
// version de esquema, siembra de defaults, exportacion e importacion
// validada, y CSV con BOM para Excel en espanol.
//
// No hay servidor: LOS DATOS VIVEN EN ESTE NAVEGADOR Y EN ESTE
// DISPOSITIVO. La exportacion es el unico respaldo. La interfaz declara
// esta limitacion de forma visible.
//
// Toda escritura va en try/catch: localStorage puede fallar por cuota
// llena o modo privado; si falla, la aplicacion sigue en memoria y lo
// avisa, sin romperse. El backend es inyectable para poder probar en
// Node sin DOM.

import {
  PARAMETROS,
  TRACTORES_SIEMBRA,
  EQUIPOS_SIEMBRA,
  GASES_SIEMBRA,
  ROTAMETROS_SIEMBRA,
  PREFERENCIAS_SIEMBRA,
  COTAS_TRACTOR,
  COTAS_VELOCIDAD_MARCHA,
  COTAS_EQUIPO,
  COTAS_GAS,
  COTAS_ROTAMETRO,
  ORIGENES_VELOCIDAD,
  TIPOS_BOMBA,
  ACCIONAMIENTOS,
} from './domain/defaults.js';
import { CATALOGO_SIEMBRA } from './data/nozzle-catalog.js';
import { validarValor } from './domain/validate.js';

export const CLAVE_ALMACEN = 'sprayboom.v1';
export const VERSION_ESQUEMA = 1;

const clonar = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------------
// Siembra
// ---------------------------------------------------------------------
export function sembrarEstado() {
  const parametros = {};
  for (const [grupo, def] of Object.entries(PARAMETROS)) {
    parametros[grupo] = {};
    for (const [campo, defCampo] of Object.entries(def.campos)) {
      parametros[grupo][campo] = defCampo.valor;
    }
  }
  return {
    version: VERSION_ESQUEMA,
    preferencias: clonar(PREFERENCIAS_SIEMBRA),
    parametros,
    tractores: clonar(TRACTORES_SIEMBRA),
    tractorActivoId: TRACTORES_SIEMBRA[0].id,
    equipos: clonar(EQUIPOS_SIEMBRA),
    equipoActivoId: EQUIPOS_SIEMBRA[0].id,
    gases: clonar(GASES_SIEMBRA),
    gasActivoId: GASES_SIEMBRA[0].id,
    rotametros: clonar(ROTAMETROS_SIEMBRA),
    rotametroActivoId: ROTAMETROS_SIEMBRA[0].id,
    catalogo: clonar(CATALOGO_SIEMBRA),
    factoresDesviacion: [],
    bitacora: [],
    pruebasCaptura: [],
    borradores: {},
  };
}

// ---------------------------------------------------------------------
// Almacen con pub/sub y autosave
// ---------------------------------------------------------------------
export function crearAlmacen({ backend = null, alFallarEscritura = null } = {}) {
  let disponible = false;
  let almacenamiento = backend;
  if (!almacenamiento) {
    try {
      almacenamiento = globalThis.localStorage ?? null;
    } catch {
      almacenamiento = null;
    }
  }

  let estado = null;
  const errores = [];
  if (almacenamiento) {
    try {
      const crudo = almacenamiento.getItem(CLAVE_ALMACEN);
      if (crudo) {
        const cargado = JSON.parse(crudo);
        if (cargado && cargado.version === VERSION_ESQUEMA) {
          // Fusion superficial con la siembra: campos nuevos del esquema
          // aparecen con su default sin perder lo guardado.
          estado = { ...sembrarEstado(), ...cargado };
        } else {
          errores.push(
            `Versión de esquema desconocida (${cargado?.version}); se siembran defaults sin tocar lo guardado previo.`
          );
        }
      }
      disponible = true;
    } catch (error) {
      errores.push(`No se pudo leer el almacenamiento: ${error.message}`);
      disponible = true; // leer fallo, pero puede que escribir funcione
    }
  }
  if (!estado) estado = sembrarEstado();

  const suscriptores = new Set();
  let temporizador = null;
  let escrituraFallida = false;

  function persistir() {
    if (!almacenamiento) return false;
    try {
      almacenamiento.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
      escrituraFallida = false;
      return true;
    } catch (error) {
      if (!escrituraFallida && alFallarEscritura) {
        alFallarEscritura(error);
      }
      escrituraFallida = true;
      return false;
    }
  }

  function persistirConRetraso() {
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      temporizador = null;
      persistir();
    }, 250);
  }

  if (!disponible && alFallarEscritura) {
    alFallarEscritura(new Error('localStorage no disponible'));
  }

  // Primer arranque: siembra persistida de inmediato.
  persistir();

  return {
    get disponible() {
      return disponible && !escrituraFallida;
    },
    erroresDeCarga: errores,
    obtener() {
      return estado;
    },
    // mutador recibe el estado y lo modifica en sitio.
    // tipo: 'contexto' (tractor/equipo/unidades/tema: re-renderiza),
    //       'datos' (colecciones editadas), 'borrador' (autosave silencioso)
    actualizar(mutador, tipo = 'datos') {
      mutador(estado);
      if (tipo === 'borrador') {
        persistirConRetraso();
      } else {
        persistir();
      }
      for (const s of suscriptores) s({ tipo, estado });
    },
    reemplazarEstado(nuevo, tipo = 'datos') {
      estado = nuevo;
      persistir();
      for (const s of suscriptores) s({ tipo, estado });
    },
    suscribir(fn) {
      suscriptores.add(fn);
      return () => suscriptores.delete(fn);
    },
    persistirAhora: persistir,
  };
}

// ---------------------------------------------------------------------
// Exportacion
// ---------------------------------------------------------------------
export function exportarJSON(estado) {
  return JSON.stringify(
    { tipo: 'sprayboom-configuracion', version: VERSION_ESQUEMA, exportado: estado },
    null,
    2
  );
}

export function exportarCatalogoJSON(estado) {
  return JSON.stringify(
    { tipo: 'sprayboom-catalogo', version: VERSION_ESQUEMA, catalogo: estado.catalogo },
    null,
    2
  );
}

// ---------------------------------------------------------------------
// Importacion validada
//
// La validacion usa validarValor (la MISMA funcion de los formularios),
// asi el mensaje de un valor fuera de cotas es identico en ambos
// caminos. Los campos invalidos se RECHAZAN individualmente (se reporta
// que y por que, y se conserva el valor vigente); un JSON corrupto o de
// version desconocida se rechaza completo sin dejar el estado a medias.
// ---------------------------------------------------------------------

function validarParametros(parametrosImportados, parametrosActuales, rechazos) {
  const resultado = clonar(parametrosActuales);
  for (const [grupo, defGrupo] of Object.entries(PARAMETROS)) {
    const grupoImportado = parametrosImportados?.[grupo];
    if (!grupoImportado) continue;
    for (const [campo, defCampo] of Object.entries(defGrupo.campos)) {
      if (!(campo in grupoImportado)) continue;
      const valor = grupoImportado[campo];
      const veredicto = validarValor(defCampo, valor);
      if (veredicto.ok) {
        resultado[grupo][campo] = valor === '' ? null : valor;
      } else {
        rechazos.push({ ruta: `parametros.${grupo}.${campo}`, mensaje: veredicto.mensaje });
      }
    }
  }
  return resultado;
}

function validarColeccion(lista, cotas, nombre, rechazos, validadorExtra = null) {
  if (!Array.isArray(lista)) return null;
  const validos = [];
  for (const [indice, elemento] of lista.entries()) {
    let ok = true;
    if (!elemento || typeof elemento !== 'object' || !elemento.id) {
      rechazos.push({ ruta: `${nombre}[${indice}]`, mensaje: 'Elemento sin id; rechazado.' });
      continue;
    }
    for (const [campo, def] of Object.entries(cotas)) {
      const valor = elemento[campo];
      if ((valor === null || valor === undefined) && def.opcional) continue;
      const veredicto = validarValor({ ...def, etiqueta: def.etiqueta }, valor);
      if (!veredicto.ok) {
        rechazos.push({ ruta: `${nombre}[${indice}].${campo}`, mensaje: veredicto.mensaje });
        ok = false;
      }
    }
    if (ok && validadorExtra) {
      const mensaje = validadorExtra(elemento);
      if (mensaje) {
        rechazos.push({ ruta: `${nombre}[${indice}]`, mensaje });
        ok = false;
      }
    }
    if (ok) validos.push(elemento);
  }
  return validos;
}

function validarTractor(tractor) {
  if (!Array.isArray(tractor.velocidades)) return 'Tractor sin tabla de velocidades.';
  for (const fila of tractor.velocidades) {
    const veredicto = validarValor(
      { ...COTAS_VELOCIDAD_MARCHA.kmhNominal },
      fila.kmhNominal
    );
    if (!veredicto.ok) return `Velocidad de marcha invalida: ${veredicto.mensaje}`;
    if (!ORIGENES_VELOCIDAD.includes(fila.origen)) {
      return `Origen de velocidad invalido (${fila.origen}).`;
    }
  }
  return null;
}

function validarEquipo(equipo) {
  if (!TIPOS_BOMBA.includes(equipo.tipoBomba)) return `Tipo de bomba invalido (${equipo.tipoBomba}).`;
  if (!ACCIONAMIENTOS.includes(equipo.accionamiento)) {
    return `Accionamiento invalido (${equipo.accionamiento}).`;
  }
  return null;
}

const COTAS_BOQUILLA = {
  caudalRefLmin: { min: 0.01, max: 200, unidad: 'L/min', etiqueta: 'Caudal de referencia' },
  presionRefBar: { min: 0.1, max: 50, unidad: 'bar', etiqueta: 'Presión de referencia' },
  presionMinBar: { min: 0.1, max: 50, unidad: 'bar', etiqueta: 'Presión mínima' },
  presionMaxBar: { min: 0.1, max: 50, unidad: 'bar', etiqueta: 'Presión máxima' },
  exponente: { min: 0.2, max: 0.8, unidad: '', etiqueta: 'Exponente presión-caudal' },
};

function validarBoquilla(boquilla) {
  if (boquilla.presionMinBar >= boquilla.presionMaxBar) {
    return 'La presión mínima debe ser menor que la máxima.';
  }
  return null;
}

export function importarJSON(texto, estadoActual) {
  const rechazos = [];
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, errores: ['El archivo no es JSON valido; no se importó nada.'] };
  }
  if (!datos || datos.tipo !== 'sprayboom-configuracion') {
    return { ok: false, errores: ['El archivo no es una configuración de esta aplicación.'] };
  }
  if (datos.version !== VERSION_ESQUEMA) {
    return {
      ok: false,
      errores: [
        `Versión de esquema desconocida (${datos.version}); esta aplicación usa la versión ${VERSION_ESQUEMA}. No se importo nada.`,
      ],
    };
  }
  const importado = datos.exportado ?? {};
  const nuevo = clonar(estadoActual);

  nuevo.parametros = validarParametros(importado.parametros, estadoActual.parametros, rechazos);

  const tractores = validarColeccion(importado.tractores, COTAS_TRACTOR, 'tractores', rechazos, validarTractor);
  if (tractores && tractores.length > 0) nuevo.tractores = tractores;

  const equipos = validarColeccion(importado.equipos, COTAS_EQUIPO, 'equipos', rechazos, validarEquipo);
  if (equipos && equipos.length > 0) nuevo.equipos = equipos;

  const gases = validarColeccion(importado.gases, COTAS_GAS, 'gases', rechazos);
  if (gases && gases.length > 0) nuevo.gases = gases;

  const rotametros = validarColeccion(importado.rotametros, COTAS_ROTAMETRO, 'rotametros', rechazos);
  if (rotametros && rotametros.length > 0) nuevo.rotametros = rotametros;

  const catalogo = validarColeccion(importado.catalogo, COTAS_BOQUILLA, 'catalogo', rechazos, validarBoquilla);
  if (catalogo && catalogo.length > 0) nuevo.catalogo = catalogo;

  if (Array.isArray(importado.factoresDesviacion)) nuevo.factoresDesviacion = importado.factoresDesviacion;
  if (Array.isArray(importado.bitacora)) nuevo.bitacora = importado.bitacora;
  if (Array.isArray(importado.pruebasCaptura)) nuevo.pruebasCaptura = importado.pruebasCaptura;
  if (importado.preferencias) nuevo.preferencias = { ...nuevo.preferencias, ...importado.preferencias };
  for (const claveActiva of ['tractorActivoId', 'equipoActivoId', 'gasActivoId', 'rotametroActivoId']) {
    if (typeof importado[claveActiva] === 'string') nuevo[claveActiva] = importado[claveActiva];
  }

  return { ok: true, estado: nuevo, rechazos };
}

export function importarCatalogoJSON(texto, estadoActual) {
  const rechazos = [];
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, errores: ['El archivo no es JSON valido; no se importó nada.'] };
  }
  if (!datos || datos.tipo !== 'sprayboom-catalogo') {
    return { ok: false, errores: ['El archivo no es un catálogo de boquillas de esta aplicación.'] };
  }
  if (datos.version !== VERSION_ESQUEMA) {
    return {
      ok: false,
      errores: [`Versión de esquema desconocida (${datos.version}). No se importo nada.`],
    };
  }
  const catalogo = validarColeccion(datos.catalogo, COTAS_BOQUILLA, 'catalogo', rechazos, validarBoquilla);
  if (!catalogo) {
    return { ok: false, errores: ['El archivo no trae la lista de boquillas.'] };
  }
  const nuevo = clonar(estadoActual);
  nuevo.catalogo = catalogo;
  return { ok: true, estado: nuevo, rechazos };
}

// ---------------------------------------------------------------------
// CSV: separador coma, UTF-8 con BOM (para que Excel en espanol no
// rompa los acentos), encabezados en espanol.
// ---------------------------------------------------------------------
export function aCSV(encabezados, filas) {
  const escapar = (celda) => {
    const texto = celda === null || celda === undefined ? '' : String(celda);
    return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = [encabezados.map(escapar).join(',')];
  for (const fila of filas) {
    lineas.push(fila.map(escapar).join(','));
  }
  const BOM = '\uFEFF';
  return BOM + lineas.join('\r\n');
}

// ---------------------------------------------------------------------
// Descarga / hoja de compartir (solo navegador)
// ---------------------------------------------------------------------
export async function descargarOCompartir(nombreArchivo, contenido, tipoMime) {
  const blob = new Blob([contenido], { type: tipoMime });
  const archivo = new File([blob], nombreArchivo, { type: tipoMime });
  // En iOS Safari la descarga directa es poco confiable: se ofrece la
  // hoja de compartir nativa cuando existe.
  if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombreArchivo });
      return 'compartido';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelado';
      // sigue a descarga
    }
  }
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'descargado';
}
