// Pestana Guia: "¿que vas a calibrar?".
//
// Es la puerta de entrada de la aplicacion y hace tres cosas:
//
//   1. Ofrece los objetivos reales de campo (las recetas de
//      domain/recetas.js), no la lista de pantallas.
//   2. Pinta los PASOS de la receta elegida con su estado —listo, falta,
//      de otro dia— y su procedencia. Cada paso abre la pantalla que ya
//      existe; ninguno es obligatorio y ninguno captura aqui.
//   3. Cierra con la HOJA DE RESULTADO: las cifras de la receta juntas y,
//      donde tiene sentido, las dos perillas que quien calibra tiene
//      fisicamente en el tractor —presion y velocidad— recalculando en
//      vivo.
//
// Lo que NO es: un wizard. No hay carril, no hay "siguiente" obligatorio
// y no se guarda nada propio salvo cual receta esta activa. Los datos
// siguen viviendo en las pantallas de siempre, y esta solo los lee.

import { el, reemplazar } from '../dom.js';
import {
  tarjeta,
  pintarAvisos,
  pintarResultado,
  pintarResultadoNoVerificado,
  resultadoConfiable,
} from '../render.js';
import { formatear } from '../formato.js';
import { iconoSvg } from '../svg.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import { volumenConBoquilla } from '../../domain/water.js';
import { desviacionContraObjetivo } from '../../domain/mix.js';
import { RECETAS, progresoDeReceta } from '../../domain/recetas.js';
import { instantaneaDe, recetaActiva, recetaActivaId, fijarRecetaActiva } from '../receta.js';
import { fuenteEspaciamiento } from '../heredado.js';

export const id = 'guia';

export function render(panel, ctx) {
  const receta = recetaActiva(ctx);
  const instantanea = instantaneaDe(ctx);

  panel.append(tarjetaObjetivos(ctx, instantanea));
  if (receta) {
    panel.append(tarjetaPasos(ctx, receta, instantanea));
    panel.append(tarjetaHoja(ctx, receta, ctx.sistema()));
  }
}

// ---------------------------------------------------------------------
// 1. Los objetivos
// ---------------------------------------------------------------------
function tarjetaObjetivos(ctx, instantanea) {
  const activa = recetaActivaId(ctx);

  const opciones = RECETAS.map((receta) => {
    const avance = progresoDeReceta(receta, instantanea);
    const elegida = receta.id === activa;
    return el(
      'button',
      {
        clase: 'boton boton--contorno',
        id: `receta-opcion-${receta.id}`,
        // La seleccion se dice por atributo y la pinta components.css con
        // el acento del modulo, como cualquier grupo de opciones.
        'aria-pressed': elegida ? 'true' : 'false',
        alClic: () => fijarRecetaActiva(ctx, elegida ? null : receta.id),
      },
      el('span', { clase: 'receta-opcion__titulo' }, receta.titulo),
      el('span', { clase: 'receta-opcion__objetivo texto-meta' }, receta.objetivo),
      el(
        'span',
        { clase: `badge ${avance.completa ? 'badge--exito' : 'badge--neutro'}` },
        avance.completa ? 'lista' : `${avance.listos} de ${avance.total}`
      )
    );
  });

  return tarjeta(
    {
      titulo: '¿Qué vas a calibrar?',
      descripcion: 'Elige el objetivo y la guía te dice el orden.',
      ayuda:
        'Cada objetivo es una lista de pasos sobre las pantallas de siempre: aquí no se captura ' +
        'nada y ningún paso es obligatorio. Puedes seguir la lista, saltarte un paso o entrar ' +
        'directo a la pestaña que quieras, como hasta ahora. El chip de cada objetivo dice ' +
        'cuántos pasos ya tienen su dato. Para salir de la guía, vuelve a pulsar el objetivo ' +
        'elegido.',
    },
    el('div', { clase: 'grupo-modo grupo-modo--columna' }, opciones)
  );
}

