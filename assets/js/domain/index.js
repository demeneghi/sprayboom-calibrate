// Fachada del dominio: un solo punto de importacion para la interfaz.
// Todo lo exportado es JavaScript puro, sin DOM ni almacenamiento,
// ejecutable igual en el navegador y en Node.

export * as constantes from './constants.js';
export * as unidades from './units.js';
export * as defaults from './defaults.js';
export * as validar from './validate.js';
export * as verificar from './verify.js';
export * as velocidad from './speed.js';
export * as bomba from './pump.js';
export * as boquillas from './nozzles.js';
export * as agua from './water.js';
export * as captura from './capture.js';
export * as gas from './gas.js';
export * as rotametro from './flowmeter.js';
export * as mezcla from './mix.js';
export * as forzamiento from './forcing.js';

import { caudalRequerido } from './water.js';
import { seleccionarBoquillas } from './nozzles.js';

// Composicion de conveniencia: seleccion de boquilla a partir del
// objetivo agronomico (volumen, velocidad, espaciamiento y clase de gota
// deseada). Une el despeje de caudal del dominio de agua con la
// seleccion del catalogo.
export function seleccionDeBoquilla({
  catalogo,
  lhaObjetivo,
  velocidadKmh,
  espaciamientoM,
  claseDeseada = null,
  edicionEstandar = null,
}) {
  const caudal = caudalRequerido({ lhaObjetivo, velocidadKmh, espaciamientoM });
  const seleccion = seleccionarBoquillas({
    catalogo,
    caudalRequeridoLmin: caudal.valores.caudalLmin,
    claseDeseada,
    edicionEstandar,
  });
  return {
    valores: {
      caudalRequeridoLmin: caudal.valores.caudalLmin,
      candidatas: seleccion.candidatas,
      fueraDeRango: seleccion.fueraDeRango,
    },
    desglose: caudal.desglose,
    avisos: [...caudal.avisos, ...seleccion.avisos],
    verificacion: caudal.verificacion,
  };
}
