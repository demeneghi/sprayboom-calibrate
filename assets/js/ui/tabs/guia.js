// Pestaña Guía: el asistente por objetivo.
//
// Es la puerta de entrada de la aplicación y funciona así: se elige QUÉ
// se quiere obtener y el asistente pide, uno por uno, los datos que
// hacen falta —cada uno UNA sola vez— hasta la hoja de resultado, que se
// puede seguir moviendo.
//
// Por qué es un asistente aparte y no una guía que ordena las pestañas:
//
//   La primera versión de esta pantalla ponía las pestañas en fila y
//   decía en qué orden abrirlas. Se vio en campo que eso no bastaba: al
//   recorrer los pasos, la calibración pedía la presión en Gasto de agua
//   y otra vez en la Prueba de captura, y el espaciamiento y el objetivo
//   tres veces. La repetición no era de la guía; era que cada pantalla
//   declara sus campos por su cuenta, porque cada pantalla tiene que
//   poder usarse sola. La unidad de captura era la PANTALLA y tenía que
//   ser el DATO.
//
//   Las pestañas se quedan tal cual para cálculo manual, para recalibrar
//   una sola cosa y para ver el desglose completo. El asistente y las
//   pestañas escriben en el MISMO sitio (`estado.jornada`, ver
//   domain/datos.js), así que se puede saltar de uno a otro a media
//   calibración sin recapturar nada.

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
import { desviacionContraObjetivo, mezclaTanque } from '../../domain/mix.js';
import { forzamientoDesdeObjetivo } from '../../domain/forcing.js';
import { gPorScfEfectivo } from '../../domain/gas.js';
import { geometria } from '../../domain/speed.js';
import { RECETAS, recetaPorId, pasosDeReceta, progresoDeReceta, indiceDelSiguiente } from '../../domain/recetas.js';
import { valorDeDato, fijarDato, lecturaDeDatos } from '../dato.js';
import { montarPaso, volumenVigente } from './guia/pasos.js';

export const id = 'guia';

// ---------------------------------------------------------------------
// Estado del asistente
//
// Lo único que guarda es dónde va: cuál objetivo, en qué paso y cuáles
// pasos ya se vieron. Los DATOS no viven aquí; viven donde vive cada
// dato. Se escribe como 'contexto' porque cambia lo que se pinta.
// ---------------------------------------------------------------------
function estadoGuia(ctx) {
  const borrador = ctx.borrador('guia');
  return {
    recetaId: borrador.recetaId ?? null,
    indice: Number.isInteger(borrador.indice) ? borrador.indice : 0,
    vistos: Array.isArray(borrador.vistos) ? borrador.vistos : [],
  };
}

function fijarEstadoGuia(ctx, parcial) {
  ctx.almacen.actualizar((estado) => {
    if (!estado.borradores) estado.borradores = {};
    estado.borradores.guia = { ...(estado.borradores.guia ?? {}), ...parcial };
  }, 'contexto');
}

function instantanea(ctx, receta) {
  const guia = estadoGuia(ctx);
  const ids = new Set();
  for (const paso of pasosDeReceta(receta)) for (const dato of paso.datos) ids.add(dato);
  return {
    datos: lecturaDeDatos(ctx, [...ids]),
    lhaMedido: ctx.resultado('lhaMedido'),
    vistos: guia.vistos,
  };
}

// ---------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------
export function render(panel, ctx) {
  const guia = estadoGuia(ctx);
  const receta = recetaPorId(guia.recetaId);
  const sistema = ctx.sistema();

  if (!receta) {
    panel.append(tarjetaObjetivos(ctx));
    return;
  }

  // Dentro de un objetivo, la lista de objetivos se recoge a un renglón.
  // Con las cuatro tarjetas siempre arriba, el paso que se está
  // capturando empezaba por debajo del borde de la pantalla y había que
  // desplazar en CADA paso.
  panel.append(cabeceraDeReceta(ctx, receta));

  const pasos = pasosDeReceta(receta);
  const indice = Math.min(Math.max(guia.indice, 0), pasos.length);

  if (indice >= pasos.length) {
    panel.append(tarjetaHoja(ctx, receta, sistema, pasos.length));
    return;
  }
  panel.append(tarjetaPaso(ctx, receta, pasos, indice, sistema));
}

