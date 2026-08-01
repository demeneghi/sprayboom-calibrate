// Pestana Mezcla (dominio B): mezcla en tanque. Hectareas por carga,
// dosis del producto SIEMPRE en sus dos formas (por hectarea y por cada
// 100 L de caldo, porque confundirlas es un error caro), producto y
// agua por carga con verificacion redundante, y plan de cargas con la
// carga parcial del ultimo tanque para una superficie objetivo.
//
// Convenciones de la pestana ejemplar (avance.js): borradores con
// autosave en base metrica, resultados con desglose auditable, avisos
// tipados del dominio y errores de calculo atrapados como alerta
// destructiva (jamas NaN en pantalla).

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
import { crearCampoHeredado, fuenteVolumenAplicacion } from '../heredado.js';
import { formatear } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import { redondeoLegible } from '../../domain/speed.js';
import { mezclaTanque, equivalenciaDosis } from '../../domain/mix.js';

export const id = 'mezcla';

const COLUMNA = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
const CUADRICULA_2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const equipo = ctx.equipoActivo();

  const unidadVolumen = unidad('volumen', sistema);
  const unidadAplicacion = unidad('volumenAplicacion', sistema);
  const unidadSuperficie = unidad('superficie', sistema);

  // La dosis se captura y se muestra en unidades de etiqueta (L o kg,
  // por hectarea o por cada 100 L): no se convierte a imperial porque
  // las etiquetas de producto no vienen en esas unidades y traducirlas
  // invita a errores de dosificacion. La conversion imperial aplica a
  // volumenes y superficie.
  let modoDosis = borrador.modoDosis ?? 'por-ha';
  let unidadProducto = borrador.unidadProducto ?? 'L';
  let ultimoCalculo = null; // datos planos listos para bitacora

  // Valor inicial de un campo: el borrador vive en base metrica y se
  // muestra convertido al sistema vigente, con redondeo legible para no
  // pintar colas de flotante en el input.
  function precarga(magnitud, valorMetrico) {
    if (valorMetrico === null || valorMetrico === undefined) return null;
    return redondeoLegible(aSistema(magnitud, valorMetrico, sistema));
  }

  function alertaDestructiva(error) {
    return el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    );
  }

  // Unidad compuesta de la dosis en unidades de etiqueta.
  function etiquetaDosis(forma) {
    return forma === 'por-ha' ? `${unidadProducto}/ha` : `${unidadProducto}/100 L`;
  }

  // ---------------- Captura ----------------
  const campoTanque = crearCampoNumerico({
    etiqueta: 'Volumen del tanque',
    unidad: unidadVolumen,
    valorInicial: precarga('volumen', borrador.volumenTanqueL ?? equipo?.volumenTanque ?? null),
    ayuda: equipo
      ? `Viene del tanque de la barra activa (${equipo.nombre}). Cámbialo si hoy cargas distinto.`
      : 'No hay barra configurada: escribe el volumen del tanque a mano.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { volumenTanqueL: deSistema('volumen', valor, sistema) });
      recalcular();
    },
  });

  // Toda la mezcla depende de este numero, y hasta ahora habia que
  // copiarlo a mano: la ayuda decia «usa el L/ha real de Gasto de agua o
  // de la prueba de captura» sin que hubiera forma de traerlo. Ahora se
  // hereda, con el aforo mandando sobre el calculo y su procedencia a la
  // vista.
  const fuenteVolumen = fuenteVolumenAplicacion(ctx);
  const campoAplicacion = crearCampoHeredado({
    ctx,
    tabId: id,
    clave: 'lhaAplicacionLha',
    claveManual: 'lhaAplicacionManual',
    etiqueta: 'Volumen de aplicación',
    unidad: unidadAplicacion,
    ayuda:
      'El L/ha REAL con el que va a salir la barra: de este número depende toda la mezcla. ' +
      'Viene del aforo y, si no lo hay, de Gasto de agua.',
    fuente: fuenteVolumen.fuente,
    nombreDato: 'el volumen de aplicación',
    heredado: { valor: fuenteVolumen.valor, etiqueta: fuenteVolumen.etiqueta },
    aCampo: (lha) =>
      Number.isFinite(lha)
        ? Number(aSistema('volumenAplicacion', lha, sistema).toPrecision(6))
        : null,
    deCampo: (valor) => deSistema('volumenAplicacion', valor, sistema),
    formatearValor: (valor) => `${formatear(valor, 1)} ${unidadAplicacion}`,
    destino: fuenteVolumen.destino,
    textoSinDato:
      'Calcula el gasto de agua o afora la barra en la prueba de captura, o escribe aquí el ' +
      'volumen de aplicación.',
    guardadoSinMarcaEsManual: true,
    alCambiar: () => recalcular(),
  });

  const campoDosis = crearCampoNumerico({
    etiqueta: 'Dosis del producto',
    unidad: '',
    valorInicial: borrador.dosisCantidad ?? null,
    ayuda: 'La cantidad tal como viene en la etiqueta, con la forma y la unidad de abajo.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { dosisCantidad: valor });
      recalcular();
    },
  });

  const selectModoDosis = crearCampoSelect({
    etiqueta: 'Forma de la dosis',
    opciones: [
      { valor: 'por-ha', texto: 'Por hectárea' },
      { valor: 'por-100L', texto: 'Por cada 100 L de caldo' },
    ],
    valorInicial: modoDosis,
    ayuda: 'Las dos formas en que viene una etiqueta. Revisa la tuya antes de elegir.',
    alCambiar: (valor) => {
      modoDosis = valor;
      ctx.guardarBorrador(id, { modoDosis });
      recalcular();
    },
  });

  const selectUnidadProducto = crearCampoSelect({
    etiqueta: 'Unidad del producto',
    opciones: [
      { valor: 'L', texto: 'L (producto líquido)' },
      { valor: 'kg', texto: 'kg (producto sólido)' },
    ],
    valorInicial: unidadProducto,
    ayuda: 'Si el producto es sólido, lo que ocupa en el tanque no se cuenta.',
    alCambiar: (valor) => {
      unidadProducto = valor;
      ctx.guardarBorrador(id, { unidadProducto });
      recalcular();
    },
  });

  const campoSuperficie = crearCampoNumerico({
    etiqueta: 'Superficie objetivo (opcional)',
    unidad: unidadSuperficie,
    valorInicial: precarga('superficie', borrador.superficieObjetivoHa ?? null),
    ayuda: 'Si la pones, se arma el plan de cargas con el último tanque a medias.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { superficieObjetivoHa: deSistema('superficie', valor, sistema) });
      recalcular();
    },
  });

  // Lecturas siempre en base metrica: la conversion imperial vive solo
  // en la frontera de captura y de pintado.
  function lecturas() {
    return {
      volumenTanqueL: deSistema('volumen', campoTanque.obtener(), sistema),
      lhaAplicacion: deSistema('volumenAplicacion', campoAplicacion.obtener(), sistema),
      cantidadDosis: campoDosis.obtener(),
      superficieObjetivoHa: deSistema('superficie', campoSuperficie.obtener(), sistema),
    };
  }

  // ---------------- Dosis en las dos formas ----------------
  const zonaEquivalencia = el('div', { estilo: COLUMNA });

  function pintarEquivalencia() {
    const nodos = [];
    try {
      const { lhaAplicacion, cantidadDosis } = lecturas();
      if (cantidadDosis === null || lhaAplicacion === null) {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Captura el volumen de aplicación y la dosis para ver la equivalencia.'
          )
        );
      } else {
        const eq = equivalenciaDosis({ modo: modoDosis, cantidad: cantidadDosis, lhaAplicacion });
        nodos.push(
          el(
            'div',
            { estilo: CUADRICULA_2 },
            pintarResultado({
              etiqueta: 'Por hectárea',
              valor: eq.porHa,
              unidad: `${unidadProducto}/ha`,
              decimales: 3,
              principal: modoDosis === 'por-ha',
            }),
            pintarResultado({
              etiqueta: 'Por cada 100 L de caldo',
              valor: eq.por100L,
              unidad: `${unidadProducto}/100 L`,
              decimales: 3,
              principal: modoDosis === 'por-100L',
            })
          ),
          el(
            'p',
            { clase: 'ayuda' },
            'Si cambia el L/ha, la misma dosis por 100 L entrega otra cantidad por hectárea.'
          )
        );
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaEquivalencia, nodos);
  }

  // ---------------- Resultado por carga y plan ----------------
  const zonaCarga = el('div', { estilo: COLUMNA });
  const zonaPlan = el('div', { estilo: COLUMNA });

  function pintarPlan(resultado, hayDosis, confiable) {
    const plan = resultado.valores.plan;
    if (!plan) {
      reemplazar(
        zonaPlan,
        el(
          'p',
          { clase: 'texto-suave' },
          'Captura la superficie objetivo para armar el plan de cargas.'
        )
      );
      return;
    }
    const nodos = [
      el(
        'div',
        { estilo: CUADRICULA_2 },
        pintarResultado({
          etiqueta: 'Caldo total',
          valor: aSistema('volumen', plan.caldoTotalL, sistema),
          unidad: unidadVolumen,
          decimales: 0,
        }),
        pintarResultado({
          etiqueta: 'Cargas completas',
          valor: plan.cargasCompletas,
          unidad: '',
          decimales: 0,
        }),
        pintarResultado({
          etiqueta: 'Tanques necesarios',
          valor: plan.tanquesNecesarios,
          unidad: '',
          decimales: 0,
        }),
        pintarResultado({
          etiqueta: 'Superficie por carga',
          valor: aSistema('superficie', resultado.valores.hectareasPorCarga, sistema),
          unidad: unidadSuperficie,
          decimales: 2,
        })
      ),
    ];
    if (plan.caldoParcialL > 0) {
      nodos.push(
        el('h3', { clase: 'etiqueta' }, 'Carga parcial del último tanque'),
        pintarResultado({
          etiqueta: 'Caldo a preparar',
          valor: aSistema('volumen', plan.caldoParcialL, sistema),
          unidad: unidadVolumen,
          decimales: 0,
          principal: true,
        }),
        el(
          'div',
          { estilo: CUADRICULA_2 },
          hayDosis
            ? confiable
              ? pintarResultado({
                  etiqueta: 'Producto en la carga parcial',
                  valor: plan.productoParcial,
                  unidad: unidadProducto,
                  decimales: 2,
                })
              : pintarResultadoNoVerificado('Producto en la carga parcial')
            : null,
          pintarResultado({
            etiqueta: 'Superficie restante',
            valor: aSistema('superficie', plan.hectareasParciales, sistema),
            unidad: unidadSuperficie,
            decimales: 2,
          })
        ),
        el(
          'p',
          { clase: 'ayuda' },
          'El último tanque no va completo: prepara solo este caldo y no te sobra mezcla.'
        )
      );
    } else {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'La superficie objetivo cierra en cargas completas: no hay carga parcial.'
        )
      );
    }
    reemplazar(zonaPlan, nodos);
  }

  function pintarCarga() {
    const nodos = [];
    ultimoCalculo = null;
    try {
      const { volumenTanqueL, lhaAplicacion, cantidadDosis, superficieObjetivoHa } = lecturas();
      if (volumenTanqueL === null || lhaAplicacion === null) {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Captura el volumen del tanque y el volumen de aplicación para calcular.'
          )
        );
        reemplazar(zonaCarga, nodos);
        reemplazar(
          zonaPlan,
          el('p', { clase: 'texto-suave' }, 'El plan de cargas se calcula con la captura de arriba.')
        );
        return;
      }
      const dosis =
        cantidadDosis === null
          ? null
          : { modo: modoDosis, cantidad: cantidadDosis, unidad: unidadProducto };
      const resultado = mezclaTanque({
        volumenTanqueL,
        lhaAplicacion,
        dosis,
        areaObjetivoHa: superficieObjetivoHa,
      });
      const confiable = resultadoConfiable(resultado);

      nodos.push(...pintarAvisos(resultado.avisos));
      nodos.push(
        pintarResultado({
          etiqueta: 'Superficie por carga',
          valor: aSistema('superficie', resultado.valores.hectareasPorCarga, sistema),
          unidad: unidadSuperficie,
          decimales: 2,
          principal: dosis === null,
        })
      );

      if (dosis !== null) {
        // Gate de verificacion redundante: el producto por carga se
        // calcula por dos rutas (via dosis por hectarea y via volumen de
        // caldo); si no coinciden, el numero NO se muestra.
        nodos.push(
          confiable
            ? pintarResultado({
                etiqueta: 'Producto por carga',
                valor: resultado.valores.productoPorCarga,
                unidad: unidadProducto,
                decimales: 2,
                principal: true,
              })
            : pintarResultadoNoVerificado('Producto por carga'),
          pintarResultado({
            etiqueta: 'Agua por carga',
            valor: aSistema('volumen', resultado.valores.aguaPorCarga, sistema),
            unidad: unidadVolumen,
            decimales: 1,
          }),
          el(
            'div',
            { estilo: CUADRICULA_2 },
            pintarResultado({
              etiqueta: 'Dosis por hectárea',
              valor: resultado.valores.dosisPorHa,
              unidad: `${unidadProducto}/ha`,
              decimales: 3,
            }),
            pintarResultado({
              etiqueta: 'Dosis por cada 100 L',
              valor: resultado.valores.dosisPor100L,
              unidad: `${unidadProducto}/100 L`,
              decimales: 3,
            })
          ),
          pintarVerificacion(resultado.verificacion)
        );
      } else {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Sin dosis capturada: solo se calculan la superficie por carga y el plan de caldo.'
          )
        );
      }

      nodos.push(pintarDesglose(resultado.desglose));

      if (confiable) {
        ultimoCalculo = {
          volumenTanqueL,
          lhaAplicacion,
          modoDosis: dosis === null ? null : modoDosis,
          unidadProducto: dosis === null ? null : unidadProducto,
          dosisCantidad: cantidadDosis,
          dosisPorHa: resultado.valores.dosisPorHa,
          dosisPor100L: resultado.valores.dosisPor100L,
          productoPorCarga: resultado.valores.productoPorCarga,
          aguaPorCarga: resultado.valores.aguaPorCarga,
          hectareasPorCarga: resultado.valores.hectareasPorCarga,
          superficieObjetivoHa,
          caldoTotalL: resultado.valores.plan?.caldoTotalL ?? null,
          cargasCompletas: resultado.valores.plan?.cargasCompletas ?? null,
          caldoParcialL: resultado.valores.plan?.caldoParcialL ?? null,
          hectareasParciales: resultado.valores.plan?.hectareasParciales ?? null,
          productoParcial: resultado.valores.plan?.productoParcial ?? null,
          tanquesNecesarios: resultado.valores.plan?.tanquesNecesarios ?? null,
        };
      }

      pintarPlan(resultado, dosis !== null, confiable);
    } catch (error) {
      nodos.push(alertaDestructiva(error));
      reemplazar(
        zonaPlan,
        el('p', { clase: 'texto-suave' }, 'Corrige la captura para calcular el plan de cargas.')
      );
    }
    reemplazar(zonaCarga, nodos);
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
    let resumen =
      `${formatear(c.hectareasPorCarga, 2)} ha por carga con tanque de ` +
      `${formatear(c.volumenTanqueL, 0)} L a ${formatear(c.lhaAplicacion, 1)} L/ha`;
    if (c.dosisCantidad !== null) {
      resumen +=
        `; ${formatear(c.productoPorCarga, 2)} ${c.unidadProducto} de producto y ` +
        `${formatear(c.aguaPorCarga, 0)} L de agua por carga`;
    }
    if (c.superficieObjetivoHa !== null && c.tanquesNecesarios !== null) {
      resumen += `; ${formatear(c.superficieObjetivoHa, 2)} ha objetivo en ${formatear(c.tanquesNecesarios, 0)} tanque(s)`;
    }
    resumen += '.';
    const registroBase = {
      id: `mezcla-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'mezcla',
      fecha: new Date().toISOString(),
      titulo:
        c.dosisCantidad === null
          ? 'Mezcla en tanque: solo caldo'
          : `Mezcla en tanque: ${formatear(c.dosisCantidad, 2)} ${etiquetaDosis(c.modoDosis)}`,
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
    mostrarToast('Cálculo de mezcla guardado en la bitácora.');
  });

  function recalcular() {
    pintarEquivalencia();
    pintarCarga();
  }

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Mezcla en tanque',
        descripcion:
          'Cuánto producto y cuánta agua van en cada carga, a partir del volumen de aplicación real.',
      },
      campoTanque.elemento,
      campoAplicacion.elemento,
      campoDosis.elemento,
      selectModoDosis.elemento,
      selectUnidadProducto.elemento,
      campoSuperficie.elemento
    ),
    tarjeta(
      {
        titulo: 'Dosis en las dos formas',
        descripcion:
          'Por hectárea y por cada 100 L de caldo, siempre juntas: confundirlas es un error caro.',
      },
      zonaEquivalencia
    ),
    tarjeta(
      {
        titulo: 'Resultado por carga',
        descripcion: 'Producto y agua para una carga completa del tanque.',
      },
      zonaCarga,
      botonBitacora
    ),
    tarjeta(
      {
        titulo: 'Plan de cargas',
        descripcion:
          'Cargas completas y carga parcial del último tanque para la superficie objetivo.',
      },
      zonaPlan
    )
  );

  recalcular();
}
