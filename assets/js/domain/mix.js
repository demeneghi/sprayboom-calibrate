// Dominio B: mezcla en tanque. Hectareas por carga, producto por carga,
// agua por carga y carga parcial del ultimo tanque. Soporta dosis por
// hectarea (el caso normal) y por cada 100 L de caldo (como vienen
// algunas etiquetas); ambas formas se muestran juntas porque
// confundirlas es un error caro.

import { BASE_DOSIS_100L, PORCIENTO } from './constants.js';
import { aviso, requierePositivo, requiereNoNegativo } from './validate.js';
import { paso, redondeoLegible } from './speed.js';
import { compararRutas } from './verify.js';

export const MODOS_DOSIS = ['por-ha', 'por-100L'];

// dosis: { modo: 'por-ha' | 'por-100L', cantidad, unidad: 'L' | 'kg' }
export function mezclaTanque({ volumenTanqueL, lhaAplicacion, dosis = null, areaObjetivoHa = null }) {
  requierePositivo('el volumen del tanque', volumenTanqueL);
  requierePositivo('el volumen de aplicación', lhaAplicacion);

  const hectareasPorCarga = volumenTanqueL / lhaAplicacion;
  const avisos = [];
  const desglose = [
    paso(
      'Hectáreas por carga',
      'volumen_tanque / L_por_ha',
      `${redondeoLegible(volumenTanqueL)} / ${redondeoLegible(lhaAplicacion)}`,
      hectareasPorCarga,
      'ha'
    ),
  ];

  let dosisPorHa = null;
  let dosisPor100L = null;
  let productoPorCarga = null;
  let aguaPorCarga = null;
  let verificacion = null;

  if (dosis !== null && dosis !== undefined) {
    requierePositivo('la dosis de producto', dosis.cantidad);
    if (!MODOS_DOSIS.includes(dosis.modo)) {
      throw new Error(`No se puede calcular: modo de dosis desconocido (${dosis.modo}).`);
    }

    if (dosis.modo === 'por-ha') {
      dosisPorHa = dosis.cantidad;
      // Equivalente por cada 100 L de caldo, porque ambos numeros
      // conviven en las etiquetas.
      dosisPor100L = (dosis.cantidad / lhaAplicacion) * BASE_DOSIS_100L;
      productoPorCarga = dosisPorHa * hectareasPorCarga;
      desglose.push(
        paso(
          'Producto por carga',
          'dosis_por_ha * hectareas_por_carga',
          `${redondeoLegible(dosisPorHa)} * ${redondeoLegible(hectareasPorCarga)}`,
          productoPorCarga,
          dosis.unidad ?? 'L'
        ),
        paso(
          'Equivalente por cada 100 L de caldo',
          'dosis_por_ha / L_por_ha * 100',
          `${redondeoLegible(dosisPorHa)} / ${redondeoLegible(lhaAplicacion)} * ${BASE_DOSIS_100L}`,
          dosisPor100L,
          `${dosis.unidad ?? 'L'}/100 L`
        )
      );
    } else {
      dosisPor100L = dosis.cantidad;
      dosisPorHa = (dosis.cantidad * lhaAplicacion) / BASE_DOSIS_100L;
      productoPorCarga = dosisPorHa * hectareasPorCarga;
      desglose.push(
        paso(
          'Equivalente por hectárea',
          'dosis_por_100L * L_por_ha / 100',
          `${redondeoLegible(dosisPor100L)} * ${redondeoLegible(lhaAplicacion)} / ${BASE_DOSIS_100L}`,
          dosisPorHa,
          `${dosis.unidad ?? 'L'}/ha`
        ),
        paso(
          'Producto por carga',
          'dosis_por_ha * hectareas_por_carga',
          `${redondeoLegible(dosisPorHa)} * ${redondeoLegible(hectareasPorCarga)}`,
          productoPorCarga,
          dosis.unidad ?? 'L'
        )
      );
    }

    // Verificacion redundante gratuita: el producto por carga calculado
    // via dosis por hectarea debe coincidir con la ruta directa por
    // volumen de caldo (dosis_por_100L * tanque / 100).
    const rutaDirecta = (dosisPor100L * volumenTanqueL) / BASE_DOSIS_100L;
    const redundante = compararRutas(productoPorCarga, rutaDirecta);
    verificacion = { redundante };
    if (!redundante.ok) {
      avisos.push(
        aviso(
          'error',
          'calculo-no-verificado',
          'Las dos rutas del producto por carga no coinciden: el resultado no está ' +
            'verificado y no debe usarse. Reporta este error.',
          redundante
        )
      );
    }

    // El agua por carga resta el producto solo si la dosis es liquida
    // (en L); para producto solido el volumen desplazado se desprecia.
    const unidadLiquida = (dosis.unidad ?? 'L') === 'L';
    aguaPorCarga = unidadLiquida ? volumenTanqueL - productoPorCarga : volumenTanqueL;
    desglose.push(
      paso(
        'Agua por carga',
        unidadLiquida ? 'volumen_tanque - producto_por_carga' : 'volumen_tanque (producto solido)',
        unidadLiquida
          ? `${redondeoLegible(volumenTanqueL)} - ${redondeoLegible(productoPorCarga)}`
          : `${redondeoLegible(volumenTanqueL)}`,
        aguaPorCarga,
        'L'
      )
    );
    if (!unidadLiquida) {
      avisos.push(
        aviso(
          'info',
          'producto-solido',
          'La dosis está en unidades de masa: el volumen que desplaza el producto en el ' +
            'tanque se desprecia y el agua por carga es el tanque completo.',
          null
        )
      );
    }
    if (unidadLiquida && productoPorCarga >= volumenTanqueL) {
      avisos.push(
        aviso(
          'advertencia',
          'producto-excede-tanque',
          'El producto por carga iguala o excede el volumen del tanque: revisa la dosis o ' +
            'el volumen de aplicación.',
          { productoPorCarga, volumenTanqueL }
        )
      );
    }
  }

  // Carga parcial para el area objetivo.
  let plan = null;
  if (areaObjetivoHa !== null && areaObjetivoHa !== undefined) {
    requierePositivo('el área objetivo', areaObjetivoHa);
    const caldoTotalL = lhaAplicacion * areaObjetivoHa;
    const cargasCompletas = Math.floor(caldoTotalL / volumenTanqueL);
    const caldoParcialL = caldoTotalL - cargasCompletas * volumenTanqueL;
    const hectareasParciales = caldoParcialL / lhaAplicacion;
    const productoParcial = dosisPorHa === null ? null : dosisPorHa * hectareasParciales;
    plan = {
      caldoTotalL,
      cargasCompletas,
      caldoParcialL,
      hectareasParciales,
      productoParcial,
      tanquesNecesarios: cargasCompletas + (caldoParcialL > 0 ? 1 : 0),
    };
    desglose.push(
      paso(
        'Caldo total para el área objetivo',
        'L_por_ha * area_objetivo',
        `${redondeoLegible(lhaAplicacion)} * ${redondeoLegible(areaObjetivoHa)}`,
        caldoTotalL,
        'L'
      ),
      paso(
        'Cargas completas y carga parcial',
        'piso(caldo_total / tanque); resto',
        `piso(${redondeoLegible(caldoTotalL)} / ${redondeoLegible(volumenTanqueL)}) = ${cargasCompletas}; resto ${redondeoLegible(caldoParcialL)}`,
        caldoParcialL,
        'L'
      )
    );
  }

  return {
    valores: {
      hectareasPorCarga,
      dosisPorHa,
      dosisPor100L,
      productoPorCarga,
      aguaPorCarga,
      plan,
    },
    desglose,
    avisos,
    verificacion,
  };
}

// Utilidad para mostrar juntas las dos formas de dosis.
export function equivalenciaDosis({ modo, cantidad, lhaAplicacion }) {
  requierePositivo('la dosis', cantidad);
  requierePositivo('el volumen de aplicación', lhaAplicacion);
  if (modo === 'por-ha') {
    return { porHa: cantidad, por100L: (cantidad / lhaAplicacion) * BASE_DOSIS_100L };
  }
  if (modo === 'por-100L') {
    return { porHa: (cantidad * lhaAplicacion) / BASE_DOSIS_100L, por100L: cantidad };
  }
  throw new Error(`No se puede calcular: modo de dosis desconocido (${modo}).`);
}

// Porcentaje de desviacion generico entre un valor y su objetivo.
export function desviacionContraObjetivo({ valor, objetivo }) {
  requierePositivo('el objetivo', objetivo);
  requiereNoNegativo('el valor', valor);
  return ((valor - objetivo) / objetivo) * PORCIENTO;
}
