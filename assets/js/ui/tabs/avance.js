// Pestana Avance (dominio A): velocidad desde marcha y regimen, o desde
// el reporte de campo en segundos por tramo. Muestra siempre la
// velocidad teorica y la corregida por factores medidos, con el tiempo
// por tabla, el estado de la TDF y la geometria derivada.
//
// Es la pestana EJEMPLAR del proyecto: borradores con autosave,
// cuadricula de marchas generada desde la transmision, resultados con
// desglose auditable, avisos tipados y edicion de estado via dialogo.

import { el, reemplazar } from '../dom.js';
import { tarjeta, pintarAvisos, pintarDesglose, pintarResultado } from '../render.js';
import { crearCampoNumerico } from '../campos.js';
import { formatear, formatearTiempo, formatearPorcentaje } from '../formato.js';
import { confirmar } from '../dialog.js';
import { mostrarToast } from '../toast.js';
import { aSistema, unidad } from '../../domain/units.js';
import {
  marchasDeTractor,
  marchasParaVelocidad,
  velocidadEfectiva,
  avance,
  avanceDesdeReporte,
  velocidadDesdeReporte,
  calibrarMarcha,
  geometria,
  factorDesviacion,
  velocidadCorregida,
  validarRegimen,
} from '../../domain/speed.js';
import { tdfRpm } from '../../domain/pump.js';

