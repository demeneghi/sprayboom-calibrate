// Pestana Configuracion: formularios por grupo de parametros con
// validacion contra cotas, unidad rotulada y origen del default como
// ayuda contextual; alta y edicion de tractores, equipos, gases y
// rotametros; tabla editable de velocidades por marcha con bandera de
// origen; factores de desviacion medidos; editor del catalogo de
// boquillas; restaurar defaults por grupo con dialogo que enumera los
// cambios; tema y unidades; exportacion e importacion.
//
// Va antes que las calculadoras a proposito: si los parametros no se
// pueden capturar y guardar, las calculadoras no tienen de donde leer.

import { el, reemplazar } from '../dom.js';
import { tarjeta, pintarAvisos } from '../render.js';
import { crearCampoNumerico, crearCampoSelect, crearInterruptor } from '../campos.js';
import { formatear } from '../formato.js';
import { confirmar } from '../dialog.js';
import { mostrarToast } from '../toast.js';
import { estiloBadgeIso } from '../color.js';
import { aSistema, unidad } from '../../domain/units.js';
import {
  PARAMETROS,
  COTAS_TRACTOR,
  COTAS_BOQUILLA,
  BOQUILLA_NUEVA,
  COTAS_VELOCIDAD_MARCHA,
  COTAS_EQUIPO,
  COTAS_GAS,
  COTAS_ROTAMETRO,
  COTAS_FACTOR_DESVIACION,
  TIPOS_BOMBA,
  ACCIONAMIENTOS,
  TRACTORES_SIEMBRA,
  EQUIPOS_SIEMBRA,
  GASES_SIEMBRA,
  ROTAMETROS_SIEMBRA,
} from '../../domain/defaults.js';
import { validarValor } from '../../domain/validate.js';
import { geometria, factorDeMedicion } from '../../domain/speed.js';
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
} from '../../storage.js';

export const id = 'configuracion';

const ETIQUETAS_BOMBA = { positiva: 'Desplazamiento positivo', centrifuga: 'Centrífuga', independiente: 'Motor independiente' };
const ETIQUETAS_ACCIONAMIENTO = { tdf: 'Toma de fuerza', hidraulico: 'Hidráulico', 'motor-propio': 'Motor propio' };

function seccion(props, ...hijos) {
  return tarjeta(props, ...hijos);
}