// ---------------------------------------------------------------------
// 1. Los objetivos
// ---------------------------------------------------------------------
function cabeceraDeReceta(ctx, receta) {
  const avance = progresoDeReceta(receta, instantanea(ctx, receta));
  return el(
    'div',
    { clase: 'cabecera-receta' },
    el(
      'span',
      { clase: 'cabecera-receta__cuerpo' },
      el('span', { clase: 'cabecera-receta__titulo' }, receta.titulo),
      el(
        'span',
        { clase: `badge ${avance.completa ? 'badge--exito' : 'badge--neutro'}` },
        avance.completa ? 'lista' : `${avance.resueltos} de ${avance.total}`
      )
    ),
    el(
      'button',
      {
        clase: 'boton boton--contorno boton--sm',
        id: `receta-opcion-${receta.id}`,
        'aria-pressed': 'true',
        alClic: () => fijarEstadoGuia(ctx, { recetaId: null, indice: 0 }),
      },
      'Cambiar'
    )
  );
}

function tarjetaObjetivos(ctx) {
  const opciones = RECETAS.map((receta) => {
    const avance = progresoDeReceta(receta, instantanea(ctx, receta));
    return el(
      'button',
      {
        clase: 'boton boton--contorno',
        id: `receta-opcion-${receta.id}`,
        'aria-pressed': 'false',
        alClic: () => {
          // Se entra por el primer dato que falta, no por el paso uno:
          // quien ya capturó la velocidad hoy no tiene por qué volver a
          // pasar por ella.
          fijarEstadoGuia(ctx, {
            recetaId: receta.id,
            indice: indiceDelSiguiente(receta, instantanea(ctx, receta)),
          });
        },
      },
      el('span', { clase: 'receta-opcion__titulo' }, receta.titulo),
      el('span', { clase: 'receta-opcion__objetivo texto-meta' }, receta.objetivo),
      el(
        'span',
        { clase: `badge ${avance.completa ? 'badge--exito' : 'badge--neutro'}` },
        avance.completa ? 'lista' : `${avance.resueltos} de ${avance.total}`
      )
    );
  });

  return tarjeta(
    {
      titulo: '¿Qué vas a calibrar?',
      descripcion: 'Elige el objetivo y te voy pidiendo lo que hace falta.',
      ayuda:
        'El asistente pregunta cada dato UNA vez y lo guarda donde lo leen todas las pantallas: ' +
        'si ya capturaste la velocidad hoy, no te la vuelve a pedir. Las pestañas siguen ahí ' +
        'para calcular a mano, recalibrar una sola cosa o ver el desglose completo, y trabajan ' +
        'sobre los mismos números. Para salir de un objetivo, el botón «Cambiar» de arriba.',
    },
    el('div', { clase: 'grupo-modo grupo-modo--columna' }, opciones)
  );
}

