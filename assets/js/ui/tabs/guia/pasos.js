// Los pasos del asistente.
//
// Cada paso pide UN dato (o el puñado que se captura de un solo golpe
// porque no se entienden por separado, como la boquilla y su presión), y
// cierra con lo que ese dato produce, para que se vea que sirvió de
// algo.
//
// Reglas que se repiten en todos:
//
//   1. Ningún paso guarda un estado propio. Escribe en el sitio único
//      del dato —la jornada o el borrador de su pantalla— y ese mismo
//      número es el que ve la pestaña. Ver domain/datos.js.
//   2. Ningún paso calcula. Llama al dominio ya probado, igual que la
//      pestaña equivalente.
//   3. Lo que el paso deja resuelto se dice con el número a la vista, no
//      con una palomita.

import { el, reemplazar } from '../../dom.js';
import { pintarAvisos, pintarResultado, resultadoConfiable, pintarResultadoNoVerificado } from '../../render.js';
import { crearCampoNumerico } from '../../campos.js';
import { crearCombobox } from '../../combobox.js';
import { crearCampoDato, valorDeDato, fijarDato, lecturaDeDatos, DATOS } from '../../dato.js';
import { crearTrioBarra } from '../../trio-barra.js';
import { formatear, formatearTiempo } from '../../formato.js';
import { estiloBadgeIso } from '../../color.js';
import { filaIso } from '../../../data/iso-colors.js';
import { aSistema, unidad } from '../../../domain/units.js';
import { marchasDeTractor, modoGeometriaDe } from '../../../domain/speed.js';
import { volumenConBoquilla, caudalRequerido } from '../../../domain/water.js';
import { seleccionarBoquillas, clasificarGota } from '../../../domain/nozzles.js';
import { estadisticaCaptura } from '../../../domain/capture.js';

const MARCA_ORIGEN = { medido: ' medida', fabrica: '' };

// ---------------------------------------------------------------------
// Paso genérico: los campos de sus datos, uno debajo de otro
// ---------------------------------------------------------------------
function pasoDatos(ctx, { paso, sistema, alCambiar }) {
  const pila = el('div', { clase: 'pila-campos' });
  for (const id of paso.datos) {
    const campo = crearCampoDato(ctx, id, { sistema, alCambiar });
    pila.append(campo.elemento);
  }
  return { nodo: pila };
}

// ---------------------------------------------------------------------
// La barra: los tres datos amarrados
//
// Ancho, número de boquillas y espaciamiento cumplen
// `ancho = número * espaciamiento`, así que aquí se confirman DOS y el
// tercero se calcula. Es el mismo componente que monta Gasto de agua y
// escribe en los mismos datos de la jornada: pintarlos sueltos dejaría
// dos formas de capturar la misma geometría, y una de las dos podría
// quedar sin cuadrar.
// ---------------------------------------------------------------------
function pasoBarra(ctx, { sistema, alCambiar }) {
  const equipo = ctx.equipoActivo();
  const modoJornada = valorDeDato(ctx, 'geometriaCalculada');
  const trio = crearTrioBarra({
    sistema,
    valores: {
      anchoBarraM: valorDeDato(ctx, 'anchoBarraM').valor,
      numBoquillas: valorDeDato(ctx, 'numBoquillas').valor,
      espaciamientoM: valorDeDato(ctx, 'espaciamientoM').valor,
    },
    calcular: modoJornada.manual ? modoJornada.valor : modoGeometriaDe(equipo),
    umbralDiscrepanciaPct: ctx.estado().parametros.umbrales.umbralDiscrepanciaMetodos,
    espaciamientoMinimoPlausible: ctx.estado().parametros.umbrales.espaciamientoMinimoPlausible,
    etiquetas: {
      anchoBarra: DATOS.anchoBarraM.etiqueta,
      numBoquillas: DATOS.numBoquillas.etiqueta,
      espaciamiento: DATOS.espaciamientoM.etiqueta,
    },
    ayudas: {
      anchoBarra: DATOS.anchoBarraM.ayuda,
      numBoquillas: DATOS.numBoquillas.ayuda,
      espaciamiento: DATOS.espaciamientoM.ayuda,
    },
    alCambiar: ({ valores, calcular }) => {
      fijarDato(ctx, 'anchoBarraM', valores.anchoBarraM);
      fijarDato(ctx, 'numBoquillas', valores.numBoquillas);
      fijarDato(ctx, 'espaciamientoM', valores.espaciamientoM);
      fijarDato(ctx, 'geometriaCalculada', calcular);
      if (alCambiar) alCambiar();
    },
  });
  return { nodo: trio.elemento };
}

