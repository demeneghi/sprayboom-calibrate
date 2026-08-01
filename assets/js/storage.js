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
  COTAS_BOQUILLA,
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
    // Los datos que MAS DE UNA pantalla pide: presion, velocidad,
    // espaciamiento, boquilla, volumen objetivo, ancho y numero de
    // boquillas. Viven aqui UNA sola vez, no una copia por pestana.
    //
    // Antes cada pantalla los guardaba en su propio borrador, con el
    // MISMO nombre en tres sitios distintos (borradores.gasto.presionBar,
    // borradores.captura.presionBar). Funcionaba mientras cada pantalla
    // se usara sola, y se volvio incoherente en cuanto la guia las puso
    // en fila: la calibracion pedia la presion tres veces. Lo que se
    // declara aqui se pregunta UNA vez, lo capture el asistente o lo
    // capture una pestana. Ver domain/datos.js.
    jornada: {},
    // Lo que una pantalla CALCULO y otra necesita de entrada (volumen de
    // aplicacion, masa por tabla, objetivo de la jornada). Va aparte de
    // los borradores porque no es la captura de una pantalla, sino su
    // resultado, con procedencia y fecha. Ver ctx.guardarResultado.
    resultados: {},
  };
}

// ---------------------------------------------------------------------
// Adopcion de las tablas de velocidad de fabrica
//
// Un telefono que ya uso la aplicacion tiene sus tractores guardados: sin
// esto, la correccion de una tabla de velocidades nunca le llegaria y
// seguiria calculando el gasto con la velocidad vieja. Una fila que sigue
// marcada 'estimacion' es un default que nadie verifico, asi que se
// reemplaza por la de la siembra. Lo que el usuario capturo o calibro NO
// se toca: sale de SU unidad y manda sobre cualquier tabla generica.
// ---------------------------------------------------------------------
export function adoptarVelocidadesDeFabrica(tractoresGuardados, tractoresSemilla) {
  if (!Array.isArray(tractoresGuardados) || !Array.isArray(tractoresSemilla)) {
    return tractoresGuardados;
  }
  return tractoresGuardados.map((tractor) => {
    const semilla = tractoresSemilla.find((t) => t.id === tractor?.id);
    if (!semilla || !Array.isArray(tractor?.velocidades)) return tractor;
    return {
      ...tractor,
      velocidades: tractor.velocidades.map((fila) => {
        if (fila?.origen !== 'estimacion') return fila;
        const deFabrica = semilla.velocidades.find(
          (v) => v.rango === fila.rango && v.marcha === fila.marcha
        );
        if (!deFabrica || deFabrica.origen === 'estimacion') return fila;
        return { ...deFabrica };
      }),
    };
  });
}

// ---------------------------------------------------------------------
// Adopcion de las boquillas de fabrica
//
// Mismo problema que con las tablas de velocidad: un telefono que ya uso
// la aplicacion tiene SU catalogo guardado, y sin esto una boquilla
// nueva de la siembra no le llegaria nunca —quedaria calibrando sin la
// candidata que necesita—. Se agregan solo las fichas de fabrica cuyo id
// no esta en lo guardado; ninguna ficha existente se toca, porque el
// usuario pudo haberla editado o pudo ser suya desde el principio.
//
// Si el usuario borro a proposito una boquilla de fabrica, vuelve a
// aparecer y tendra que borrarla otra vez. Es el precio de que las
// nuevas lleguen, y es el lado seguro: sobra una boquilla en la lista,
// no falta la que hace falta.
// ---------------------------------------------------------------------
export function adoptarBoquillasDeFabrica(catalogoGuardado, catalogoSemilla) {
  if (!Array.isArray(catalogoGuardado) || !Array.isArray(catalogoSemilla)) {
    return catalogoGuardado;
  }
  const conocidas = new Set(catalogoGuardado.map((b) => b?.id));
  const faltantes = catalogoSemilla.filter((b) => !conocidas.has(b.id));
  return faltantes.length === 0 ? catalogoGuardado : [...catalogoGuardado, ...clonar(faltantes)];
}