// ---------------------------------------------------------------------
// 2. El paso
// ---------------------------------------------------------------------
function tarjetaPaso(ctx, receta, pasos, indice, sistema) {
  const paso = pasos[indice];
  const guia = estadoGuia(ctx);

  // Entrar en un paso lo marca visto: es lo que deja que un paso de
  // confirmación —la barra, que ya viene llena de la configuración— se
  // dé por resuelto sin capturar nada, pero solo después de mirarlo.
  //
  // Se guarda como 'borrador' y NO como 'contexto' a propósito: marcar
  // visto no cambia nada de lo que se está pintando, y un re-render
  // desde dentro del propio render remontaría la tarjeta que se acaba de
  // construir.
  if (!guia.vistos.includes(paso.id)) {
    ctx.guardarBorrador('guia', { vistos: [...guia.vistos, paso.id] });
  }

  const zonaEstado = el('div', {});
  const montado = montarPaso(ctx, {
    paso,
    sistema,
    alCambiar: () => pintarEstado(),
  });

  function pintarEstado() {
    const avance = progresoDeReceta(receta, instantanea(ctx, receta));
    const estado = avance.pasos.find((p) => p.id === paso.id);
    reemplazar(
      zonaEstado,
      estado?.resuelto || paso.opcional
        ? []
        : [
            el(
              'p',
              { clase: 'ayuda' },
              'Puedes seguir sin esto: el resultado saldrá incompleto hasta que lo captures.'
            ),
          ]
    );
  }
  pintarEstado();

  const irA = (nuevo) => fijarEstadoGuia(ctx, { indice: nuevo });

  const navegacion = el(
    'div',
    { clase: 'nav-paso' },
    el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        'aria-label': indice > 0 ? `Paso anterior: ${pasos[indice - 1].titulo}` : 'No hay paso anterior',
        disabled: indice === 0,
        alClic: () => irA(indice - 1),
      },
      iconoSvg('flecha-izquierda')
    ),
    el(
      'button',
      { clase: 'boton nav-paso__siguiente', alClic: () => irA(indice + 1) },
      indice === pasos.length - 1 ? 'Ver el resultado' : `Siguiente: ${pasos[indice + 1].titulo}`
    )
  );

  return tarjeta(
    {
      titulo: paso.pregunta,
      descripcion: `Paso ${indice + 1} de ${pasos.length} · ${receta.titulo}`,
      ayuda: paso.porque,
    },
    montado.nodo,
    zonaEstado,
    navegacion,
    paso.opcional
      ? el(
          'button',
          {
            clase: 'boton boton--fantasma boton--bloque',
            alClic: () => irA(pasos.length),
          },
          'Saltar este paso'
        )
      : null
  );
}