// ---------------------------------------------------------------------
// Velocidad: marcha con su régimen, o segundos por tramo
//
// Escribe en el borrador de Avance —modo, marcha, régimen y segundos—,
// que es de donde `ctx.velocidadDeAvance()` deriva la velocidad para
// TODA la aplicación. El asistente no guarda una velocidad propia: eso
// volvería a crear dos números con el mismo nombre.
// ---------------------------------------------------------------------
function pasoVelocidad(ctx, { sistema, alCambiar }) {
  const borrador = ctx.borrador('avance');
  const tractor = ctx.tractorActivo();
  const unidadVelocidad = unidad('velocidad', sistema);
  let modo = borrador.modo ?? 'marcha';

  const zona = el('div', { clase: 'pila-campos' });
  const resumen = el('div', {});

  const botonMarcha = el('button', { clase: 'boton boton--contorno' }, 'Con marcha y régimen');
  const botonReporte = el('button', { clase: 'boton boton--contorno' }, 'Desde reporte de campo');

  const cuadricula = el('div', {
    clase: 'cuadricula-marchas',
    estilo: { '--marchas-por-rango': String(tractor?.marchasPorRango ?? 3) },
    role: 'group',
    'aria-label': 'Marchas del tractor',
  });
  const botonesMarcha = new Map();
  for (const fila of tractor ? marchasDeTractor(tractor) : []) {
    const boton = el(
      'button',
      { clase: 'marcha', 'aria-pressed': 'false', disabled: fila.kmhNominal === null || null },
      el('span', { clase: 'marcha__nombre' }, fila.etiqueta),
      el(
        'span',
        { clase: 'marcha__velocidad' },
        fila.kmhNominal === null
          ? 'pendiente'
          : `${formatear(aSistema('velocidad', fila.kmhNominal, sistema), 1)} ${unidadVelocidad}${MARCA_ORIGEN[fila.origen] ?? ''}`
      )
    );
    boton.addEventListener('click', () => {
      const marcha = { rango: fila.rango, marcha: fila.marcha, tractorId: tractor.id };
      ctx.guardarBorrador('avance', { modo: 'marcha', marcha });
      // La marcha elegida queda como marcha de TRABAJO del tractor, igual
      // que al elegirla en Avance: es un dato del tractor y es lo que
      // hace llegar el tiempo por tabla a Gas etileno y a Forzamiento.
      recordarMarcha(fila.rango, fila.marcha);
      pintarSeleccion();
      refrescar();
    });
    botonesMarcha.set(`${fila.rango}-${fila.marcha}`, boton);
    cuadricula.append(boton);
  }

  function recordarMarcha(rango, marcha) {
    const guardada = ctx.tractorActivo()?.marchaHabitual;
    if (guardada && guardada.rango === rango && guardada.marcha === marcha) return;
    ctx.almacen.actualizar((e) => {
      const t = e.tractores.find((x) => x.id === tractor.id);
      if (t) t.marchaHabitual = { rango, marcha };
    }, 'datos');
  }

  function pintarSeleccion() {
    const elegida = ctx.borrador('avance').marcha;
    for (const [clave, boton] of botonesMarcha) {
      const activa = elegida && `${elegida.rango}-${elegida.marcha}` === clave;
      boton.setAttribute('aria-pressed', activa ? 'true' : 'false');
    }
  }

  const campoRpm = crearCampoNumerico({
    etiqueta: 'Régimen del motor',
    unidad: 'rpm',
    valorInicial: borrador.rpm ?? tractor?.regimenHabitual ?? null,
    ayuda: 'El que marca el tacómetro trabajando. Viene el habitual de este tractor.',
    alCambiar: (valor) => {
      ctx.guardarBorrador('avance', { rpm: valor });
      refrescar();
    },
  });

  const campoSegundos = crearCampoNumerico({
    etiqueta: 'Segundos por tramo',
    unidad: 's',
    valorInicial: borrador.segundosPorTramo ?? null,
    ayuda:
      'Lo que tardó el tractor en recorrer el tramo de referencia. Es la velocidad REAL: ya ' +
      'trae el patinaje.',
    alCambiar: (valor) => {
      ctx.guardarBorrador('avance', { segundosPorTramo: valor });
      refrescar();
    },
  });

  const zonaMarcha = el('div', { clase: 'pila-campos' }, cuadricula, campoRpm.elemento);
  const zonaReporte = el('div', { clase: 'pila-campos' }, campoSegundos.elemento);

  function pintarModo() {
    botonMarcha.setAttribute('aria-pressed', modo === 'marcha' ? 'true' : 'false');
    botonReporte.setAttribute('aria-pressed', modo === 'reporte' ? 'true' : 'false');
    zonaMarcha.classList.toggle('oculto', modo !== 'marcha');
    zonaReporte.classList.toggle('oculto', modo !== 'reporte');
  }
  botonMarcha.addEventListener('click', () => {
    modo = 'marcha';
    ctx.guardarBorrador('avance', { modo });
    pintarModo();
    refrescar();
  });
  botonReporte.addEventListener('click', () => {
    modo = 'reporte';
    ctx.guardarBorrador('avance', { modo });
    pintarModo();
    refrescar();
  });

  function refrescar() {
    const velocidad = ctx.velocidadDeAvance();
    const avance = ctx.avanceDeAvance();
    const nodos = [];
    if (Number.isFinite(velocidad.velocidadKmh)) {
      nodos.push(
        pintarResultado({
          etiqueta: 'Velocidad de avance',
          valor: aSistema('velocidad', velocidad.velocidadKmh, sistema),
          unidad: unidadVelocidad,
          decimales: 2,
          principal: true,
        })
      );
      if (avance.avance) {
        nodos.push(
          pintarResultado({
            etiqueta: 'Tiempo por tabla',
            valor: avance.avance.valores.tiempoTotalS,
            unidad: 's',
            decimales: 0,
          }),
          el('p', { clase: 'ayuda' }, formatearTiempo(avance.avance.valores.tiempoTotalS))
        );
      }
      nodos.push(...pintarAvisos(velocidad.avisos));
    } else {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          modo === 'marcha'
            ? 'Elige la marcha con la que vas y confirma el régimen.'
            : 'Captura los segundos que tardó el tractor en el tramo de referencia.'
        )
      );
    }
    reemplazar(resumen, nodos);
    if (alCambiar) alCambiar();
  }

  zona.append(el('div', { clase: 'grupo-modo' }, botonMarcha, botonReporte), zonaMarcha, zonaReporte, resumen);
  pintarModo();
  pintarSeleccion();
  refrescar();
  return { nodo: zona };
}

