// Pestana Gas etileno (dominio C): los cuatro modos del rotametro.
//
// Modos con botones segmentados (convencion de avance.js): consumo
// (masa), presion requerida, tiempo requerido y lectura del flotador.
// La masa por pie cubico estandar efectiva del gas activo se muestra
// SIEMPRE, con badge de anulacion manual o derivacion y su desglose.
// Los DOS instrumentos de la linea se dibujan en SVG desde su escala
// configurada —el tubo del rotametro y el manometro de la entrada— y
// son ademas la superficie de captura: se toca el dibujo, o se sube y
// baja con los botones mas y menos, y el escalon es la resolucion
// legible del aparato. El flotador y la aguja se posicionan en el valor
// vigente del modo; fuera de escala se fijan al extremo en color de
// advertencia mostrando el numero real, nunca recortado. El modo que
// DESPEJA una de las dos variables deja de capturarla: ahi el
// instrumento es un resultado.
//
// Convenciones de la pestana ejemplar: borradores con autosave en base
// metrica, resultados con desglose auditable, avisos tipados, gate de
// verificacion y errores de dominio atrapados como alerta destructiva
// (jamas NaN en pantalla).

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
import { crearCampoNumerico } from '../campos.js';
import { formatear, formatearTiempo } from '../formato.js';
import { nodosTubo } from './gas/tubo.js';
import { nodosManometro } from './gas/manometro.js';
import { decimalesDe, ajustar } from './gas/escala.js';
import { mostrarToast } from '../toast.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import {
  redondeoLegible,
  marchasDeTractor,
  velocidadEfectiva,
  factorDesviacion,
  velocidadCorregida,
  avance,
  avanceDesdeReporte,
} from '../../domain/speed.js';
import { masaGas, despejePresion, despejeTiempo, despejeScfm } from '../../domain/flowmeter.js';
import { valorDefault } from '../../domain/defaults.js';
import { gPorScfEfectivo } from '../../domain/gas.js';

export const id = 'gas';

const GRID_2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };
const COLUMNA = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };

