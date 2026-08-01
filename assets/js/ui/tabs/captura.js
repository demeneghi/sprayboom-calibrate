// Pestana Prueba de captura (dominio B): aforo boquilla por boquilla.
// El desgaste de boquillas es la causa mas comun de sobreaplicacion y
// esta pantalla lo detecta: media, desviacion estandar y CV de la
// barra, boquillas atipicas a reemplazar, desgaste implicito contra el
// caudal de catalogo y volumen real aplicado contra el objetivo.
//
// Convenciones tomadas de avance.js: borrador con autosave (los
// navegadores moviles matan pestanas sin avisar), resultados con
// desglose auditable, avisos tipados, gate de verificacion y calculo
// interno SIEMPRE en metrico con captura/muestra en el sistema activo.

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
import { crearCampoNumerico, crearEtiquetaConAyuda } from '../campos.js';
import { crearCampoVelocidad } from '../velocidad.js';
import { crearCampoHeredado, fuenteEspaciamiento } from '../heredado.js';
import { crearCombobox } from '../combobox.js';
import { crearCronometro } from '../cronometro.js';
import { formatear, formatearPorcentaje } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { filaIso } from '../../data/iso-colors.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import { estadisticaCaptura } from '../../domain/capture.js';
import { caudalAPresionDetallado } from '../../domain/nozzles.js';
import { geometria } from '../../domain/speed.js';

export const id = 'captura';