// ---------------------------------------------------------------------
// Boquilla y presión
// ---------------------------------------------------------------------
function pasoBoquilla(ctx, { sistema, alCambiar }) {
  const catalogo = ctx.estado().catalogo;
  const unidadCaudal = unidad('caudal', sistema);
  const unidadPresion = unidad('presion', sistema);
  const zona = el('div', { clase: 'pila-campos' });
  const resumen = el('div', {});

  const opciones = catalogo.map((b) => {
    const iso = b.tamanoIso ? filaIso(b.tamanoIso) : null;
    return {
      valor: b.id,
      texto: `${b.fabricante} ${b.modelo}`,
      detalle: `${formatear(aSistema('caudal', b.caudalRefLmin, sistema), 2)} ${unidadCaudal} a ${formatear(aSistema('presion', b.presionRefBar, sistema), 1)} ${unidadPresion}`,
      colorHex: iso?.hex ?? null,
    };
  });

  const combo = crearCombobox({
    id: 'guia-boquilla',
    opciones,
    placeholder: 'Buscar en el catálogo…',
    alSeleccionar: (opcion) => {
      fijarDato(ctx, 'boquillaId', opcion.valor);
      refrescar();
    },
  });
  {
    const inicial = catalogo.find((b) => b.id === valorDeDato(ctx, 'boquillaId').valor) ?? null;
    if (inicial) combo.fijarTexto(`${inicial.fabricante} ${inicial.modelo}`);
  }
  const campoBoquilla = el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'etiqueta', for: 'guia-boquilla' }, 'Boquilla montada en la barra'),
    combo.elemento
  );

  const campoPresion = crearCampoDato(ctx, 'presionBar', { sistema, alCambiar: () => refrescar() });

  function refrescar() {
    const nodos = [];
    const boquillaId = valorDeDato(ctx, 'boquillaId').valor;
    const boquilla = catalogo.find((b) => b.id === boquillaId) ?? null;
    const presionBar = valorDeDato(ctx, 'presionBar').valor;
    if (boquilla && Number.isFinite(presionBar)) {
      const clase = clasificarGota({ boquilla, presionBar });
      const fuera = presionBar < boquilla.presionMinBar || presionBar > boquilla.presionMaxBar;
      nodos.push(
        el(
          'p',
          {},
          el('span', { clase: 'badge badge--secundario' }, `${boquilla.fabricante} ${boquilla.modelo}`),
          clase ? el('span', { clase: 'badge badge--contorno' }, `gota ${clase}`) : null,
          fuera
            ? el('span', { clase: 'badge badge--advertencia' }, 'fuera del rango de la ficha')
            : null
        ),
        el(
          'p',
          { clase: 'ayuda' },
          `Rango de la ficha: ${formatear(aSistema('presion', boquilla.presionMinBar, sistema), 1)} a ` +
            `${formatear(aSistema('presion', boquilla.presionMaxBar, sistema), 1)} ${unidadPresion}.`
        )
      );
    }
    reemplazar(resumen, nodos);
    if (alCambiar) alCambiar();
  }

  zona.append(campoBoquilla, campoPresion.elemento, resumen);
  refrescar();
  return { nodo: zona };
}