const MODOS = [
  { id: 'masa', etiqueta: 'Consumo (masa)', descripcion: 'consumo de gas' },
  { id: 'presion', etiqueta: 'Presión requerida', descripcion: 'presión requerida' },
  { id: 'tiempo', etiqueta: 'Tiempo requerido', descripcion: 'tiempo requerido' },
  { id: 'lectura', etiqueta: 'Lectura del flotador', descripcion: 'lectura del flotador' },
];

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const tractor = ctx.tractorActivo();
  const unidadMasa = unidad('masa', sistema);
  const decMasa = sistema === 'imperial' ? 2 : 1;

  let modo = borrador.modo ?? 'masa';
  let gEfectivoValor = null; // g/SCF confiable listo para calcular
  let gEfectivoAnulado = null;
  let lecturaTubo = null; // SCFM vigente del modo (capturada o despejada)
  let presionAguja = null; // psi vigente del modo (capturada o despejada)
  let ultimoCalculo = null; // datos planos listos para bitacora

  function alertaDestructiva(error) {
    return el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    );
  }

  // Valor inicial de un campo de masa: el borrador vive en gramos y se
  // muestra convertido al sistema vigente con redondeo legible.
  function precargaMasa(valorG) {
    if (valorG === null || valorG === undefined) return null;
    return redondeoLegible(aSistema('masa', valorG, sistema));
  }

  // ---------------- Modo ----------------
  const botonesModo = new Map();
  const filaModos = el('div', { clase: 'grupo-modo' });
  for (const def of MODOS) {
    const boton = el('button', { clase: 'boton boton--contorno', 'aria-pressed': 'false' }, def.etiqueta);
    boton.addEventListener('click', () => {
      modo = def.id;
      ctx.guardarBorrador(id, { modo });
      pintarModo();
      recalcular();
    });
    botonesModo.set(def.id, boton);
    filaModos.append(boton);
  }

  function pintarModo() {
    for (const [modoId, boton] of botonesModo) {
      // El resalte del modo elegido lo pinta components.css desde
      // `aria-pressed`: no se intercambian variantes de boton aqui.
      boton.setAttribute('aria-pressed', modoId === modo ? 'true' : 'false');
    }
    // Cada modo despeja una variable: su campo se oculta y los otros
    // tres se capturan.
    campoMasa.elemento.classList.toggle('oculto', modo === 'masa');
    campoScfm.elemento.classList.toggle('oculto', modo === 'lectura');
    campoPsi.elemento.classList.toggle('oculto', modo === 'presion');
    campoTiempo.elemento.classList.toggle('oculto', modo === 'tiempo');
    botonTiempoAvance.classList.toggle('oculto', modo === 'tiempo');
  }

  // ---------------- Campos (todos con borrador) ----------------
  const campoMasa = crearCampoNumerico({
    etiqueta: 'Masa de gas objetivo',
    unidad: unidadMasa,
    valorInicial: precargaMasa(borrador.masaObjetivoG ?? null),
    ayuda: 'La masa de etileno que se quiere inyectar en la corrida.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { masaObjetivoG: deSistema('masa', valor, sistema) });
      recalcular();
    },
  });

  const campoScfm = crearCampoNumerico({
    etiqueta: 'Lectura del flotador',
    unidad: 'SCFM',
    valorInicial: borrador.scfm ?? null,
    ayuda: 'La raya de la escala donde flota la bola, en pies cúbicos estándar por minuto.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { scfm: valor });
      recalcular();
    },
  });

  const campoPsi = crearCampoNumerico({
    etiqueta: 'Presión manométrica en el rotámetro',
    unidad: 'psi',
    valorInicial: borrador.psiManometrica ?? null,
    ayuda:
      'La presión del manómetro a la entrada del tubo. La escala está calibrada a la presión estándar: con el gas comprimido el flotador subestima el flujo real y la corrección lo compensa.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { psiManometrica: valor });
      recalcular();
    },
  });

  const campoTiempo = crearCampoNumerico({
    etiqueta: 'Tiempo de inyección',
    unidad: 's',
    valorInicial: borrador.tiempoS ?? null,
    ayuda: 'Tiempo con la válvula abierta. Para una tabla completa, tráelo de Avance con el botón de abajo.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { tiempoS: valor });
      recalcular();
    },
  });

  const botonTiempoAvance = el(
    'button',
    { clase: 'boton boton--contorno' },
    'Usar el tiempo por tabla de Avance'
  );
  botonTiempoAvance.addEventListener('click', traerTiempoDeAvance);

  function traerTiempoDeAvance() {
    const capturaAvance = ctx.borrador('avance');
    const p = ctx.estado().parametros;
    try {
      let resultadoAvance = null;
      let origen = '';
      if (capturaAvance.segundosPorTramo !== null && capturaAvance.segundosPorTramo !== undefined) {
        resultadoAvance = avanceDesdeReporte({
          segundosPorTramo: capturaAvance.segundosPorTramo,
          distanciaReferencia: p.geometria.distanciaReferencia,
          largoTabla: p.geometria.largoTabla,
        });
        origen = 'del reporte de campo';
      } else if (
        capturaAvance.marcha &&
        capturaAvance.rpm !== null &&
        capturaAvance.rpm !== undefined
      ) {
        const fila = marchasDeTractor(tractor).find(
          (f) => f.rango === capturaAvance.marcha.rango && f.marcha === capturaAvance.marcha.marcha
        );
        if (fila && fila.kmhNominal !== null) {
          const teorica = velocidadEfectiva({
            kmhNominal: fila.kmhNominal,
            rpm: capturaAvance.rpm,
            regimenNominal: tractor.regimenNominal,
          });
          const mediciones = ctx
            .estado()
            .factoresDesviacion.filter((m) => m.tractorId === tractor.id)
            .map((m) => ({ rpm: m.rpm, factor: m.factor }));
          const factor = factorDesviacion({ mediciones, rpm: capturaAvance.rpm });
          const corregida = velocidadCorregida({
            velocidadTeoricaKmh: teorica,
            factor: factor.factor,
            umbralDesviacionPct: p.umbrales.umbralDesviacionVelocidad,
          });
          const velocidadKmh = corregida.valores.velocidadCorregidaKmh ?? teorica;
          resultadoAvance = avance({
            velocidadKmh,
            distanciaReferencia: p.geometria.distanciaReferencia,
            largoTabla: p.geometria.largoTabla,
          });
          origen =
            corregida.valores.velocidadCorregidaKmh !== null
              ? `de la marcha ${fila.etiqueta} con factor medido`
              : `de la marcha ${fila.etiqueta} (teórica sin verificar)`;
        }
      }
      if (!resultadoAvance) {
        mostrarToast(
          'No hay datos utilizables en Avance: captura ahí los segundos por tramo o una marcha con régimen.',
          { tipo: 'destructivo' }
        );
        return;
      }
      const tiempo = Math.round(resultadoAvance.valores.tiempoTotalS * 10) / 10;
      campoTiempo.fijar(tiempo);
      ctx.guardarBorrador(id, { tiempoS: tiempo });
      recalcular();
      mostrarToast(`Tiempo por tabla traído ${origen}: ${formatearTiempo(tiempo)}.`);
    } catch (error) {
      mostrarToast(String(error?.message ?? error), { tipo: 'destructivo' });
    }
  }

  function lecturas() {
    return {
      masaObjetivoG: deSistema('masa', campoMasa.obtener(), sistema),
      scfm: campoScfm.obtener(),
      psiManometrica: campoPsi.obtener(),
      tiempoS: campoTiempo.obtener(),
    };
  }

  // ---------------- Captura desde el instrumento ----------------
  // Los dos numeros que se leen en campo —SCFM del flujometro y psi del
  // manometro— se capturan tocando el dibujo o con los botones mas y
  // menos, sin teclado y con guantes. El campo de texto sigue siendo el
  // mismo: aqui solo se escribe en el, se guarda el borrador y se
  // recalcula, igual que si la persona lo hubiera tecleado.

  function fijarCaptura(campo, clave, valor) {
    campo.fijar(String(valor));
    ctx.guardarBorrador(id, { [clave]: valor });
    recalcular();
  }

  // Fila de captura: menos, cifra grande y mas. El escalon es la
  // resolucion legible del instrumento, no un numero inventado aqui.
  function filaPasos({ campo, clave, etiqueta, unidad, paso, minimo, maximo, arranque }) {
    const decimales = decimalesDe(paso);
    const cifra = el('span', { clase: 'captura__valor' }, '—');
    const unidadNodo = el('span', { clase: 'captura__unidad' }, unidad);
    const mover = (signo) => {
      const actual = campo.obtener();
      if (!Number.isFinite(actual)) {
        fijarCaptura(campo, clave, ajustar(arranque, paso, minimo, maximo));
        return;
      }
      // Con un valor ya fuera de escala (tecleado o traido de un
      // despeje), el escalon solo puede ACERCARLO al rango: un boton de
      // mas que baja el numero de golpe al tope se lee como un error.
      const piso = Math.min(minimo, actual);
      const techo = Math.max(maximo, actual);
      fijarCaptura(campo, clave, ajustar(actual + signo * paso, paso, piso, techo));
    };
    const menos = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        type: 'button',
        'aria-label': `Bajar ${etiqueta} un escalón de ${paso} ${unidad}`,
      },
      '−'
    );
    const mas = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        type: 'button',
        'aria-label': `Subir ${etiqueta} un escalón de ${paso} ${unidad}`,
      },
      '+'
    );
    menos.addEventListener('click', () => mover(-1));
    mas.addEventListener('click', () => mover(1));
    const raiz = el('div', { clase: 'captura' }, menos, cifra, unidadNodo, mas);
    return {
      elemento: raiz,
      refrescar(activo) {
        const actual = campo.obtener();
        cifra.textContent = Number.isFinite(actual) ? formatear(actual, decimales) : '—';
        menos.disabled = !activo;
        mas.disabled = !activo;
        raiz.classList.toggle('oculto', !activo);
      },
    };
  }

  // ---------------- Masa por pie cubico estandar (siempre visible) ----
  const zonaGscf = el('div', { estilo: COLUMNA });

  function pintarGscf() {
    const nodos = [];
    gEfectivoValor = null;
    gEfectivoAnulado = null;
    const gas = ctx.gasActivo();
    const p = ctx.estado().parametros;
    if (!gas) {
      nodos.push(
        el(
          'div',
          { clase: 'alerta alerta--destructiva', role: 'alert' },
          el(
            'p',
            { clase: 'alerta__descripcion' },
            'Sin gas configurado: agrégalo en Sistema, Configuración para poder calcular.'
          )
        )
      );
    } else {
      try {
        const efectivo = gPorScfEfectivo({ gas });
        gEfectivoAnulado = efectivo.valores.anulado;
        nodos.push(
          el(
            'div',
            { clase: 'fila-control' },
            efectivo.valores.anulado
              ? el('span', { clase: 'badge badge--advertencia' }, 'ANULADO manualmente')
              : el('span', { clase: 'badge badge--secundario' }, 'derivado del peso molecular'),
            el('span', {}, gas.nombre)
          )
        );
        nodos.push(...pintarAvisos(efectivo.avisos));
        if (!resultadoConfiable(efectivo)) {
          nodos.push(
            pintarResultadoNoVerificado('Masa por pie cúbico estándar'),
            pintarVerificacion(efectivo.verificacion)
          );
        } else {
          gEfectivoValor = efectivo.valores.gPorScf;
          nodos.push(
            pintarResultado({
              etiqueta: 'Masa por pie cúbico estándar',
              valor: efectivo.valores.gPorScf,
              unidad: 'g/SCF',
              decimales: 3,
              principal: true,
            }),
            pintarVerificacion(efectivo.verificacion),
            pintarDesglose(efectivo.desglose)
          );
        }
        nodos.push(
          el(
            'div',
            { estilo: GRID_2 },
            pintarResultado({
              etiqueta: 'Presión estándar de calibración',
              valor: gas.presionEstandarPsia,
              unidad: 'psia',
              decimales: 2,
            }),
            pintarResultado({
              etiqueta: 'Presión atmosférica local',
              valor: ctx.atmosferaSitio().valores.presionPsia,
              unidad: 'psia',
              decimales: 2,
            })
          ),
          el(
            'p',
            { clase: 'ayuda' },
            'Son dos parámetros distintos: la estándar es la condición a la que el fabricante calibró la escala del tubo; la local es la presión absoluta del sitio. El despeje de presión resta la atmosférica LOCAL, no la estándar. ' +
              (ctx.atmosferaSitio().valores.anulado
                ? 'La local está anulada a mano.'
                : `La local sale de los ${formatear(p.sitio.altitudM, 0)} m de altitud del sitio.`) +
              ' Ambas se editan en Sistema, Configuración.'
          )
        );
      } catch (error) {
        nodos.push(alertaDestructiva(error));
      }
    }
    reemplazar(zonaGscf, nodos);
  }

  // ---------------- Resultado por modo ----------------
  const zonaResultado = el('div', { estilo: COLUMNA });

  function pintarCentral() {
    const nodos = [];
    ultimoCalculo = null;
    lecturaTubo = null;
    presionAguja = null;
    try {
      const gas = ctx.gasActivo();
      const p = ctx.estado().parametros;
      const { masaObjetivoG, scfm, psiManometrica, tiempoS } = lecturas();

      // Los instrumentos reflejan lo capturado en cuanto existe, aunque
      // el calculo del modo aun este incompleto. El modo que despeja la
      // variable no la toma de la captura: la pone su resultado.
      if (modo !== 'lectura' && Number.isFinite(scfm)) {
        lecturaTubo = scfm;
      }
      if (modo !== 'presion' && Number.isFinite(psiManometrica)) {
        presionAguja = psiManometrica;
      }

      if (!gas) {
        nodos.push(
          el('p', { clase: 'texto-suave' }, 'Sin gas configurado no hay nada que calcular.')
        );
      } else if (gEfectivoValor === null) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--destructiva', role: 'alert' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              'La masa por pie cúbico estándar no está disponible o no está verificada: revisa la tarjeta de arriba antes de calcular.'
            )
          )
        );
      } else {
        const rotametro = ctx.rotametroActivo();
        const base = {
          gPorScf: gEfectivoValor,
          presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
          presionEstandarCalibracion: gas.presionEstandarPsia,
        };
        const comunes = {
          modo,
          gasId: gas.id,
          gasNombre: gas.nombre,
          gPorScf: gEfectivoValor,
          gPorScfAnulado: gEfectivoAnulado,
          presionEstandarCalibracionPsia: gas.presionEstandarPsia,
          presionAtmosfericaLocalPsia: ctx.presionAtmosfericaLocal(),
          rotametroId: rotametro?.id ?? null,
          rotametroModelo: rotametro?.modelo ?? null,
          escalaMinScfm: rotametro?.escalaMin ?? null,
          escalaMaxScfm: rotametro?.escalaMax ?? null,
        };

        if (modo === 'masa') {
          if (scfm === null || psiManometrica === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura lectura del flotador, presión manométrica y tiempo para calcular la masa inyectada.'
              )
            );
          } else {
            const resultado = masaGas({ scfm, psiManometrica, tiempoS, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Masa de gas inyectada'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Masa de gas inyectada',
                    valor: aSistema('masa', resultado.valores.masaG, sistema),
                    unidad: unidadMasa,
                    decimales: decMasa,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                scfm,
                psiManometrica,
                tiempoS,
                factor: resultado.valores.factor,
                masaG: resultado.valores.masaG,
              };
            }
          }
        } else if (modo === 'presion') {
          if (masaObjetivoG === null || scfm === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, lectura del flotador y tiempo para despejar la presión.'
              )
            );
          } else {
            const resultado = despejePresion({ masaObjetivoG, scfm, tiempoS, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Presión manométrica requerida'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              presionAguja = resultado.valores.psiManometrica;
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Presión manométrica requerida',
                    valor: resultado.valores.psiManometrica,
                    unidad: 'psi',
                    decimales: 2,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor requerido',
                    valor: resultado.valores.factorRequerido,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                scfm,
                tiempoS,
                factorRequerido: resultado.valores.factorRequerido,
                psiManometrica: resultado.valores.psiManometrica,
              };
            }
          }
        } else if (modo === 'tiempo') {
          if (masaObjetivoG === null || scfm === null || psiManometrica === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, lectura del flotador y presión manométrica para despejar el tiempo.'
              )
            );
          } else {
            const resultado = despejeTiempo({ masaObjetivoG, scfm, psiManometrica, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Tiempo requerido'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: `Tiempo requerido (${formatearTiempo(resultado.valores.tiempoS)})`,
                    valor: resultado.valores.tiempoS,
                    unidad: 's',
                    decimales: 0,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                scfm,
                psiManometrica,
                factor: resultado.valores.factor,
                tiempoS: resultado.valores.tiempoS,
              };
            }
          }
        } else if (modo === 'lectura') {
          if (masaObjetivoG === null || psiManometrica === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, presión manométrica y tiempo para despejar la lectura del flotador.'
              )
            );
          } else {
            const resultado = despejeScfm({
              masaObjetivoG,
              psiManometrica,
              tiempoS,
              ...base,
              rotametro: rotametro ?? null,
            });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Lectura de flotador requerida'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              lecturaTubo = resultado.valores.scfm;
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Lectura de flotador requerida',
                    valor: resultado.valores.scfm,
                    unidad: 'SCFM',
                    decimales: 2,
                    principal: true,
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                psiManometrica,
                tiempoS,
                factor: resultado.valores.factor,
                scfm: resultado.valores.scfm,
              };
            }
          }
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaResultado, nodos);
  }

  // ---------------- Bitacora ----------------
  const botonBitacora = el('button', { clase: 'boton' }, 'Guardar en bitácora');
  botonBitacora.addEventListener('click', () => {
    if (!ultimoCalculo) {
      mostrarToast(
        'Completa el cálculo antes de guardar: faltan capturas o el resultado no está verificado.',
        { tipo: 'destructivo' }
      );
      return;
    }
    const c = ultimoCalculo;
    const etiquetaModo = MODOS.find((m) => m.id === c.modo)?.descripcion ?? c.modo;
    let resumen = '';
    if (c.modo === 'masa') {
      resumen =
        `${formatear(c.masaG, 1)} g inyectados con ${formatear(c.scfm, 2)} SCFM a ` +
        `${formatear(c.psiManometrica, 1)} psi durante ${formatearTiempo(c.tiempoS)}.`;
    } else if (c.modo === 'presion') {
      resumen =
        `Se requieren ${formatear(c.psiManometrica, 2)} psi manométricas para ${formatear(c.masaObjetivoG, 1)} g ` +
        `con ${formatear(c.scfm, 2)} SCFM en ${formatearTiempo(c.tiempoS)}.`;
    } else if (c.modo === 'tiempo') {
      resumen =
        `Se requieren ${formatearTiempo(c.tiempoS)} para ${formatear(c.masaObjetivoG, 1)} g ` +
        `con ${formatear(c.scfm, 2)} SCFM a ${formatear(c.psiManometrica, 1)} psi.`;
    } else {
      resumen =
        `Flotador en ${formatear(c.scfm, 2)} SCFM para ${formatear(c.masaObjetivoG, 1)} g ` +
        `a ${formatear(c.psiManometrica, 1)} psi en ${formatearTiempo(c.tiempoS)}.`;
    }
    const registroBase = {
      id: `gas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'gas',
      fecha: new Date().toISOString(),
      titulo: `Gas etileno: ${etiquetaModo}`,
      resumen,
      datos: { ...c },
    };
    ctx.almacen.actualizar((e) => {
      // El snapshot es COPIA de los parametros vigentes, no referencia:
      // el registro historico conserva los numeros con los que se calculo.
      e.bitacora.push({
        ...registroBase,
        parametros: JSON.parse(
          JSON.stringify({
            parametros: e.parametros,
            tractor: ctx.tractorActivo(),
            equipo: ctx.equipoActivo(),
          })
        ),
      });
    }, 'datos');
    mostrarToast('Cálculo de gas guardado en la bitácora.');
  });

  // ---------------- Tubo del rotametro en SVG ----------------
  // El dibujo vive en ./gas/tubo.js: aqui solo se le pasa el estado
  // vigente y se cuelga lo que devuelve.
  const zonaTubo = el('div', { estilo: COLUMNA });

  function dibujarTubo() {
    reemplazar(
      zonaTubo,
      nodosTubo({
        rotametro: ctx.rotametroActivo(),
        lectura: lecturaTubo,
        // En el modo que DESPEJA la lectura el tubo es un resultado.
        capturable: modo !== 'lectura',
        presionEstandarPsia: ctx.gasActivo()?.presionEstandarPsia,
        alCapturar: (valor) => fijarCaptura(campoScfm, 'scfm', valor),
      })
    );
  }

  // ---------------- Manometro en SVG ----------------
  // El fondo de escala y la resolucion de la caratula son parametros
  // (Sistema, Configuracion), igual que la escala del rotametro: aqui no
  // se inventa ningun numero de dominio. El dibujo vive en
  // ./gas/manometro.js.
  const cfgManometro = ctx.estado().parametros.manometro ?? {
    escalaMaxPsi: valorDefault('manometro', 'escalaMaxPsi'),
    resolucionPsi: valorDefault('manometro', 'resolucionPsi'),
  };
  const zonaManometro = el('div', { estilo: COLUMNA });

  function dibujarManometro() {
    reemplazar(
      zonaManometro,
      nodosManometro({
        maxPsi: cfgManometro.escalaMaxPsi,
        resPsi: cfgManometro.resolucionPsi,
        presion: presionAguja,
        capturable: modo !== 'presion',
        alCapturar: (valor) => fijarCaptura(campoPsi, 'psiManometrica', valor),
      })
    );
  }

  // ---------------- Filas de captura rapida ----------------
  const rotametroMontaje = ctx.rotametroActivo();
  const pasosScfm = filaPasos({
    campo: campoScfm,
    clave: 'scfm',
    etiqueta: 'la lectura del flotador',
    unidad: 'SCFM',
    paso: rotametroMontaje?.resolucion > 0 ? rotametroMontaje.resolucion : 0.1,
    minimo: rotametroMontaje?.escalaMin ?? 0,
    maximo: rotametroMontaje?.escalaMax ?? Number.MAX_SAFE_INTEGER,
    arranque: rotametroMontaje?.escalaMin ?? 0,
  });
  const pasosPsi = filaPasos({
    campo: campoPsi,
    clave: 'psiManometrica',
    etiqueta: 'la presión manométrica',
    unidad: 'psi',
    paso: cfgManometro.resolucionPsi,
    minimo: 0,
    maximo: cfgManometro.escalaMaxPsi,
    arranque: 0,
  });

  function recalcular() {
    pintarGscf();
    pintarCentral();
    dibujarTubo();
    dibujarManometro();
    pasosScfm.refrescar(modo !== 'lectura');
    pasosPsi.refrescar(modo !== 'presion');
  }

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Gas etileno',
        descripcion:
          'Los cuatro modos del rotámetro: mide el consumo o despeja la presión, el tiempo o la lectura que logran la masa objetivo.',
      },
      filaModos,
      el(
        'div',
        { estilo: COLUMNA },
        campoMasa.elemento,
        campoScfm.elemento,
        campoPsi.elemento,
        campoTiempo.elemento,
        botonTiempoAvance
      )
    ),
    // Los dos instrumentos van ANTES del resultado: son la superficie de
    // captura de los dos numeros que se leen en campo, no una ilustracion
    // al final de la pantalla.
    tarjeta(
      {
        titulo: 'Tubo del rotámetro',
        descripcion:
          'La escala configurada, con el flotador en la lectura vigente del modo. Es también donde se captura la lectura.',
      },
      zonaTubo,
      pasosScfm.elemento
    ),
    tarjeta(
      {
        titulo: 'Manómetro',
        descripcion:
          'La carátula a la entrada del tubo, con la aguja en la presión vigente del modo. Es también donde se captura la presión.',
      },
      zonaManometro,
      pasosPsi.elemento
    ),
    tarjeta(
      {
        titulo: 'Masa por pie cúbico estándar',
        descripcion: 'El valor efectivo del gas activo que usan todos los modos.',
      },
      zonaGscf
    ),
    tarjeta({ titulo: 'Resultado' }, zonaResultado, botonBitacora)
  );

  pintarModo();
  recalcular();
}