function idPrueba() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `captura-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const p = ctx.estado().parametros;
  const equipo = ctx.equipoActivo();

  const unidadVolChico = unidad('volumenChico', sistema);
  const unidadCaudal = unidad('caudal', sistema);
  const unidadPresion = unidad('presion', sistema);
  const unidadEspaciamiento = unidad('distanciaCorta', sistema);
  const unidadVolumen = unidad('volumenAplicacion', sistema);
  const decimalesPresion = sistema === 'imperial' ? 1 : 2;
  const decimalesVolumenAplicacion = sistema === 'imperial' ? 1 : 0;

  // El borrador guarda SIEMPRE en base metrica; al pintar se convierte
  // al sistema activo (toPrecision evita colas de punto flotante en el
  // input tras una ida y vuelta metrico-imperial).
  function aCampo(magnitud, valorMetrico) {
    if (valorMetrico === null || valorMetrico === undefined || !Number.isFinite(valorMetrico)) {
      return null;
    }
    return Number(aSistema(magnitud, valorMetrico, sistema).toPrecision(6));
  }

  function grid2(...hijos) {
    return el(
      'div',
      { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
      ...hijos
    );
  }

  // ---------------- Tiempo de prueba y cronometro ----------------
  const campoTiempo = crearCampoNumerico({
    etiqueta: 'Tiempo de prueba',
    unidad: 's',
    valorInicial: borrador.tiempoS ?? p.umbrales.tiempoPruebaCaptura,
    ayuda: `Se precarga el tiempo típico de aforo configurado (${p.umbrales.tiempoPruebaCaptura} s). Todas las probetas se llenan durante el mismo tiempo.`,
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { tiempoS: valor });
      if (valor !== null && valor > 0) cronometro.fijarDuracion(valor);
      recalcular();
    },
  });

  // Cronometro en modo regresivo: cuenta el tiempo de prueba y avisa al
  // llegar a cero para retirar las probetas.
  const zonaCronometro = el('div', {});
  const cronometro = crearCronometro({
    modo: 'regresivo',
    duracionS: borrador.tiempoS ?? p.umbrales.tiempoPruebaCaptura,
    alTerminar: () => {
      mostrarToast('Tiempo de prueba cumplido: cierra el paso y retira las probetas.');
    },
  });
  zonaCronometro.append(
    el(
      'p',
      { clase: 'ayuda' },
      'Cuenta regresiva del tiempo de prueba: arranca al abrir la barra y avisa cuando se cumple.'
    ),
    cronometro.elemento
  );

  // ---------------- Presion de trabajo ----------------
  const campoPresion = crearCampoNumerico({
    etiqueta: 'Presión de trabajo',
    magnitud: 'presion',
    sistema,
    valorInicial: aCampo('presion', borrador.presionBar ?? equipo?.presionCalibracion ?? null),
    ayuda: 'Presión manométrica durante la prueba: con ella se calcula el caudal teórico de la boquilla de referencia (el de una boquilla nueva).',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { presionBar: deSistema('presion', valor, sistema) });
      recalcular();
    },
  });

  // ---------------- Regimen del motor durante el aforo ----------------
  // Con bomba de TDF el caudal depende del regimen, asi que un aforo sin
  // el regimen anotado no se puede comparar despues con otro: la deriva
  // del desgaste que muestra Bitacora mezclaria pruebas hechas a
  // regimenes distintos sin que nada lo dijera. Se hereda de Avance y se
  // guarda con la prueba.
  const rpmDeAvance = ctx.borrador('avance').rpm ?? ctx.tractorActivo()?.regimenHabitual ?? null;
  const campoRpm = crearCampoHeredado({
    ctx,
    tabId: id,
    clave: 'rpmPrueba',
    claveManual: 'rpmPruebaManual',
    etiqueta: 'Régimen del motor durante la prueba',
    unidad: 'rpm',
    ayuda:
      'Con bomba de toma de fuerza el caudal cambia con el régimen: anotarlo es lo que permite ' +
      'comparar este aforo con los anteriores. Se precarga el capturado en Avance.',
    fuente: 'Avance',
    nombreDato: 'el régimen',
    heredado: {
      valor: rpmDeAvance,
      etiqueta: Number.isFinite(ctx.borrador('avance').rpm)
        ? 'capturado en Avance'
        : `régimen habitual del ${ctx.tractorActivo()?.nombre ?? 'tractor'}`,
    },
    formatearValor: (valor) => `${formatear(valor, 0)} rpm`,
    destino: { seccion: 'calibrar', tab: 'avance' },
    textoSinDato: 'Captura el régimen del motor en Avance, o escríbelo aquí.',
    guardadoSinMarcaEsManual: true,
    alCambiar: () => recalcular(),
  });

  // ---------------- Boquilla de referencia (combobox) ----------------
  let boquillaId = borrador.boquillaId ?? equipo?.boquillaId ?? null;
  function boquillaSeleccionada() {
    return ctx.estado().catalogo.find((b) => b.id === boquillaId) ?? null;
  }
  function opcionesCatalogo() {
    return ctx.estado().catalogo.map((b) => ({
      valor: b.id,
      texto: `${b.fabricante} ${b.modelo}`,
      detalle: `${formatear(aSistema('caudal', b.caudalRefLmin, sistema), 3)} ${unidadCaudal} a ${formatear(aSistema('presion', b.presionRefBar, sistema), decimalesPresion)} ${unidadPresion}`,
      colorHex: b.tamanoIso ? (filaIso(b.tamanoIso)?.hex ?? null) : null,
    }));
  }
  const combo = crearCombobox({
    id: 'captura-boquilla',
    opciones: opcionesCatalogo(),
    placeholder: 'Buscar boquilla en el catálogo...',
    alSeleccionar: (opcion) => {
      boquillaId = opcion.valor;
      ctx.guardarBorrador(id, { boquillaId });
      recalcular();
    },
  });
  const boquillaInicial = boquillaSeleccionada();
  if (boquillaInicial) {
    combo.fijarTexto(`${boquillaInicial.fabricante} ${boquillaInicial.modelo}`);
  }
  const cabeceraBoquilla = crearEtiquetaConAyuda({
    idCampo: 'captura-boquilla',
    etiqueta: 'Boquilla de referencia',
    ayuda:
      ctx.estado().catalogo.length === 0
        ? 'El catálogo está vacío: agrega boquillas en Sistema, Configuración.'
        : 'Se precarga la boquilla de la barra activa. El caudal de catálogo es el de una boquilla NUEVA: contra él se estima el desgaste.',
  });
  const campoBoquilla = el(
    'div',
    { clase: 'campo' },
    cabeceraBoquilla.cabecera,
    cabeceraBoquilla.globo,
    combo.elemento
  );

  // ---------------- Renglones de volumenes recogidos ----------------
  const numBoquillasConfig = ctx.equipoActivo()?.numBoquillas;
  const semillaRenglones =
    Number.isFinite(numBoquillasConfig) && numBoquillasConfig >= 1
      ? Math.floor(numBoquillasConfig)
      : 1;
  let volumenes =
    Array.isArray(borrador.volumenesMl) && borrador.volumenesMl.length > 0
      ? borrador.volumenesMl.slice()
      : new Array(semillaRenglones).fill(null);

  function guardarVolumenes() {
    ctx.guardarBorrador(id, { volumenesMl: volumenes.slice() });
  }

  const cuadriculaRenglones = el('div', {
    estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' },
  });
  const botonAgregar = el('button', { clase: 'boton boton--contorno' }, 'Agregar renglón');
  const botonQuitar = el('button', { clase: 'boton boton--contorno' }, 'Quitar último renglón');
  botonAgregar.addEventListener('click', () => {
    volumenes.push(null);
    guardarVolumenes();
    pintarRenglones();
    recalcular();
  });
  botonQuitar.addEventListener('click', () => {
    if (volumenes.length <= 1) return;
    volumenes.pop();
    guardarVolumenes();
    pintarRenglones();
    recalcular();
  });

  function pintarRenglones() {
    const campos = volumenes.map((valor, i) =>
      crearCampoNumerico({
        etiqueta: `Boquilla ${i + 1}`,
        magnitud: 'volumenChico',
        sistema,
        valorInicial: aCampo('volumenChico', valor),
        alCambiar: (capturado) => {
          volumenes[i] = deSistema('volumenChico', capturado, sistema);
          guardarVolumenes();
          recalcular();
        },
      })
    );
    reemplazar(cuadriculaRenglones, campos.map((c) => c.elemento));
    botonQuitar.disabled = volumenes.length <= 1;
  }

  // ---------------- Contexto para el volumen real ----------------
  // Hereda por defecto la velocidad capturada en Avance: la teorica sin
  // verificar sesga el volumen real, y el numero se captura una sola vez.
  const campoVelocidad = crearCampoVelocidad({
    ctx,
    tabId: id,
    sistema,
    etiqueta: 'Velocidad de trabajo',
    alCambiar: () => recalcular(),
  });
  const fuenteEsp = fuenteEspaciamiento(ctx);
  const campoEspaciamiento = crearCampoHeredado({
    ctx,
    tabId: id,
    clave: 'espaciamientoM',
    claveManual: 'espaciamientoManual',
    etiqueta: 'Espaciamiento entre boquillas',
    magnitud: 'distanciaCorta',
    sistema,
    ayuda:
      'Sale de la geometría de la barra activa: el capturado si lo hay, y si no el ancho entre ' +
      'el número de boquillas. Editarlo aquí no cambia la configuración.',
    fuente: fuenteEsp.fuente,
    nombreDato: 'el espaciamiento',
    heredado: { valor: fuenteEsp.valor, etiqueta: fuenteEsp.etiqueta },
    aCampo: (m) =>
      Number.isFinite(m) ? Number(aSistema('distanciaCorta', m, sistema).toPrecision(6)) : null,
    deCampo: (valor) => deSistema('distanciaCorta', valor, sistema),
    formatearValor: (valor) => `${formatear(valor, 3)} ${unidadEspaciamiento}`,
    destino: fuenteEsp.destino,
    textoSinDato:
      'Captura el ancho y el número de boquillas de la barra en Sistema, Configuración, o ' +
      'escribe aquí el espaciamiento.',
    guardadoSinMarcaEsManual: true,
    alCambiar: () => recalcular(),
  });
  const campoObjetivo = crearCampoNumerico({
    etiqueta: 'Volumen objetivo',
    magnitud: 'volumenAplicacion',
    sistema,
    // Mismo objetivo de jornada que Boquillas y Gasto de agua; si nadie
    // lo ha capturado, el objetivo propio del rancho de Configuracion.
    valorInicial: aCampo('volumenAplicacion', borrador.lhaObjetivo ?? ctx.objetivoVolumenLha()),
    ayuda:
      'Opcional: si se captura, el volumen real medido se compara contra este objetivo. Se ' +
      'precarga el último objetivo capturado en la aplicación.',
    alCambiar: (valor) => {
      const lha = deSistema('volumenAplicacion', valor, sistema);
      ctx.guardarBorrador(id, { lhaObjetivo: lha });
      ctx.guardarResultado('lhaObjetivo', { valor: lha, origen: id, detalle: 'objetivo de la jornada' });
      recalcular();
    },
  });

  // ---------------- Resultados ----------------
  const zonaResultados = el('div', {
    estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  });
  let ultimoCalculo = null;

  function tablaPorBoquilla(resultado, capturas) {
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
            el('th', {}, 'Boquilla'),
            el('th', {}, `Vol. (${unidadVolChico})`),
            el('th', {}, `Caudal (${unidadCaudal})`),
            el('th', {}, 'Desv.'),
            el('th', {}, 'Estado')
          )
        ),
        el(
          'tbody',
          {},
          resultado.valores.porBoquilla.map((b) =>
            el(
              'tr',
              {},
              el('td', {}, String(capturas[b.indice].renglon + 1)),
              el(
                'td',
                { clase: 'numero' },
                formatear(aSistema('volumenChico', capturas[b.indice].volumenMl, sistema), 1)
              ),
              el('td', { clase: 'numero' }, formatear(aSistema('caudal', b.caudalLmin, sistema), 3)),
              el('td', { clase: 'numero' }, formatearPorcentaje(b.desviacionPct, 1)),
              el(
                'td',
                {},
                b.atipica
                  ? el('span', { clase: 'badge badge--destructivo' }, 'reemplazar')
                  : el('span', { clase: 'badge badge--secundario' }, 'en rango')
              )
            )
          )
        )
      )
    );
  }

  function recalcular() {
    const estado = ctx.estado();
    const par = estado.parametros;
    const nodos = [];
    ultimoCalculo = null;

    const tiempoS = campoTiempo.obtener();
    const capturas = volumenes
      .map((volumenMl, renglon) => ({ renglon, volumenMl }))
      .filter((c) => Number.isFinite(c.volumenMl));

    if (tiempoS === null) {
      nodos.push(el('p', { clase: 'texto-suave' }, 'Captura el tiempo de prueba para calcular.'));
    } else if (capturas.length === 0) {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'Captura al menos un volumen recogido: los renglones vacíos se ignoran.'
        )
      );
    } else {
      try {
        const presionBar = deSistema('presion', campoPresion.obtener(), sistema);
        const boquilla = boquillaSeleccionada();
        let caudalTeoricoLmin = null;
        // Variante detallada del dominio: ademas del caudal teorico
        // regresa el paso del escalado presion-caudal con los numeros
        // sustituidos, para anteponerlo al desglose de la prueba.
        let desgloseTeorico = [];
        if (boquilla && presionBar !== null) {
          const teorico = caudalAPresionDetallado({
            caudalRef: boquilla.caudalRefLmin,
            presionRef: boquilla.presionRefBar,
            presion: presionBar,
            exponente: boquilla.exponente,
          });
          caudalTeoricoLmin = teorico.valores.caudalLmin;
          desgloseTeorico = teorico.desglose;
          if (presionBar < boquilla.presionMinBar || presionBar > boquilla.presionMaxBar) {
            nodos.push(
              el(
                'div',
                { clase: 'alerta alerta--advertencia', role: 'alert' },
                el(
                  'p',
                  { clase: 'alerta__descripcion' },
                  `La presión capturada (${formatear(aSistema('presion', presionBar, sistema), decimalesPresion)} ${unidadPresion}) queda fuera del rango de la ${boquilla.modelo} (${formatear(aSistema('presion', boquilla.presionMinBar, sistema), decimalesPresion)} a ${formatear(aSistema('presion', boquilla.presionMaxBar, sistema), decimalesPresion)} ${unidadPresion}): el caudal teórico extrapolado es menos confiable y el desgaste estimado hereda esa duda.`
                )
              )
            );
          }
        }

        const velocidadKmh = deSistema('velocidad', campoVelocidad.obtener(), sistema);
        const espaciamientoM = deSistema('distanciaCorta', campoEspaciamiento.obtener(), sistema);
        const lhaObjetivo = deSistema('volumenAplicacion', campoObjetivo.obtener(), sistema);

        // Guardas de plausibilidad del espaciamiento capturado (dominio):
        // detecta captura en centimetros y discrepancia contra el
        // derivado del ancho entre el numero de boquillas configurados.
        if (espaciamientoM !== null) {
          try {
            const g = geometria({ ...ctx.parametrosGeometria(), espaciamientoCapturado: espaciamientoM });
            nodos.push(...pintarAvisos(g.avisos));
          } catch {
            // La geometria configurada no bloquea el aforo: el volumen
            // real solo depende de las capturas de esta pestana.
          }
        }

        const resultado = estadisticaCaptura({
          volumenesMl: capturas.map((c) => c.volumenMl),
          tiempoS,
          umbralAtipicasPct: par.umbrales.umbralAtipicas,
          caudalTeoricoLmin,
          velocidadKmh,
          espaciamientoM,
          lhaObjetivo,
        });

        nodos.push(...pintarAvisos(resultado.avisos));

        nodos.push(
          grid2(
            pintarResultado({
              etiqueta: 'Media de la barra',
              valor: aSistema('caudal', resultado.valores.mediaLmin, sistema),
              unidad: unidadCaudal,
              decimales: 3,
              principal: true,
            }),
            pintarResultado({
              etiqueta: 'CV de la barra',
              valor: resultado.valores.cvPoblacionalPct,
              unidad: '%',
              decimales: 1,
              principal: true,
            }),
            pintarResultado({
              etiqueta: 'DE poblacional',
              valor: aSistema('caudal', resultado.valores.dePoblacional, sistema),
              unidad: unidadCaudal,
              decimales: 4,
            }),
            pintarResultado({
              etiqueta: 'DE muestral (n − 1)',
              valor: aSistema('caudal', resultado.valores.deMuestral, sistema),
              unidad: unidadCaudal,
              decimales: 4,
            })
          ),
          el(
            'p',
            { clase: 'ayuda' },
            resultado.valores.cvPoblacionalPct === null
              ? 'Con una sola boquilla capturada no hay dispersión que medir; el CV aparece vacío.'
              : `Se reporta el CV poblacional (DE poblacional entre la media): el aforo cubre las ${resultado.valores.n} boquillas capturadas como población completa, no como muestra. Referencia muestral (n − 1): CV ${formatearPorcentaje(resultado.valores.cvMuestralPct, 1)}.`
          )
        );

        if (capturas.length < volumenes.length) {
          nodos.push(
            el(
              'p',
              { clase: 'ayuda' },
              `Se calcularon ${capturas.length} de ${volumenes.length} renglones; los vacíos se ignoraron.`
            )
          );
        }
        nodos.push(tablaPorBoquilla(resultado, capturas));

        if (resultado.valores.desgastePct !== null) {
          nodos.push(
            grid2(
              pintarResultado({
                etiqueta: `Caudal teórico (${boquilla.modelo})`,
                valor: aSistema('caudal', caudalTeoricoLmin, sistema),
                unidad: unidadCaudal,
                decimales: 3,
              }),
              pintarResultado({
                etiqueta: 'Desgaste implícito',
                valor: resultado.valores.desgastePct,
                unidad: '%',
                decimales: 1,
              })
            ),
            el(
              'p',
              { clase: 'ayuda' },
              'Desgaste implícito: cuánto más (o menos) entrega la media de la barra que la boquilla nueva de catálogo a la misma presión.'
            )
          );
        } else {
          nodos.push(
            el(
              'p',
              { clase: 'ayuda' },
              'Elige la boquilla de referencia y captura la presión para estimar el desgaste contra el caudal de catálogo.'
            )
          );
        }

        if (resultado.valores.lhaRealMedido !== null) {
          if (resultadoConfiable(resultado)) {
            // El volumen MEDIDO queda a disposicion de Mezcla y
            // Forzamiento, y manda ahi sobre el calculado: sale del aforo
            // de esta barra, con sus boquillas como estan hoy, no de la
            // ficha de una boquilla nueva. Solo se publica el verificado.
            ctx.guardarResultado('lhaMedido', {
              valor: resultado.valores.lhaRealMedido,
              origen: 'captura',
              detalle: `medida en la prueba de captura de ${resultado.valores.n} ${
                resultado.valores.n === 1 ? 'boquilla' : 'boquillas'
              }`,
            });
            nodos.push(
              grid2(
                pintarResultado({
                  etiqueta: 'Volumen real medido',
                  valor: aSistema('volumenAplicacion', resultado.valores.lhaRealMedido, sistema),
                  unidad: unidadVolumen,
                  decimales: decimalesVolumenAplicacion,
                  principal: true,
                }),
                resultado.valores.comparacionObjetivoPct !== null
                  ? pintarResultado({
                      etiqueta: 'Contra objetivo',
                      valor: resultado.valores.comparacionObjetivoPct,
                      unidad: '%',
                      decimales: 1,
                    })
                  : null
              )
            );
          } else {
            nodos.push(pintarResultadoNoVerificado('Volumen real medido'));
          }
          nodos.push(pintarVerificacion(resultado.verificacion));
        } else {
          nodos.push(
            el(
              'p',
              { clase: 'ayuda' },
              `Captura velocidad y espaciamiento para convertir la media de la barra en volumen real aplicado (${unidadVolumen}) y compararlo con el objetivo.`
            )
          );
        }

        // Un solo desglose auditable: primero la derivacion del caudal
        // teorico desde la presion y despues los pasos de la prueba.
        nodos.push(pintarDesglose([...desgloseTeorico, ...resultado.desglose]));

        ultimoCalculo = {
          resultado,
          entradas: {
            tiempoS,
            presionBar,
            rpmPrueba: campoRpm.obtener(),
            boquillaId: boquilla?.id ?? null,
            volumenesMl: capturas.map((c) => c.volumenMl),
          },
        };
      } catch (error) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--destructiva', role: 'alert' },
            el('p', { clase: 'alerta__descripcion' }, String(error.message ?? error))
          )
        );
      }
    }

    reemplazar(zonaResultados, nodos);
  }

  // ---------------- Guardar prueba ----------------
  const botonGuardar = el('button', { clase: 'boton' }, 'Guardar prueba');
  botonGuardar.addEventListener('click', () => {
    if (!ultimoCalculo) {
      mostrarToast('Completa la prueba antes de guardarla: falta el cálculo.', {
        tipo: 'destructivo',
      });
      return;
    }
    if (!resultadoConfiable(ultimoCalculo.resultado)) {
      mostrarToast('El cálculo no está verificado: no se guarda. Reporta el error.', {
        tipo: 'destructivo',
      });
      return;
    }
    const { resultado, entradas } = ultimoCalculo;
    const prueba = {
      id: idPrueba(),
      fecha: new Date().toISOString(),
      equipoId: ctx.equipoActivo()?.id ?? null,
      boquillaId: entradas.boquillaId,
      presionBar: entradas.presionBar,
      rpmPrueba: entradas.rpmPrueba,
      tiempoS: entradas.tiempoS,
      volumenesMl: entradas.volumenesMl.slice(),
      resultados: JSON.parse(JSON.stringify(resultado.valores)),
      parametros: null,
    };
    ctx.almacen.actualizar((e) => {
      // Snapshot COPIA de los parametros vigentes: el registro historico
      // debe mostrar los numeros con los que se calculo aunque los
      // parametros cambien despues.
      prueba.parametros = JSON.parse(
        JSON.stringify({
          parametros: e.parametros,
          tractor: ctx.tractorActivo(),
          equipo: ctx.equipoActivo(),
        })
      );
      e.pruebasCaptura.push(prueba);
    }, 'datos');
    mostrarToast('Prueba guardada. La deriva histórica del desgaste se consulta en Bitácora.', {
      accionTexto: 'Ir a Bitácora',
      alAccionar: () => ctx.navegarA('registrar', 'bitacora'),
    });
  });

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Prueba de captura',
        descripcion:
          'Aforo boquilla por boquilla: detecta el desgaste, la causa más común de sobreaplicación.',
      },
      campoTiempo.elemento,
      zonaCronometro,
      campoPresion.elemento,
      campoRpm.elemento,
      campoBoquilla
    ),
    tarjeta(
      {
        titulo: 'Volúmenes recogidos',
        descripcion:
          'Un renglón por boquilla, todos con el mismo tiempo de prueba. Los renglones vacíos se ignoran al calcular.',
      },
      cuadriculaRenglones,
      el('div', { estilo: { display: 'flex', gap: '0.5rem' } }, botonAgregar, botonQuitar)
    ),
    tarjeta(
      {
        titulo: 'Volumen real aplicado',
        descripcion:
          'Opcional: con velocidad y espaciamiento, la media medida se convierte en volumen real y se compara con el objetivo.',
      },
      campoVelocidad.elemento,
      campoEspaciamiento.elemento,
      campoObjetivo.elemento
    ),
    tarjeta(
      { titulo: 'Resultado' },
      zonaResultados,
      botonGuardar,
      el(
        'p',
        { clase: 'ayuda' },
        'La prueba se guarda con una copia de los parámetros vigentes: los registros históricos muestran los números con los que se calcularon aunque la configuración cambie después.'
      )
    )
  );

  pintarRenglones();
  recalcular();
}