function generarId(prefijo) {
  return `${prefijo}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

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
  const selectTema = crearCampoSelect({
    etiqueta: 'Tema',
    opciones: [
      { valor: 'claro', texto: 'Claro' },
      { valor: 'oscuro', texto: 'Oscuro' },
      { valor: 'auto', texto: 'Automático (según el sistema)' },
    ],
    valorInicial: estado0.preferencias.tema,
    ayuda: 'A pleno sol en campo el tema claro puede ser más legible; el oscuro es el default.',
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
    ayuda: 'El cálculo interno siempre es métrico; la conversión ocurre solo al mostrar y capturar.',
    alCambiar: (valor) =>
      almacen.actualizar((estado) => {
        estado.preferencias.unidades = valor;
      }, 'contexto'),
  });

  // ----------------------------------------------------------------
  // Grupos de parametros escalares
  // ----------------------------------------------------------------
  const zonaDerivados = el('div', { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } });
  const zonaAvisosGeometria = el('div', {});

  function pintarDerivados() {
    const p = ctx.estado().parametros;
    try {
      const g = geometria({
        largoTabla: p.geometria.largoTabla,
        anchoBarra: p.geometria.anchoBarra,
        numBoquillas: p.geometria.numBoquillas,
        distanciaReferencia: p.geometria.distanciaReferencia,
        espaciamientoCapturado: p.geometria.espaciamientoCapturado,
        espaciamientoMinimoPlausible: p.umbrales.espaciamientoMinimoPlausible,
        umbralDiscrepanciaPct: p.umbrales.umbralDiscrepanciaMetodos,
      });
      const sistema = ctx.sistema();
      const fila = (etiqueta, valor, unidadTexto, decimales) =>
        el(
          'div',
          { clase: 'resultado' },
          el('span', { clase: 'resultado__etiqueta' }, etiqueta),
          el('span', { clase: 'resultado__valor', estilo: { fontSize: '1.1rem' } },
            `${formatear(valor, decimales)} ${unidadTexto}`)
        );
      reemplazar(
        zonaDerivados,
        fila('Área por tabla', aSistema('areaChica', g.valores.areaM2, sistema), unidad('areaChica', sistema), 2),
        fila('Superficie por tabla', aSistema('superficie', g.valores.hectareasPorTabla, sistema), unidad('superficie', sistema), 6),
        fila('Tramos por tabla', g.valores.tramosPorTabla, '', 2),
        fila('Espaciamiento derivado', aSistema('distanciaCorta', g.valores.espaciamientoDerivado, sistema), unidad('distanciaCorta', sistema), 4)
      );
      reemplazar(zonaAvisosGeometria, ...pintarAvisos(g.avisos));
    } catch (error) {
      reemplazar(zonaAvisosGeometria,
        el('p', { clase: 'campo__error' }, String(error.message ?? error)));
    }
  }

  function tarjetaGrupo(nombreGrupo, defGrupo) {
    const campos = [];
    for (const [nombreCampo, defCampo] of Object.entries(defGrupo.campos)) {
      const campo = crearCampoNumerico({
        etiqueta: defCampo.etiqueta,
        unidad: defCampo.unidad,
        valorInicial: ctx.estado().parametros[nombreGrupo][nombreCampo],
        ayuda: `${defCampo.origen} Cotas: ${defCampo.min} a ${defCampo.max}${defCampo.unidad ? ` ${defCampo.unidad}` : ''}. Default: ${defCampo.valor === null ? 'pendiente de capturar' : defCampo.valor}.`,
        alCambiar: (valor, texto) => {
          if (texto.trim() === '' && defCampo.opcional) {
            campo.fijarError(null);
            almacen.actualizar((estado) => {
              estado.parametros[nombreGrupo][nombreCampo] = null;
            }, 'borrador');
            pintarDerivados();
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
        },
      });
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
        cuerpo: el('ul', { estilo: { paddingLeft: '1.2rem', fontSize: '0.9rem' } }, cambios),
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

    const extras = [];
    if (nombreGrupo === 'geometria') {
      extras.push(el('h3', { clase: 'etiqueta' }, 'Valores derivados (solo lectura)'), zonaDerivados, zonaAvisosGeometria);
    }
    return seccion({ titulo: defGrupo.etiqueta }, ...campos, ...extras, botonRestaurar);
  }

  // ----------------------------------------------------------------
  // Tractores y tabla de velocidades por marcha
  // ----------------------------------------------------------------
  const zonaTractor = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

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
        valorInicial: tractor[campo],
        ayuda: `Cotas: ${cota.min} a ${cota.max}${cota.unidad ? ` ${cota.unidad}` : ''}. Se aplica al salir del campo.`,
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
                { estilo: { paddingLeft: '1.2rem', fontSize: '0.9rem' } },
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
          }
        }, 'contexto');
      });
      nodos.push(entrada.elemento);
    }

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
          estilo: { height: '2.2rem', width: '5.5rem' },
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
        'Todos los defaults son estimaciones no verificadas contra el manual. La bandera distingue estimación, capturado y calibrado; el botón de calibrar está en la pestaña Avance.'),
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
    nodos.push(el('div', { estilo: { display: 'flex', gap: '0.5rem' } }, botonAlta, botonBaja));

    reemplazar(zonaTractor, nodos);
  }

  // ----------------------------------------------------------------
  // Equipos de aplicacion
  // ----------------------------------------------------------------
  const zonaEquipo = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

  function pintarEditorEquipo() {
    const estado = ctx.estado();
    const equipo = ctx.equipoActivo();
    const nodos = [];

    const selector = crearCampoSelect({
      etiqueta: 'Equipo a editar',
      opciones: estado.equipos.map((e) => ({ valor: e.id, texto: e.nombre })),
      valorInicial: equipo.id,
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

    nodos.push(
      crearCampoSelect({
        etiqueta: 'Tipo de bomba',
        opciones: TIPOS_BOMBA.map((t) => ({ valor: t, texto: ETIQUETAS_BOMBA[t] })),
        valorInicial: equipo.tipoBomba,
        ayuda: 'Positiva con regulador sostiene presión al bajar régimen (el volumen por hectárea SUBE); centrífuga sin regulacion se autocompensa. Hasta 40 puntos de dosis de diferencia.',
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
      const entrada = crearCampoNumerico({
        etiqueta: cota.etiqueta,
        unidad: cota.unidad,
        valorInicial: equipo[campo],
        ayuda: `Cotas: ${cota.min} a ${cota.max} ${cota.unidad}.${cota.opcional ? ' Opcional: vacio significa por capturar.' : ''}`,
        alCambiar: (valor, texto) => {
          if (texto.trim() === '' && cota.opcional) {
            entrada.fijarError(null);
            almacen.actualizar((e) => {
              e.equipos.find((x) => x.id === equipo.id)[campo] = null;
            }, 'borrador');
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
        },
      });
      nodos.push(entrada.elemento);
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
        ayuda: 'La pestaña de gasto de agua la precarga como boquilla del equipo.',
        alCambiar: (valor) =>
          almacen.actualizar((e) => {
            e.equipos.find((x) => x.id === equipo.id).boquillaId = valor || null;
          }, 'contexto'),
      }).elemento
    );

    const botonAlta = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Agregar equipo');
    botonAlta.addEventListener('click', () => {
      const nuevoId = generarId('equipo');
      almacen.actualizar((e) => {
        const plantilla = JSON.parse(JSON.stringify(EQUIPOS_SIEMBRA[0]));
        plantilla.id = nuevoId;
        plantilla.nombre = 'Equipo nuevo';
        e.equipos.push(plantilla);
        e.equipoActivoId = nuevoId;
      }, 'contexto');
    });
    const botonBaja = el('button', { clase: 'boton boton--destructivo boton--sm' }, 'Eliminar este equipo');
    botonBaja.addEventListener('click', async () => {
      if (ctx.estado().equipos.length <= 1) {
        mostrarToast('Debe quedar al menos un equipo.', { tipo: 'destructivo' });
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
    nodos.push(el('div', { estilo: { display: 'flex', gap: '0.5rem' } }, botonAlta, botonBaja));

    reemplazar(zonaEquipo, nodos);
  }

  // ----------------------------------------------------------------
  // Gases y rotametros
  // ----------------------------------------------------------------
  const zonaGas = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

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
          el('div', { clase: 'resultado' },
            el('span', { clase: 'resultado__etiqueta' },
              `Masa por pie cúbico estándar (${efectivo.valores.anulado ? 'ANULADA manualmente' : 'derivada'})`),
            el('span', { clase: 'resultado__valor', estilo: { fontSize: '1.2rem' } },
              `${formatear(efectivo.valores.gPorScf, 4)} g/SCF`)),
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
        valorInicial: gas[campo],
        ayuda:
          campo === 'gPorScfManual'
            ? 'Cuando está llena gana sobre el valor derivado; al vaciarla vuelve a derivarse del peso molecular.'
            : `Cotas: ${cota.min} a ${cota.max} ${cota.unidad}. La presión estándar es la de la escala del tubo; la atmosférica local va en el grupo Sitio.`,
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

  const zonaRotametro = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

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
        valorInicial: rotametro[campo],
        ayuda: 'La escala solo alimenta advertencias y el dibujo del tubo; nunca recorta un cálculo.',
        alCambiar: (valor) => {
          const veredicto = validarValor(cota, valor);
          if (!veredicto.ok) {
            entrada.fijarError(veredicto.mensaje);
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
  const zonaFactores = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

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
      const campoTeorica = crearCampoNumerico({ etiqueta: COTAS_FACTOR_DESVIACION.velocidadTeorica.etiqueta, unidad: 'km/h' });
      const campoMedida = crearCampoNumerico({ etiqueta: COTAS_FACTOR_DESVIACION.velocidadMedida.etiqueta, unidad: 'km/h' });
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
  const zonaCatalogo = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

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
    const campoCaudal = crearCampoNumerico({ etiqueta: 'Caudal de referencia', unidad: 'L/min', valorInicial: b.caudalRefLmin });
    const campoPresionRef = crearCampoNumerico({ etiqueta: 'Presión de referencia', unidad: 'bar', valorInicial: b.presionRefBar, ayuda: '3 bar es el estándar ISO.' });
    const campoPresionMin = crearCampoNumerico({ etiqueta: 'Presión mínima de operación', unidad: 'bar', valorInicial: b.presionMinBar });
    const campoPresionMax = crearCampoNumerico({ etiqueta: 'Presión máxima de operación', unidad: 'bar', valorInicial: b.presionMaxBar });
    const campoExponente = crearCampoNumerico({
      etiqueta: 'Exponente presión-caudal',
      valorInicial: b.exponente,
      ayuda: '0.5 para boquillas hidráulicas convencionales; inducción de aire y patron regulable pueden desviarse.',
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
      ayuda: 'No se comparan clases entre ediciones distintas: S572.3 subio umbrales e invirtio los colores C/VC.',
    });
    const campoNotas = el('input', { clase: 'entrada', id: 'boquilla-notas', value: b.notas ?? '' });

    // Mini editor de clases de gota por rango de presion
    const listaClases = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.4rem' } });
    const clases = (b.clasesGota ?? []).map((r) => ({ ...r }));
    function pintarClases() {
      reemplazar(
        listaClases,
        clases.map((rango, i) => {
          const min = el('input', { clase: 'entrada', inputmode: 'decimal', value: rango.presionMinBar, estilo: { width: '4.2rem', height: '2.2rem' }, 'aria-label': 'Presión mínima del rango' });
          const max = el('input', { clase: 'entrada', inputmode: 'decimal', value: rango.presionMaxBar, estilo: { width: '4.2rem', height: '2.2rem' }, 'aria-label': 'Presión máxima del rango' });
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
        `${estado.catalogo.length} boquillas. El caudal de catálogo es el de boquilla NUEVA: el desgaste solo se detecta con prueba de captura. Al capturar, si el caudal se desvia del tamaño ISO declarado más allá de la tolerancia, la aplicación lo advierte sin bloquear.`),
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
      descripcion: 'Parámetros, tractores, equipos, gases, rotámetros y catálogo vuelven a la siembra. La bitácora y las pruebas de captura NO se tocan. Exporta antes si tienes dudas.',
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
    mostrarToast('Aplicacion restaurada a la siembra (bitácora conservada).');
  });

  // ----------------------------------------------------------------
  // Montaje
  // ----------------------------------------------------------------
  panel.append(
    seccion(
      {
        titulo: 'Respaldo de datos',
        descripcion:
          'Los datos viven en este navegador y en este dispositivo. Si borras los datos del sitio o cambias de telefono, se pierden. Exporta con regularidad: es el único respaldo.',
      },
      el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
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
    seccion({ titulo: 'Equipos de aplicación' }, zonaEquipo),
    seccion({ titulo: 'Gases' }, zonaGas),
    seccion({ titulo: 'Rotametros' }, zonaRotametro),
    seccion({ titulo: 'Factores de desviación medidos' }, zonaFactores),
    seccion({ titulo: 'Catálogo de boquillas' }, zonaCatalogo),
    seccion({ titulo: 'Zona de riesgo' }, botonRestaurarTodo)
  );

  pintarDerivados();
  pintarReporteImportacion();
  pintarEditorTractor();
  pintarEditorEquipo();
  pintarEditorGas();
  pintarEditorRotametro();
  pintarFactores();
  pintarCatalogo();
}