// ---------------------------------------------------------------------
// 3. La hoja de resultado
//
// Aquí es donde el resultado se manipula. Las perillas escriben en el
// dato compartido —la presión y la velocidad son las mismas que ve Gasto
// de agua—, nunca en un estado propio del asistente: si la hoja guardara
// su copia, en dos toques la hoja y la pantalla estarían diciendo
// números distintos.
//
// Las perillas se construyen UNA vez y solo refrescan su cifra. Volver a
// montarlas en cada toque le quitaría el foco al botón que se acaba de
// pulsar, y ajustar de dos en dos décimas se hace pulsando varias veces
// seguidas.
// ---------------------------------------------------------------------
function tarjetaHoja(ctx, receta, sistema, totalPasos) {
  const ajustable = receta.ajustes.length > 0;
  const zonaCifras = el('div', { clase: 'pila-hoja' });
  const perillasVivas = [];

  function crearPerilla({ etiqueta, datoId, unidadTexto, salto, minimo, nota }) {
    const magnitud = magnitudDe(datoId);
    const cifra = el('span', { clase: 'perilla__valor mono', role: 'status' });
    const zonaNota = el('span', { clase: 'perilla__nota' });

    const mover = (direccion) => {
      const actual = valorDeDato(ctx, datoId).valor;
      if (!Number.isFinite(actual)) return;
      const enSistema = aSistema(magnitud, actual, sistema);
      const nuevo = Math.max(minimo, Number((enSistema + direccion * salto).toFixed(4)));
      fijarDato(ctx, datoId, deSistema(magnitud, nuevo, sistema));
      refrescarHoja();
    };

    const menos = el(
      'button',
      { clase: 'boton boton--contorno boton--icono', 'aria-label': `Bajar ${etiqueta}`, alClic: () => mover(-1) },
      iconoSvg('menos')
    );
    const mas = el(
      'button',
      { clase: 'boton boton--contorno boton--icono', 'aria-label': `Subir ${etiqueta}`, alClic: () => mover(1) },
      iconoSvg('mas')
    );

    const nodo = el(
      'div',
      { clase: 'perilla' },
      el('span', { clase: 'perilla__etiqueta texto-meta' }, etiqueta),
      el('div', { clase: 'perilla__control' }, menos, cifra, mas),
      zonaNota
    );

    function refrescar() {
      const vigente = valorDeDato(ctx, datoId);
      const hay = Number.isFinite(vigente.valor);
      cifra.textContent = hay
        ? `${formatear(aSistema(magnitud, vigente.valor, sistema), 2)} ${unidadTexto}`
        : '—';
      menos.disabled = !hay;
      mas.disabled = !hay;
      reemplazar(zonaNota, [nota ? nota(vigente) : null].filter(Boolean));
    }

    return { nodo, refrescar };
  }

  function construirPerillas() {
    const nodos = [];
    if (receta.ajustes.includes('presion')) {
      const perilla = crearPerilla({
        etiqueta: 'Presión en la boquilla',
        datoId: 'presionBar',
        unidadTexto: unidad('presion', sistema),
        salto: sistema === 'metrico' ? 0.1 : 1,
        minimo: sistema === 'metrico' ? 0.1 : 1,
        nota: () => {
          const { boquilla } = volumenVigente(ctx);
          const presion = valorDeDato(ctx, 'presionBar').valor;
          const fuera =
            boquilla &&
            Number.isFinite(presion) &&
            (presion < boquilla.presionMinBar || presion > boquilla.presionMaxBar);
          return fuera
            ? el('span', { clase: 'badge badge--advertencia' }, 'fuera del rango de presión de la ficha')
            : null;
        },
      });
      perillasVivas.push(perilla);
      nodos.push(perilla.nodo);
    }
    if (receta.ajustes.includes('velocidad')) {
      const perilla = crearPerilla({
        etiqueta: 'Velocidad de avance',
        datoId: 'velocidadKmh',
        unidadTexto: unidad('velocidad', sistema),
        salto: 0.1,
        minimo: 0.1,
        nota: (vigente) =>
          vigente.manual
            ? el(
                'button',
                {
                  clase: 'boton boton--fantasma boton--sm',
                  disabled: !Number.isFinite(vigente.respaldo?.valor),
                  alClic: () => {
                    // Volver a lo de Avance: se limpia la marca de captura
                    // manual y el dato vuelve a derivarse solo.
                    ctx.fijarJornada({ velocidadKmh: vigente.respaldo.valor, velocidadManual: false });
                    refrescarHoja();
                  },
                },
                'Volver a la de Avance'
              )
            : el(
                'span',
                { clase: 'texto-meta' },
                vigente.respaldo?.etiqueta ? `Viene de Avance: ${vigente.respaldo.etiqueta}.` : 'Viene de Avance.'
              ),
      });
      perillasVivas.push(perilla);
      nodos.push(perilla.nodo);
    }
    return nodos;
  }

  const zonaPerillas = ajustable ? el('div', { clase: 'pila-perillas' }, construirPerillas()) : null;

  function refrescarHoja() {
    const nodos = ajustable ? cifrasDeVolumen(ctx, sistema) : cifrasDeCierre(ctx, receta, sistema);
    reemplazar(zonaCifras, nodos.filter(Boolean));
    for (const perilla of perillasVivas) perilla.refrescar();
  }
  refrescarHoja();

  const volver = el(
    'button',
    {
      clase: 'boton boton--contorno boton--bloque',
      alClic: () => fijarEstadoGuia(ctx, { indice: totalPasos - 1 }),
    },
    'Volver al último paso'
  );

  return tarjeta(
    {
      titulo: 'Hoja de resultado',
      descripcion: ajustable
        ? 'Mueve la presión o la velocidad y mira el volumen cambiar.'
        : 'Las cifras que cierran esta calibración.',
      ayuda: ajustable
        ? 'Las dos perillas son las que de verdad tienes enfrente: el manómetro de la barra y la ' +
          'marcha. Moverlas aquí es lo mismo que capturarlas en Gasto de agua —es el mismo dato— ' +
          'y el volumen se recalcula por la misma ruta verificada, con la corrección por ' +
          'densidad del caldo.'
        : 'El desglose paso a paso, las advertencias del dominio y el guardado en bitácora viven ' +
          'en la pantalla de este cálculo. Aquí queda el número con el que sales al lote.',
    },
    zonaCifras,
    zonaPerillas,
    volver
  );
}

