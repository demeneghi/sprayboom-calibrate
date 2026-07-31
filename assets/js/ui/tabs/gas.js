// Pestana Gas etileno (dominio C): los cuatro modos del rotametro.
//
// Modos con botones segmentados (convencion de avance.js): consumo
// (masa), presion requerida, tiempo requerido y lectura del flotador.
// La masa por pie cubico estandar efectiva del gas activo se muestra
// SIEMPRE, con badge de anulacion manual o derivacion y su desglose.
// El tubo del rotametro se dibuja en SVG desde la escala configurada y
// el flotador se posiciona en la lectura vigente del modo; fuera de
// escala se fija al extremo en color de advertencia mostrando el numero
// real, nunca recortado.
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

// ---------------------------------------------------------------------
// Ayudantes SVG: nodos con createElementNS y texto via textContent.
// Los colores van por style (CSS) para poder usar los tokens del tema.
// ---------------------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg';

function nodoSvg(nombre, atributos = {}, estilos = {}) {
  const nodo = document.createElementNS(SVG_NS, nombre);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined) continue;
    nodo.setAttribute(clave, String(valor));
  }
  for (const [clave, valor] of Object.entries(estilos)) {
    nodo.style[clave] = valor;
  }
  return nodo;
}

function textoSvg(x, y, contenido, opciones = {}) {
  const {
    anclaje = 'start',
    tamano = '11px',
    color = 'hsl(var(--muted-foreground))',
    peso = 'normal',
  } = opciones;
  const nodo = nodoSvg(
    'text',
    { x, y, 'text-anchor': anclaje },
    { fontSize: tamano, fill: color, fontWeight: peso }
  );
  nodo.textContent = contenido;
  return nodo;
}