// ---------------------------------------------------------------------
// 2. Los pasos
// ---------------------------------------------------------------------
function tarjetaPasos(ctx, receta, instantanea) {
  const avance = progresoDeReceta(receta, instantanea);

  const filas = avance.pasos.map((paso, i) =>
    el(
      'button',
      {
        clase: 'paso-receta',
        dataset: { listo: paso.listo ? 'true' : 'false' },
        'aria-label': `Paso ${i + 1}, ${paso.titulo}: ${paso.listo ? 'ya tiene dato' : 'falta'}. Abrir.`,
        alClic: () => ctx.navegarA(paso.seccion, paso.tab),
      },
      el('span', { clase: 'paso-receta__numero mono', 'aria-hidden': 'true' }, String(i + 1)),
      el(
        'span',
        { clase: 'paso-receta__cuerpo' },
        el(
          'span',
          { clase: 'paso-receta__titulo' },
          paso.titulo,
          paso.opcional ? el('span', { clase: 'badge badge--contorno' }, 'opcional') : null,
          chipDePaso(paso)
        ),
        // Un paso listo dice SIEMPRE de donde salio su numero: en verde y
        // sin procedencia se leeria como un dato propio, y entonces nadie
        // sospecha cuando esta viejo.
        el(
          'span',
          { clase: 'paso-receta__detalle texto-meta' },
          paso.listo ? paso.detalle ?? paso.porque : paso.detalle
        )
      )
    )
  );

  const siguiente = avance.siguiente;

  return tarjeta(
    {
      titulo: receta.titulo,
      // El objetivo NO se repite aqui: ya esta en el boton elegido, tres
      // dedos mas arriba, y en un telefono de 390px cada renglon de
      // prosa repetida es un renglon menos de pasos a la vista.
      ayuda:
        'El orden no es un capricho: cada paso necesita el número del anterior. La velocidad ' +
        'manda sobre el volumen por hectárea, y ese manda sobre la dosis del tanque y sobre el ' +
        'etileno. Si es de otro día, el paso lo dice, porque un aforo de la semana pasada puede ' +
        'no ser el de la barra de hoy.',
    },
    el('div', { clase: 'pila-pasos' }, filas),
    avance.hayViejos
      ? el(
          'p',
          { clase: 'ayuda' },
          'Hay pasos con datos de otro día. No están mal por eso, pero revísalos antes de aplicar.'
        )
      : null,
    siguiente
      ? el(
          'button',
          {
            clase: 'boton boton--bloque',
            alClic: () => ctx.navegarA(siguiente.seccion, siguiente.tab),
          },
          avance.completa ? `Ir a ${siguiente.titulo}` : `Continuar: ${siguiente.titulo}`
        )
      : el('p', { clase: 'ayuda' }, 'Todos los pasos de esta guía ya tienen su dato.')
  );
}

function chipDePaso(paso) {
  if (!paso.listo) return el('span', { clase: 'badge badge--advertencia' }, 'falta');
  if (paso.viejo) return el('span', { clase: 'badge badge--advertencia' }, 'de otro día');
  return el('span', { clase: 'badge badge--exito' }, 'listo');
}

