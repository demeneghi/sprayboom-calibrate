// Conversion entre sistema metrico e imperial, SOLO en la frontera.
//
// Todo el dominio trabaja internamente en base metrica (L/min, km/h, m,
// bar, ha, g). La conversion ocurre al entrar un valor capturado en
// unidades imperiales y al salir un resultado para mostrarse en
// imperiales. No se propagan unidades duales hacia adentro.
//
// Cada magnitud declara un unico factor tal que:
//   imperial = metrico * factor        metrico = imperial / factor
// Usar el mismo factor en ambos sentidos garantiza que la ida y vuelta
// no acumule deriva (se verifica en tests/units.test.js).

import {
  HA_POR_ACRE,
  KM_POR_MILLA,
  KPA_POR_BAR,
  L_POR_GALON_US,
  M_POR_PIE,
  M_POR_PULGADA,
  ML_POR_ONZA_FLUIDA,
  G_POR_LIBRA,
  G_POR_KG,
  OZ_POR_LIBRA,
  PSI_POR_BAR,
} from './constants.js';

export const SISTEMAS = ['metrico', 'imperial'];

// factor: imperial = metrico * factor
export const MAGNITUDES = {
  volumenAplicacion: {
    etiqueta: 'Volumen de aplicación',
    metrico: 'L/ha',
    imperial: 'gal/acre',
    factor: HA_POR_ACRE / L_POR_GALON_US,
  },
  caudal: {
    etiqueta: 'Caudal de boquilla',
    metrico: 'L/min',
    imperial: 'gal/min',
    factor: 1 / L_POR_GALON_US,
  },
  velocidad: {
    etiqueta: 'Velocidad',
    metrico: 'km/h',
    imperial: 'mph',
    factor: 1 / KM_POR_MILLA,
  },
  presion: {
    etiqueta: 'Presion',
    metrico: 'bar',
    imperial: 'psi',
    factor: PSI_POR_BAR,
  },
  distancia: {
    etiqueta: 'Distancia',
    metrico: 'm',
    imperial: 'ft',
    factor: 1 / M_POR_PIE,
  },
  distanciaCorta: {
    etiqueta: 'Espaciamiento',
    metrico: 'm',
    imperial: 'in',
    factor: 1 / M_POR_PULGADA,
  },
  superficie: {
    etiqueta: 'Superficie',
    metrico: 'ha',
    imperial: 'acre',
    factor: 1 / HA_POR_ACRE,
  },
  masa: {
    etiqueta: 'Masa',
    metrico: 'g',
    imperial: 'oz',
    factor: OZ_POR_LIBRA / G_POR_LIBRA,
  },
  masaGrande: {
    etiqueta: 'Masa grande',
    metrico: 'kg',
    imperial: 'lb',
    factor: G_POR_KG / G_POR_LIBRA,
  },
  volumen: {
    etiqueta: 'Volumen',
    metrico: 'L',
    imperial: 'gal',
    factor: 1 / L_POR_GALON_US,
  },
  volumenChico: {
    etiqueta: 'Volumen chico',
    metrico: 'mL',
    imperial: 'oz fl',
    factor: 1 / ML_POR_ONZA_FLUIDA,
  },
};

function definicion(magnitud) {
  const def = MAGNITUDES[magnitud];
  if (!def) {
    throw new Error(`Magnitud desconocida: ${magnitud}`);
  }
  return def;
}

export function aImperial(magnitud, valorMetrico) {
  if (valorMetrico === null || valorMetrico === undefined) return valorMetrico;
  return valorMetrico * definicion(magnitud).factor;
}

export function aMetrico(magnitud, valorImperial) {
  if (valorImperial === null || valorImperial === undefined) return valorImperial;
  return valorImperial / definicion(magnitud).factor;
}

// Convierte un valor en base metrica al sistema pedido (para mostrar).
export function aSistema(magnitud, valorMetrico, sistema) {
  return sistema === 'imperial' ? aImperial(magnitud, valorMetrico) : valorMetrico;
}

// Convierte un valor capturado en el sistema dado a base metrica.
export function deSistema(magnitud, valorCapturado, sistema) {
  return sistema === 'imperial' ? aMetrico(magnitud, valorCapturado) : valorCapturado;
}

export function unidad(magnitud, sistema) {
  const def = definicion(magnitud);
  return sistema === 'imperial' ? def.imperial : def.metrico;
}

// La presion metrica se muestra en bar y tambien en kPa.
export function barAKpa(bar) {
  if (bar === null || bar === undefined) return bar;
  return bar * KPA_POR_BAR;
}

export function kpaABar(kpa) {
  if (kpa === null || kpa === undefined) return kpa;
  return kpa / KPA_POR_BAR;
}