function magnitudDe(datoId) {
  return datoId === 'presionBar' ? 'presion' : 'velocidad';
}

// Volumen de aplicación, recalculado en vivo con lo que la jornada tiene
// ahora. Es la ruta verificada de Gasto de agua (domain/water.js).
function cifrasDeVolumen(ctx, sistema) {
  const unidadVolumen = unidad('volumenAplicacion', sistema);
  const nodos = [];
  const { boquilla, calculo, error } = volumenVigente(ctx);

  if (!calculo) {
    nodos.push(
      el(
        'p',
        { clase: 'texto-suave' },
        'Todavía falta algún dato para calcular el volumen. Vuelve al paso que corresponda y esta ' +
          'hoja se llena sola.'
      ),
      error ? el('p', { clase: 'ayuda' }, String(error.message ?? error)) : null
    );
    return nodos;
  }
  if (!resultadoConfiable(calculo)) {
    nodos.push(pintarResultadoNoVerificado('Volumen de aplicación'));
    return nodos;
  }

  const lha = calculo.valores.lhaPorBoquilla;
  nodos.push(
    pintarResultado({
      etiqueta: `Volumen con ${boquilla.fabricante} ${boquilla.modelo}`,
      valor: aSistema('volumenAplicacion', lha, sistema),
      unidad: unidadVolumen,
      decimales: 1,
      principal: true,
    })
  );

  const objetivo = valorDeDato(ctx, 'lhaObjetivo').valor;
  if (Number.isFinite(objetivo)) {
    nodos.push(
      el(
        'div',
        { clase: 'rejilla-cifras' },
        pintarResultado({
          etiqueta: 'Objetivo',
          valor: aSistema('volumenAplicacion', objetivo, sistema),
          unidad: unidadVolumen,
          decimales: 1,
        }),
        pintarResultado({
          etiqueta: 'Diferencia contra el objetivo',
          valor: desviacionContraObjetivo({ valor: lha, objetivo }),
          unidad: '%',
          decimales: 1,
        })
      )
    );
  }
  nodos.push(...pintarAvisos(calculo.avisos));

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

  nodos.push(
    el(
      'button',
      { clase: 'boton boton--contorno boton--bloque', alClic: () => ctx.navegarA('calibrar', 'gasto') },
      'Ver el desglose en Gasto de agua'
    )
  );
  return nodos;
}