// ---------------------------------------------------------------------
// 3. La hoja de resultado
//
// Aqui es donde el resultado se manipula. Las perillas escriben en el
// BORRADOR DE LA PANTALLA que manda sobre ese dato —la presion y la
// velocidad son de Gasto de agua—, nunca en un estado propio de la guia:
// si la hoja guardara su copia, en dos toques la guia y la pantalla
// estarian diciendo numeros distintos.
//
// Las perillas se construyen UNA vez y solo refrescan su cifra. Volver a
// montarlas en cada toque le quitaria el foco al boton que se acaba de
// pulsar, y ajustar de dos en dos decimas se hace pulsando varias veces
// seguidas.
// ---------------------------------------------------------------------
function tarjetaHoja(ctx, receta, sistema) {
  const ajustable = receta.ajustes.length > 0;
  const zonaCifras = el('div', { clase: 'pila-hoja' });
  const perillasVivas = [];

  const unidadPresion = unidad('presion', sistema);
  const unidadVelocidad = unidad('velocidad', sistema);
  const unidadVolumen = unidad('volumenAplicacion', sistema);

  // Todo se lee en cada refresco: la hoja no guarda copias.
  function lecturas() {
    const estado = ctx.estado();
    const borrador = ctx.borrador('gasto');
    const equipo = ctx.equipoActivo();
    const heredada = ctx.velocidadDeAvance();
    const boquillaId = borrador.boquillaId ?? equipo?.boquillaId ?? null;
    const esp = fuenteEspaciamiento(ctx);
    return {
      boquilla: estado.catalogo.find((b) => b.id === boquillaId) ?? null,
      presionBar: numero(borrador.presionBar ?? equipo?.presionCalibracion),
      velocidadKmh: borrador.velocidadManual
        ? numero(borrador.velocidadKmh)
        : numero(heredada.velocidadKmh),
      velocidadManual: borrador.velocidadManual === true,
      heredadaKmh: numero(heredada.velocidadKmh),
      etiquetaVelocidad: heredada.etiqueta,
      espaciamientoM: numero(borrador.espaciamientoM ?? esp.valor),
      anchoBarraM: numero(borrador.anchoBarraM ?? equipo?.anchoBarra),
      numBoquillas: numero(borrador.numBoquillas ?? equipo?.numBoquillas),
      densidadRelativa: estado.parametros.caldo.densidadRelativa,
      umbralDiscrepanciaPct: estado.parametros.umbrales.umbralDiscrepanciaMetodos,
      lhaObjetivo: numero(ctx.objetivoVolumenLha()),
    };
  }

  // Una perilla: menos, cifra y mas. El paso va en la unidad que se lee
  // en el fierro, no en la interna: en imperial se mueve de psi en psi.
  function crearPerilla({ etiqueta, magnitud, unidadTexto, salto, minimo, leer, fijar, nota }) {
    const cifra = el('span', { clase: 'perilla__valor mono', role: 'status' });
    const zonaNota = el('span', { clase: 'perilla__nota' });

    const mover = (direccion) => {
      const actual = leer();
      if (!Number.isFinite(actual)) return;
      const enSistema = aSistema(magnitud, actual, sistema);
      const nuevo = Math.max(minimo, Number((enSistema + direccion * salto).toFixed(4)));
      fijar(deSistema(magnitud, nuevo, sistema));
      refrescarHoja();
    };

    const menos = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        'aria-label': `Bajar ${etiqueta}`,
        alClic: () => mover(-1),
      },
      iconoSvg('menos')
    );
    const mas = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        'aria-label': `Subir ${etiqueta}`,
        alClic: () => mover(1),
      },
      iconoSvg('mas')
    );

    const nodo = el(
      'div',
      { clase: 'perilla' },
      el('span', { clase: 'perilla__etiqueta texto-meta' }, etiqueta),
      el('div', { clase: 'perilla__control' }, menos, cifra, mas),
      zonaNota
    );

    function refrescar(datos) {
      const valor = leer();
      const hay = Number.isFinite(valor);
      cifra.textContent = hay
        ? `${formatear(aSistema(magnitud, valor, sistema), 2)} ${unidadTexto}`
        : '—';
      menos.disabled = !hay;
      mas.disabled = !hay;
      reemplazar(zonaNota, [nota ? nota(datos) : null].filter(Boolean));
    }

    return { nodo, refrescar };
  }

  function construirPerillas() {
    const nodos = [];
    if (receta.ajustes.includes('presion')) {
      const perilla = crearPerilla({
        etiqueta: 'Presión en la boquilla',
        magnitud: 'presion',
        unidadTexto: unidadPresion,
        salto: sistema === 'metrico' ? 0.1 : 1,
        minimo: sistema === 'metrico' ? 0.1 : 1,
        leer: () => lecturas().presionBar,
        fijar: (bar) => ctx.guardarBorrador('gasto', { presionBar: bar }),
        nota: (datos) => {
          const fuera =
            datos.boquilla &&
            Number.isFinite(datos.presionBar) &&
            (datos.presionBar < datos.boquilla.presionMinBar ||
              datos.presionBar > datos.boquilla.presionMaxBar);
          return fuera
            ? el(
                'span',
                { clase: 'badge badge--advertencia' },
                'fuera del rango de presión de la ficha'
              )
            : null;
        },
      });
      perillasVivas.push(perilla);
      nodos.push(perilla.nodo);
    }
    if (receta.ajustes.includes('velocidad')) {
      const perilla = crearPerilla({
        etiqueta: 'Velocidad de avance',
        magnitud: 'velocidad',
        unidadTexto: unidadVelocidad,
        salto: 0.1,
        minimo: 0.1,
        leer: () => lecturas().velocidadKmh,
        // Mover la velocidad aqui es capturarla a mano en Gasto de agua:
        // esa pantalla ya trata la captura manual como la que manda sobre
        // lo heredado de Avance, y el boton la devuelve.
        fijar: (kmh) => ctx.guardarBorrador('gasto', { velocidadKmh: kmh, velocidadManual: true }),
        nota: (datos) =>
          datos.velocidadManual
            ? el(
                'button',
                {
                  clase: 'boton boton--fantasma boton--sm',
                  disabled: !Number.isFinite(datos.heredadaKmh),
                  alClic: () => {
                    ctx.guardarBorrador('gasto', {
                      velocidadKmh: datos.heredadaKmh,
                      velocidadManual: false,
                    });
                    refrescarHoja();
                  },
                },
                'Volver a la de Avance'
              )
            : el(
                'span',
                { clase: 'texto-meta' },
                datos.etiquetaVelocidad
                  ? `Viene de Avance: ${datos.etiquetaVelocidad}.`
                  : 'Viene de Avance.'
              ),
      });
      perillasVivas.push(perilla);
      nodos.push(perilla.nodo);
    }
    return nodos;
  }

  const zonaPerillas = ajustable ? el('div', { clase: 'pila-perillas' }, construirPerillas()) : null;

  function refrescarHoja() {
    const datos = lecturas();
    const nodos = [];

    if (ajustable) {
      let calculo = null;
      let error = null;
      try {
        calculo = volumenConBoquilla({
          boquilla: datos.boquilla,
          presionBar: datos.presionBar,
          velocidadKmh: datos.velocidadKmh,
          espaciamientoM: datos.espaciamientoM,
          anchoBarraM: datos.anchoBarraM,
          numBoquillas: datos.numBoquillas,
          densidadRelativa: datos.densidadRelativa,
          umbralDiscrepanciaPct: datos.umbralDiscrepanciaPct,
        });
      } catch (e) {
        error = e;
      }

      if (!calculo) {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Todavía no hay con qué calcular el volumen: completa los pasos de arriba y esta hoja ' +
              'se llena sola.'
          ),
          error ? el('p', { clase: 'ayuda' }, String(error.message ?? error)) : null
        );
      } else if (!resultadoConfiable(calculo)) {
        // Regla dura del proyecto: si la verificacion redundante fallo, no
        // se pinta el numero.
        nodos.push(pintarResultadoNoVerificado('Volumen de aplicación'));
      } else {
        const lha = calculo.valores.lhaPorBoquilla;
        nodos.push(
          pintarResultado({
            etiqueta: `Volumen con ${datos.boquilla.fabricante} ${datos.boquilla.modelo}`,
            valor: aSistema('volumenAplicacion', lha, sistema),
            unidad: unidadVolumen,
            decimales: 1,
            principal: true,
          })
        );
        if (Number.isFinite(datos.lhaObjetivo)) {
          nodos.push(
            el(
              'div',
              { clase: 'rejilla-cifras' },
              pintarResultado({
                etiqueta: 'Objetivo',
                valor: aSistema('volumenAplicacion', datos.lhaObjetivo, sistema),
                unidad: unidadVolumen,
                decimales: 1,
              }),
              pintarResultado({
                etiqueta: 'Diferencia contra el objetivo',
                valor: desviacionContraObjetivo({ valor: lha, objetivo: datos.lhaObjetivo }),
                unidad: '%',
                decimales: 1,
              })
            )
          );
        }
        nodos.push(...pintarAvisos(calculo.avisos));
      }
    }

    nodos.push(...cifrasDeCierre(ctx, receta, sistema));
    reemplazar(zonaCifras, nodos.filter(Boolean));
    for (const perilla of perillasVivas) perilla.refrescar(datos);
  }

  refrescarHoja();

  return tarjeta(
    {
      titulo: 'Hoja de resultado',
      descripcion: ajustable
        ? 'Mueve la presión o la velocidad y mira el volumen cambiar.'
        : 'Las cifras que cierran esta guía.',
      ayuda: ajustable
        ? 'Las dos perillas son las que de verdad tienes enfrente: el manómetro de la barra y la ' +
          'marcha. Moverlas aquí es lo mismo que capturarlas en Gasto de agua, y el volumen se ' +
          'recalcula por la misma ruta verificada, con la corrección por densidad del caldo. La ' +
          'velocidad queda como captura manual hasta que la devuelvas a la de Avance.'
        : 'Esta guía no trae perillas porque su número clave no es el volumen por hectárea, sino ' +
          'una cuenta que depende de él: la dosis del tanque o la masa de etileno. Esa cuenta se ' +
          've completa —con su desglose y sus advertencias— en su propia pantalla.',
    },
    zonaCifras,
    zonaPerillas,
    ajustable
      ? el(
          'p',
          { clase: 'ayuda' },
          'Las perillas escriben en Gasto de agua: ahí queda el desglose paso a paso, la clase de ' +
            'gota y el guardado en bitácora.'
        )
      : null,
    ajustable
      ? el(
          'button',
          {
            clase: 'boton boton--contorno boton--bloque',
            alClic: () => ctx.navegarA('calibrar', 'gasto'),
          },
          'Ver el desglose en Gasto de agua'
        )
      : null
  );
}

