// Pestana Configuracion: formularios por grupo de parametros con
// validacion contra cotas, unidad rotulada y origen del default como
// ayuda contextual; alta y edicion de tractores, barras de aplicacion
// (con su geometria propia), gases y
// rotametros; tabla editable de velocidades por marcha con bandera de
// origen; factores de desviacion medidos; editor del catalogo de
// boquillas; restaurar defaults por grupo con dialogo que enumera los
// cambios; tema y unidades; exportacion e importacion.
//
// Va antes que las calculadoras a proposito: si los parametros no se
// pueden capturar y guardar, las calculadoras no tienen de donde leer.

import { el, reemplazar } from '../dom.js';
import { tarjeta, pintarAvisos } from '../render.js';
import { crearAyuda, crearCampoNumerico, crearCampoSelect, crearInterruptor } from '../campos.js';
import { crearTrioBarra } from '../trio-barra.js';
import { formatear } from '../formato.js';
import { nodoAlterno } from '../alterna.js';
import { confirmar } from '../dialog.js';
import { mostrarToast } from '../toast.js';
import { idRegistro } from '../id.js';
import { buscarActualizacion, reinstalar, versionInstalada } from '../actualizar.js';
import { estiloBadgeIso } from '../color.js';
import { aSistema, unidad } from '../../domain/units.js';
import {
  PARAMETROS,
  COTAS_TRACTOR,
  COTAS_BOQUILLA,
  BOQUILLA_NUEVA,
  COTAS_VELOCIDAD_MARCHA,
  COTAS_BARRA,
  COTAS_EQUIPO,
  COTAS_GAS,
  COTAS_ROTAMETRO,
  COTAS_FACTOR_DESVIACION,
  TEMAS,
  TIPOS_BOMBA,
  ACCIONAMIENTOS,
  TRACTORES_SIEMBRA,
  EQUIPOS_SIEMBRA,
  GASES_SIEMBRA,
  ROTAMETROS_SIEMBRA,
} from '../../domain/defaults.js';
import { validarValor } from '../../domain/validate.js';
import { presionAtmosfericaEfectiva } from '../../domain/atmosphere.js';
import {
  geometria,
  factorDeMedicion,
  marchasDeTractor,
  modoGeometriaDe,
} from '../../domain/speed.js';
import { gPorScfEfectivo } from '../../domain/gas.js';
import { validarContraIso } from '../../domain/nozzles.js';
import { TABLA_ISO_10625, PRESION_NOMINAL_ISO_BAR, filaIso } from '../../data/iso-colors.js';
import { TIPOS_PATRON, MATERIALES, FABRICANTES_SUGERIDOS } from '../../data/nozzle-catalog.js';
import { EDICIONES_S572, ORDEN_CLASES } from '../../data/droplet-classes.js';
import {
  exportarJSON,
  exportarCatalogoJSON,
  importarJSON,
  importarCatalogoJSON,
  descargarOCompartir,
  sembrarEstado,
  validarRotametro,
} from '../../storage.js';

export const id = 'configuracion';

// Configuración captura y guarda SIEMPRE en base metrica, este la
// aplicación en metrico o en imperial: son los parametros del rancho y
// del fierro, no una captura de jornada, y el dominio los quiere asi.
//
// Eso NO obliga a quien los teclea: cada campo con magnitud lleva el
// boton de unidades, asi que la ficha de una boquilla americana se
// captura en GPM y psi —que es como viene impresa— y se guarda
// convertida. El sistema que aqui se declara es el de SALIDA del campo,
// no el de captura.
const SISTEMA_PARAMETROS = 'metrico';

let consecutivoDerivado = 0;

/* Cifra derivada de esta pantalla —lo que sale solo de lo capturado
   arriba— con su boton "?", igual que un resultado de calculadora.
   Aquí no se usa `pintarResultado` porque en Configuración la cifra va
   un escalón más chica: son decenas de campos apilados y no el número
   que se lee a distancia de brazo, y el consumidor no puede pedirle ese
   tamaño. La estructura y la ayuda sí son las mismas. */
function cifraDerivada({
  etiqueta,
  texto,
  ayuda,
  tamano = 'var(--text-lg)',
  valor = null,
  unidadTexto = '',
  magnitud = null,
  decimales = 2,
}) {
  consecutivoDerivado += 1;
  const idCifra = `derivado-${consecutivoDerivado}`;
  const rotulo = el('span', { clase: 'resultado__etiqueta', id: idCifra }, etiqueta);
  const ayudaCifra = crearAyuda({ idCampo: idCifra, etiqueta, texto: ayuda });
  return el(
    'div',
    { clase: 'resultado' },
    el('div', { clase: 'resultado__cabecera' }, rotulo, ayudaCifra.boton),
    el('span', { clase: 'resultado__valor', estilo: { fontSize: tamano } }, texto),
    // La equivalencia en el otro sistema, igual que en `pintarResultado`.
    // Aqui hay que pasarle el numero aparte porque esta cifra llega ya
    // compuesta con su unidad.
    nodoAlterno(valor, unidadTexto, { magnitud, decimales }),
    ayudaCifra.globo
  );
}

// Respuesta en palabras de cada estado de la busqueda de version nueva.
// Quien lee esto esta de pie en el lote: cada mensaje dice que paso y
// que hacer, sin hablar de caches ni de service workers.
const MENSAJES_ACTUALIZACION = {
  'al-dia': 'Ya tienes la última versión publicada.',
  'sin-conexion': 'Sin conexión con el servidor. Conéctate a datos o wifi y vuelve a intentar.',
  descargando:
    'La versión nueva se está descargando. Espera un momento y vuelve a tocar el botón.',
  error:
    'La descarga se interrumpió. Vuelve a intentar; si sigue igual, usa «Reinstalar desde cero».',
  'sin-soporte':
    'Este navegador no guarda la aplicación para uso sin conexión: siempre carga la última versión al abrirla.',
  // Reinstalar borra la única copia con la que la aplicación abre sin
  // señal: sin conexión no se borra nada y se dice por qué.
  reinstalarSinConexion:
    'Sin conexión: no se borró nada. La copia guardada es lo único con lo que la aplicación abre en el lote. Conéctate a datos o wifi y vuelve a intentar.',
};

// Ubicacion por GPS para rellenar la altitud del sitio.
//
// Vale la pena porque el error del GPS es despreciable para lo que se
// necesita: la presion cae 0.0017 psi por metro, asi que equivocarse los
// 10-30 m tipicos de la altitud satelital mueve el resultado un 0.08%,
// contra el 3.3% de suponer el nivel del mar estando a 2200 m.
//
// Dos limitaciones, ambas dichas en pantalla cuando ocurren: hay
// telefonos que dan la posicion sin altitud (cuando ubican por wifi en
// vez de por satelite), y fijar un satelite tarda. El GPS SI funciona
// sin senal de datos, que es la condicion normal en el lote.
const GPS_ESPERA_MS = 20000;

const MENSAJES_GPS = {
  1: 'No hay permiso de ubicación. Concédelo para este sitio en los ajustes del navegador, o escribe la altitud a mano.',
  2: 'El teléfono no pudo fijar la posición. Sal a cielo abierto y vuelve a intentar, o escribe la altitud a mano.',
  3: 'El GPS tardó demasiado. Sal a cielo abierto y vuelve a intentar, o escribe la altitud a mano.',
};

function posicionActual(opciones) {
  return new Promise((resolver, rechazar) => {
    navigator.geolocation.getCurrentPosition(resolver, rechazar, opciones);
  });
}

const ETIQUETAS_BOMBA = { positiva: 'Desplazamiento positivo', centrifuga: 'Centrífuga', independiente: 'Motor independiente' };
const ETIQUETAS_ACCIONAMIENTO = { tdf: 'Toma de fuerza', hidraulico: 'Hidráulico', 'motor-propio': 'Motor propio' };

function seccion(props, ...hijos) {
  return tarjeta(props, ...hijos);
}

// El mismo generador que usan las pestañas que guardan en bitacora.
const generarId = idRegistro;

// El reporte de la ultima importacion vive a nivel de modulo: el
// re-render por 'contexto' reconstruye la pestana y el reporte se
// vuelve a pintar en el nodo nuevo (antes se escribia en uno huerfano).
let ultimoReporteImportacion = null;

