// Pestana Boquillas (dominio B): seleccion de boquilla con el flujo
// canonico OBJETIVO PRIMERO. Se captura el volumen objetivo, la
// velocidad y el espaciamiento; el dominio despeja el caudal requerido
// por boquilla (con verificacion redundante e ida y vuelta) y evalua el
// catalogo completo: candidatas dentro de su rango de presion ordenadas
// por cercania al centro del rango, y las fuera de rango en tabla
// aparte. Al elegir una candidata se precarga en Gasto de agua.
//
// Las curvas presion-caudal del catalogo estan medidas con agua: cuando
// la densidad relativa del caldo difiere de 1, el despeje usa el
// objetivo equivalente en agua (volumenEquivalenteEnAgua del dominio,
// igual que el modo inverso de gasto.js) y se muestra ese equivalente
// con su explicacion y su paso de desglose. Con densidad 1 nada cambia.
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
import { crearCampoDato } from '../dato.js';
import { formatear, formatearPorcentaje } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { estiloBadgeIso } from '../color.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import { seleccionDeBoquilla } from '../../domain/index.js';
import { volumenEquivalenteEnAgua } from '../../domain/nozzles.js';
import { geometria, paso, redondeoLegible } from '../../domain/speed.js';
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
  const unidadEspaciamiento = unidad('distanciaCorta', sistema);
  const unidadPresion = unidad('presion', sistema);
  const unidadCaudal = unidad('caudal', sistema);
  const decimalesPresion = sistema === 'imperial' ? 1 : 2;

  // El borrador guarda SIEMPRE en base metrica; al pintar se convierte
  // al sistema activo (toPrecision evita colas de punto flotante en el
  // input tras una ida y vuelta metrico-imperial).
  function aCampo(magnitud, valorMetrico) {
    if (valorMetrico === null || valorMetrico === undefined || !Number.isFinite(valorMetrico)) {
      return null;
    }
    return Number(aSistema(magnitud, valorMetrico, sistema).toPrecision(6));
  }

  // ---------------- Captura del objetivo ----------------
  // Los tres datos que esta pantalla comparte con el asistente y con
  // Gasto de agua los monta `ui/dato.js` desde el registro
  // (domain/datos.js), y se guardan en el sitio unico de cada uno: el
  // objetivo de la jornada es UNO, no uno por pantalla. Capturarlo tres
  // veces era capturarlo tres veces distinto.
  const campoVolumen = crearCampoDato(ctx, 'lhaObjetivo', {
    sistema,
    etiqueta: 'Volumen de aplicación objetivo',
    ayuda:
      'Primero el objetivo: de él sale el caudal que debe dar cada boquilla. Viene el último ' +
      'que capturaste.',
    alCambiar: () => recalcular(),
  });
  // Hereda por defecto la velocidad capturada en Avance: la teorica sin
  // verificar sesga la seleccion.
  const campoVelocidad = crearCampoDato(ctx, 'velocidadKmh', {
    sistema,
    etiqueta: 'Velocidad de trabajo',
    alCambiar: () => recalcular(),
  });
  const campoEspaciamiento = crearCampoDato(ctx, 'espaciamientoM', {
    sistema,
    alCambiar: () => recalcular(),
  });
  const selectClase = crearCampoSelect({
    etiqueta: 'Clase de gota deseada',
    opciones: [
      { valor: '', texto: 'Cualquiera' },
      ...ORDEN_CLASES.map((s) => ({ valor: s, texto: `${s} — ${NOMBRE_CLASE.get(s) ?? s}` })),
    ],
    valorInicial: borrador.claseDeseada ?? '',
    ayuda: 'Filtra por la clase que el fabricante publica a esa presión. Las que no la publican quedan fuera.',
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
    ayuda: 'No compares clases de ediciones distintas: la S572.3 subió los umbrales de las clases gruesas e invirtió los colores de C y VC. Solo filtra si elegiste una clase.',
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
          'Para dar ese caudal necesitan una presión fuera del rango del fabricante: la gota y el patrón saldrían mal.'
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

    // Los campos de dato devuelven base metrica: la conversion vive
    // dentro del campo, no repetida aqui.
    const lhaObjetivo = campoVolumen.obtenerBase();
    const velocidadKmh = campoVelocidad.obtenerBase();
    const espaciamientoM = campoEspaciamiento.obtenerBase();
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
          const g = geometria({ ...ctx.parametrosGeometria(), espaciamientoCapturado: espaciamientoM });
          nodosResultado.push(...pintarAvisos(g.avisos));
        } catch {
          // La geometria configurada no bloquea la seleccion: el despeje
          // solo depende de los tres valores capturados.
        }

        // Las curvas presion-caudal del catalogo estan medidas con agua:
        // con un caldo mas denso se despeja contra el objetivo
        // equivalente en agua (el dominio lo calcula; el caldo, mas
        // lento, entrega en campo el objetivo real). Con densidad 1 el
        // equivalente es el mismo objetivo y nada visible cambia.
        const dr = estado.parametros.caldo.densidadRelativa;
        const objetivoEnAgua =
          dr === 1
            ? lhaObjetivo
            : volumenEquivalenteEnAgua({ volumenCaldoLha: lhaObjetivo, densidadRelativa: dr });

        const resultado = seleccionDeBoquilla({
          catalogo: estado.catalogo,
          lhaObjetivo: objetivoEnAgua,
          velocidadKmh,
          espaciamientoM,
          claseDeseada,
          edicionEstandar,
        });
        const avisosSinCandidatas = resultado.avisos.filter((a) => a.codigo === 'sin-candidatas');
        const avisosDelCaudal = resultado.avisos.filter((a) => a.codigo !== 'sin-candidatas');
        const confiable = resultadoConfiable(resultado);
        // El desglose arranca en la correccion por densidad para que la
        // cadena objetivo de caldo -> objetivo en agua -> caudal quede
        // auditable con los numeros sustituidos.
        const desglose =
          dr === 1
            ? resultado.desglose
            : [
                paso(
                  'Objetivo equivalente en agua',
                  'v_agua = v_caldo * raíz(densidad_relativa)',
                  `${redondeoLegible(lhaObjetivo)} * raíz(${redondeoLegible(dr)})`,
                  objetivoEnAgua,
                  'L/ha'
                ),
                ...resultado.desglose,
              ];

        nodosResultado.push(...pintarAvisos(avisosDelCaudal));
        if (dr !== 1) {
          nodosResultado.push(
            pintarResultado({
              etiqueta: 'Objetivo equivalente en agua',
              valor: aSistema('volumenAplicacion', objetivoEnAgua, sistema),
              unidad: unidadVolumen,
              decimales: 1,
              ayuda:
                'Las fichas de las boquillas están medidas con agua. Este es el volumen que ' +
                'habría que buscar SI se aplicara agua para que el caldo, más denso y más ' +
                'lento, entregue en campo el objetivo real. Contra este número se eligen las ' +
                'candidatas.',
            }),
            el(
              'p',
              { clase: 'ayuda' },
              `Densidad relativa del caldo: ${formatear(dr, 2)}. Un caldo más denso sale más despacio ` +
                'por la misma boquilla (q_caldo = q_agua / raíz(dr)), así que el caudal y las ' +
                'presiones se despejan contra su equivalente en agua.'
            )
          );
        }
        if (confiable) {
          nodosResultado.push(
            pintarResultado({
              etiqueta: 'Caudal requerido por boquilla',
              valor: aSistema('caudal', resultado.valores.caudalRequeridoLmin, sistema),
              unidad: unidadCaudal,
              ayuda:
                'Lo que tiene que salir por CADA boquilla para lograr el volumen objetivo a esta ' +
                'velocidad y con este espaciamiento. Es el número contra el que se busca en el ' +
                'catálogo: la boquilla sirve si lo alcanza dentro de su rango de presión.',
              decimales: 3,
              principal: true,
            })
          );
        } else {
          nodosResultado.push(pintarResultadoNoVerificado('Caudal requerido por boquilla'));
        }
        nodosResultado.push(pintarVerificacion(resultado.verificacion), pintarDesglose(desglose));

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
        ayuda:
          'Cambiar el tamaño de boquilla es mejor palanca que forzar la presión: para duplicar ' +
          'el caudal hay que cuadruplicar la presión.',
      },
      zonaCandidatas
    ),
    tarjeta(
      {
        titulo: 'Guía de tamaño de gota',
        descripcion:
          'Informativa, sin recomendación automática: la decisión depende del producto y de las condiciones del día, que la aplicación no conoce.',
        ayuda:
          'La gota fina cubre y se retiene mejor, pero deriva más. La gruesa deriva menos y ' +
          'puede quedarse corta de cobertura en productos de contacto.',
      },
      guiaGota
    )
  );

  recalcular();
}
