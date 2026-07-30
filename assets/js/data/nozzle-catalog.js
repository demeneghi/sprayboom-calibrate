// Catalogo de boquillas de siembra. COMPLETAMENTE EDITABLE por el
// usuario; estas entradas son la semilla inicial y todas provienen de
// tablas publicadas por el fabricante. NO hay numeros inventados.
//
// Fuentes (consultadas 2026-07-30):
//
// [TJ] TeeJet Technologies, Catalog 51A-M (metrico),
//      https://www.teejet.com/-/media/dam/agricultural/usa/sales-material/catalog/cat51a_metric.pdf
//      Caudales en L/min por presion en bar y clase de gota por presion
//      tomados de las tablas de cada serie (paginas 7-15 y 40-41 del
//      PDF). Las clases de gota del catalogo TeeJet estan clasificadas
//      conforme a ASABE S572.1. Para las series de dos angulos se
//      tomo la columna del angulo indicado en cada ficha.
//
// [AL] Albuz (CoorsTek), ficha ATR 80 cono hueco, catalogo 2024,
//      https://albuz-spray.com/en/pdf/arbo-viticulture-NON-ISO-ATR-80.pdf
//      Tabla de caudal 5-25 bar; angulo 80 grados a 5 bar; presion
//      recomendada 10 bar; codigo de color europeo NO ISO. La ficha
//      describe la gota como fina pero no publica clase por presion,
//      asi que clasesGota queda vacia y la clase no participa en el
//      filtrado de esas boquillas.
//
// Los rangos de clasesGota se construyeron a partir de los puntos
// muestreados por presion del catalogo: la frontera entre dos clases se
// coloca en el punto medio entre la ultima presion con una clase y la
// primera con la siguiente. Es una interpolacion documentada del dato
// discreto del fabricante, no un dato nuevo.
//
// El exponente presion-caudal es 0.5 en las series TeeJet (sus tablas
// siguen la raiz cuadrada) y en ATR 80 se ajusto a la propia tabla del
// fabricante entre 5 y 20 bar (ln(q2/q1)/ln(p2/p1)), de ahi los valores
// 0.47-0.49.
//
// Pendientes declarados (no sembrados por falta de fuente verificable
// durante la construccion): Lechler, Hypro y ARAG. El usuario puede
// capturarlos en el editor del catalogo citando su ficha tecnica.

function tj(id, serie, modelo, tamanoIso, angulo, tipoPatron, material, caudal3bar, presionMin, presionMax, clasesGota, notas = '') {
  return {
    id,
    fabricante: 'TeeJet',
    serie,
    modelo,
    tipoPatron,
    anguloGrados: angulo,
    tamanoIso,
    caudalRefLmin: caudal3bar,
    presionRefBar: 3,
    presionMinBar: presionMin,
    presionMaxBar: presionMax,
    exponente: 0.5,
    material,
    edicionEstandar: 'S572.1',
    clasesGota,
    notas,
    fuente: 'TeeJet Catalog 51A-M (métrico), tabla de la serie; clase de gota ASABE S572.1.',
  };
}

function rangos(...tramos) {
  // tramos: [presionMin, presionMax, clase]
  return tramos.map(([presionMinBar, presionMaxBar, clase]) => ({ presionMinBar, presionMaxBar, clase }));
}