export function render(panel, ctx) {
  const almacen = ctx.almacen;

  // ----------------------------------------------------------------
  // Preferencias: tema y unidades
  // ----------------------------------------------------------------
  const estado0 = ctx.estado();
  // Las opciones salen de TEMAS (domain/defaults.js), que es la misma lista
  // con la que la importacion rechaza un tema desconocido: dos listas
  // separadas terminan divergiendo.
  const TEXTO_TEMA = { claro: 'Claro', oscuro: 'Oscuro', auto: 'Automático (según el sistema)' };
  const selectTema = crearCampoSelect({
    etiqueta: 'Tema',
    opciones: TEMAS.map((t) => ({ valor: t, texto: TEXTO_TEMA[t] ?? t })),
    valorInicial: estado0.preferencias.tema,
    ayuda: 'A pleno sol el claro se lee mejor. De fábrica viene el oscuro.',
    alCambiar: (valor) =>
      almacen.actualizar((estado) => {
        estado.preferencias.tema = valor;
      }, 'contexto'),
  });
  const selectUnidades = crearCampoSelect({
    etiqueta: 'Sistema de unidades',
    opciones: [
      { valor: 'metrico', texto: 'Métrico (L/ha, km/h, bar)' },
      { valor: 'imperial', texto: 'Imperial (GPA, mph, psi)' },
    ],
    valorInicial: estado0.preferencias.unidades,
    ayuda: 'Aplica a toda la aplicación. Por dentro siempre se calcula en métrico.',
    alCambiar: (valor) =>
      almacen.actualizar((estado) => {
        estado.preferencias.unidades = valor;
      }, 'contexto'),
  });

  // ----------------------------------------------------------------
  // Grupos de parametros escalares
  // ----------------------------------------------------------------
  const zonaDerivados = el('div', { clase: 'rejilla-2' });
  const zonaAvisosGeometria = el('div', {});

  function pintarDerivados() {
    try {
      const g = geometria(ctx.parametrosGeometria());
      const sistema = ctx.sistema();
      const fila = (etiqueta, valor, unidadTexto, decimales, ayuda, magnitud = null) =>
        cifraDerivada({
          etiqueta,
          texto: `${formatear(valor, decimales)} ${unidadTexto}`,
          ayuda,
          valor,
          unidadTexto,
          magnitud,
          decimales,
        });
      // No se imprime el área en m2: es la MISMA cifra que la superficie
      // en hectáreas dividida entre 10000, y la aplicación dosifica por
      // hectárea. Dos renglones para un solo dato obligan a leer los dos
      // para darse cuenta de que dicen lo mismo.
      reemplazar(
        zonaDerivados,
        fila(
          'Superficie por tabla',
          aSistema('superficie', g.valores.hectareasPorTabla, sistema),
          unidad('superficie', sistema),
          6,
          'Las hectáreas que cubre un pase de la tabla: su largo por el ancho de la barra. ' +
            'Multiplica a la dosis por hectárea para saber cuánto producto o cuánto gas lleva ' +
            'una tabla.'
        ),
        fila(
          'Tramos por tabla',
          g.valores.tramosPorTabla,
          '',
          2,
          'Cuántos tramos de referencia caben en el largo de la tabla. El tramo es la ' +
            'distancia que se cronometra en campo para medir la velocidad.'
        ),
        fila(
          'Espaciamiento derivado',
          aSistema('distanciaCorta', g.valores.espaciamientoDerivado, sistema),
          unidad('distanciaCorta', sistema),
          4,
          'La distancia entre boquillas que sale del ancho de barra entre el número de ' +
            'boquillas. Si mides otra cosa con el flexómetro, captúrala: la capturada gana ' +
            'sobre esta.',
          // En metros la unidad es ambigua: 'm' es tramo largo y también
          // espaciamiento. Aquí es lo corto, así que la equivalencia va
          // en pulgadas y no en pies.
          'distanciaCorta'
        )
      );
      reemplazar(zonaAvisosGeometria, ...pintarAvisos(g.avisos));
    } catch (error) {
      reemplazar(zonaAvisosGeometria,
        el('p', { clase: 'campo__error' }, String(error.message ?? error)));
    }
  }

  // ----------------------------------------------------------------
  // Sitio: la presion atmosferica se DERIVA de la altitud
  //
  // Nadie trae un barometro al lote, pero la altitud del rancho se sabe
  // —y si no, la da el GPS del telefono—, asi que ese es el dato que se
  // captura. La presion en uso se muestra aqui mismo, con su origen,
  // porque es la que corrige el rotametro y antes se quedaba en 14.7
  // sin que nada lo dijera.
  // ----------------------------------------------------------------
  const zonaAtmosfera = el('div', { clase: 'pila pila--compacta' });

  function pintarAtmosfera() {
    const sitio = ctx.estado().parametros.sitio;
    try {
      const atmosfera = presionAtmosfericaEfectiva({ sitio });
      reemplazar(
        zonaAtmosfera,
        cifraDerivada({
          etiqueta: 'Presión atmosférica local en uso',
          texto: `${formatear(atmosfera.valores.presionPsia, 2)} psia`,
          valor: atmosfera.valores.presionPsia,
          unidadTexto: 'psia',
          ayuda:
            'La presión del aire en el rancho. Se suma a lo que marca el manómetro del gas ' +
            'para llegar a la presión absoluta con la que se corrige el rotámetro: en el ' +
            'altiplano el aire pesa menos y el mismo manómetro significa otro flujo.',
        }),
        el(
          'p',
          { clase: 'ayuda' },
          atmosfera.valores.anulado
            ? 'Anulada a mano: la altitud no se está usando. Vacía el campo para que vuelva a salir de ella.'
            : `Derivada de ${formatear(sitio.altitudM, 0)} m de altitud con la atmósfera estándar internacional.`
        ),
        // Los avisos de tipo info ya los dice la línea de arriba con las
        // palabras de esta pantalla; aquí solo se pinta lo que es error.
        ...pintarAvisos(atmosfera.avisos.filter((a) => a.tipo !== 'info'))
      );
    } catch (error) {
      reemplazar(zonaAtmosfera, el('p', { clase: 'campo__error' }, String(error.message ?? error)));
    }
  }

  function botonAltitudGps(campoAltitud) {
    const boton = el('button', { type: 'button', clase: 'boton boton--contorno' }, 'Usar la altitud del GPS');
    boton.addEventListener('click', async () => {
      if (!navigator.geolocation) {
        mostrarToast(
          'Este navegador no comparte la ubicación con la aplicación. Escribe la altitud a mano.',
          { tipo: 'destructivo', duracionMs: 9000 }
        );
        return;
      }
      boton.disabled = true;
      boton.textContent = 'Buscando el GPS…';
      try {
        const posicion = await posicionActual({
          enableHighAccuracy: true,
          timeout: GPS_ESPERA_MS,
          maximumAge: 0,
        });
        const altitud = posicion.coords.altitude;
        if (!Number.isFinite(altitud)) {
          mostrarToast(
            'Este teléfono dio la posición pero no la altitud: pasa cuando ubica por wifi en vez de por satélite. Sal a cielo abierto y vuelve a intentar, o escríbela a mano.',
            { tipo: 'destructivo', duracionMs: 11000 }
          );
          return;
        }
        // La altitud del GPS es sobre el elipsoide WGS84, no sobre el
        // nivel del mar; en México difieren unos 10-20 m, que en presión
        // son 0.03 psi. Se acepta y no se corrige por el geoide.
        const metros = Math.round(altitud);
        const defAltitud = PARAMETROS.sitio.campos.altitudM;
        const veredicto = validarValor(defAltitud, metros);
        if (!veredicto.ok) {
          mostrarToast(`El GPS dio ${metros} m. ${veredicto.mensaje}`, {
            tipo: 'destructivo',
            duracionMs: 9000,
          });
          return;
        }
        campoAltitud.fijar(metros);
        campoAltitud.fijarError(null);
        almacen.actualizar((estado) => {
          estado.parametros.sitio.altitudM = metros;
        }, 'borrador');
        pintarAtmosfera();

        const precision = posicion.coords.altitudeAccuracy;
        const margen = Number.isFinite(precision) ? ` (± ${Math.round(precision)} m)` : '';
        // Con la anulación manual puesta, la altitud recién traída no
        // cambia nada: decirlo aquí evita creer que el botón sirvió.
        const anulada = ctx.estado().parametros.sitio.presionAtmosfericaLocal !== null;
        mostrarToast(
          `Altitud del GPS: ${metros} m${margen}.` +
            (anulada
              ? ' Ojo: la presión sigue anulada a mano, así que esta altitud no se está usando.'
              : ''),
          { duracionMs: anulada ? 11000 : 6000 }
        );
      } catch (error) {
        mostrarToast(
          MENSAJES_GPS[error?.code] ??
            'No se pudo leer la ubicación. Escribe la altitud a mano.',
          { tipo: 'destructivo', duracionMs: 9000 }
        );
      } finally {
        boton.disabled = false;
        boton.textContent = 'Usar la altitud del GPS';
      }
    });
    return boton;
  }

  function tarjetaGrupo(nombreGrupo, defGrupo) {
    const campos = [];
    const controles = {};
    for (const [nombreCampo, defCampo] of Object.entries(defGrupo.campos)) {
      const campo = crearCampoNumerico({
        etiqueta: defCampo.etiqueta,
        unidad: defCampo.unidad,
        magnitud: defCampo.magnitud,
        sistema: SISTEMA_PARAMETROS,
        valorInicial: ctx.estado().parametros[nombreGrupo][nombreCampo],
        ayuda: `${defCampo.origen} De ${defCampo.min} a ${defCampo.max}${defCampo.unidad ? ` ${defCampo.unidad}` : ''}. De fábrica: ${defCampo.valor === null ? 'pendiente de capturar' : defCampo.valor}.`,
        alCambiar: (valor, texto) => {
          if (texto.trim() === '' && defCampo.opcional) {
            campo.fijarError(null);
            almacen.actualizar((estado) => {
              estado.parametros[nombreGrupo][nombreCampo] = null;
            }, 'borrador');
            pintarDerivados();
            if (nombreGrupo === 'sitio') pintarAtmosfera();
            return;
          }
          const veredicto = validarValor(defCampo, texto.trim() === '' ? '' : valor);
          if (!veredicto.ok) {
            campo.fijarError(veredicto.mensaje);
            return;
          }
          campo.fijarError(null);
          almacen.actualizar((estado) => {
            estado.parametros[nombreGrupo][nombreCampo] = valor;
          }, 'borrador');
          pintarDerivados();
          if (nombreGrupo === 'sitio') pintarAtmosfera();
        },
      });
      controles[nombreCampo] = campo;
      campos.push(campo.elemento);
    }

    const botonRestaurar = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Restaurar defaults del grupo');
    botonRestaurar.addEventListener('click', async () => {
      const actuales = ctx.estado().parametros[nombreGrupo];
      const cambios = Object.entries(defGrupo.campos)
        .filter(([campo, def]) => actuales[campo] !== def.valor)
        .map(([campo, def]) =>
          el('li', {}, `${def.etiqueta}: ${actuales[campo] ?? 'vacio'} pasa a ${def.valor ?? 'vacio'}`)
        );
      if (cambios.length === 0) {
        mostrarToast('Este grupo ya está en sus defaults.');
        return;
      }
      const ok = await confirmar({
        titulo: `Restaurar ${defGrupo.etiqueta}`,
        descripcion: 'Estos valores van a cambiar:',
        cuerpo: el('ul', { estilo: { paddingLeft: '1.2rem', fontSize: 'var(--text-sm)' } }, cambios),
        confirmarTexto: 'Restaurar',
        destructivo: true,
      });
      if (!ok) return;
      almacen.actualizar((estado) => {
        for (const [campo, def] of Object.entries(defGrupo.campos)) {
          estado.parametros[nombreGrupo][campo] = def.valor;
        }
      }, 'contexto');
      mostrarToast(`${defGrupo.etiqueta}: defaults restaurados.`);
    });

    if (nombreGrupo !== 'sitio') {
      return seccion({ titulo: defGrupo.etiqueta }, ...campos, botonRestaurar);
    }
    pintarAtmosfera();
    return seccion(
      { titulo: defGrupo.etiqueta },
      controles.altitudM.elemento,
      botonAltitudGps(controles.altitudM),
      zonaAtmosfera,
      controles.presionAtmosfericaLocal.elemento,
      botonRestaurar
    );
  }

  // ----------------------------------------------------------------
  // Tractores y tabla de velocidades por marcha
  // ----------------------------------------------------------------
  const zonaTractor = el('div', { clase: 'pila' });

  function pintarEditorTractor() {
    const estado = ctx.estado();
    const tractor = ctx.tractorActivo();
    const nodos = [];

    const selector = crearCampoSelect({
      etiqueta: 'Tractor a editar',
      opciones: estado.tractores.map((t) => ({ valor: t.id, texto: t.nombre })),
      valorInicial: tractor.id,
      alCambiar: (valor) =>
        almacen.actualizar((e) => {
          e.tractorActivoId = valor;
        }, 'contexto'),
    });
    nodos.push(selector.elemento);

    if (tractor.regimenNominalVerificado === 'pendiente') {
      nodos.push(
        el('div', { clase: 'alerta alerta--advertencia', role: 'alert' },
          el('p', { clase: 'alerta__descripcion' },
            `El régimen nominal de este tractor está PENDIENTE de confirmar contra el manual. ${tractor.regimenNominalOrigen ?? ''}`))
      );
    }

    const campoNombre = el('input', { clase: 'entrada', id: 'tractor-nombre', value: tractor.nombre });
    campoNombre.addEventListener('change', () => {
      const nombre = campoNombre.value.trim();
      if (!nombre) return;
      almacen.actualizar((e) => {
        e.tractores.find((t) => t.id === tractor.id).nombre = nombre;
      }, 'contexto');
    });
    nodos.push(el('div', { clase: 'campo' }, el('label', { clase: 'etiqueta', for: 'tractor-nombre' }, 'Nombre'), campoNombre));

    for (const [campo, cota] of Object.entries(COTAS_TRACTOR)) {
      // Validacion en vivo al teclear, pero el COMMIT es al confirmar
      // (change/blur): asi no se re-renderiza ni se poda la tabla de
      // velocidades con un valor a medio teclear.
      const entrada = crearCampoNumerico({
        etiqueta: cota.etiqueta,
        unidad: cota.unidad,
        magnitud: cota.magnitud,
        sistema: SISTEMA_PARAMETROS,
        valorInicial: tractor[campo],
        ayuda: `De ${cota.min} a ${cota.max}${cota.unidad ? ` ${cota.unidad}` : ''}. Se guarda al salir del campo.`,
        alCambiar: (valor) => {
          const veredicto = validarValor(cota, valor);
          entrada.fijarError(veredicto.ok ? null : veredicto.mensaje);
        },
      });
      entrada.entrada.addEventListener('change', async () => {
        const valor = entrada.obtener();
        const veredicto = validarValor(cota, valor);
        if (!veredicto.ok) {
          entrada.fijarError(veredicto.mensaje);
          entrada.fijar(tractor[campo]);
          return;
        }
        // Cota CRUZADA del rango de trabajo del motor: con el minimo por
        // encima del maximo, Avance marca TODAS las marchas fuera de rango
        // y dice «ninguna marcha da esa velocidad», culpando a la
        // transmision de un error de dedo.
        if (campo === 'regimenMinimo' || campo === 'regimenMaximo') {
          const minimo = campo === 'regimenMinimo' ? valor : tractor.regimenMinimo;
          const maximo = campo === 'regimenMaximo' ? valor : tractor.regimenMaximo;
          if (!(minimo <= maximo)) {
            entrada.fijarError(
              `El régimen mínimo (${formatear(minimo, 0)}) no puede ser mayor que el máximo (${formatear(maximo, 0)}).`
            );
            entrada.fijar(tractor[campo]);
            return;
          }
        }
        entrada.fijarError(null);
        const numero = veredicto.numero ?? valor;
        if (campo === 'numRangos' || campo === 'marchasPorRango') {
          const rangosNuevos = campo === 'numRangos' ? numero : tractor.numRangos;
          const marchasNuevas = campo === 'marchasPorRango' ? numero : tractor.marchasPorRango;
          const perdidas = tractor.velocidades.filter(
            (v) => !(v.rango < rangosNuevos && v.marcha <= marchasNuevas)
          );
          if (perdidas.length > 0) {
            const ok = await confirmar({
              titulo: 'Reducir la transmisión elimina marchas capturadas',
              descripcion: 'Estas filas de velocidad se perderían:',
              cuerpo: el(
                'ul',
                { estilo: { paddingLeft: '1.2rem', fontSize: 'var(--text-sm)' } },
                perdidas.map((v) =>
                  el('li', {}, `${tractor.etiquetasRango[v.rango] ?? v.rango + 1}${v.marcha}: ${v.kmhNominal} km/h (${v.origen})`)
                )
              ),
              confirmarTexto: 'Reducir de todos modos',
              destructivo: true,
            });
            if (!ok) {
              entrada.fijar(tractor[campo]);
              return;
            }
          }
        }
        almacen.actualizar((e) => {
          const t = e.tractores.find((x) => x.id === tractor.id);
          t[campo] = numero;
          if (campo === 'numRangos' || campo === 'marchasPorRango') {
            const rangos = t.numRangos;
            const marchas = t.marchasPorRango;
            t.etiquetasRango = Array.from({ length: rangos }, (_, i) =>
              t.etiquetasRango[i] ?? String.fromCharCode(65 + i));
            t.velocidades = t.velocidades.filter(
              (v) => v.rango < rangos && v.marcha <= marchas
            );
            // La marcha de trabajo apunta a una POSICION: si la
            // transmision se encogio por debajo de ella, deja de existir
            // y se olvida en vez de quedar apuntando a otra marcha.
            if (
              t.marchaHabitual &&
              !(t.marchaHabitual.rango < rangos && t.marchaHabitual.marcha <= marchas)
            ) {
              t.marchaHabitual = null;
            }
          }
        }, 'contexto');
      });
      nodos.push(entrada.elemento);
    }

    // Marcha de trabajo: con cual se aplica normalmente. Avance la
    // escribe sola en cuanto se elige una marcha, y aqui se puede fijar
    // o corregir sin pasar por ahi. De ella cuelga que el tiempo por
    // tabla llegue calculado a Gas etileno y a Forzamiento la primera
    // vez que se abren.
    const marchasConVelocidad = marchasDeTractor(tractor).filter((f) => f.kmhNominal !== null);
    const claveMarcha = (f) => `${f.rango}-${f.marcha}`;
    const selectMarchaTrabajo = crearCampoSelect({
      etiqueta: 'Marcha de trabajo',
      opciones: [
        { valor: '', texto: 'Sin definir' },
        ...marchasConVelocidad.map((f) => ({
          valor: claveMarcha(f),
          texto: `${f.etiqueta} — ${formatear(f.kmhNominal, 1)} km/h nominales`,
        })),
      ],
      valorInicial: tractor.marchaHabitual ? claveMarcha(tractor.marchaHabitual) : '',
      ayuda:
        'Con la que se aplica normalmente. Es el último respaldo de la velocidad: sin nada ' +
        'capturado en Avance, de aquí sale el tiempo por tabla que heredan Gas etileno y ' +
        'Forzamiento. Elegir una marcha en Avance la actualiza sola.',
      alCambiar: (valor) => {
        const elegida = marchasConVelocidad.find((f) => claveMarcha(f) === valor) ?? null;
        almacen.actualizar((e) => {
          const t = e.tractores.find((x) => x.id === tractor.id);
          t.marchaHabitual = elegida ? { rango: elegida.rango, marcha: elegida.marcha } : null;
        }, 'datos');
      },
    });
    nodos.push(selectMarchaTrabajo.elemento);

    // Tabla de velocidades por marcha con bandera de origen
    const filasTabla = [];
    for (let r = 0; r < tractor.numRangos; r += 1) {
      for (let m = 1; m <= tractor.marchasPorRango; m += 1) {
        const fila = tractor.velocidades.find((v) => v.rango === r && v.marcha === m) ?? null;
        const etiqueta = `${tractor.etiquetasRango[r] ?? r + 1}${m}`;
        const entrada = el('input', {
          clase: 'entrada',
          inputmode: 'decimal',
          value: fila?.kmhNominal ?? '',
          'aria-label': `Velocidad nominal de ${etiqueta}`,
          estilo: { width: '5.5rem' },
        });
        entrada.addEventListener('change', () => {
          const valor = Number(entrada.value.replace(',', '.'));
          const veredicto = validarValor(COTAS_VELOCIDAD_MARCHA.kmhNominal, entrada.value === '' ? '' : valor);
          if (entrada.value !== '' && !veredicto.ok) {
            mostrarToast(veredicto.mensaje, { tipo: 'destructivo' });
            entrada.value = fila?.kmhNominal ?? '';
            return;
          }
          almacen.actualizar((e) => {
            const t = e.tractores.find((x) => x.id === tractor.id);
            let f = t.velocidades.find((v) => v.rango === r && v.marcha === m);
            if (entrada.value === '') {
              t.velocidades = t.velocidades.filter((v) => !(v.rango === r && v.marcha === m));
              return;
            }
            if (!f) {
              f = { rango: r, marcha: m, kmhNominal: valor, origen: 'capturado', fecha: null };
              t.velocidades.push(f);
            } else {
              f.kmhNominal = valor;
              f.origen = 'capturado';
            }
            f.fecha = new Date().toISOString();
          }, 'contexto');
        });
        const badge =
          fila === null
            ? el('span', { clase: 'badge badge--contorno' }, 'pendiente')
            : fila.origen === 'calibrado'
              ? el('span', { clase: 'badge' }, 'calibrado')
              : fila.origen === 'capturado'
                ? el('span', { clase: 'badge badge--contorno' }, 'capturado')
                : el('span', { clase: 'badge badge--secundario' }, 'estimación');
        filasTabla.push(
          el('tr', {},
            el('td', {}, etiqueta),
            el('td', {}, entrada),
            el('td', {}, badge))
        );
      }
    }
    nodos.push(
      el('h3', { clase: 'etiqueta' }, 'Velocidades por marcha (km/h al régimen nominal)'),
      el('p', { clase: 'ayuda' },
        'Vienen las tablas del fabricante: el 5715 a 2400 rpm con llanta 16.9-30 y el 6603 a 2100 rpm con llanta 18.4-38. Con otra llanta hay que capturarlas. Ninguna incluye patinaje: eso se calibra en Avance.'),
      el('div', { clase: 'scroll-x' },
        el('table', { clase: 'tabla' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Marcha'), el('th', {}, 'km/h nominal'), el('th', {}, 'Origen'))),
          el('tbody', {}, filasTabla)))
    );

    // Alta y baja de tractores
    const botonAlta = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Agregar tractor');
    botonAlta.addEventListener('click', async () => {
      const ok = await confirmar({
        titulo: 'Agregar tractor',
        descripcion: 'Se crea con la plantilla del JD 6603 (transmision 3x3); ajusta sus datos después.',
        confirmarTexto: 'Agregar',
      });
      if (!ok) return;
      const nuevoId = generarId('tractor');
      almacen.actualizar((e) => {
        const plantilla = JSON.parse(JSON.stringify(TRACTORES_SIEMBRA[1]));
        plantilla.id = nuevoId;
        plantilla.nombre = 'Tractor nuevo';
        plantilla.velocidades.forEach((v) => {
          v.origen = 'estimacion';
        });
        e.tractores.push(plantilla);
        e.tractorActivoId = nuevoId;
      }, 'contexto');
    });
    const botonBaja = el('button', { clase: 'boton boton--destructivo boton--sm' }, 'Eliminar este tractor');
    botonBaja.addEventListener('click', async () => {
      if (ctx.estado().tractores.length <= 1) {
        mostrarToast('Debe quedar al menos un tractor.', { tipo: 'destructivo' });
        return;
      }
      const ok = await confirmar({
        titulo: `Eliminar ${tractor.nombre}`,
        descripcion: 'Sus velocidades y selección se pierden; la bitácora histórica no se toca.',
        confirmarTexto: 'Eliminar',
        destructivo: true,
      });
      if (!ok) return;
      almacen.actualizar((e) => {
        e.tractores = e.tractores.filter((t) => t.id !== tractor.id);
        e.tractorActivoId = e.tractores[0].id;
      }, 'contexto');
    });
    nodos.push(el('div', { clase: 'fila-acciones' }, botonAlta, botonBaja));

    reemplazar(zonaTractor, nodos);
  }

  // ----------------------------------------------------------------
  // Barras de aplicacion
  //
  // En el codigo la coleccion se llama `equipos` (clave del estado
  // guardado y de los respaldos exportados); en pantalla es BARRA, que es
  // la palabra que usa quien calibra y la que dice el selector del
  // encabezado.
  // ----------------------------------------------------------------
  const zonaEquipo = el('div', { clase: 'pila' });

  function pintarEditorEquipo() {
    const estado = ctx.estado();
    const equipo = ctx.equipoActivo();
    const nodos = [];

    const selector = crearCampoSelect({
      etiqueta: 'Barra a editar',
      opciones: estado.equipos.map((e) => ({ valor: e.id, texto: e.nombre })),
      valorInicial: equipo.id,
      ayuda: 'Es la misma barra del selector de arriba. Lo que edites aquí lo usan todas las pantallas.',
      alCambiar: (valor) =>
        almacen.actualizar((e) => {
          e.equipoActivoId = valor;
        }, 'contexto'),
    });
    nodos.push(selector.elemento);

    const campoNombre = el('input', { clase: 'entrada', id: 'equipo-nombre', value: equipo.nombre });
    campoNombre.addEventListener('change', () => {
      const nombre = campoNombre.value.trim();
      if (!nombre) return;
      almacen.actualizar((e) => {
        e.equipos.find((x) => x.id === equipo.id).nombre = nombre;
      }, 'contexto');
    });
    nodos.push(el('div', { clase: 'campo' }, el('label', { clase: 'etiqueta', for: 'equipo-nombre' }, 'Nombre'), campoNombre));

    // Un campo numerico de la barra. Los de geometria van primero y
    // aparte: son los que cambian el volumen por hectarea.
    function campoDeBarra(campo, cota) {
      const entrada = crearCampoNumerico({
        etiqueta: cota.etiqueta,
        unidad: cota.unidad,
        magnitud: cota.magnitud,
        sistema: SISTEMA_PARAMETROS,
        ayuda:
          cota.ayuda ??
          `De ${cota.min} a ${cota.max} ${cota.unidad}.${cota.opcional ? ' Opcional: vacío es por capturar.' : ''}`,
        valorInicial: equipo[campo],
        alCambiar: (valor, texto) => {
          if (texto.trim() === '' && cota.opcional) {
            entrada.fijarError(null);
            almacen.actualizar((e) => {
              e.equipos.find((x) => x.id === equipo.id)[campo] = null;
            }, 'borrador');
            pintarDerivados();
            return;
          }
          const veredicto = validarValor(cota, valor);
          if (!veredicto.ok) {
            entrada.fijarError(veredicto.mensaje);
            return;
          }
          entrada.fijarError(null);
          almacen.actualizar((e) => {
            e.equipos.find((x) => x.id === equipo.id)[campo] = valor;
          }, 'borrador');
          pintarDerivados();
        },
      });
      return entrada.elemento;
    }

    // Los tres datos de la geometria van juntos y amarrados
    // (`ancho = número * espaciamiento`): se capturan dos y el tercero
    // sale solo, en la direccion que se elija. Quien mide con el
    // flexometro la distancia entre boquillas y las cuenta llega al ancho
    // sin sacar la calculadora, que es donde se colaba el error.
    const trioBarra = crearTrioBarra({
      sistema: SISTEMA_PARAMETROS,
      valores: {
        anchoBarraM: equipo.anchoBarra ?? null,
        numBoquillas: equipo.numBoquillas ?? null,
        espaciamientoM: equipo.espaciamientoCapturado ?? null,
      },
      calcular: modoGeometriaDe(equipo),
      umbralDiscrepanciaPct: estado.parametros.umbrales.umbralDiscrepanciaMetodos,
      espaciamientoMinimoPlausible: estado.parametros.umbrales.espaciamientoMinimoPlausible,
      etiquetas: {
        anchoBarra: COTAS_BARRA.anchoBarra.etiqueta,
        numBoquillas: COTAS_BARRA.numBoquillas.etiqueta,
        espaciamiento: COTAS_BARRA.espaciamientoCapturado.etiqueta,
      },
      ayudas: {
        anchoBarra: COTAS_BARRA.anchoBarra.ayuda,
        numBoquillas: COTAS_BARRA.numBoquillas.ayuda,
        espaciamiento: COTAS_BARRA.espaciamientoCapturado.ayuda,
      },
      alCambiar: ({ valores, calcular }) => guardarGeometriaBarra(equipo.id, valores, calcular),
    });

    // Guardar la geometria de la barra. Los tres campos se validan contra
    // sus cotas y un valor fuera de rango NO se guarda: la barra se queda
    // con el ultimo bueno y el campo dice por que.
    //
    // El espaciamiento se guarda vacio cuando es el calculado, que es lo
    // que ese campo opcional siempre significo: vacio = sale del ancho
    // entre el numero de boquillas. Asi sigue a la barra cuando cambie el
    // ancho, en vez de quedarse clavado en el numero de hoy.
    function guardarGeometriaBarra(equipoId, valores, calcular) {
      const capturados = {
        anchoBarra: valores.anchoBarraM,
        numBoquillas: valores.numBoquillas,
        espaciamientoCapturado: calcular === 'espaciamiento' ? null : valores.espaciamientoM,
      };
      const CLAVE_TRIO = {
        anchoBarra: 'anchoBarra',
        numBoquillas: 'numBoquillas',
        espaciamientoCapturado: 'espaciamiento',
      };
      let ok = true;
      for (const [campo, cota] of Object.entries(COTAS_BARRA)) {
        const valor = capturados[campo];
        if (valor === null && (cota.opcional || campo === 'espaciamientoCapturado')) {
          trioBarra.fijarError(CLAVE_TRIO[campo], null);
          continue;
        }
        const veredicto = validarValor(cota, valor);
        trioBarra.fijarError(CLAVE_TRIO[campo], veredicto.ok ? null : veredicto.mensaje);
        if (!veredicto.ok) ok = false;
      }
      if (!ok) return;
      almacen.actualizar((e) => {
        const barra = e.equipos.find((x) => x.id === equipoId);
        if (!barra) return;
        Object.assign(barra, capturados, { geometriaCalculada: calcular });
      }, 'borrador');
      pintarDerivados();
    }

    nodos.push(el('h3', { clase: 'etiqueta' }, 'Geometría de esta barra'), trioBarra.elemento);
    for (const [campo, cota] of Object.entries(COTAS_BARRA)) {
      if (campo === 'anchoBarra' || campo === 'numBoquillas' || campo === 'espaciamientoCapturado') {
        continue;
      }
      nodos.push(campoDeBarra(campo, cota));
    }
    nodos.push(
      el('h3', { clase: 'etiqueta' }, 'Valores derivados (solo lectura)'),
      zonaDerivados,
      zonaAvisosGeometria
    );

    nodos.push(
      crearCampoSelect({
        etiqueta: 'Tipo de bomba',
        opciones: TIPOS_BOMBA.map((t) => ({ valor: t, texto: ETIQUETAS_BOMBA[t] })),
        valorInicial: equipo.tipoBomba,
        ayuda: 'Con positiva y regulador, al bajar el régimen el volumen por hectárea SUBE; la centrífuga se compensa sola. Son hasta 40 puntos de diferencia en la dosis.',
        alCambiar: (valor) =>
          almacen.actualizar((e) => {
            e.equipos.find((x) => x.id === equipo.id).tipoBomba = valor;
          }, 'contexto'),
      }).elemento,
      crearCampoSelect({
        etiqueta: 'Accionamiento',
        opciones: ACCIONAMIENTOS.map((a) => ({ valor: a, texto: ETIQUETAS_ACCIONAMIENTO[a] })),
        valorInicial: equipo.accionamiento,
        alCambiar: (valor) =>
          almacen.actualizar((e) => {
            e.equipos.find((x) => x.id === equipo.id).accionamiento = valor;
          }, 'contexto'),
      }).elemento,
      crearInterruptor({
        etiqueta: 'Con regulador de presión',
        valorInicial: equipo.conRegulador,
        alCambiar: (valor) =>
          almacen.actualizar((e) => {
            e.equipos.find((x) => x.id === equipo.id).conRegulador = valor;
          }, 'contexto'),
      }).elemento
    );

    for (const [campo, cota] of Object.entries(COTAS_EQUIPO)) {
      if (campo in COTAS_BARRA) continue; // ya pintados arriba, con los derivados
      nodos.push(campoDeBarra(campo, cota));
    }

    // Boquilla instalada
    const opcionesBoquilla = [{ valor: '', texto: 'Sin asignar' }].concat(
      estado.catalogo.map((b) => ({ valor: b.id, texto: `${b.fabricante} ${b.modelo}` }))
    );
    nodos.push(
      crearCampoSelect({
        etiqueta: 'Boquilla instalada',
        opciones: opcionesBoquilla,
        valorInicial: equipo.boquillaId ?? '',
        ayuda: 'Gasto de agua la usará como boquilla de esta barra.',
        alCambiar: (valor) =>
          almacen.actualizar((e) => {
            e.equipos.find((x) => x.id === equipo.id).boquillaId = valor || null;
          }, 'contexto'),
      }).elemento
    );

    const botonAlta = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Agregar barra');
    botonAlta.addEventListener('click', () => {
      const nuevoId = generarId('equipo');
      almacen.actualizar((e) => {
        const plantilla = JSON.parse(JSON.stringify(EQUIPOS_SIEMBRA[0]));
        plantilla.id = nuevoId;
        plantilla.nombre = 'Barra nueva';
        e.equipos.push(plantilla);
        e.equipoActivoId = nuevoId;
      }, 'contexto');
      mostrarToast('Barra agregada: ajusta su ancho y su número de boquillas.');
    });
    const botonBaja = el('button', { clase: 'boton boton--destructivo boton--sm' }, 'Eliminar esta barra');
    botonBaja.addEventListener('click', async () => {
      if (ctx.estado().equipos.length <= 1) {
        mostrarToast('Debe quedar al menos una barra.', { tipo: 'destructivo' });
        return;
      }
      const ok = await confirmar({
        titulo: `Eliminar ${equipo.nombre}`,
        confirmarTexto: 'Eliminar',
        destructivo: true,
      });
      if (!ok) return;
      almacen.actualizar((e) => {
        e.equipos = e.equipos.filter((x) => x.id !== equipo.id);
        e.equipoActivoId = e.equipos[0].id;
      }, 'contexto');
    });
    nodos.push(el('div', { clase: 'fila-acciones' }, botonAlta, botonBaja));

    reemplazar(zonaEquipo, nodos);
  }

  // ----------------------------------------------------------------
  // Gases y rotametros
  // ----------------------------------------------------------------
  const zonaGas = el('div', { clase: 'pila' });

  function pintarEditorGas() {
    const estado = ctx.estado();
    const gas = ctx.gasActivo();
    const nodos = [];

    const selector = crearCampoSelect({
      etiqueta: 'Gas a editar',
      opciones: estado.gases.map((g) => ({ valor: g.id, texto: g.nombre })),
      valorInicial: gas.id,
      alCambiar: (valor) =>
        almacen.actualizar((e) => {
          e.gasActivoId = valor;
        }, 'contexto'),
    });
    nodos.push(selector.elemento);

    const zonaDerivado = el('div', {});
    function pintarDerivadoGas() {
      const gasVigente = ctx.gasActivo();
      try {
        const efectivo = gPorScfEfectivo({ gas: gasVigente });
        reemplazar(
          zonaDerivado,
          cifraDerivada({
            etiqueta: `Masa por pie cúbico estándar (${efectivo.valores.anulado ? 'ANULADA manualmente' : 'derivada'})`,
            texto: `${formatear(efectivo.valores.gPorScf, 4)} g/SCF`,
            tamano: 'var(--text-xl)',
            ayuda:
              'Cuántos gramos pesa un pie cúbico de este gas en las condiciones estándar del ' +
              'rotámetro. Es lo que convierte lo que marca el flotador —volumen— en gramos ' +
              'aplicados, así que entra en todo el cálculo de forzamiento.',
          }),
          ...pintarAvisos(efectivo.avisos)
        );
      } catch (error) {
        reemplazar(zonaDerivado, el('p', { clase: 'campo__error' }, String(error.message ?? error)));
      }
    }

    for (const [campo, cota] of Object.entries(COTAS_GAS)) {
      const entrada = crearCampoNumerico({
        etiqueta: cota.etiqueta,
        unidad: cota.unidad,
        magnitud: cota.magnitud,
        sistema: SISTEMA_PARAMETROS,
        valorInicial: gas[campo],
        ayuda:
          campo === 'gPorScfManual'
            ? 'Si la llenas, manda tu número. Si la vacías, vuelve a salir del peso molecular.'
            : `De ${cota.min} a ${cota.max} ${cota.unidad}. La estándar es la de la escala del tubo; la local va en el grupo Sitio.`,
        alCambiar: (valor, texto) => {
          if (texto.trim() === '' && cota.opcional) {
            entrada.fijarError(null);
            almacen.actualizar((e) => {
              e.gases.find((x) => x.id === gas.id)[campo] = null;
            }, 'borrador');
            pintarDerivadoGas();
            return;
          }
          const veredicto = validarValor(cota, valor);
          if (!veredicto.ok) {
            entrada.fijarError(veredicto.mensaje);
            return;
          }
          entrada.fijarError(null);
          almacen.actualizar((e) => {
            e.gases.find((x) => x.id === gas.id)[campo] = valor;
          }, 'borrador');
          pintarDerivadoGas();
        },
      });
      nodos.push(entrada.elemento);
    }
    nodos.push(zonaDerivado);
    reemplazar(zonaGas, nodos);
    pintarDerivadoGas();
  }

  const zonaRotametro = el('div', { clase: 'pila' });

  function pintarEditorRotametro() {
    const estado = ctx.estado();
    const rotametro = ctx.rotametroActivo();
    const nodos = [];
    const selector = crearCampoSelect({
      etiqueta: 'Rotámetro a editar',
      opciones: estado.rotametros.map((r) => ({ valor: r.id, texto: r.modelo })),
      valorInicial: rotametro.id,
      alCambiar: (valor) =>
        almacen.actualizar((e) => {
          e.rotametroActivoId = valor;
        }, 'contexto'),
    });
    nodos.push(selector.elemento);
    for (const [campo, cota] of Object.entries(COTAS_ROTAMETRO)) {
      const entrada = crearCampoNumerico({
        etiqueta: cota.etiqueta,
        unidad: cota.unidad,
        magnitud: cota.magnitud,
        sistema: SISTEMA_PARAMETROS,
        valorInicial: rotametro[campo],
        ayuda: 'La escala solo sirve para los avisos y el dibujo del tubo. Nunca recorta un cálculo.',
        alCambiar: (valor) => {
          const veredicto = validarValor(cota, valor);
          if (!veredicto.ok) {
            entrada.fijarError(veredicto.mensaje);
            return;
          }
          // Cota CRUZADA: con el minimo por encima del maximo, el tubo se
          // pinta como escala invalida y el despeje sigue avisando «fuera
          // de escala» contra una escala que no existe. Se rechaza aqui,
          // con el mismo mensaje que la importacion.
          const propuesta = { ...ctx.rotametroActivo(), [campo]: valor };
          const cruce = validarRotametro(propuesta);
          if (cruce) {
            entrada.fijarError(cruce);
            return;
          }
          entrada.fijarError(null);
          almacen.actualizar((e) => {
            e.rotametros.find((x) => x.id === rotametro.id)[campo] = valor;
          }, 'borrador');
        },
      });
      nodos.push(entrada.elemento);
    }
    reemplazar(zonaRotametro, nodos);
  }

  // ----------------------------------------------------------------
  // Factores de desviacion medidos (por tractor y regimen)
  // ----------------------------------------------------------------
  const zonaFactores = el('div', { clase: 'pila' });

  function pintarFactores() {
    const estado = ctx.estado();
    const filas = estado.factoresDesviacion.map((medicion) => {
      const tractor = estado.tractores.find((t) => t.id === medicion.tractorId);
      const botonBorrar = el('button', { clase: 'boton boton--fantasma boton--sm', 'aria-label': 'Eliminar medición' }, 'Quitar');
      botonBorrar.addEventListener('click', () => {
        almacen.actualizar((e) => {
          e.factoresDesviacion = e.factoresDesviacion.filter((m) => m.id !== medicion.id);
        }, 'datos');
        pintarFactores();
      });
      return el('tr', {},
        el('td', {}, tractor?.nombre ?? medicion.tractorId),
        el('td', { clase: 'numero' }, formatear(medicion.rpm, 0)),
        el('td', { clase: 'numero' }, formatear(medicion.factor, 4)),
        el('td', {}, medicion.condiciones ?? ''),
        el('td', {}, botonBorrar));
    });

    const botonAlta = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Agregar medición de campo');
    botonAlta.addEventListener('click', async () => {
      const estadoActual = ctx.estado();
      const selectorTractor = crearCampoSelect({
        etiqueta: 'Tractor',
        opciones: estadoActual.tractores.map((t) => ({ valor: t.id, texto: t.nombre })),
        valorInicial: estadoActual.tractorActivoId,
      });
      const campoRpm = crearCampoNumerico({ etiqueta: COTAS_FACTOR_DESVIACION.rpm.etiqueta, unidad: 'rpm' });
      const campoTeorica = crearCampoNumerico({ etiqueta: COTAS_FACTOR_DESVIACION.velocidadTeorica.etiqueta, magnitud: 'velocidad', sistema: SISTEMA_PARAMETROS });
      const campoMedida = crearCampoNumerico({ etiqueta: COTAS_FACTOR_DESVIACION.velocidadMedida.etiqueta, magnitud: 'velocidad', sistema: SISTEMA_PARAMETROS });
      const campoCondiciones = el('input', { clase: 'entrada', id: 'factor-condiciones', placeholder: 'Implemento, humedad del suelo...' });
      const cuerpo = el('div', { clase: 'pila-campos' },
        selectorTractor.elemento, campoRpm.elemento, campoTeorica.elemento, campoMedida.elemento,
        el('div', { clase: 'campo' }, el('label', { clase: 'etiqueta', for: 'factor-condiciones' }, 'Condiciones'), campoCondiciones));
      const ok = await confirmar({
        titulo: 'Medición de desviación',
        descripcion: 'factor = velocidad medida / velocidad teórica. Se aplica exacto en su régimen y se interpola entre mediciones; nunca se extrapola.',
        cuerpo,
        confirmarTexto: 'Guardar medición',
      });
      if (!ok) return;
      const rpm = campoRpm.obtener();
      const teorica = campoTeorica.obtener();
      const medida = campoMedida.obtener();
      for (const [valor, cota] of [
        [rpm, COTAS_FACTOR_DESVIACION.rpm],
        [teorica, COTAS_FACTOR_DESVIACION.velocidadTeorica],
        [medida, COTAS_FACTOR_DESVIACION.velocidadMedida],
      ]) {
        const veredicto = validarValor(cota, valor);
        if (!veredicto.ok) {
          mostrarToast(veredicto.mensaje, { tipo: 'destructivo' });
          return;
        }
      }
      try {
        const factor = factorDeMedicion({ velocidadTeoricaKmh: teorica, velocidadMedidaKmh: medida });
        // El factor tambien tiene cota, y es la que importa: es lo unico de
        // esta ficha que entra al calculo. Se valida con la MISMA funcion y
        // el MISMO mensaje que la importacion de un respaldo.
        const veredictoFactor = validarValor(COTAS_FACTOR_DESVIACION.factor, factor);
        if (!veredictoFactor.ok) {
          mostrarToast(
            `${veredictoFactor.mensaje} Las dos velocidades no parecen de la misma medición: ` +
              `${formatear(teorica, 2)} km/h teórica contra ${formatear(medida, 2)} km/h medida.`,
            { tipo: 'destructivo', duracionMs: 9000 }
          );
          return;
        }
        almacen.actualizar((e) => {
          e.factoresDesviacion.push({
            id: generarId('factor'),
            tractorId: selectorTractor.obtener(),
            rpm,
            velocidadTeorica: teorica,
            velocidadMedida: medida,
            factor,
            condiciones: campoCondiciones.value.trim(),
            fecha: new Date().toISOString(),
          });
        }, 'datos');
        pintarFactores();
        mostrarToast(`Medición guardada: factor ${formatear(factor, 4)}.`);
      } catch (error) {
        mostrarToast(String(error.message ?? error), { tipo: 'destructivo' });
      }
    });

    reemplazar(
      zonaFactores,
      el('p', { clase: 'ayuda' },
        'Patinaje y tacómetro no se predicen con fórmula: se corrigen con estas mediciones por tractor y régimen. Sin mediciones, la velocidad mostrada es teórica y así se marca.'),
      filas.length === 0
        ? el('p', { clase: 'texto-suave' }, 'Sin mediciones capturadas.')
        : el('div', { clase: 'scroll-x' },
            el('table', { clase: 'tabla' },
              el('thead', {}, el('tr', {},
                el('th', {}, 'Tractor'), el('th', {}, 'rpm'), el('th', {}, 'Factor'),
                el('th', {}, 'Condiciones'), el('th', {}, ''))),
              el('tbody', {}, filas))),
      botonAlta
    );
  }

  // ----------------------------------------------------------------
  // Catalogo de boquillas
  // ----------------------------------------------------------------
  const zonaCatalogo = el('div', { clase: 'pila' });

  function formularioBoquilla(boquilla = null) {
    const b = boquilla ?? {
      id: generarId('boquilla'),
      fabricante: 'generica',
      serie: '',
      modelo: '',
      tamanoIso: null,
      caudalRefLmin: null,
      edicionEstandar: null,
      clasesGota: [],
      notas: '',
      fuente: 'captura manual',
      // La semilla numerica de una ficha nueva vive en defaults.js
      // (todo es parametro; la UI no incrusta numeros de dominio).
      ...JSON.parse(JSON.stringify(BOQUILLA_NUEVA)),
    };
    const campoFabricante = crearCampoSelect({
      etiqueta: 'Fabricante',
      opciones: FABRICANTES_SUGERIDOS.map((f) => ({ valor: f, texto: f })),
      valorInicial: FABRICANTES_SUGERIDOS.includes(b.fabricante) ? b.fabricante : 'generica',
    });
    const campoModelo = el('input', { clase: 'entrada', id: 'boquilla-modelo', value: b.modelo, placeholder: 'XR11004' });
    const campoPatron = crearCampoSelect({
      etiqueta: 'Tipo de patron',
      opciones: TIPOS_PATRON.map((t) => ({ valor: t, texto: t })),
      valorInicial: b.tipoPatron,
    });
    const campoTamano = crearCampoSelect({
      etiqueta: 'Tamaño ISO (deriva el color)',
      opciones: [{ valor: '', texto: 'Sin tamaño ISO' }].concat(
        TABLA_ISO_10625.map((f) => ({ valor: f.tamano, texto: `${f.tamano} (${f.caudalLmin} L/min a ${PRESION_NOMINAL_ISO_BAR} bar)` }))
      ),
      valorInicial: b.tamanoIso ?? '',
    });
    const campoAngulo = crearCampoNumerico({ etiqueta: 'Angulo de aspersión', unidad: 'grados', valorInicial: b.anguloGrados });
    const campoCaudal = crearCampoNumerico({ etiqueta: 'Caudal de referencia', magnitud: 'caudal', sistema: SISTEMA_PARAMETROS, valorInicial: b.caudalRefLmin });
    const campoPresionRef = crearCampoNumerico({ etiqueta: 'Presión de referencia', magnitud: 'presion', sistema: SISTEMA_PARAMETROS, valorInicial: b.presionRefBar, ayuda: '3 bar es el estándar ISO.' });
    const campoPresionMin = crearCampoNumerico({ etiqueta: 'Presión mínima de operación', magnitud: 'presion', sistema: SISTEMA_PARAMETROS, valorInicial: b.presionMinBar });
    const campoPresionMax = crearCampoNumerico({ etiqueta: 'Presión máxima de operación', magnitud: 'presion', sistema: SISTEMA_PARAMETROS, valorInicial: b.presionMaxBar });
    const campoExponente = crearCampoNumerico({
      etiqueta: 'Exponente presión-caudal',
      valorInicial: b.exponente,
      ayuda: '0.5 en las boquillas hidráulicas de siempre. Las de inducción de aire o patrón regulable se desvían.',
    });
    const campoMaterial = crearCampoSelect({
      etiqueta: 'Material',
      opciones: MATERIALES.map((m) => ({ valor: m, texto: m })),
      valorInicial: MATERIALES.includes(b.material) ? b.material : 'polimero',
    });
    const campoEdicion = crearCampoSelect({
      etiqueta: 'Edición del estándar de gota',
      opciones: [{ valor: '', texto: 'Sin clasificar' }].concat(
        EDICIONES_S572.map((e) => ({ valor: e, texto: e }))
      ),
      valorInicial: b.edicionEstandar ?? '',
      ayuda: 'No compares clases de ediciones distintas: la S572.3 subió los umbrales e invirtió los colores de C y VC.',
    });
    const campoNotas = el('input', { clase: 'entrada', id: 'boquilla-notas', value: b.notas ?? '' });

    // Mini editor de clases de gota por rango de presion
    const listaClases = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.4rem' } });
    const clases = (b.clasesGota ?? []).map((r) => ({ ...r }));
    function pintarClases() {
      reemplazar(
        listaClases,
        clases.map((rango, i) => {
          const min = el('input', { clase: 'entrada', inputmode: 'decimal', value: rango.presionMinBar, estilo: { width: '4.6rem' }, 'aria-label': 'Presión mínima del rango' });
          const max = el('input', { clase: 'entrada', inputmode: 'decimal', value: rango.presionMaxBar, estilo: { width: '4.6rem' }, 'aria-label': 'Presión máxima del rango' });
          const clase = el('select', { 'aria-label': 'Clase de gota' }, ORDEN_CLASES.map((c) => el('option', { value: c, selected: c === rango.clase || null }, c)));
          min.addEventListener('change', () => { clases[i].presionMinBar = Number(min.value.replace(',', '.')); });
          max.addEventListener('change', () => { clases[i].presionMaxBar = Number(max.value.replace(',', '.')); });
          clase.addEventListener('change', () => { clases[i].clase = clase.value; });
          const quitar = el('button', { clase: 'boton boton--fantasma boton--sm' }, 'Quitar');
          quitar.addEventListener('click', () => { clases.splice(i, 1); pintarClases(); });
          return el('div', { estilo: { display: 'flex', gap: '0.4rem', alignItems: 'center' } },
            min, el('span', { clase: 'texto-suave' }, 'a'), max, el('span', { clase: 'texto-suave' }, 'bar'),
            el('div', { clase: 'selector', estilo: { flex: '1' } }, clase), quitar);
        })
      );
    }
    const agregarClase = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Agregar rango de clase de gota');
    agregarClase.addEventListener('click', () => {
      clases.push({ presionMinBar: b.presionMinBar, presionMaxBar: b.presionMaxBar, clase: 'M' });
      pintarClases();
    });
    pintarClases();

    const cuerpo = el('div', { clase: 'pila-campos' },
      campoFabricante.elemento,
      el('div', { clase: 'campo' }, el('label', { clase: 'etiqueta', for: 'boquilla-modelo' }, 'Serie o modelo'), campoModelo),
      campoPatron.elemento, campoTamano.elemento, campoAngulo.elemento, campoCaudal.elemento,
      campoPresionRef.elemento, campoPresionMin.elemento, campoPresionMax.elemento,
      campoExponente.elemento, campoMaterial.elemento, campoEdicion.elemento,
      el('h3', { clase: 'etiqueta' }, 'Clase de gota por rango de presión'), listaClases, agregarClase,
      el('div', { clase: 'campo' }, el('label', { clase: 'etiqueta', for: 'boquilla-notas' }, 'Notas'), campoNotas));

    return {
      cuerpo,
      recolectar() {
        const nueva = {
          ...b,
          fabricante: campoFabricante.obtener(),
          modelo: campoModelo.value.trim(),
          serie: b.serie,
          tipoPatron: campoPatron.obtener(),
          tamanoIso: campoTamano.obtener() || null,
          anguloGrados: campoAngulo.obtener(),
          caudalRefLmin: campoCaudal.obtener(),
          presionRefBar: campoPresionRef.obtener(),
          presionMinBar: campoPresionMin.obtener(),
          presionMaxBar: campoPresionMax.obtener(),
          exponente: campoExponente.obtener(),
          material: campoMaterial.obtener(),
          edicionEstandar: campoEdicion.obtener() || null,
          clasesGota: clases,
          notas: campoNotas.value.trim(),
        };
        if (!nueva.modelo) return { error: 'Falta el modelo de la boquilla.' };
        // Las MISMAS cotas (y mensajes) que valida la importacion JSON:
        // lo que el formulario acepta siempre se puede reimportar.
        for (const [campo, cota] of Object.entries(COTAS_BOQUILLA)) {
          const veredicto = validarValor(cota, nueva[campo]);
          if (!veredicto.ok) return { error: veredicto.mensaje };
          nueva[campo] = veredicto.numero ?? nueva[campo];
        }
        if (nueva.presionMinBar >= nueva.presionMaxBar) {
          return { error: 'La presión mínima debe ser menor que la máxima.' };
        }
        for (const rango of nueva.clasesGota) {
          if (!(rango.presionMinBar < rango.presionMaxBar)) {
            return { error: 'Cada rango de clase de gota necesita presión mínima menor que la máxima.' };
          }
        }
        return { boquilla: nueva };
      },
    };
  }

  async function abrirFormularioBoquilla(boquilla = null) {
    const formulario = formularioBoquilla(boquilla);
    const ok = await confirmar({
      titulo: boquilla ? `Editar ${boquilla.modelo}` : 'Agregar boquilla al catálogo',
      descripcion: 'No inventes datos: captura la ficha del fabricante y cita la fuente en las notas.',
      cuerpo: formulario.cuerpo,
      confirmarTexto: 'Guardar',
    });
    if (!ok) return;
    const resultado = formulario.recolectar();
    if (resultado.error) {
      mostrarToast(resultado.error, { tipo: 'destructivo' });
      return;
    }
    const nueva = resultado.boquilla;
    // Validacion contra la tabla ISO: advierte sin bloquear.
    if (nueva.tamanoIso) {
      const veredicto = validarContraIso({
        tamanoIso: nueva.tamanoIso,
        caudalRefLmin: nueva.caudalRefLmin,
        presionRefBar: nueva.presionRefBar,
        exponente: nueva.exponente,
        tablaIso: TABLA_ISO_10625,
        toleranciaPct: ctx.estado().parametros.umbrales.toleranciaIso,
        presionNominalIsoBar: PRESION_NOMINAL_ISO_BAR,
      });
      for (const aviso of veredicto.avisos) {
        mostrarToast(aviso.mensaje, { tipo: 'destructivo', duracionMs: 9000 });
      }
    }
    almacen.actualizar((e) => {
      const indice = e.catalogo.findIndex((x) => x.id === nueva.id);
      if (indice >= 0) e.catalogo[indice] = nueva;
      else e.catalogo.push(nueva);
    }, 'contexto');
    mostrarToast('Boquilla guardada en el catálogo.');
  }

  function pintarCatalogo() {
    const estado = ctx.estado();
    const filas = estado.catalogo.map((b) => {
      const iso = b.tamanoIso ? filaIso(b.tamanoIso) : null;
      const botonEditar = el('button', { clase: 'boton boton--fantasma boton--sm' }, 'Editar');
      botonEditar.addEventListener('click', () => abrirFormularioBoquilla(b));
      const botonBorrar = el('button', { clase: 'boton boton--fantasma boton--sm' }, 'Quitar');
      botonBorrar.addEventListener('click', async () => {
        const ok = await confirmar({
          titulo: `Quitar ${b.modelo} del catálogo`,
          confirmarTexto: 'Quitar',
          destructivo: true,
        });
        if (!ok) return;
        almacen.actualizar((e) => {
          e.catalogo = e.catalogo.filter((x) => x.id !== b.id);
        }, 'contexto');
      });
      return el('tr', {},
        el('td', {},
          iso?.hex
            ? el('span', { clase: 'badge badge--iso', estilo: estiloBadgeIso(iso.hex) }, b.tamanoIso)
            : el('span', { clase: 'badge badge--contorno' }, b.tamanoIso ?? '—')),
        el('td', {}, `${b.fabricante} ${b.modelo}`),
        el('td', { clase: 'numero' }, `${formatear(b.caudalRefLmin, 3)} @ ${formatear(b.presionRefBar, 0)} bar`),
        el('td', {}, el('div', { estilo: { display: 'flex', gap: '0.25rem' } }, botonEditar, botonBorrar)));
    });

    const botonAlta = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Agregar boquilla');
    botonAlta.addEventListener('click', () => abrirFormularioBoquilla(null));

    reemplazar(
      zonaCatalogo,
      el('p', { clase: 'ayuda' },
        `${estado.catalogo.length} boquillas. El caudal de catálogo es el de boquilla NUEVA: el desgaste solo sale con la prueba de captura. Si al capturar se aleja del tamaño ISO más de la tolerancia, te avisamos sin bloquear.`),
      el('div', { clase: 'scroll-x' },
        el('table', { clase: 'tabla' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'ISO'), el('th', {}, 'Modelo'), el('th', {}, 'Caudal ref.'), el('th', {}, ''))),
          el('tbody', {}, filas))),
      botonAlta
    );
  }

  // ----------------------------------------------------------------
  // Exportacion / importacion
  // ----------------------------------------------------------------
  const entradaImportar = el('input', { type: 'file', accept: 'application/json,.json', clase: 'visualmente-oculto', id: 'importar-config', tabindex: '-1', 'aria-hidden': 'true' });
  const entradaImportarCatalogo = el('input', { type: 'file', accept: 'application/json,.json', clase: 'visualmente-oculto', id: 'importar-catalogo', tabindex: '-1', 'aria-hidden': 'true' });
  const zonaRechazos = el('div', {});

  function pintarReporteImportacion() {
    if (!ultimoReporteImportacion) return;
    const resultado = ultimoReporteImportacion;
    if (!resultado.ok) {
      reemplazar(zonaRechazos,
        el('div', { clase: 'alerta alerta--destructiva', role: 'alert' },
          el('p', { clase: 'alerta__titulo' }, 'Importación rechazada'),
          ...resultado.errores.map((e) => el('p', { clase: 'alerta__descripcion' }, e))));
      return;
    }
    const nodos = [el('div', { clase: 'alerta', role: 'status' },
      el('p', { clase: 'alerta__descripcion' }, 'Importación aplicada.'))];
    if (resultado.rechazos.length > 0) {
      nodos.push(
        el('div', { clase: 'alerta alerta--advertencia', role: 'alert' },
          el('p', { clase: 'alerta__titulo' }, `${resultado.rechazos.length} valores rechazados (se conservó el vigente)`),
          ...resultado.rechazos.map((r) => el('p', { clase: 'alerta__descripcion' }, `${r.ruta}: ${r.mensaje}`))));
    }
    reemplazar(zonaRechazos, nodos);
  }

  function reportarImportacion(resultado) {
    ultimoReporteImportacion = resultado;
    if (!resultado.ok) {
      pintarReporteImportacion();
      return;
    }
    // reemplazarEstado re-renderiza toda la pestana; el reporte se
    // pinta al montar (ver final de render()).
    almacen.reemplazarEstado(resultado.estado, 'contexto');
  }

  entradaImportar.addEventListener('change', async () => {
    const archivo = entradaImportar.files?.[0];
    if (!archivo) return;
    const texto = await archivo.text();
    reportarImportacion(importarJSON(texto, ctx.estado()));
    entradaImportar.value = '';
  });
  entradaImportarCatalogo.addEventListener('change', async () => {
    const archivo = entradaImportarCatalogo.files?.[0];
    if (!archivo) return;
    const texto = await archivo.text();
    reportarImportacion(importarCatalogoJSON(texto, ctx.estado()));
    entradaImportarCatalogo.value = '';
  });

  const botonExportar = el('button', { clase: 'boton' }, 'Exportar configuración (JSON)');
  botonExportar.addEventListener('click', async () => {
    const resultado = await descargarOCompartir('sprayboom-configuracion.json', exportarJSON(ctx.estado()), 'application/json');
    if (resultado !== 'cancelado') mostrarToast('Configuración exportada.');
  });
  const botonExportarCatalogo = el('button', { clase: 'boton boton--secundario' }, 'Exportar catálogo (JSON)');
  botonExportarCatalogo.addEventListener('click', async () => {
    const resultado = await descargarOCompartir('sprayboom-catalogo.json', exportarCatalogoJSON(ctx.estado()), 'application/json');
    if (resultado !== 'cancelado') mostrarToast('Catálogo exportado.');
  });
  const botonImportar = el('button', { clase: 'boton boton--contorno' }, 'Importar configuración');
  botonImportar.addEventListener('click', () => entradaImportar.click());
  const botonImportarCatalogo = el('button', { clase: 'boton boton--contorno' }, 'Importar catálogo');
  botonImportarCatalogo.addEventListener('click', () => entradaImportarCatalogo.click());

  const botonRestaurarTodo = el('button', { clase: 'boton boton--destructivo' }, 'Restaurar TODO a defaults');
  botonRestaurarTodo.addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Restaurar toda la aplicación',
      // El diálogo enumera TODO lo que se pierde. Antes listaba lo que
      // vuelve a la siembra y lo que no se toca, y la captura de hoy no
      // aparecía en ninguna de las dos listas: quien devolvía un umbral a
      // su valor de fábrica perdía la velocidad, la presión, la boquilla y
      // lo aforado de la jornada en curso, de pie en el lote y sin poder
      // deshacer.
      descripcion:
        'Parámetros, tractores, barras, gases, rotámetros y catálogo vuelven a la siembra. Se ' +
        'borran también las mediciones de desviación y lo capturado en la calibración de hoy: ' +
        'velocidad, presión, boquilla, volumen objetivo, volúmenes recogidos y lo aforado. La ' +
        'bitácora y las pruebas de captura guardadas NO se tocan. No se puede deshacer: exporta ' +
        'antes si tienes dudas.',
      confirmarTexto: 'Restaurar todo',
      destructivo: true,
    });
    if (!ok) return;
    const actual = ctx.estado();
    const semilla = sembrarEstado();
    semilla.bitacora = actual.bitacora;
    semilla.pruebasCaptura = actual.pruebasCaptura;
    semilla.preferencias = actual.preferencias;
    almacen.reemplazarEstado(semilla, 'contexto');
    mostrarToast('Aplicación restaurada a la siembra (bitácora y pruebas conservadas).');
  });

  // ----------------------------------------------------------------
  // Actualizacion de la aplicacion
  //
  // En un iPhone con la aplicacion en la pantalla de inicio no hay barra
  // de direcciones: no se puede recargar ni borrar la cache a mano. Sin
  // este boton, un telefono que se quedo con la version vieja no tiene
  // como salir de ahi.
  // ----------------------------------------------------------------
  const version = versionInstalada();
  const lineaVersion = el(
    'p',
    { clase: 'texto-meta' },
    'Versión instalada: ',
    el('span', { clase: 'mono' }, version ?? 'desconocida')
  );
  const estadoActualizacion = el('p', {
    clase: 'ayuda',
    role: 'status',
    'aria-live': 'polite',
  });
  const botonBuscar = el('button', { clase: 'boton' }, 'Buscar actualización');
  botonBuscar.addEventListener('click', async () => {
    botonBuscar.disabled = true;
    botonBuscar.textContent = 'Buscando…';
    estadoActualizacion.textContent = 'Preguntando al servidor si hay una versión nueva…';
    let recargaEnCamino = false;
    try {
      const resultado = await buscarActualizacion();
      if (resultado.estado === 'lista') {
        recargaEnCamino = true;
        estadoActualizacion.textContent =
          'Versión nueva lista. La aplicación se recarga sola en un momento.';
        mostrarToast('Versión nueva encontrada: actualizando…');
        resultado.aplicar();
        return;
      }
      estadoActualizacion.textContent = MENSAJES_ACTUALIZACION[resultado.estado];
      if (resultado.estado === 'sin-conexion') {
        mostrarToast(MENSAJES_ACTUALIZACION['sin-conexion'], { tipo: 'destructivo' });
      }
    } catch (error) {
      estadoActualizacion.textContent = `${MENSAJES_ACTUALIZACION.error} (${String(error?.message ?? error)})`;
    } finally {
      // Con la recarga en camino, reactivar el botón solo invita a
      // tocarlo otra vez mientras la pantalla se va.
      if (!recargaEnCamino) {
        botonBuscar.disabled = false;
        botonBuscar.textContent = 'Buscar actualización';
      }
    }
  });

  const botonReinstalar = el('button', { clase: 'boton boton--contorno' }, 'Reinstalar desde cero');
  botonReinstalar.addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Reinstalar la aplicación desde cero',
      descripcion:
        'Se borra la copia guardada en el teléfono y se descarga todo otra vez. Tu configuración, la bitácora y las pruebas de captura NO se tocan: se guardan aparte. Necesitas conexión: mientras se descarga, la aplicación no funciona sin señal.',
      confirmarTexto: 'Reinstalar',
      destructivo: true,
    });
    if (!ok) return;
    botonReinstalar.disabled = true;
    botonBuscar.disabled = true;
    estadoActualizacion.textContent = 'Borrando la copia guardada y recargando…';
    const reactivar = () => {
      botonReinstalar.disabled = false;
      botonBuscar.disabled = false;
    };
    try {
      const resultado = await reinstalar();
      // Sin señal no se borró nada: hay que decirlo y devolver los
      // botones, o la pantalla se queda en «recargando…» para siempre.
      if (resultado.estado === 'sin-conexion') {
        estadoActualizacion.textContent = MENSAJES_ACTUALIZACION.reinstalarSinConexion;
        mostrarToast(MENSAJES_ACTUALIZACION.reinstalarSinConexion, { tipo: 'destructivo' });
        reactivar();
        return;
      }
      // Son dos recargas: la pantalla se va y vuelve una vez más antes
      // de mostrar la versión nueva.
      estadoActualizacion.textContent =
        'Reinstalando. La aplicación se recarga sola un par de veces; no la cierres.';
    } catch (error) {
      estadoActualizacion.textContent = `No se pudo borrar la copia guardada: ${String(error?.message ?? error)}`;
      reactivar();
    }
  });

  // ----------------------------------------------------------------
  // Montaje
  // ----------------------------------------------------------------
  panel.append(
    seccion(
      {
        titulo: 'Actualizar la aplicación',
        descripcion:
          'La aplicación se guarda completa en el teléfono para funcionar sin señal en el lote. Con este botón pides la versión nueva cuando te avisan que ya hay una; en iPhone, abierta desde la pantalla de inicio, es la única forma.',
      },
      lineaVersion,
      el(
        'div',
        { clase: 'pila pila--compacta' },
        botonBuscar,
        botonReinstalar
      ),
      estadoActualizacion,
      el(
        'p',
        { clase: 'ayuda' },
        'Un cambio recién publicado puede tardar unos minutos en llegar. Si dice que estás al día y aun así falta, espera y vuelve a intentar antes de reinstalar.'
      )
    ),
    seccion(
      {
        titulo: 'Respaldo de datos',
        descripcion:
          'Los datos viven en este navegador y en este dispositivo. Si borras los datos del sitio o cambias de telefono, se pierden. Exporta con regularidad: es el único respaldo.',
      },
      el('div', { clase: 'pila pila--compacta' },
        botonExportar, botonExportarCatalogo, botonImportar, botonImportarCatalogo),
      entradaImportar,
      entradaImportarCatalogo,
      zonaRechazos
    ),
    seccion({ titulo: 'Preferencias' }, selectTema.elemento, selectUnidades.elemento),
    ...Object.entries(PARAMETROS).map(([nombre, def]) => tarjetaGrupo(nombre, def)),
    seccion(
      { titulo: 'Tractores', descripcion: 'La cuadricula de marchas y la tabla de velocidades se generan desde el número de rangos y marchas: otra transmision funciona sin cambios de código.' },
      zonaTractor
    ),
    seccion(
      {
        titulo: 'Barras de aplicación',
        descripcion:
          'Cada barra guarda su ancho, su número de boquillas y su espaciamiento: dos barras distintas ya no comparten geometría. La que elijas aquí es la que calcula toda la aplicación, y es la misma del selector del encabezado.',
      },
      zonaEquipo
    ),
    seccion({ titulo: 'Gases' }, zonaGas),
    seccion({ titulo: 'Rotametros' }, zonaRotametro),
    seccion({ titulo: 'Factores de desviación medidos' }, zonaFactores),
    seccion({ titulo: 'Catálogo de boquillas' }, zonaCatalogo),
    seccion({ titulo: 'Zona de riesgo' }, botonRestaurarTodo)
  );

  pintarReporteImportacion();
  pintarEditorTractor();
  // El editor de la barra ADOPTA zonaDerivados; pintar los derivados
  // antes lo dejaria escribiendo en un nodo que aun no esta montado.
  pintarEditorEquipo();
  pintarDerivados();
  pintarEditorGas();
  pintarEditorRotametro();
  pintarFactores();
  pintarCatalogo();
}
