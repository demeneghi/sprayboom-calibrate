// Enlace entre dominios: forzamiento por percolacion.
//
// El gas etileno se disuelve en el agua del tanque y esa solucion se
// aplica con boquillas dirigidas a la roseta. El calculo encadena el
// dominio A (tiempo por tabla), el B (volumen de agua) y el C (ajuste
// del rotametro), y se resuelve en ambos sentidos.
//
// Advertencia estructural que la interfaz debe mostrar SIEMPRE en esta
// pantalla: el etileno es poco soluble en agua; el rotametro mide gas
// INYECTADO, no gas retenido en solucion. El pesaje del cilindro y la
// respuesta agronomica observada tienen prioridad sobre estos numeros.

import { PORCIENTO } from './constants.js';
import { aviso, requierePositivo } from './validate.js';
import { paso, redondeoLegible } from './speed.js';
import { despejeScfm, despejePresion, despejeTiempo, masaGas } from './flowmeter.js';

export const AVISO_SOLUBILIDAD = aviso(
  'info',
  'solubilidad-etileno',
  'El etileno es poco soluble en agua. El rotametro mide gas inyectado, no gas retenido ' +
    'en solucion, y buena parte se escapa por la superficie del tanque. La relacion entre ' +
    'lo inyectado y lo aplicado depende del difusor, de la temperatura del agua y del ' +
    'tiempo entre la carga y la aplicacion. El pesaje del cilindro y la respuesta ' +
    'agronomica observada tienen prioridad sobre cualquier numero calculado aqui.',
  null
);

// Sentido objetivo -> ajuste: dada la dosis agronomica en g/ha, entrega
// masa por tabla, concentracion en tanque y el despeje pedido del
// rotametro ('scfm' | 'psi' | 'tiempo').
export function forzamientoDesdeObjetivo({
  dosisObjetivoGha,
  volumenAguaLha,
  hectareasPorTabla,
  tiempoPorTablaS,
  gPorScf,
  presionAtmosfericaLocal,
  presionEstandarCalibracion,
  modoDespeje = 'scfm',
  scfmDado = null,
  psiDado = null,
  rotametro = null,
  dosisReferenciaGha = null,
  toleranciaAlertaPct = null,
}) {
  requierePositivo('la dosis objetivo', dosisObjetivoGha);
  requierePositivo('las hectareas por tabla', hectareasPorTabla);

  const masaPorTablaG = dosisObjetivoGha * hectareasPorTabla;
  const avisos = [AVISO_SOLUBILIDAD];
  const desglose = [
    paso(
      'Masa de etileno por tabla',
      'dosis_objetivo * hectareas_por_tabla',
      `${redondeoLegible(dosisObjetivoGha)} * ${redondeoLegible(hectareasPorTabla)}`,
      masaPorTablaG,
      'g'
    ),
  ];

  let volumenAguaPorTablaL = null;
  let concentracionGL = null;
  if (volumenAguaLha !== null && volumenAguaLha !== undefined) {
    requierePositivo('el volumen de agua', volumenAguaLha);
    volumenAguaPorTablaL = volumenAguaLha * hectareasPorTabla;
    concentracionGL = masaPorTablaG / volumenAguaPorTablaL;
    desglose.push(
      paso(
        'Volumen de agua por tabla',
        'L_por_ha * hectareas_por_tabla',
        `${redondeoLegible(volumenAguaLha)} * ${redondeoLegible(hectareasPorTabla)}`,
        volumenAguaPorTablaL,
        'L'
      ),
      paso(
        'Concentracion en tanque',
        'masa_por_tabla / volumen_agua_por_tabla',
        `${redondeoLegible(masaPorTablaG)} / ${redondeoLegible(volumenAguaPorTablaL)}`,
        concentracionGL,
        'g/L'
      )
    );
  } else {
    avisos.push(
      aviso(
        'info',
        'volumen-agua-pendiente',
        'El volumen de agua objetivo propio esta pendiente de capturar: sin el no se ' +
          'calcula la concentracion en tanque. Capturalo en la configuracion agronomica.',
        null
      )
    );
  }

  // Despeje del rotametro para inyectar esa masa.
  let ajuste = null;
  if (modoDespeje === 'scfm') {
    requierePositivo('el tiempo por tabla', tiempoPorTablaS);
    ajuste = despejeScfm({
      masaObjetivoG: masaPorTablaG,
      psiManometrica: psiDado,
      tiempoS: tiempoPorTablaS,
      gPorScf,
      presionAtmosfericaLocal,
      presionEstandarCalibracion,
      rotametro,
    });
  } else if (modoDespeje === 'psi') {
    requierePositivo('el tiempo por tabla', tiempoPorTablaS);
    ajuste = despejePresion({
      masaObjetivoG: masaPorTablaG,
      scfm: scfmDado,
      tiempoS: tiempoPorTablaS,
      gPorScf,
      presionAtmosfericaLocal,
      presionEstandarCalibracion,
    });
  } else if (modoDespeje === 'tiempo') {
    ajuste = despejeTiempo({
      masaObjetivoG: masaPorTablaG,
      scfm: scfmDado,
      psiManometrica: psiDado,
      gPorScf,
      presionAtmosfericaLocal,
      presionEstandarCalibracion,
    });
  } else {
    throw new Error(`No se puede calcular: modo de despeje desconocido (${modoDespeje}).`);
  }
  avisos.push(...ajuste.avisos);
  desglose.push(...ajuste.desglose);

  // Cota de sanidad contra la referencia de la literatura.
  let desviacionContraReferenciaPct = null;
  if (
    dosisReferenciaGha !== null &&
    dosisReferenciaGha !== undefined &&
    toleranciaAlertaPct !== null &&
    toleranciaAlertaPct !== undefined
  ) {
    requierePositivo('la dosis de referencia', dosisReferenciaGha);
    desviacionContraReferenciaPct =
      ((dosisObjetivoGha - dosisReferenciaGha) / dosisReferenciaGha) * PORCIENTO;
    if (Math.abs(desviacionContraReferenciaPct) > toleranciaAlertaPct) {
      avisos.push(
        aviso(
          'advertencia',
          'dosis-fuera-de-referencia',
          `La dosis objetivo (${redondeoLegible(dosisObjetivoGha)} g/ha) se aparta ` +
            `${redondeoLegible(Math.abs(desviacionContraReferenciaPct))} % de la referencia de la ` +
            `literatura (${redondeoLegible(dosisReferenciaGha)} g/ha), mas que la tolerancia de ` +
            `${redondeoLegible(toleranciaAlertaPct)} %.`,
          { dosisObjetivoGha, dosisReferenciaGha, desviacionContraReferenciaPct }
        )
      );
    }
  }

  return {
    valores: {
      masaPorTablaG,
      volumenAguaPorTablaL,
      concentracionGL,
      ajuste: ajuste.valores,
      modoDespeje,
      desviacionContraReferenciaPct,
    },
    desglose,
    avisos,
    verificacion: ajuste.verificacion,
  };
}