// ---------------------------------------------------------------------
// Correccion de fichas de fabrica ya sembradas
//
// Cuando una ficha de la siembra sale con un dato equivocado respecto a
// la tabla del fabricante, agregar la version buena no basta: el
// telefono ya tiene la mala guardada. Aqui se declara, ficha por ficha,
// el valor ANTERIOR y el corregido, y solo se reemplaza cuando lo
// guardado coincide exactamente con el anterior: asi la correccion llega
// a quien nunca toco esa ficha y no pisa a quien la edito.
//
// Cada entrada se puede borrar cuando ya no haya telefonos con la
// version vieja; mientras tanto, documenta que se corrigio y contra que.
// ---------------------------------------------------------------------
const claseGota = (tramos) =>
  tramos.map(([presionMinBar, presionMaxBar, clase]) => ({ presionMinBar, presionMaxBar, clase }));

export const CORRECCIONES_CATALOGO = [
  // Clase de gota tomada de la columna de 80 grados en vez de la de 110.
  // Catalogo TeeJet 51A-M, tabla de la serie AI.
  {
    id: 'ai110025',
    antes: claseGota([[2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 7.5, 'VC'], [7.5, 8, 'C']]),
    despues: claseGota([[2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C']]),
  },
  {
    id: 'ai11006',
    antes: claseGota([[2, 3.5, 'UC'], [3.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C']]),
    despues: claseGota([[2, 2.5, 'UC'], [2.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C']]),
  },
];

export function corregirBoquillasDeFabrica(catalogoGuardado, correcciones = CORRECCIONES_CATALOGO) {
  if (!Array.isArray(catalogoGuardado)) return catalogoGuardado;
  return catalogoGuardado.map((boquilla) => {
    const correccion = correcciones.find((c) => c.id === boquilla?.id);
    if (!correccion) return boquilla;
    if (JSON.stringify(boquilla.clasesGota) !== JSON.stringify(correccion.antes)) return boquilla;
    return { ...boquilla, clasesGota: clonar(correccion.despues) };
  });
}

// ---------------------------------------------------------------------
// Migracion: la geometria de la barra pasa de global a cada barra
//
// El ancho de barra, el numero de boquillas y el espaciamiento vivian en
// parametros.geometria, uno solo para toda la aplicacion. Ahora son de
// cada barra. Un telefono que ya uso la aplicacion tiene sus barras
// guardadas SIN esos tres campos: sin esto quedarian vacios y el calculo
// de volumen por hectarea reventaria al abrir. Se copia lo que el
// usuario tenia capturado en la geometria global —era el ancho de su
// barra— y solo si tampoco esta, la semilla.
//
// La version del esquema NO sube: subirla mandaria todo lo guardado al
// respaldo y el telefono arrancaria con defaults, que es justo lo que
// esta migracion evita.
// ---------------------------------------------------------------------
const CAMPOS_GEOMETRIA_BARRA = ['anchoBarra', 'numBoquillas', 'espaciamientoCapturado'];

export function migrarGeometriaABarras(equiposGuardados, geometriaGuardada, equipoSemilla) {
  if (!Array.isArray(equiposGuardados)) return equiposGuardados;
  return equiposGuardados.map((equipo) => {
    if (!equipo || typeof equipo !== 'object') return equipo;
    const migrado = { ...equipo };
    for (const campo of CAMPOS_GEOMETRIA_BARRA) {
      if (migrado[campo] !== undefined) continue;
      const global = geometriaGuardada?.[campo];
      migrado[campo] = global === undefined ? (equipoSemilla?.[campo] ?? null) : global;
    }
    return migrado;
  });
}

// ---------------------------------------------------------------------
// Migracion: la presion atmosferica del sitio pasa a derivarse de la
// altitud
//
// Antes `parametros.sitio.presionAtmosfericaLocal` era un campo
// obligatorio con default 14.7 psia (nivel del mar). Ahora se deriva de
// `altitudM` y ese campo queda como ANULACION MANUAL, donde vacio
// significa derivada.
//
// Un telefono que ya uso la aplicacion trae 14.7 guardado. Sin esto, ese
// 14.7 se leeria como una anulacion manual y la altitud —lo que este
// cambio vino a habilitar— no serviria de nada en las unidades que ya
// estan en campo, en silencio.
//
// Solo se limpia cuando el valor guardado es EXACTAMENTE el default
// anterior: nadie lo tocó. Un valor distinto salio de una decision del
// usuario y se conserva como anulacion manual. La presion derivada de 0 m
// es 14.696 psia contra los 14.7 anteriores: 0.002% de diferencia en el
// factor del rotametro, invisible en campo.
//
// La version del esquema NO sube, por el mismo motivo que la migracion
// de la geometria: subirla mandaria todo lo guardado al respaldo.
// ---------------------------------------------------------------------
export const PRESION_ATMOSFERICA_DEFAULT_ANTERIOR = 14.7;

export function migrarSitioAAltitud(sitioFusionado, sitioGuardado) {
  if (!sitioFusionado || typeof sitioFusionado !== 'object') return sitioFusionado;
  // Ya conoce la altitud: se guardo con el esquema nuevo, nada que hacer.
  if (sitioGuardado?.altitudM !== undefined) return sitioFusionado;
  if (sitioGuardado?.presionAtmosfericaLocal !== PRESION_ATMOSFERICA_DEFAULT_ANTERIOR) {
    return sitioFusionado;
  }
  return { ...sitioFusionado, presionAtmosfericaLocal: null };
}

// ---------------------------------------------------------------------
// Los datos compartidos suben de los borradores a la jornada
//
// Un telefono que ya uso la aplicacion tiene la presion, la boquilla y el
// objetivo repartidos en los borradores de tres pantallas. Sin esto, al
// abrir la version nueva se quedaria con los campos en blanco y habria
// que volver a capturar toda la jornada, de pie en el lote.
//
// El orden de preferencia es el de autoridad de cada pantalla sobre el
// dato: Gasto de agua es la pantalla central del volumen, la Prueba de
// captura es la que afora, y Boquillas solo aporta el objetivo. Una vez
// migrado, `jornada` manda y los borradores viejos ya no se leen.
const ORIGEN_JORNADA = [
  ['gasto', ['presionBar', 'boquillaId', 'anchoBarraM', 'numBoquillas', 'espaciamientoM', 'espaciamientoManual', 'velocidadKmh', 'velocidadManual', 'lhaObjetivo']],
  ['captura', ['presionBar', 'boquillaId', 'espaciamientoM', 'espaciamientoManual', 'lhaObjetivo']],
  ['boquillas', ['espaciamientoM', 'espaciamientoManual', 'lhaObjetivo']],
];

export function migrarJornada(jornadaGuardada, borradores) {
  // Ya se guardo con el esquema nuevo: manda lo que hay.
  if (jornadaGuardada && Object.keys(jornadaGuardada).length > 0) return { ...jornadaGuardada };
  const jornada = {};
  for (const [tab, claves] of ORIGEN_JORNADA) {
    const borrador = borradores?.[tab];
    if (!borrador || typeof borrador !== 'object') continue;
    for (const clave of claves) {
      if (jornada[clave] !== undefined) continue;
      const valor = borrador[clave];
      if (valor === undefined || valor === null) continue;
      jornada[clave] = valor;
    }
  }
  // El nombre viejo del objetivo en Gasto de agua, que se siguio leyendo
  // para no perder lo capturado en un telefono.
  if (jornada.lhaObjetivo === undefined && Number.isFinite(borradores?.gasto?.lhaObjetivoLha)) {
    jornada.lhaObjetivo = borradores.gasto.lhaObjetivoLha;
  }
  return jornada;
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
  // Cuando lo guardado no se puede adoptar (version desconocida o JSON
  // corrupto), NO se sobreescribe: se respalda en una clave aparte y la
  // siembra vive solo en memoria hasta la primera edicion del usuario.
  let conservarGuardado = false;
  if (almacenamiento) {
    try {
      const crudo = almacenamiento.getItem(CLAVE_ALMACEN);
      if (crudo) {
        let cargado = null;
        let parseFallo = false;
        try {
          cargado = JSON.parse(crudo);
        } catch {
          parseFallo = true;
        }
        if (!parseFallo && cargado && cargado.version === VERSION_ESQUEMA) {
          // Fusion PROFUNDA con la siembra: los campos nuevos del
          // esquema (incluidos los anidados por grupo) aparecen con su
          // default sin perder lo guardado.
          const semilla = sembrarEstado();
          const parametros = { ...semilla.parametros };
          for (const grupo of Object.keys(semilla.parametros)) {
            parametros[grupo] = { ...semilla.parametros[grupo], ...(cargado.parametros?.[grupo] ?? {}) };
          }
          parametros.sitio = migrarSitioAAltitud(parametros.sitio, cargado.parametros?.sitio);
          estado = {
            ...semilla,
            ...cargado,
            parametros,
            preferencias: { ...semilla.preferencias, ...(cargado.preferencias ?? {}) },
            tractores: adoptarVelocidadesDeFabrica(
              cargado.tractores ?? semilla.tractores,
              semilla.tractores
            ),
            equipos: migrarGeometriaABarras(
              cargado.equipos ?? semilla.equipos,
              cargado.parametros?.geometria,
              semilla.equipos[0]
            ),
            catalogo: corregirBoquillasDeFabrica(
              adoptarBoquillasDeFabrica(cargado.catalogo ?? semilla.catalogo, semilla.catalogo)
            ),
            jornada: migrarJornada(cargado.jornada, cargado.borradores),
          };
        } else {
          conservarGuardado = true;
          try {
            almacenamiento.setItem(`${CLAVE_ALMACEN}.respaldo`, crudo);
          } catch {
            // sin espacio para el respaldo: al menos no se toca la clave
          }
          errores.push(
            parseFallo
              ? `Lo guardado en este navegador no se pudo leer (JSON dañado). Quedó respaldado en la clave ${CLAVE_ALMACEN}.respaldo y NO se tocará hasta que edites algo; se usan defaults.`
              : `Versión de esquema desconocida (${cargado?.version}). Lo guardado quedó respaldado en la clave ${CLAVE_ALMACEN}.respaldo y NO se tocará hasta que edites algo; se usan defaults.`
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

  // Primer arranque limpio: siembra persistida de inmediato. Si lo
  // guardado no se pudo adoptar, NO se pisa: queda el respaldo y la
  // clave original intacta hasta la primera edicion.
  if (!conservarGuardado) {
    persistir();
  }

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
        resultado[grupo][campo] = valor === '' || valor === null ? null : (veredicto.numero ?? valor);
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
      } else if (veredicto.numero !== undefined) {
        elemento[campo] = veredicto.numero;
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
  // Un respaldo exportado antes de que la presion del sitio se derivara
  // de la altitud trae el 14.7 de default: se limpia igual que al cargar
  // lo guardado, o restaurarlo dejaria la altitud sin efecto.
  nuevo.parametros.sitio = migrarSitioAAltitud(nuevo.parametros.sitio, importado.parametros?.sitio);

  const tractores = validarColeccion(importado.tractores, COTAS_TRACTOR, 'tractores', rechazos, validarTractor);
  if (tractores && tractores.length > 0) nuevo.tractores = tractores;

  // Un respaldo exportado ANTES de que la geometria bajara a cada barra
  // trae el ancho y las boquillas en parametros.geometria: se copian a
  // las barras antes de validar, o cada barra se rechazaria entera por
  // tres campos que ese archivo no podia traer.
  const equipos = validarColeccion(
    migrarGeometriaABarras(importado.equipos, importado.parametros?.geometria, EQUIPOS_SIEMBRA[0]),
    COTAS_EQUIPO,
    'equipos',
    rechazos,
    validarEquipo
  );
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
  // Los datos de la jornada viajan en el respaldo; uno exportado antes de
  // que existieran se reconstruye desde sus borradores, igual que al
  // cargar lo guardado.
  const jornadaImportada = migrarJornada(importado.jornada, importado.borradores);
  if (Object.keys(jornadaImportada).length > 0) nuevo.jornada = jornadaImportada;
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
