// Pestana Boquillas (dominio B): seleccion de boquilla con el flujo
// canonico OBJETIVO PRIMERO. Se captura el volumen objetivo, la
// velocidad y el espaciamiento; el dominio despeja el caudal requerido
// por boquilla (con verificacion redundante e ida y vuelta) y evalua el
// catalogo completo: candidatas dentro de su rango de presion ordenadas
// por cercania al centro del rango, y las fuera de rango en tabla
// aparte. Al elegir una candidata se precarga en Gasto de agua.
//
// Reglas duras respetadas aqui: cero formulas en la UI (todo llega de
// domain/), captura y muestra en el sistema de unidades activo con
// calculo interno metrico, y ningun numero sin desglose ni gate de
// verificacion.

import { el, reemplazar } from '../dom.js';
import {
  tarjeta,
  pintarAvisos,
  pintarDesglose,
  pintarResultado,
  pintarVerificacion,
  resultadoConfiable,
  pintarResultadoNoVerificado,
} from '../render.js';
import { crearCampoNumerico, crearCampoSelect } from '../campos.js';
import { formatear, formatearPorcentaje } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { estiloBadgeIso } from '../color.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import { seleccionDeBoquilla } from '../../domain/index.js';
import { geometria } from '../../domain/speed.js';
import { PORCIENTO } from '../../domain/constants.js';
import { filaIso } from '../../data/iso-colors.js';
import {
  ORDEN_CLASES,
  EDICIONES_S572,
  CLASES_S572_1,
  GUIA_USO_GOTA,
} from '../../data/droplet-classes.js';

export const id = 'boquillas';