// Sentido ajuste -> dosis: dado un ajuste del rotametro, entrega la masa
// inyectada por tabla y la dosis resultante en g/ha.
export function forzamientoDesdeAjuste({
  scfm,
  psiManometrica,
  tiempoPorTablaS,
  hectareasPorTabla,
  gPorScf,
  presionAtmosfericaLocal,
  presionEstandarCalibracion,
  volumenAguaLha = null,
  dosisObjetivoGha = null,
  toleranciaAlertaPct = null,
}) {
  requierePositivo('las hectareas por tabla', hectareasPorTabla);

  const consumo = masaGas({
    scfm,
    psiManometrica,
    tiempoS: tiempoPorTablaS,
    gPorScf,
    presionAtmosfericaLocal,
    presionEstandarCalibracion,
  });
  const masaPorTablaG = consumo.valores.masaG;
  const dosisGha = masaPorTablaG / hectareasPorTabla;

  const avisos = [AVISO_SOLUBILIDAD, ...consumo.avisos];
  const desglose = [
    ...consumo.desglose,
    paso(
      'Dosis resultante',
      'masa_por_tabla / hectareas_por_tabla',
      `${redondeoLegible(masaPorTablaG)} / ${redondeoLegible(hectareasPorTabla)}`,
      dosisGha,
      'g/ha'
    ),
  ];

  let concentracionGL = null;
  if (volumenAguaLha !== null && volumenAguaLha !== undefined) {
    requierePositivo('el volumen de agua', volumenAguaLha);
    const volumenPorTabla = volumenAguaLha * hectareasPorTabla;
    concentracionGL = masaPorTablaG / volumenPorTabla;
    desglose.push(
      paso(
        'Concentracion en tanque',
        'masa_por_tabla / (L_por_ha * hectareas_por_tabla)',
        `${redondeoLegible(masaPorTablaG)} / ${redondeoLegible(volumenPorTabla)}`,
        concentracionGL,
        'g/L'
      )
    );
  }

  let desviacionContraObjetivoPct = null;
  if (
    dosisObjetivoGha !== null &&
    dosisObjetivoGha !== undefined &&
    toleranciaAlertaPct !== null &&
    toleranciaAlertaPct !== undefined
  ) {
    requierePositivo('la dosis objetivo', dosisObjetivoGha);
    desviacionContraObjetivoPct = ((dosisGha - dosisObjetivoGha) / dosisObjetivoGha) * PORCIENTO;
    if (Math.abs(desviacionContraObjetivoPct) > toleranciaAlertaPct) {
      avisos.push(
        aviso(
          'advertencia',
          'dosis-fuera-de-objetivo',
          `La dosis resultante (${redondeoLegible(dosisGha)} g/ha) se aparta ` +
            `${redondeoLegible(Math.abs(desviacionContraObjetivoPct))} % del objetivo ` +
            `(${redondeoLegible(dosisObjetivoGha)} g/ha), mas que la tolerancia de ` +
            `${redondeoLegible(toleranciaAlertaPct)} %.`,
          { dosisGha, dosisObjetivoGha, desviacionContraObjetivoPct }
        )
      );
    }
  }

  return {
    valores: {
      masaPorTablaG,
      dosisGha,
      concentracionGL,
      desviacionContraObjetivoPct,
    },
    desglose,
    avisos,
    verificacion: consumo.verificacion,
  };
}