// Cierre de las recetas cuyo número clave no es el volumen: la mezcla y
// el forzamiento. El cálculo es el mismo del dominio que corre su
// pantalla; lo que no se repite aquí es el desglose ni la bitácora.
function cifrasDeCierre(ctx, receta, sistema) {
  const nodos = [];
  const estado = ctx.estado();
  const unidadVolumen = unidad('volumen', sistema);

  if (receta.id === 'mezcla-tanque') {
    const datos = lecturaDeDatos(ctx, [
      'volumenAplicacionLha',
      'volumenTanqueL',
      'dosisCantidad',
      'modoDosis',
      'unidadProducto',
      'superficieObjetivoHa',
    ]);
    try {
      const resultado = mezclaTanque({
        volumenTanqueL: datos.volumenTanqueL,
        lhaAplicacion: datos.volumenAplicacionLha,
        dosis: Number.isFinite(datos.dosisCantidad)
          ? { modo: datos.modoDosis ?? 'por-ha', cantidad: datos.dosisCantidad }
          : null,
        areaObjetivoHa: Number.isFinite(datos.superficieObjetivoHa) ? datos.superficieObjetivoHa : null,
      });
      const unidadProducto = datos.unidadProducto ?? 'L';
      nodos.push(...pintarAvisos(resultado.avisos));
      if (Number.isFinite(resultado.valores.productoPorCarga)) {
        nodos.push(
          pintarResultado({
            etiqueta: 'Producto por carga',
            valor: resultado.valores.productoPorCarga,
            unidad: unidadProducto,
            decimales: 2,
            principal: true,
          })
        );
      }
      nodos.push(
        el(
          'div',
          { clase: 'rejilla-cifras' },
          pintarResultado({
            etiqueta: 'Hectáreas por carga',
            valor: resultado.valores.hectareasPorCarga,
            unidad: 'ha',
            decimales: 2,
          }),
          Number.isFinite(resultado.valores.aguaPorCarga)
            ? pintarResultado({
                etiqueta: 'Agua por carga',
                valor: aSistema('volumen', resultado.valores.aguaPorCarga, sistema),
                unidad: unidadVolumen,
                decimales: 0,
              })
            : null
        )
      );
    } catch (error) {
      nodos.push(
        el('p', { clase: 'texto-suave' }, 'Faltan el volumen del tanque o la dosis para armar la mezcla.'),
        el('p', { clase: 'ayuda' }, String(error?.message ?? error))
      );
    }
    nodos.push(
      el(
        'button',
        { clase: 'boton boton--contorno boton--bloque', alClic: () => ctx.navegarA('calibrar', 'mezcla') },
        'Ver la cuenta completa en Mezcla'
      )
    );
    return nodos;
  }

  if (receta.id === 'forzamiento-etileno') {
    const datos = lecturaDeDatos(ctx, ['volumenAplicacionLha', 'dosisObjetivoGha', 'scfm', 'psiManometrica']);
    const avanceDeAvance = ctx.avanceDeAvance();
    try {
      const g = geometria(ctx.parametrosGeometria()).valores;
      const resultado = forzamientoDesdeObjetivo({
        dosisObjetivoGha: datos.dosisObjetivoGha,
        volumenAguaLha: datos.volumenAplicacionLha,
        hectareasPorTabla: g.hectareasPorTabla,
        tiempoPorTablaS: avanceDeAvance.avance?.valores.tiempoTotalS ?? null,
        gPorScf: gPorScfEfectivo({ gas: ctx.gasActivo() }).valores.gPorScf,
        presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
        presionEstandarCalibracion: ctx.gasActivo()?.presionEstandarPsia,
        modoDespeje: 'scfm',
        psiDado: Number.isFinite(datos.psiManometrica) ? datos.psiManometrica : null,
        rotametro: ctx.rotametroActivo(),
        dosisReferenciaGha: estado.parametros.agronomicos.dosisEtilenoReferencia,
        toleranciaAlertaPct: estado.parametros.agronomicos.toleranciaAlerta,
      });
      // La masa por tabla queda a disposición de Gas etileno, igual que
      // la publica la pantalla de Forzamiento.
      ctx.guardarResultado('masaPorTablaG', {
        valor: resultado.valores.masaPorTablaG,
        origen: 'forzamiento',
        detalle: 'calculada en el asistente de forzamiento',
      });
      nodos.push(
        pintarResultado({
          etiqueta: 'Masa de etileno por tabla',
          valor: resultado.valores.masaPorTablaG,
          unidad: 'g',
          decimales: 1,
          principal: true,
        })
      );
      const scfmRequerido = resultado.valores.ajuste?.scfm ?? null;
      if (Number.isFinite(scfmRequerido)) {
        nodos.push(
          pintarResultado({
            etiqueta: 'Lectura de flotador requerida',
            valor: scfmRequerido,
            unidad: 'SCFM',
            decimales: 2,
          })
        );
      }
      nodos.push(...pintarAvisos(resultado.avisos));
    } catch (error) {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'Faltan la dosis de etileno, el volumen de agua o la velocidad para calcular el forzamiento.'
        ),
        el('p', { clase: 'ayuda' }, String(error?.message ?? error))
      );
    }
    nodos.push(
      el(
        'button',
        { clase: 'boton boton--contorno boton--bloque', alClic: () => ctx.navegarA('calibrar', 'gas') },
        'Ajustar el rotámetro en Gas etileno'
      )
    );
    return nodos;
  }

  return nodos;
}