export const CATALOGO_SIEMBRA = [
  // ----- XR TeeJet 110 (abanico plano rango extendido, 1-4 bar) -----
  tj('xr11001', 'XR', 'XR11001', '01', 110, 'abanico-plano', 'inox/polimero', 0.39, 1, 4,
    rangos([1, 3.5, 'F'], [3.5, 4, 'VF'])),
  tj('xr110015', 'XR', 'XR110015', '015', 110, 'abanico-plano', 'inox/polimero', 0.59, 1, 4,
    rangos([1, 4, 'F'])),
  tj('xr11002', 'XR', 'XR11002', '02', 110, 'abanico-plano', 'inox/polimero', 0.79, 1, 4,
    rangos([1, 1.25, 'M'], [1.25, 4, 'F'])),
  tj('xr110025', 'XR', 'XR110025', '025', 110, 'abanico-plano', 'inox/polimero', 0.99, 1, 4,
    rangos([1, 1.25, 'M'], [1.25, 4, 'F'])),
  tj('xr11003', 'XR', 'XR11003', '03', 110, 'abanico-plano', 'inox/polimero', 1.18, 1, 4,
    rangos([1, 1.75, 'M'], [1.75, 4, 'F'])),
  tj('xr11004', 'XR', 'XR11004', '04', 110, 'abanico-plano', 'inox/polimero', 1.58, 1, 4,
    rangos([1, 2.75, 'M'], [2.75, 4, 'F'])),
  tj('xr11005', 'XR', 'XR11005', '05', 110, 'abanico-plano', 'inox/polimero', 1.97, 1, 4,
    rangos([1, 3.5, 'M'], [3.5, 4, 'F'])),
  tj('xr11006', 'XR', 'XR11006', '06', 110, 'abanico-plano', 'inox/polimero', 2.37, 1, 4,
    rangos([1, 1.25, 'C'], [1.25, 3.5, 'M'], [3.5, 4, 'F'])),
  tj('xr11008', 'XR', 'XR11008', '08', 110, 'abanico-plano', 'inox/polimero', 3.16, 1, 4,
    rangos([1, 2.25, 'C'], [2.25, 4, 'M'])),
  tj('xr11010', 'XR', 'XR11010', '10', 110, 'abanico-plano', 'inox/polimero', 3.95, 1, 4,
    rangos([1, 1.25, 'VC'], [1.25, 2.75, 'C'], [2.75, 4, 'M'])),

  // ----- Turbo TeeJet 110 (abanico plano con preorificio, 1-6 bar) -----
  tj('tt11001', 'TT', 'TT11001', '01', 110, 'abanico-preorificio', 'polimero', 0.39, 1, 6,
    rangos([1, 1.5, 'C'], [1.5, 3.5, 'M'], [3.5, 6, 'F'])),
  tj('tt110015', 'TT', 'TT110015', '015', 110, 'abanico-preorificio', 'polimero', 0.59, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 3.5, 'M'], [3.5, 6, 'F'])),
  tj('tt11002', 'TT', 'TT11002', '02', 110, 'abanico-preorificio', 'polimero', 0.79, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 2.5, 'C'], [2.5, 4.5, 'M'], [4.5, 6, 'F'])),
  tj('tt110025', 'TT', 'TT110025', '025', 110, 'abanico-preorificio', 'polimero', 0.99, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 2.5, 'C'], [2.5, 4.5, 'M'], [4.5, 6, 'F'])),
  tj('tt11003', 'TT', 'TT11003', '03', 110, 'abanico-preorificio', 'polimero', 1.18, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 2.5, 'C'], [2.5, 6, 'M'])),
  tj('tt11004', 'TT', 'TT11004', '04', 110, 'abanico-preorificio', 'polimero', 1.58, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 3.5, 'C'], [3.5, 6, 'M'])),
  tj('tt11005', 'TT', 'TT11005', '05', 110, 'abanico-preorificio', 'polimero', 1.97, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 4.5, 'C'], [4.5, 6, 'M'])),
  tj('tt11006', 'TT', 'TT11006', '06', 110, 'abanico-preorificio', 'polimero', 2.37, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 3.5, 'VC'], [3.5, 5.5, 'C'], [5.5, 6, 'M'])),
  tj('tt11008', 'TT', 'TT11008', '08', 110, 'abanico-preorificio', 'polimero', 3.16, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 4.5, 'C'], [4.5, 6, 'M'])),

  // ----- AIXR TeeJet 110 (abanico induccion de aire, 1-6 bar) -----
  tj('aixr110015', 'AIXR', 'AIXR110015', '015', 110, 'abanico-induccion', 'polimero', 0.59, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 4.5, 'C'], [4.5, 6, 'M'])),
  tj('aixr11002', 'AIXR', 'AIXR11002', '02', 110, 'abanico-induccion', 'polimero', 0.79, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 5.5, 'C'], [5.5, 6, 'M'])),
  tj('aixr110025', 'AIXR', 'AIXR110025', '025', 110, 'abanico-induccion', 'polimero', 0.99, 1, 6,
    rangos([1, 2.5, 'XC'], [2.5, 3.5, 'VC'], [3.5, 6, 'C'])),
  tj('aixr11003', 'AIXR', 'AIXR11003', '03', 110, 'abanico-induccion', 'polimero', 1.18, 1, 6,
    rangos([1, 2.5, 'XC'], [2.5, 3.5, 'VC'], [3.5, 6, 'C'])),
  tj('aixr11004', 'AIXR', 'AIXR11004', '04', 110, 'abanico-induccion', 'polimero', 1.58, 1, 6,
    rangos([1, 1.5, 'UC'], [1.5, 2.5, 'XC'], [2.5, 4.5, 'VC'], [4.5, 6, 'C'])),
  tj('aixr11005', 'AIXR', 'AIXR11005', '05', 110, 'abanico-induccion', 'polimero', 1.97, 1, 6,
    rangos([1, 1.5, 'UC'], [1.5, 3.5, 'XC'], [3.5, 4.5, 'VC'], [4.5, 6, 'C'])),
  tj('aixr11006', 'AIXR', 'AIXR11006', '06', 110, 'abanico-induccion', 'polimero', 2.37, 1, 6,
    rangos([1, 1.5, 'UC'], [1.5, 3.5, 'XC'], [3.5, 4.5, 'VC'], [4.5, 6, 'C'])),

  // ----- TTI TeeJet 110 (induccion Turbo, gota ultra gruesa, 1-7 bar) -----
  tj('tti110015', 'TTI', 'TTI110015', '015', 110, 'abanico-induccion', 'polimero', 0.59, 1, 7,
    rangos([1, 3.5, 'UC'], [3.5, 7, 'XC'])),
  tj('tti11002', 'TTI', 'TTI11002', '02', 110, 'abanico-induccion', 'polimero', 0.79, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti110025', 'TTI', 'TTI110025', '025', 110, 'abanico-induccion', 'polimero', 0.99, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11003', 'TTI', 'TTI11003', '03', 110, 'abanico-induccion', 'polimero', 1.18, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11004', 'TTI', 'TTI11004', '04', 110, 'abanico-induccion', 'polimero', 1.58, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11005', 'TTI', 'TTI11005', '05', 110, 'abanico-induccion', 'polimero', 1.97, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11006', 'TTI', 'TTI11006', '06', 110, 'abanico-induccion', 'polimero', 2.37, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),

  // ----- AI TeeJet 110 (induccion de aire alta presion, 2-8 bar) -----
  tj('ai11002', 'AI', 'AI11002', '02', 110, 'abanico-induccion', 'inox', 0.79, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai110025', 'AI', 'AI110025', '025', 110, 'abanico-induccion', 'inox', 0.99, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 7.5, 'VC'], [7.5, 8, 'C'])),
  tj('ai11003', 'AI', 'AI11003', '03', 110, 'abanico-induccion', 'inox', 1.18, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai11004', 'AI', 'AI11004', '04', 110, 'abanico-induccion', 'inox', 1.58, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai11005', 'AI', 'AI11005', '05', 110, 'abanico-induccion', 'inox', 1.97, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai11006', 'AI', 'AI11006', '06', 110, 'abanico-induccion', 'inox', 2.37, 2, 8,
    rangos([2, 3.5, 'UC'], [3.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C'])),

  // ----- TX ConeJet VisiFlo (cono hueco ceramico, 80 grados a 7 bar) -----
  // Tamanos propios de TeeJet, NO ISO. Uso tipico a 3 bar o mas.
  tj('txvk6', 'TX', 'TX-VK6', null, 80, 'cono-hueco', 'ceramica', 0.393, 2, 20,
    rangos([2, 3.5, 'F'], [3.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk8', 'TX', 'TX-VK8', null, 80, 'cono-hueco', 'ceramica', 0.525, 2, 20,
    rangos([2, 3.5, 'F'], [3.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk10', 'TX', 'TX-VK10', null, 80, 'cono-hueco', 'ceramica', 0.657, 2, 20,
    rangos([2, 4.5, 'F'], [4.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk12', 'TX', 'TX-VK12', null, 80, 'cono-hueco', 'ceramica', 0.788, 2, 20,
    rangos([2, 4.5, 'F'], [4.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk18', 'TX', 'TX-VK18', null, 80, 'cono-hueco', 'ceramica', 1.18, 2, 20,
    rangos([2, 6.5, 'F'], [6.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk26', 'TX', 'TX-VK26', null, 80, 'cono-hueco', 'ceramica', 1.71, 2, 20,
    rangos([2, 7.5, 'F'], [7.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),

  // ----- TXA ConeJet (cono hueco ceramico con codigo ISO, 80 grados) -----
  tj('txa800050', 'TXA', 'TXA800050VK', '0050', 80, 'cono-hueco', 'ceramica', 0.196, 2, 20,
    rangos([2, 2.5, 'F'], [2.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa800067', 'TXA', 'TXA800067VK', '0067', 80, 'cono-hueco', 'ceramica', 0.262, 2, 20,
    rangos([2, 2.5, 'F'], [2.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8001', 'TXA', 'TXA8001VK', '01', 80, 'cono-hueco', 'ceramica', 0.393, 2, 20,
    rangos([2, 3.5, 'F'], [3.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa80015', 'TXA', 'TXA80015VK', '015', 80, 'cono-hueco', 'ceramica', 0.591, 2, 20,
    rangos([2, 5.5, 'F'], [5.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8002', 'TXA', 'TXA8002VK', '02', 80, 'cono-hueco', 'ceramica', 0.788, 2, 20,
    rangos([2, 4.5, 'F'], [4.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8003', 'TXA', 'TXA8003VK', '03', 80, 'cono-hueco', 'ceramica', 1.18, 2, 20,
    rangos([2, 6.5, 'F'], [6.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8004', 'TXA', 'TXA8004VK', '04', 80, 'cono-hueco', 'ceramica', 1.58, 2, 20,
    rangos([2, 6.5, 'F'], [6.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
];

// ----- Albuz ATR 80 (cono hueco ceramico, codigo de color europeo NO ISO) -----
function atr(id, color, caudal10bar, exponente) {
  return {
    id,
    fabricante: 'Albuz',
    serie: 'ATR',
    modelo: `ATR 80 ${color}`,
    tipoPatron: 'cono-hueco',
    anguloGrados: 80,
    tamanoIso: null,
    caudalRefLmin: caudal10bar,
    presionRefBar: 10,
    presionMinBar: 5,
    presionMaxBar: 20,
    exponente,
    material: 'ceramica',
    edicionEstandar: null,
    clasesGota: [],
    notas:
      'Código de color europeo, NO ISO. Angulo 80 grados a 5 bar; presión recomendada 10 bar. ' +
      'La ficha describe gota fina pero no publica clase por presión. Exponente ajustado a la ' +
      'tabla del fabricante (5-20 bar).',
    fuente: 'Albuz, ficha ATR 80 catálogo 2024 (albuz-spray.com).',
  };
}

CATALOGO_SIEMBRA.push(
  atr('atr80-lila', 'lila', 0.5, 0.48),
  atr('atr80-cafe', 'cafe', 0.67, 0.477),
  atr('atr80-amarillo', 'amarillo', 1.03, 0.49),
  atr('atr80-naranja', 'naranja', 1.39, 0.485),
  atr('atr80-rojo', 'rojo', 1.92, 0.476),
  atr('atr80-gris', 'gris', 2.08, 0.471)
);

export const TIPOS_PATRON = [
  'abanico-plano',
  'abanico-preorificio',
  'abanico-induccion',
  'abanico-impacto',
  'cono-lleno',
  'cono-hueco',
  'chorro',
];

export const MATERIALES = ['ceramica', 'inox', 'inox/polimero', 'polimero', 'laton'];

export const FABRICANTES_SUGERIDOS = ['TeeJet', 'Albuz', 'Lechler', 'Hypro', 'ARAG', 'generica'];