// Cifras de cierre: el resultado de la receta que NO se manipula aqui,
// con el enlace a la pantalla donde se ve la cuenta completa.
function cifrasDeCierre(ctx, receta, sistema) {
  const nodos = [];
  const unidadVolumen = unidad('volumenAplicacion', sistema);

  if (receta.ajustes.length > 0) {
    const medido = ctx.resultado('lhaMedido');
    if (Number.isFinite(medido?.valor)) {
      nodos.push(
        pintarResultado({
          etiqueta: 'Aforado en la prueba de captura',
          valor: aSistema('volumenAplicacion', medido.valor, sistema),
          unidad: unidadVolumen,
          decimales: 1,
        }),
        el(
          'p',
          { clase: 'ayuda' },
          'El aforo mide la barra como está hoy; el cálculo describe una boquilla nueva. Cuando ' +
            'difieren mucho, manda el aforo.'
        )
      );
    }
    return nodos;
  }

  const vigente = ctx.volumenAplicacionReal();
  if (Number.isFinite(vigente?.valor)) {
    nodos.push(
      pintarResultado({
        etiqueta: 'Volumen de aplicación vigente',
        valor: aSistema('volumenAplicacion', vigente.valor, sistema),
        unidad: unidadVolumen,
        decimales: 1,
      }),
      el('p', { clase: 'ayuda' }, `Viene de ${vigente.detalle ?? 'la última calibración'}.`)
    );
  }

  if (receta.id === 'forzamiento-etileno') {
    const masa = ctx.resultado('masaPorTablaG');
    if (Number.isFinite(masa?.valor)) {
      nodos.push(
        pintarResultado({
          etiqueta: 'Masa de etileno por tabla',
          valor: masa.valor,
          unidad: 'g',
          decimales: 1,
          principal: true,
        })
      );
    }
    nodos.push(
      el(
        'button',
        {
          clase: 'boton boton--contorno boton--bloque',
          alClic: () => ctx.navegarA('calibrar', 'gas'),
        },
        'Ajustar el rotámetro en Gas etileno'
      )
    );
  }

  if (receta.id === 'mezcla-tanque') {
    nodos.push(
      el(
        'button',
        {
          clase: 'boton boton--contorno boton--bloque',
          alClic: () => ctx.navegarA('calibrar', 'mezcla'),
        },
        'Ver la cuenta del tanque en Mezcla'
      )
    );
  }

  return nodos;
}

function numero(x) {
  return Number.isFinite(x) ? x : null;
}