// ---------------------------------------------------------------------
// Candidatas del catálogo
//
// Con la velocidad, el espaciamiento y el objetivo ya capturados, este
// paso no vuelve a pedir nada: calcula el caudal requerido y ofrece las
// boquillas que lo logran dentro de su rango de presión. Elegir una fija
// la boquilla Y su presión de trabajo.
// ---------------------------------------------------------------------
function pasoCandidatas(ctx, { sistema, alCambiar }) {
  const zona = el('div', {});
  const unidadPresion = unidad('presion', sistema);
  const unidadCaudal = unidad('caudal', sistema);

  function refrescar() {
    const nodos = [];
    const { velocidadKmh, espaciamientoM, lhaObjetivo, boquillaId } = lecturaDeDatos(ctx, [
      'velocidadKmh',
      'espaciamientoM',
      'lhaObjetivo',
      'boquillaId',
    ]);
    try {
      const requerido = caudalRequerido({ lhaObjetivo, velocidadKmh, espaciamientoM });
      const caudalRequeridoLmin = requerido.valores.caudalLmin;
      nodos.push(
        pintarResultado({
          etiqueta: 'Caudal requerido por boquilla',
          valor: aSistema('caudal', caudalRequeridoLmin, sistema),
          unidad: unidadCaudal,
          decimales: 3,
        })
      );
      const { candidatas, avisos } = seleccionarBoquillas({
        catalogo: ctx.estado().catalogo,
        caudalRequeridoLmin,
      });
      nodos.push(...pintarAvisos(avisos));
      const lista = el('div', { clase: 'pila-pasos' });
      for (const candidata of candidatas.slice(0, 6)) {
        const b = candidata.boquilla;
        const elegida = b.id === boquillaId;
        const iso = b.tamanoIso ? filaIso(b.tamanoIso) : null;
        lista.append(
          el(
            'button',
            {
              clase: 'paso-receta',
              'aria-pressed': elegida ? 'true' : 'false',
              alClic: () => {
                fijarDato(ctx, 'boquillaId', b.id);
                // La presión que hace que ESA boquilla dé el objetivo. Se
                // fija junto con la boquilla porque una sin la otra no
                // sirve de nada.
                fijarDato(ctx, 'presionBar', candidata.presionRequeridaBar);
                refrescar();
              },
            },
            el(
              'span',
              { clase: 'paso-receta__cuerpo' },
              el(
                'span',
                { clase: 'paso-receta__titulo' },
                `${b.fabricante} ${b.modelo}`,
                iso
                  ? el('span', { clase: 'badge badge--iso', estilo: estiloBadgeIso(iso.hex) }, iso.iso)
                  : null,
                candidata.clase ? el('span', { clase: 'badge badge--contorno' }, `gota ${candidata.clase}`) : null
              ),
              el(
                'span',
                { clase: 'paso-receta__detalle texto-meta' },
                `a ${formatear(aSistema('presion', candidata.presionRequeridaBar, sistema), 2)} ${unidadPresion}, ` +
                  `dentro de su rango de ${formatear(aSistema('presion', b.presionMinBar, sistema), 1)} a ` +
                  `${formatear(aSistema('presion', b.presionMaxBar, sistema), 1)}`
              )
            )
          )
        );
      }
      if (candidatas.length > 0) nodos.push(lista);
    } catch (error) {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'Faltan la velocidad, el espaciamiento o el objetivo para filtrar el catálogo.'
        ),
        el('p', { clase: 'ayuda' }, String(error?.message ?? error))
      );
    }
    reemplazar(zona, nodos);
    if (alCambiar) alCambiar();
  }

  refrescar();
  return { nodo: zona };
}