export const id = 'avance';

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  let modo = borrador.modo ?? 'marcha';
  let marchaSeleccionada = borrador.marcha ?? null; // {rango, marcha}
  const tractor = ctx.tractorActivo();
  const sistema = ctx.sistema();
  const unidadVelocidad = unidad('velocidad', sistema);

  // ---------------- Modo ----------------
  const botonMarcha = el('button', { clase: 'boton boton--contorno', 'aria-pressed': 'false' }, 'Desde marcha y rpm');
  const botonReporte = el('button', { clase: 'boton boton--contorno', 'aria-pressed': 'false' }, 'Desde reporte de campo');
  function pintarModo() {
    botonMarcha.setAttribute('aria-pressed', modo === 'marcha' ? 'true' : 'false');
    botonReporte.setAttribute('aria-pressed', modo === 'reporte' ? 'true' : 'false');
    botonMarcha.classList.toggle('boton--secundario', modo === 'marcha');
    botonReporte.classList.toggle('boton--secundario', modo === 'reporte');
    zonaMarcha.classList.toggle('oculto', modo !== 'marcha');
    zonaReporte.classList.toggle('oculto', modo !== 'reporte');
  }
  botonMarcha.addEventListener('click', () => {
    modo = 'marcha';
    ctx.guardarBorrador(id, { modo });
    pintarModo();
    recalcular();
  });
  botonReporte.addEventListener('click', () => {
    modo = 'reporte';
    ctx.guardarBorrador(id, { modo });
    pintarModo();
    recalcular();
  });

  // ---------------- Cuadricula de marchas ----------------
  const cuadricula = el('div', {
    clase: 'cuadricula-marchas',
    estilo: { '--marchas-por-rango': String(tractor.marchasPorRango) },
    role: 'group',
    'aria-label': 'Marchas del tractor',
  });
  const filasMarchas = marchasDeTractor(tractor);
  const botonesMarcha = new Map();
  for (const fila of filasMarchas) {
    const clave = `${fila.rango}-${fila.marcha}`;
    const boton = el(
      'button',
      { clase: 'marcha', 'aria-pressed': 'false', disabled: fila.kmhNominal === null || null },
      el('span', { clase: 'marcha__nombre' }, fila.etiqueta),
      el(
        'span',
        { clase: 'marcha__velocidad' },
        fila.kmhNominal === null
          ? 'pendiente'
          : `${formatear(aSistema('velocidad', fila.kmhNominal, sistema), 1)} ${unidadVelocidad}${fila.origen === 'estimacion' ? ' (est.)' : ''}`
      )
    );
    boton.addEventListener('click', () => {
      marchaSeleccionada = { rango: fila.rango, marcha: fila.marcha };
      ctx.guardarBorrador(id, { marcha: marchaSeleccionada });
      pintarSeleccion();
      recalcular();
    });
    botonesMarcha.set(clave, boton);
    cuadricula.append(boton);
  }
  function pintarSeleccion() {
    for (const [clave, boton] of botonesMarcha) {
      const activa =
        marchaSeleccionada && clave === `${marchaSeleccionada.rango}-${marchaSeleccionada.marcha}`;
      boton.setAttribute('aria-pressed', activa ? 'true' : 'false');
    }
  }

  const campoRpm = crearCampoNumerico({
    etiqueta: 'Regimen del motor',
    unidad: 'rpm',
    valorInicial: borrador.rpm ?? tractor.regimenHabitual,
    ayuda: `Se precarga el regimen habitual de trabajo (${tractor.regimenHabitual} rpm), no el nominal: este rancho opera entre 1500 y 1800 rpm.`,
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { rpm: valor });
      recalcular();
    },
  });

  const botonCalibrarMarcha = el(
    'button',
    { clase: 'boton boton--contorno' },
    'Calibrar esta marcha con una medicion'
  );
  botonCalibrarMarcha.addEventListener('click', () => abrirCalibracion());

  const zonaMarcha = el(
    'div',
    { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } },
    cuadricula,
    campoRpm.elemento,
    botonCalibrarMarcha
  );

  // ---------------- Reporte de campo ----------------
  const campoSegundos = crearCampoNumerico({
    etiqueta: 'Segundos por tramo',
    unidad: 's',
    valorInicial: borrador.segundosPorTramo ?? null,
    ayuda: 'Tiempo medido para recorrer la distancia de referencia. El reporte de campo es siempre mas confiable que la marcha teorica.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { segundosPorTramo: valor });
      recalcular();
    },
  });
  const zonaCronometro = el('div', {}); // el cronometro se monta aqui (fase de opcionales)
  const zonaMarchasQueReproducen = el('div', {});
  const zonaReporte = el(
    'div',
    { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } },
    campoSegundos.elemento,
    zonaCronometro,
    zonaMarchasQueReproducen
  );

  // ---------------- Resultados ----------------
  const zonaResultados = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });
  const zonaTdf = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });
  const zonaGeometria = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

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

  function recalcular() {
    const estado = ctx.estado();
    const p = estado.parametros;
    const nodos = [];

    try {
      let velocidadTeorica = null;
      let origenVelocidad = null;

      if (modo === 'marcha') {
        const rpm = campoRpm.obtener();
        const fila = marchaSeleccionada
          ? filasMarchas.find(
              (f) => f.rango === marchaSeleccionada.rango && f.marcha === marchaSeleccionada.marcha
            )
          : null;
        if (!fila || fila.kmhNominal === null || rpm === null) {
          nodos.push(
            el('p', { clase: 'texto-suave' }, 'Elige una marcha y captura el regimen para calcular.')
          );
        } else {
          nodos.push(...pintarAvisos(validarRegimen({ rpm, tractor })));
          if (fila.origen === 'estimacion') {
            nodos.push(
              el(
                'div',
                { clase: 'alerta', role: 'status' },
                el(
                  'p',
                  { clase: 'alerta__descripcion' },
                  'La velocidad nominal de esta marcha es una ESTIMACION no verificada contra el manual: calibrala en campo antes de confiar en la aplicacion calculada.'
                )
              )
            );
          }
          velocidadTeorica = velocidadEfectiva({
            kmhNominal: fila.kmhNominal,
            rpm,
            regimenNominal: tractor.regimenNominal,
          });
          origenVelocidad = fila;
        }
      } else {
        const segundos = campoSegundos.obtener();
        if (segundos === null) {
          nodos.push(el('p', { clase: 'texto-suave' }, 'Captura los segundos por tramo para calcular.'));
        } else {
          velocidadTeorica = velocidadDesdeReporte({
            segundosPorTramo: segundos,
            distanciaReferencia: p.geometria.distanciaReferencia,
          });
        }
      }

      if (velocidadTeorica !== null) {
        // Factores de desviacion medidos para este tractor (solo aplican
        // al modo marcha: el reporte de campo YA es velocidad real).
        let velocidadFinal = velocidadTeorica;
        if (modo === 'marcha') {
          const rpm = campoRpm.obtener();
          const mediciones = estado.factoresDesviacion
            .filter((m) => m.tractorId === tractor.id)
            .map((m) => ({ rpm: m.rpm, factor: m.factor }));
          const factor = factorDesviacion({ mediciones, rpm });
          nodos.push(...pintarAvisos(factor.avisos));
          const corregida = velocidadCorregida({
            velocidadTeoricaKmh: velocidadTeorica,
            factor: factor.factor,
            umbralDesviacionPct: p.umbrales.umbralDesviacionVelocidad,
          });
          nodos.push(...pintarAvisos(corregida.avisos));

          const etiquetaFactor =
            factor.estado === 'medido'
              ? 'factor medido en campo'
              : factor.estado === 'interpolado'
                ? 'factor interpolado'
                : factor.estado === 'sin-mediciones'
                  ? 'teorica sin verificar'
                  : 'sin medicion en este regimen';

          nodos.push(
            pintarResultado({
              etiqueta: `Velocidad teorica (${origenVelocidad?.etiqueta ?? ''})`,
              valor: aSistema('velocidad', velocidadTeorica, sistema),
              unidad: unidadVelocidad,
              decimales: 2,
            }),
            pintarResultado({
              etiqueta: `Velocidad corregida (${etiquetaFactor})`,
              valor:
                corregida.valores.velocidadCorregidaKmh === null
                  ? null
                  : aSistema('velocidad', corregida.valores.velocidadCorregidaKmh, sistema),
              unidad: unidadVelocidad,
              decimales: 2,
              principal: true,
            }),
            el(
              'p',
              { clase: 'ayuda' },
              corregida.valores.desviacionPct === null
                ? 'Sin factor aplicable: se usa la teorica. El patinaje no se predice con formula; se mide en campo.'
                : `Desviacion aplicada: ${formatearPorcentaje(Math.abs(corregida.valores.desviacionPct))} (factor ${formatear(factor.factor, 4)}). Teorica y corregida se muestran siempre juntas.`
            )
          );
          if (corregida.valores.velocidadCorregidaKmh !== null) {
            velocidadFinal = corregida.valores.velocidadCorregidaKmh;
          }
        } else {
          nodos.push(
            pintarResultado({
              etiqueta: 'Velocidad real del reporte',
              valor: aSistema('velocidad', velocidadTeorica, sistema),
              unidad: unidadVelocidad,
              decimales: 2,
              principal: true,
            })
          );
        }

        const resultadoAvance =
          modo === 'reporte'
            ? avanceDesdeReporte({
                segundosPorTramo: campoSegundos.obtener(),
                distanciaReferencia: p.geometria.distanciaReferencia,
                largoTabla: p.geometria.largoTabla,
              })
            : avance({
                velocidadKmh: velocidadFinal,
                distanciaReferencia: p.geometria.distanciaReferencia,
                largoTabla: p.geometria.largoTabla,
              });

        nodos.push(
          el(
            'div',
            { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
            pintarResultado({
              etiqueta: 'Segundos por tramo',
              valor: resultadoAvance.valores.segundosPorTramo,
              unidad: 's',
              decimales: 1,
            }),
            pintarResultado({
              etiqueta: 'Tramos por tabla',
              valor: resultadoAvance.valores.tramosPorTabla,
              unidad: '',
              decimales: 2,
            })
          ),
          pintarResultado({
            etiqueta: `Tiempo total por tabla (${formatearTiempo(resultadoAvance.valores.tiempoTotalS)})`,
            valor: resultadoAvance.valores.tiempoTotalS,
            unidad: 's',
            decimales: 0,
          }),
          pintarDesglose(resultadoAvance.desglose)
        );

        if (modo === 'reporte') {
          pintarMarchasQueReproducen(velocidadTeorica);
        }
      } else if (modo === 'reporte') {
        reemplazar(zonaMarchasQueReproducen);
      }
    } catch (error) {
      nodos.push(
        el(
          'div',
          { clase: 'alerta alerta--destructiva', role: 'alert' },
          el('p', { clase: 'alerta__descripcion' }, String(error.message ?? error))
        )
      );
    }

    reemplazar(zonaResultados, nodos);
    pintarTdf();
    pintarGeometria();
  }

  function pintarMarchasQueReproducen(velocidadObjetivoKmh) {
    const filas = marchasParaVelocidad({ tractor, velocidadObjetivoKmh });
    reemplazar(
      zonaMarchasQueReproducen,
      el('h3', { clase: 'etiqueta' }, 'Marchas que reproducen esta velocidad'),
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
              el('th', {}, 'Marcha'),
              el('th', {}, 'rpm requeridas'),
              el('th', {}, 'Estado')
            )
          ),
          el(
            'tbody',
            {},
            filas.map((fila) =>
              el(
                'tr',
                {},
                el('td', {}, fila.etiqueta),
                el('td', { clase: 'numero' }, formatear(fila.rpmRequeridas, 0)),
                el(
                  'td',
                  {},
                  fila.fueraDeRango
                    ? el('span', { clase: 'badge badge--destructivo' }, 'fuera de rango')
                    : el('span', { clase: 'badge badge--secundario' }, 'en rango')
                )
              )
            )
          )
        )
      ),
      el(
        'p',
        { clase: 'ayuda' },
        `Rango de trabajo del motor: ${tractor.regimenMinimo} a ${tractor.regimenMaximo} rpm.`
      )
    );
  }

  function pintarTdf() {
    const equipo = ctx.equipoActivo();
    const rpm = modo === 'marcha' ? campoRpm.obtener() : null;
    const nodos = [];
    if (!equipo) {
      nodos.push(el('p', { clase: 'texto-suave' }, 'Sin equipo de aplicacion configurado.'));
    } else if (equipo.accionamiento !== 'tdf') {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'La bomba de este equipo no es de TDF: su velocidad no depende del regimen del motor.'
        )
      );
    } else if (rpm === null) {
      nodos.push(
        el('p', { clase: 'texto-suave' }, 'Captura el regimen en el modo de marcha para ver la TDF.')
      );
    } else {
      const resultado = tdfRpm({
        tdfNominal: equipo.tdfNominal,
        rpmMotor: rpm,
        rpmMotorTdfNominal: equipo.rpmMotorTdfNominal,
      });
      nodos.push(
        el(
          'div',
          { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
          pintarResultado({
            etiqueta: 'TDF resultante',
            valor: resultado.valores.tdfRpm,
            unidad: 'rpm',
            decimales: 0,
          }),
          pintarResultado({
            etiqueta: 'Porcentaje del nominal',
            valor: resultado.valores.porcentajeNominal,
            unidad: '%',
            decimales: 1,
          })
        ),
        pintarDesglose(resultado.desglose)
      );
      if (equipo.rpmCalibracion === null || equipo.rpmCalibracion === undefined) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta', role: 'status' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              'No hay registrado el regimen de la ultima calibracion de presion. Capturalo en Configuracion para que la aplicacion pueda advertir el efecto del regimen sobre el gasto de la barra.'
            )
          )
        );
      } else if (Math.abs(rpm - equipo.rpmCalibracion) > 1) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--advertencia', role: 'alert' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              `Estas operando a ${formatear(rpm, 0)} rpm y la ultima calibracion de presion fue a ${formatear(equipo.rpmCalibracion, 0)} rpm. El efecto sobre el gasto depende del tipo de bomba: revisa el contraste en Gasto de agua. El aforo al regimen real manda.`
            )
          )
        );
      }
    }
    reemplazar(zonaTdf, nodos);
  }

  function pintarGeometria() {
    const g = geometria(parametrosGeometria());
    reemplazar(
      zonaGeometria,
      el(
        'div',
        { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
        pintarResultado({ etiqueta: 'Area por tabla', valor: g.valores.areaM2, unidad: 'm2', decimales: 2 }),
        pintarResultado({
          etiqueta: 'Hectareas por tabla',
          valor: g.valores.hectareasPorTabla,
          unidad: 'ha',
          decimales: 4,
        }),
        pintarResultado({
          etiqueta: 'Tramos por tabla',
          valor: g.valores.tramosPorTabla,
          unidad: '',
          decimales: 2,
        }),
        pintarResultado({
          etiqueta: 'Espaciamiento efectivo',
          valor: g.valores.espaciamientoEfectivo,
          unidad: 'm',
          decimales: 4,
        })
      ),
      ...pintarAvisos(g.avisos),
      el(
        'p',
        { clase: 'ayuda' },
        'Derivados de la geometria configurada; se editan en Sistema, Configuracion.'
      )
    );
  }

  async function abrirCalibracion() {
    const fila = marchaSeleccionada
      ? filasMarchas.find(
          (f) => f.rango === marchaSeleccionada.rango && f.marcha === marchaSeleccionada.marcha
        )
      : null;
    if (!fila) {
      mostrarToast('Primero elige la marcha que vas a calibrar.', { tipo: 'destructivo' });
      return;
    }
    const p = ctx.estado().parametros;
    const campoSegundosMedidos = crearCampoNumerico({
      etiqueta: `Segundos medidos por tramo de ${p.geometria.distanciaReferencia} m`,
      unidad: 's',
    });
    const campoRpmMedidas = crearCampoNumerico({
      etiqueta: 'Regimen durante la medicion',
      unidad: 'rpm',
      valorInicial: campoRpm.obtener() ?? tractor.regimenHabitual,
    });
    const vista = el('div', {}, campoSegundosMedidos.elemento, campoRpmMedidas.elemento);
    const ok = await confirmar({
      titulo: `Calibrar ${fila.etiqueta} desde una medicion de campo`,
      descripcion:
        'La velocidad nominal de la marcha se recalcula al regimen nominal del tractor y la fila queda marcada como calibrada.',
      cuerpo: vista,
      confirmarTexto: 'Calibrar',
    });
    if (!ok) return;
    const segundos = campoSegundosMedidos.obtener();
    const rpmMedidas = campoRpmMedidas.obtener();
    if (segundos === null || rpmMedidas === null) {
      mostrarToast('Faltan la medicion o el regimen: no se calibro nada.', { tipo: 'destructivo' });
      return;
    }
    try {
      const velocidadMedida = velocidadDesdeReporte({
        segundosPorTramo: segundos,
        distanciaReferencia: p.geometria.distanciaReferencia,
      });
      const nominal = calibrarMarcha({
        velocidadMedidaKmh: velocidadMedida,
        rpmMedidas,
        regimenNominal: tractor.regimenNominal,
      });
      ctx.almacen.actualizar((estado) => {
        const t = estado.tractores.find((x) => x.id === tractor.id);
        const filaEstado = t.velocidades.find(
          (v) => v.rango === fila.rango && v.marcha === fila.marcha
        );
        filaEstado.kmhNominal = nominal;
        filaEstado.origen = 'calibrado';
        filaEstado.fecha = new Date().toISOString();
      }, 'contexto');
      mostrarToast(
        `${fila.etiqueta} calibrada: ${formatear(nominal, 2)} km/h nominales a ${tractor.regimenNominal} rpm.`
      );
    } catch (error) {
      mostrarToast(String(error.message ?? error), { tipo: 'destructivo' });
    }
  }

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Avance',
        descripcion: `Velocidad y tiempo por tabla del ${tractor.nombre}.`,
      },
      el('div', { estilo: { display: 'flex', gap: '0.5rem' } }, botonMarcha, botonReporte),
      zonaMarcha,
      zonaReporte
    ),
    tarjeta({ titulo: 'Resultado' }, zonaResultados),
    tarjeta(
      {
        titulo: 'Toma de fuerza y bomba',
        descripcion: 'Si la bomba es de TDF, su velocidad cae con el regimen del motor.',
      },
      zonaTdf
    ),
    tarjeta({ titulo: 'Geometria derivada' }, zonaGeometria)
  );

  pintarModo();
  pintarSeleccion();
  recalcular();
}