// Paso de numeracion legible de la escala: el menor candidato que deja
// nueve etiquetas o menos (para la F-550 de 0.5 a 4.5 sale 0.5 SCFM).
// Es una decision de presentacion, no un valor de dominio.
function pasoLegible(amplitud) {
  const candidatos = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
  for (const paso of candidatos) {
    if (amplitud / paso <= 9) return paso;
  }
  return candidatos[candidatos.length - 1];
}

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
              valor: p.sitio.presionAtmosfericaLocal,
              unidad: 'psia',
              decimales: 2,
            })
          ),
          el(
            'p',
            { clase: 'ayuda' },
            'Son dos parámetros distintos: la estándar es la condición a la que el fabricante calibró la escala del tubo; la local es la presión absoluta del sitio. El despeje de presión resta la atmosférica LOCAL, no la estándar. Ambas se editan en Sistema, Configuración.'
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
    try {
      const gas = ctx.gasActivo();
      const p = ctx.estado().parametros;
      const { masaObjetivoG, scfm, psiManometrica, tiempoS } = lecturas();

      // El tubo refleja la lectura capturada en cuanto existe, aunque el
      // calculo del modo aun este incompleto.
      if (modo !== 'lectura' && Number.isFinite(scfm)) {
        lecturaTubo = scfm;
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
          presionAtmosfericaLocal: p.sitio.presionAtmosfericaLocal,
          presionEstandarCalibracion: gas.presionEstandarPsia,
        };
        const comunes = {
          modo,
          gasId: gas.id,
          gasNombre: gas.nombre,
          gPorScf: gEfectivoValor,
          gPorScfAnulado: gEfectivoAnulado,
          presionEstandarCalibracionPsia: gas.presionEstandarPsia,
          presionAtmosfericaLocalPsia: p.sitio.presionAtmosfericaLocal,
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
  const zonaTubo = el('div', { estilo: COLUMNA });

  function dibujarTubo() {
    const rotametro = ctx.rotametroActivo();
    const nodos = [];
    if (!rotametro) {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'Sin rotámetro configurado: agrégalo en Sistema, Configuración para ver el tubo.'
        )
      );
    } else {
      const min = rotametro.escalaMin;
      const max = rotametro.escalaMax;
      const amplitud = max - min;
      if (!(amplitud > 0)) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--destructiva', role: 'alert' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              'La escala del rotámetro configurado no es válida: el mínimo debe ser menor que el máximo.'
            )
          )
        );
      } else {
        const fueraDeEscala = lecturaTubo !== null && (lecturaTubo < min || lecturaTubo > max);
        // Geometria de dibujo (viewBox 240 x 320): tubo conico vertical
        // con la escala a la derecha y la lectura junto al flotador.
        const Y_SUP = 24;
        const Y_INF = 296;
        const CX = 96;
        const eps = amplitud * 1e-6;
        const yDe = (v) => Y_INF - ((v - min) / amplitud) * (Y_INF - Y_SUP);

        const etiquetaAria =
          lecturaTubo === null
            ? `Tubo del rotámetro ${rotametro.modelo}: sin lectura`
            : `Tubo del rotámetro ${rotametro.modelo}: flotador en ${formatear(lecturaTubo, 2)} SCFM` +
              (fueraDeEscala ? ', fuera de escala' : '');
        const svg = nodoSvg(
          'svg',
          { viewBox: '0 0 240 320', role: 'img', 'aria-label': etiquetaAria },
          { width: '100%', maxWidth: '280px', height: 'auto', display: 'block', margin: '0 auto' }
        );

        // Cuerpo del tubo: mas ancho arriba, como el instrumento real.
        svg.append(
          nodoSvg(
            'path',
            { d: `M 72 ${Y_SUP} L 120 ${Y_SUP} L 112 ${Y_INF} L 80 ${Y_INF} Z` },
            { fill: 'hsl(var(--muted))', stroke: 'hsl(var(--border))', strokeWidth: '1.5' }
          )
        );

        // Rayas menores: una por cada resolucion legible del instrumento.
        if (rotametro.resolucion > 0 && amplitud / rotametro.resolucion <= 400) {
          const nRayas = Math.round(amplitud / rotametro.resolucion);
          for (let i = 0; i <= nRayas; i += 1) {
            const v = min + i * rotametro.resolucion;
            if (v > max + eps) break;
            const y = yDe(v);
            svg.append(
              nodoSvg(
                'line',
                { x1: 124, y1: y, x2: 132, y2: y },
                { stroke: 'hsl(var(--border))', strokeWidth: '1' }
              )
            );
          }
        }

        // Rayas mayores con numero, a un paso legible de la escala.
        const paso = pasoLegible(amplitud);
        const kInicio = Math.ceil((min - eps) / paso);
        const kFin = Math.floor((max + eps) / paso);
        for (let k = kInicio; k <= kFin; k += 1) {
          const v = k * paso;
          const y = yDe(Math.min(Math.max(v, min), max));
          svg.append(
            nodoSvg(
              'line',
              { x1: 124, y1: y, x2: 138, y2: y },
              { stroke: 'hsl(var(--muted-foreground))', strokeWidth: '1.5' }
            ),
            textoSvg(142, y + 4, formatear(v, 2, { fijos: false }))
          );
        }
        svg.append(textoSvg(142, 14, 'SCFM', { tamano: '10px' }));

        // Flotador: en la lectura vigente; fuera de escala se fija al
        // extremo en color de advertencia y el numero mostrado es el
        // REAL, nunca el recortado.
        if (lecturaTubo !== null) {
          const lecturaDibujo = Math.min(Math.max(lecturaTubo, min), max);
          const y = yDe(lecturaDibujo);
          const colorFlotador = fueraDeEscala ? 'hsl(var(--warning))' : 'hsl(var(--primary))';
          svg.append(
            nodoSvg(
              'circle',
              { cx: CX, cy: y, r: 13 },
              { fill: colorFlotador, stroke: 'hsl(var(--card))', strokeWidth: '2' }
            ),
            textoSvg(66, y + 4, `${formatear(lecturaTubo, 2)} SCFM`, {
              anclaje: 'end',
              tamano: '12px',
              color: fueraDeEscala ? 'hsl(var(--warning))' : 'hsl(var(--foreground))',
              peso: '600',
            })
          );
        }
        nodos.push(svg);

        if (lecturaTubo === null) {
          nodos.push(
            el(
              'p',
              { clase: 'texto-suave' },
              modo === 'lectura'
                ? 'Sin lectura despejada todavía: completa las capturas del modo para posicionar el flotador.'
                : 'Captura la lectura del flotador para posicionarlo en el tubo.'
            )
          );
        } else if (fueraDeEscala) {
          nodos.push(
            el(
              'div',
              { clase: 'alerta alerta--advertencia', role: 'alert' },
              el(
                'p',
                { clase: 'alerta__descripcion' },
                `La lectura real (${formatear(lecturaTubo, 2)} SCFM) queda fuera de la escala del tubo ` +
                  `(${formatear(min, 2, { fijos: false })} a ${formatear(max, 2, { fijos: false })} SCFM): ` +
                  'el flotador se dibuja fijado al extremo y el número mostrado es el calculado, sin recorte.'
              )
            )
          );
        }
        nodos.push(
          el(
            'p',
            { clase: 'ayuda' },
            `${rotametro.modelo}: escala de ${formatear(min, 2, { fijos: false })} a ` +
              `${formatear(max, 2, { fijos: false })} SCFM, rayas cada ` +
              `${formatear(rotametro.resolucion, 2, { fijos: false })} SCFM. Se edita en Sistema, Configuración.`
          )
        );
      }
    }
    reemplazar(zonaTubo, nodos);
  }

  function recalcular() {
    pintarGscf();
    pintarCentral();
    dibujarTubo();
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
    tarjeta(
      {
        titulo: 'Masa por pie cúbico estándar',
        descripcion: 'El valor efectivo del gas activo que usan todos los modos.',
      },
      zonaGscf
    ),
    tarjeta({ titulo: 'Resultado' }, zonaResultado, botonBitacora),
    tarjeta(
      {
        titulo: 'Tubo del rotámetro',
        descripcion: 'La escala configurada con el flotador en la lectura vigente del modo.',
      },
      zonaTubo
    )
  );

  pintarModo();
  recalcular();
}