// ---------------------------------------------------------------------
// Aforo
//
// Escribe en el borrador de la Prueba de captura y publica el volumen
// medido con `guardarResultado`, exactamente igual que esa pantalla: es
// el mismo aforo, capturado desde aquí.
// ---------------------------------------------------------------------
function pasoAforo(ctx, { sistema, alCambiar }) {
  const borrador = ctx.borrador('captura');
  const parametros = ctx.estado().parametros;
  const unidadVolumen = unidad('volumenAplicacion', sistema);
  const zona = el('div', { clase: 'pila-campos' });
  const resumen = el('div', {});

  const numBoquillas = valorDeDato(ctx, 'numBoquillas').valor;
  const semilla = Number.isFinite(numBoquillas) && numBoquillas >= 1 ? Math.min(Math.floor(numBoquillas), 8) : 1;
  let volumenes =
    Array.isArray(borrador.volumenesMl) && borrador.volumenesMl.length > 0
      ? borrador.volumenesMl.slice()
      : new Array(semilla).fill(null);

  const campoTiempo = crearCampoNumerico({
    etiqueta: 'Tiempo de prueba',
    unidad: 's',
    valorInicial: borrador.tiempoS ?? parametros.umbrales.tiempoPruebaCaptura,
    ayuda: 'Los segundos que recogiste de cada boquilla. El mismo para todas.',
    alCambiar: (valor) => {
      ctx.guardarBorrador('captura', { tiempoS: valor });
      refrescar();
    },
  });

  const cuadricula = el('div', { clase: 'rejilla-cifras' });
  function pintarRenglones() {
    const campos = volumenes.map((valor, i) => {
      const campo = crearCampoNumerico({
        etiqueta: `Boquilla ${i + 1}`,
        unidad: 'mL',
        valorInicial: valor,
        alCambiar: (nuevo) => {
          volumenes[i] = nuevo;
          ctx.guardarBorrador('captura', { volumenesMl: volumenes.slice() });
          refrescar();
        },
      });
      return campo.elemento;
    });
    reemplazar(cuadricula, campos);
  }

  const botonAgregar = el(
    'button',
    {
      clase: 'boton boton--contorno boton--sm',
      alClic: () => {
        volumenes.push(null);
        ctx.guardarBorrador('captura', { volumenesMl: volumenes.slice() });
        pintarRenglones();
        refrescar();
      },
    },
    'Agregar boquilla'
  );

  function refrescar() {
    const nodos = [];
    const capturados = volumenes.filter((v) => Number.isFinite(v) && v > 0);
    const tiempoS = campoTiempo.obtener();
    const { velocidadKmh, espaciamientoM, lhaObjetivo } = lecturaDeDatos(ctx, [
      'velocidadKmh',
      'espaciamientoM',
      'lhaObjetivo',
    ]);
    if (capturados.length === 0 || !Number.isFinite(tiempoS)) {
      nodos.push(
        el('p', { clase: 'texto-suave' }, 'Captura el tiempo y lo que recogiste de al menos una boquilla.')
      );
    } else {
      try {
        const resultado = estadisticaCaptura({
          volumenesMl: capturados,
          tiempoS,
          umbralAtipicasPct: parametros.umbrales.umbralAtipicas,
          velocidadKmh,
          espaciamientoM,
          lhaObjetivo,
        });
        nodos.push(...pintarAvisos(resultado.avisos));
        if (resultado.valores.lhaRealMedido !== null && resultadoConfiable(resultado)) {
          ctx.guardarResultado('lhaMedido', {
            valor: resultado.valores.lhaRealMedido,
            origen: 'captura',
            detalle: `medida en la prueba de captura de ${resultado.valores.n} ${
              resultado.valores.n === 1 ? 'boquilla' : 'boquillas'
            }`,
          });
          nodos.push(
            pintarResultado({
              etiqueta: 'Volumen real medido',
              valor: aSistema('volumenAplicacion', resultado.valores.lhaRealMedido, sistema),
              unidad: unidadVolumen,
              decimales: 1,
              principal: true,
            })
          );
        } else if (resultado.valores.lhaRealMedido !== null) {
          nodos.push(pintarResultadoNoVerificado('Volumen real medido'));
        }
        nodos.push(
          pintarResultado({
            etiqueta: 'CV de la barra',
            valor: resultado.valores.cvPct,
            unidad: '%',
            decimales: 1,
          })
        );
      } catch (error) {
        nodos.push(el('p', { clase: 'ayuda' }, String(error?.message ?? error)));
      }
    }
    reemplazar(resumen, nodos);
    if (alCambiar) alCambiar();
  }

  pintarRenglones();
  zona.append(campoTiempo.elemento, cuadricula, botonAgregar, resumen);
  refrescar();
  return { nodo: zona };
}