// Nombres legibles de las clases; son identicos en ambas ediciones del
// estandar (solo cambian umbrales y colores, no los nombres).
const NOMBRE_CLASE = new Map(CLASES_S572_1.categorias.map((c) => [c.simbolo, c.nombre]));

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const unidadVolumen = unidad('volumenAplicacion', sistema);
  const unidadVelocidad = unidad('velocidad', sistema);
  const unidadEspaciamiento = unidad('distanciaCorta', sistema);
  const unidadPresion = unidad('presion', sistema);
  const unidadCaudal = unidad('caudal', sistema);
  const decimalesPresion = sistema === 'imperial' ? 1 : 2;

  function parametrosGeometria() {
    const p = ctx.estado().parametros;
    return {
      largoTabla: p.geometria.largoTabla,
      anchoBarra: p.geometria.anchoBarra,
      numBoquillas: p.geometria.numBoquillas,
      distanciaReferencia: p.geometria.distanciaReferencia,
      espaciamientoCapturado: p.geometria.espaciamientoCapturado,
      espaciamientoMinimoPlausible: p.umbrales.espaciamientoMinimoPlausible,
      umbralDiscrepanciaPct: p.umbrales.umbralDiscrepanciaMetodos,
    };
  }

  // El borrador guarda SIEMPRE en base metrica; al pintar se convierte
  // al sistema activo (toPrecision evita colas de punto flotante en el
  // input tras una ida y vuelta metrico-imperial).
  function aCampo(magnitud, valorMetrico) {
    if (valorMetrico === null || valorMetrico === undefined || !Number.isFinite(valorMetrico)) {
      return null;
    }
    return Number(aSistema(magnitud, valorMetrico, sistema).toPrecision(6));
  }

  // Precarga del espaciamiento: el efectivo de la geometria configurada
  // (capturado si existe; si no, ancho de barra entre numero de
  // boquillas, derivado por el dominio). Editable solo en el borrador.
  function espaciamientoPrecargaM() {
    if (Number.isFinite(borrador.espaciamientoM)) return borrador.espaciamientoM;
    try {
      return geometria(parametrosGeometria()).valores.espaciamientoEfectivo;
    } catch {
      return null;
    }
  }

  // ---------------- Captura del objetivo ----------------
  const campoVolumen = crearCampoNumerico({
    etiqueta: 'Volumen de aplicación objetivo',
    unidad: unidadVolumen,
    valorInicial: aCampo('volumenAplicacion', borrador.lhaObjetivo ?? null),
    ayuda: 'Objetivo primero: el volumen agronómico manda y de él se despeja el caudal que cada boquilla debe entregar.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { lhaObjetivo: deSistema('volumenAplicacion', valor, sistema) });
      recalcular();
    },
  });
  const campoVelocidad = crearCampoNumerico({
    etiqueta: 'Velocidad de trabajo',
    unidad: unidadVelocidad,
    valorInicial: aCampo('velocidad', borrador.velocidadKmh ?? null),
    ayuda: 'Usa la velocidad real (medida o corregida) de la pestaña Avance: la teórica sin verificar sesga la selección.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { velocidadKmh: deSistema('velocidad', valor, sistema) });
      recalcular();
    },
  });
  const campoEspaciamiento = crearCampoNumerico({
    etiqueta: 'Espaciamiento entre boquillas',
    unidad: unidadEspaciamiento,
    valorInicial: aCampo('distanciaCorta', espaciamientoPrecargaM()),
    ayuda: 'Precargado del espaciamiento efectivo de la geometría configurada; editarlo aquí no cambia la configuración.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { espaciamientoM: deSistema('distanciaCorta', valor, sistema) });
      recalcular();
    },
  });
  const selectClase = crearCampoSelect({
    etiqueta: 'Clase de gota deseada',
    opciones: [
      { valor: '', texto: 'Cualquiera' },
      ...ORDEN_CLASES.map((s) => ({ valor: s, texto: `${s} — ${NOMBRE_CLASE.get(s) ?? s}` })),
    ],
    valorInicial: borrador.claseDeseada ?? '',
    ayuda: 'Filtra por la clase que el fabricante publica a la presión requerida. Las boquillas sin clase publicada quedan fuera del filtro.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { claseDeseada: valor || null });
      recalcular();
    },
  });
  const selectEdicion = crearCampoSelect({
    etiqueta: 'Edición del estándar de gota',
    opciones: [
      { valor: '', texto: 'Cualquiera' },
      ...EDICIONES_S572.map((e) => ({ valor: e, texto: e })),
    ],
    valorInicial: borrador.edicionEstandar ?? '',
    ayuda: 'No se comparan clases entre ediciones: S572.3 subió los umbrales de las clases gruesas e invirtió los colores de C y VC respecto a S572.1. Solo filtra junto con una clase deseada.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { edicionEstandar: valor || null });
      recalcular();
    },
  });

  // ---------------- Zonas de resultado ----------------
  const zonaResultado = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });
  const zonaCandidatas = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

  function badgeIso(boquilla) {
    const fila = boquilla.tamanoIso ? filaIso(boquilla.tamanoIso) : null;
    return fila?.hex
      ? el('span', { clase: 'badge badge--iso', estilo: estiloBadgeIso(fila.hex) }, boquilla.tamanoIso)
      : el('span', { clase: 'badge badge--contorno' }, boquilla.tamanoIso ?? '—');
  }

  function celdaClase(candidata) {
    if (!candidata.clase) {
      return el('span', { clase: 'texto-suave' }, 'sin clase publicada');
    }
    return el(
      'span',
      {},
      el('strong', {}, candidata.clase),
      candidata.boquilla.edicionEstandar
        ? el('span', { clase: 'texto-suave' }, ` ${candidata.boquilla.edicionEstandar}`)
        : null
    );
  }

  function presionTextoDe(bar) {
    return `${formatear(aSistema('presion', bar, sistema), decimalesPresion)} ${unidadPresion}`;
  }

  function usarEnGasto(candidata) {
    ctx.guardarBorrador('gasto', {
      boquillaId: candidata.boquilla.id,
      presionBar: candidata.presionRequeridaBar,
    });
    mostrarToast(
      `${candidata.boquilla.modelo} a ${presionTextoDe(candidata.presionRequeridaBar)} precargada en Gasto de agua.`
    );
    ctx.navegarA('calibrar', 'gasto');
  }

  function tablaCandidatas(candidatas) {
    return el(
      'div',
      { clase: 'scroll-x' },
      el(
        'table',
        { clase: 'tabla tabla--numerica' },
        el(
          'thead',
          {},
          el(
            'tr',
            {},
            el('th', {}, 'ISO'),
            el('th', {}, 'Modelo'),
            el('th', {}, `Presión (${unidadPresion})`),
            el('th', {}, 'Gota'),
            el('th', {}, 'Centrado'),
            el('th', {}, '')
          )
        ),
        el(
          'tbody',
          {},
          candidatas.map((c) => {
            const botonUsar = el(
              'button',
              {
                clase: 'boton boton--contorno boton--sm',
                'aria-label': `Usar ${c.boquilla.modelo} en Gasto de agua`,
              },
              'Usar en Gasto de agua'
            );
            botonUsar.addEventListener('click', () => usarEnGasto(c));
            return el(
              'tr',
              {},
              el('td', {}, badgeIso(c.boquilla)),
              el('td', {}, `${c.boquilla.fabricante} ${c.boquilla.modelo}`),
              el('td', { clase: 'numero' }, formatear(aSistema('presion', c.presionRequeridaBar, sistema), decimalesPresion)),
              el('td', {}, celdaClase(c)),
              el(
                'td',
                { clase: 'numero' },
                `${formatearPorcentaje((1 - c.distanciaAlCentro) * PORCIENTO, 0)} del centro`
              ),
              el('td', {}, botonUsar)
            );
          })
        )
      )
    );
  }

  function tablaFueraDeRango(fuera, abierta) {
    return el(
      'details',
      { clase: 'desglose', open: abierta || null },
      el('summary', {}, `Fuera de rango (${fuera.length} ${fuera.length === 1 ? 'boquilla' : 'boquillas'})`),
      el(
        'div',
        { clase: 'desglose__cuerpo' },
        el(
          'p',
          { clase: 'ayuda' },
          'Para lograr el caudal exigirían una presión fuera del rango del fabricante: aunque el caudal saliera exacto, el patrón y el tamaño de gota serían defectuosos.'
        ),
        el(
          'div',
          { clase: 'scroll-x' },
          el(
            'table',
            { clase: 'tabla tabla--numerica' },
            el(
              'thead',
              {},
              el(
                'tr',
                {},
                el('th', {}, 'ISO'),
                el('th', {}, 'Modelo'),
                el('th', {}, `Presión req. (${unidadPresion})`),
                el('th', {}, `Rango (${unidadPresion})`),
                el('th', {}, 'Estado')
              )
            ),
            el(
              'tbody',
              {},
              fuera.map((c) =>
                el(
                  'tr',
                  {},
                  el('td', {}, badgeIso(c.boquilla)),
                  el('td', {}, `${c.boquilla.fabricante} ${c.boquilla.modelo}`),
                  el('td', { clase: 'numero' }, formatear(aSistema('presion', c.presionRequeridaBar, sistema), decimalesPresion)),
                  el(
                    'td',
                    { clase: 'numero' },
                    `${formatear(aSistema('presion', c.boquilla.presionMinBar, sistema), decimalesPresion)} a ${formatear(aSistema('presion', c.boquilla.presionMaxBar, sistema), decimalesPresion)}`
                  ),
                  el('td', {}, el('span', { clase: 'badge badge--destructivo' }, 'fuera de rango'))
                )
              )
            )
          )
        )
      )
    );
  }

  // ---------------- Calculo ----------------
  function recalcular() {
    const estado = ctx.estado();
    const nodosResultado = [];
    const nodosCandidatas = [];

    const lhaObjetivo = deSistema('volumenAplicacion', campoVolumen.obtener(), sistema);
    const velocidadKmh = deSistema('velocidad', campoVelocidad.obtener(), sistema);
    const espaciamientoM = deSistema('distanciaCorta', campoEspaciamiento.obtener(), sistema);
    const claseDeseada = selectClase.obtener() || null;
    const edicionEstandar = selectEdicion.obtener() || null;

    if (lhaObjetivo === null || velocidadKmh === null || espaciamientoM === null) {
      nodosResultado.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'Captura el volumen objetivo, la velocidad y el espaciamiento para calcular el caudal requerido.'
        )
      );
      nodosCandidatas.push(
        el('p', { clase: 'texto-suave' }, 'Las candidatas aparecen cuando el caudal requerido está calculado.')
      );
    } else {
      try {
        // Guardas de plausibilidad del espaciamiento capturado (dominio):
        // detecta captura en centimetros y discrepancia contra el
        // derivado del ancho entre el numero de boquillas.
        try {
          const g = geometria({ ...parametrosGeometria(), espaciamientoCapturado: espaciamientoM });
          nodosResultado.push(...pintarAvisos(g.avisos));
        } catch {
          // La geometria configurada no bloquea la seleccion: el despeje
          // solo depende de los tres valores capturados.
        }

        const resultado = seleccionDeBoquilla({
          catalogo: estado.catalogo,
          lhaObjetivo,
          velocidadKmh,
          espaciamientoM,
          claseDeseada,
          edicionEstandar,
        });
        const avisosSinCandidatas = resultado.avisos.filter((a) => a.codigo === 'sin-candidatas');
        const avisosDelCaudal = resultado.avisos.filter((a) => a.codigo !== 'sin-candidatas');
        const confiable = resultadoConfiable(resultado);

        nodosResultado.push(...pintarAvisos(avisosDelCaudal));
        if (confiable) {
          nodosResultado.push(
            pintarResultado({
              etiqueta: 'Caudal requerido por boquilla',
              valor: aSistema('caudal', resultado.valores.caudalRequeridoLmin, sistema),
              unidad: unidadCaudal,
              decimales: 3,
              principal: true,
            })
          );
        } else {
          nodosResultado.push(pintarResultadoNoVerificado('Caudal requerido por boquilla'));
        }
        nodosResultado.push(pintarVerificacion(resultado.verificacion), pintarDesglose(resultado.desglose));

        if (!confiable) {
          nodosCandidatas.push(
            el(
              'p',
              { clase: 'texto-suave' },
              'No se listan candidatas: el caudal requerido no está verificado.'
            )
          );
        } else {
          const candidatas = resultado.valores.candidatas;
          const fueraDeRango = resultado.valores.fueraDeRango;

          nodosCandidatas.push(...pintarAvisos(avisosSinCandidatas));
          if (estado.catalogo.length === 0) {
            nodosCandidatas.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'El catálogo está vacío: agrega boquillas en Sistema, Configuración.'
              )
            );
          } else if (claseDeseada && candidatas.length === 0) {
            nodosCandidatas.push(
              el(
                'p',
                { clase: 'ayuda' },
                'El filtro de clase de gota también recorta la lista: prueba con «Cualquiera» para ver todas las boquillas que logran el caudal.'
              )
            );
          }

          if (candidatas.length > 0) {
            nodosCandidatas.push(
              el(
                'p',
                { clase: 'ayuda' },
                candidatas.length === 1
                  ? '1 boquilla logra el caudal dentro de su rango de presión.'
                  : `${candidatas.length} boquillas logran el caudal dentro de su rango de presión, ordenadas por cercanía al centro del rango.`
              ),
              tablaCandidatas(candidatas)
            );
          }
          if (fueraDeRango.length > 0) {
            nodosCandidatas.push(tablaFueraDeRango(fueraDeRango, candidatas.length === 0));
          }
        }
      } catch (error) {
        nodosResultado.push(
          el(
            'div',
            { clase: 'alerta alerta--destructiva', role: 'alert' },
            el('p', { clase: 'alerta__descripcion' }, String(error.message ?? error))
          )
        );
        nodosCandidatas.push(
          el('p', { clase: 'texto-suave' }, 'Corrige la captura para poder evaluar el catálogo.')
        );
      }
    }

    reemplazar(zonaResultado, nodosResultado);
    reemplazar(zonaCandidatas, nodosCandidatas);
  }

  // ---------------- Guia informativa de gota ----------------
  const guiaGota = el(
    'div',
    { estilo: { display: 'flex', flexDirection: 'column', gap: '0.6rem' } },
    el(
      'p',
      { clase: 'texto-suave' },
      'La gota fina mejora la cobertura y la retención pero deriva más; la gruesa reduce la deriva y puede comprometer la cobertura en aplicaciones de contacto.'
    ),
    Object.entries(GUIA_USO_GOTA).map(([simbolo, texto]) =>
      el(
        'div',
        { estilo: { display: 'flex', gap: '0.5rem', alignItems: 'baseline' } },
        el('span', { clase: 'badge badge--contorno' }, `${simbolo} ${NOMBRE_CLASE.get(simbolo) ?? ''}`.trim()),
        el('span', { clase: 'texto-suave' }, texto)
      )
    )
  );

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Selección de boquilla',
        descripcion:
          'Flujo objetivo primero: el volumen, la velocidad y el espaciamiento definen el caudal que la boquilla debe entregar.',
      },
      campoVolumen.elemento,
      campoVelocidad.elemento,
      campoEspaciamiento.elemento,
      selectClase.elemento,
      selectEdicion.elemento
    ),
    tarjeta({ titulo: 'Caudal requerido por boquilla' }, zonaResultado),
    tarjeta(
      {
        titulo: 'Boquillas candidatas',
        descripcion:
          'Ordenadas por cercanía al centro de su rango de presión: a media presión el gasto y el tamaño de gota son más estables.',
      },
      zonaCandidatas,
      el(
        'p',
        { clase: 'ayuda' },
        'Cambiar el tamaño de boquilla es mejor palanca que forzar la presión: para duplicar el caudal hay que cuadruplicar la presión.'
      )
    ),
    tarjeta(
      {
        titulo: 'Guía de tamaño de gota',
        descripcion:
          'Informativa, sin recomendación automática: la decisión depende del producto y de las condiciones del día, que la aplicación no conoce.',
      },
      guiaGota
    )
  );

  recalcular();
}
