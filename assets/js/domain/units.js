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
  areaChica: {
    etiqueta: 'Área',
    metrico: 'm2',
    imperial: 'ft2',
    factor: 1 / (M_POR_PIE * M_POR_PIE),
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
  // Dosis de un producto solido por superficie. No se captura en ningun
  // campo: existe para que la dosis en kg/ha pueda escribirse tambien en
  // lb/acre, que es como viene la etiqueta de un producto importado.
  masaPorSuperficie: {
    etiqueta: 'Dosis por superficie',
    metrico: 'kg/ha',
    imperial: 'lb/acre',
    factor: (G_POR_KG / G_POR_LIBRA) * HA_POR_ACRE,
  },
  // Presion ABSOLUTA. Es la misma conversion que `presion`, con otro
  // rotulo: en el calculo del gas la atmosferica y la absoluta van en
  // psia, y confundirlas con la manometrica es un error de dominio.
  presionAbsoluta: {
    etiqueta: 'Presión absoluta',
    metrico: 'bar abs',
    imperial: 'psia',
    factor: PSI_POR_BAR,
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

// El sistema contrario. Es lo que necesita el boton de unidades de un
// campo: convertir lo capturado al otro sistema y de regreso.
export function otroSistema(sistema) {
  return sistema === 'imperial' ? 'metrico' : 'imperial';
}

// Una magnitud es convertible cuando sus dos unidades son distintas.
// Un campo sin magnitud declarada —segundos, rpm, por ciento— no lo es y
// no lleva boton.
export function esConvertible(magnitud) {
  const def = MAGNITUDES[magnitud];
  return Boolean(def) && def.metrico !== def.imperial;
}

// Convierte entre dos sistemas cualesquiera pasando por la base metrica.
// No introduce un factor nuevo: reusa el unico de la magnitud, asi que
// la ida y vuelta sigue sin acumular deriva.
export function entreSistemas(magnitud, valor, desde, hacia) {
  if (valor === null || valor === undefined) return valor;
  if (desde === hacia) return valor;
  return aSistema(magnitud, deSistema(magnitud, valor, desde), hacia);
}

// ---------------------------------------------------------------------
// La misma cifra en el sistema que NO esta elegido
//
// Quien calibra aprendio empiricamente y mezcla unidades: la barra la
// piensa en bar, la boquilla en GPM y el tanque en galones. Por eso
// TODA cifra que se pinta lleva su equivalencia en el otro sistema en
// letra chica. Lo que se elige en Sistema, Configuracion sigue mandando:
// la equivalencia es apoyo de lectura, nunca el dato que se captura.
//
// La entrada es el TEXTO de la unidad con la que se esta pintando —que
// es lo que toda pantalla ya tiene a la mano— y no la magnitud, porque
// la magnitud no viaja hasta el punto donde se pinta.
// ---------------------------------------------------------------------

// Cuando dos magnitudes comparten el texto de una unidad, aqui se
// declara cual manda. Hoy solo pasa con 'm': es metro en `distancia`
// (que sale en ft) y en `distanciaCorta` (que sale en in). Gana el
// tramo largo, que es el uso comun; quien pinte un espaciamiento pasa
// su magnitud y desempata sin ambiguedad.
const PREFERENCIA_DE_UNIDAD = { m: 'distancia' };

const INDICE_DE_UNIDAD = new Map();
for (const [magnitud, def] of Object.entries(MAGNITUDES)) {
  for (const sistema of SISTEMAS) {
    const texto = def[sistema];
    if (INDICE_DE_UNIDAD.has(texto) && PREFERENCIA_DE_UNIDAD[texto] !== magnitud) continue;
    INDICE_DE_UNIDAD.set(texto, { magnitud, sistema });
  }
}

// A que magnitud y sistema pertenece un texto de unidad, o null si no
// es una unidad convertible (segundos, rpm, por ciento, SCFM, g/SCF).
export function magnitudDeUnidad(unidadTexto, magnitudPreferida = null) {
  const texto = String(unidadTexto ?? '').trim();
  if (texto === '') return null;
  const def = magnitudPreferida ? MAGNITUDES[magnitudPreferida] : null;
  if (def) {
    const sistema = SISTEMAS.find((s) => def[s] === texto);
    if (sistema) return { magnitud: magnitudPreferida, sistema };
  }
  return INDICE_DE_UNIDAD.get(texto) ?? null;
}

// La equivalencia de `valor` —ya escrito en `unidadTexto`— en el otro
// sistema. Devuelve null cuando no hay nada que convertir: unidad vacia,
// magnitud desconocida o valor no numerico. `magnitudPreferida` solo
// sirve para desempatar un texto de unidad compartido.
export function equivalenteAlterno(valor, unidadTexto, magnitudPreferida = null) {
  if (!Number.isFinite(valor)) return null;
  const entrada = magnitudDeUnidad(unidadTexto, magnitudPreferida);
  if (!entrada || !esConvertible(entrada.magnitud)) return null;
  const destino = otroSistema(entrada.sistema);
  return {
    valor: entreSistemas(entrada.magnitud, valor, entrada.sistema, destino),
    unidad: unidad(entrada.magnitud, destino),
    magnitud: entrada.magnitud,
    sistema: destino,
  };
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