// ---------------------------------------------------------------------
// Rotámetro
// ---------------------------------------------------------------------
function pasoRotametro(ctx, { paso, sistema, alCambiar }) {
  const pila = el('div', { clase: 'pila-campos' });
  const resumen = el('div', {});
  for (const id of paso.datos) {
    pila.append(crearCampoDato(ctx, id, { sistema, alCambiar: () => refrescar() }).elemento);
  }

  function refrescar() {
    const masa = ctx.resultado('masaPorTablaG');
    const nodos = [];
    if (Number.isFinite(masa?.valor)) {
      nodos.push(
        pintarResultado({
          etiqueta: 'Masa de etileno objetivo por tabla',
          valor: masa.valor,
          unidad: 'g',
          decimales: 1,
        }),
        el(
          'p',
          { clase: 'ayuda' },
          'La corrección por presión y el gas que de verdad entra se ven completos en Gas etileno.'
        )
      );
    }
    reemplazar(resumen, nodos);
    if (alCambiar) alCambiar();
  }

  refrescar();
  pila.append(resumen);
  return { nodo: pila };
}

// ---------------------------------------------------------------------
// Despachador
// ---------------------------------------------------------------------
export function montarPaso(ctx, opciones) {
  const { paso } = opciones;
  switch (paso.tipo) {
    case 'barra':
      return pasoBarra(ctx, opciones);
    case 'velocidad':
      return pasoVelocidad(ctx, opciones);
    case 'boquilla':
      return pasoBoquilla(ctx, opciones);
    case 'candidatas':
      return pasoCandidatas(ctx, opciones);
    case 'aforo':
      return pasoAforo(ctx, opciones);
    case 'rotametro':
      return pasoRotametro(ctx, opciones);
    default:
      return pasoDatos(ctx, opciones);
  }
}

// El volumen de aplicación calculado con lo que la jornada tiene ahora:
// lo usa la hoja de resultado y el resumen de varios pasos. Es el atajo
// de domain/water.js, la misma ruta verificada de Gasto de agua.
export function volumenVigente(ctx) {
  const datos = lecturaDeDatos(ctx, [
    'boquillaId',
    'presionBar',
    'velocidadKmh',
    'espaciamientoM',
    'anchoBarraM',
    'numBoquillas',
  ]);
  const estado = ctx.estado();
  const boquilla = estado.catalogo.find((b) => b.id === datos.boquillaId) ?? null;
  try {
    return {
      boquilla,
      calculo: volumenConBoquilla({
        boquilla,
        presionBar: datos.presionBar,
        velocidadKmh: datos.velocidadKmh,
        espaciamientoM: datos.espaciamientoM,
        anchoBarraM: datos.anchoBarraM,
        numBoquillas: datos.numBoquillas,
        densidadRelativa: estado.parametros.caldo.densidadRelativa,
        umbralDiscrepanciaPct: estado.parametros.umbrales.umbralDiscrepanciaMetodos,
      }),
      error: null,
    };
  } catch (error) {
    return { boquilla, calculo: null, error };
  }
}
