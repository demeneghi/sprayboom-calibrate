// Tabla de codigo de colores ISO 10625:2018 (tercera edicion, 2018-08).
//
// Fuente primaria: ISO 10625:2018, Tabla 1 (boquillas de caudal bajo,
// menos de 7,9 L/min), consultada en la vista previa oficial publicada
// por iTeh Standards:
// https://cdn.standards.iteh.ai/samples/70624/b487a5c250ed47d58af5d6e4daf78a62/ISO-10625-2018.pdf
// (consultada 2026-07-30). Caudales a 300 kPa (3 bar) con tolerancia
// relativa de +/-5 %. Los numeros RAL llevan sufijo -P (colores RAL de
// plasticos) y en la norma son informativos.
//
// Hex sRGB de los RAL: aproximaciones publicadas en Wikipedia,
// "List of RAL colours" (consultada 2026-07-30). Son para PINTAR el
// badge en la interfaz; el color normativo es el RAL, no el hex.
//
// CAMBIO 2005 -> 2018 QUE CONTRADICE LA TABLA DEL DOCUMENTO DE DISENO:
// el prologo de ISO 10625:2018 dice textualmente "changing of colour
// for 1,4 l/min 035 capacity from brown red RAL 3011 to purple red
// 3004-P". El documento de diseno traia 035 = Rojo marron 3011 (valor
// de la edicion 2005); aqui se siembra el valor vigente 2018 y se
// conserva la nota.
//
// La edicion 2018 tambien agrego los tamanos 12, 14, 16, 18 (Tabla 1) y
// separo en una Tabla 2 los caudales altos (mas de 8 L/min): tamanos
// 20 (8,0 L/min), 25 (10), 30 (12), 40 (16), 50 (20), 60 (24) y
// 80 (32), reutilizando los colores de la Tabla 1. La vista previa
// disponible NO incluye la Tabla 2, asi que del tamano 20 solo el
// caudal esta verificado (viene en el prologo); su color queda
// PENDIENTE y no se rellena por extrapolacion.

export const PRESION_NOMINAL_ISO_BAR = 3; // 300 kPa

export const TABLA_ISO_10625 = [
  { tamano: '0050', caudalLmin: 0.2, colorEs: 'Lila azulado', colorEn: 'Blue lilac', ral: '4005-P', hex: '#83639D', verificado: true },
  { tamano: '0067', caudalLmin: 0.25, colorEs: 'Verde oliva', colorEn: 'Olive green', ral: '6003-P', hex: '#4B573E', verificado: true },
  { tamano: '0075', caudalLmin: 0.3, colorEs: 'Rosa claro', colorEn: 'Light pink', ral: '3015-P', hex: '#E1A6AD', verificado: true },
  { tamano: '01', caudalLmin: 0.4, colorEs: 'Naranja puro', colorEn: 'Pure orange', ral: '2004-P', hex: '#E75B12', verificado: true },
  { tamano: '015', caudalLmin: 0.6, colorEs: 'Verde tráfico', colorEn: 'Traffic green', ral: '6024-P', hex: '#008754', verificado: true },
  { tamano: '02', caudalLmin: 0.8, colorEs: 'Amarillo zinc', colorEn: 'Zinc yellow', ral: '1018-P', hex: '#FACA30', verificado: true },
  { tamano: '025', caudalLmin: 1.0, colorEs: 'Violeta señal', colorEn: 'Signal violet', ral: '4008-P', hex: '#904684', verificado: true },
  { tamano: '03', caudalLmin: 1.2, colorEs: 'Azul genciana', colorEn: 'Gentian blue', ral: '5010-P', hex: '#13447C', verificado: true },
  {
    tamano: '035',
    caudalLmin: 1.4,
    colorEs: 'Rojo púrpura',
    colorEn: 'Purple red',
    ral: '3004-P',
    hex: '#701F29',
    verificado: true,
    nota:
      'La edición 2018 cambio este color: antes era Rojo marrón RAL 3011 (ISO 10625:2005). ' +
      'Boquillas anteriores a 2018 pueden traer el color viejo.',
  },
  { tamano: '04', caudalLmin: 1.6, colorEs: 'Rojo fuego', colorEn: 'Flame red', ral: '3000-P', hex: '#AB2524', verificado: true },
  { tamano: '05', caudalLmin: 2.0, colorEs: 'Marrón nuez', colorEn: 'Nut brown', ral: '8011-P', hex: '#5A3A29', verificado: true },
  { tamano: '06', caudalLmin: 2.4, colorEs: 'Gris señal', colorEn: 'Signal grey', ral: '7004-P', hex: '#9EA0A1', verificado: true },
  { tamano: '08', caudalLmin: 3.2, colorEs: 'Blanco tráfico', colorEn: 'Traffic white', ral: '9016-P', hex: '#F7FBF5', verificado: true },
  { tamano: '10', caudalLmin: 4.0, colorEs: 'Azul claro', colorEn: 'Light blue', ral: '5012-P', hex: '#3481B8', verificado: true },
  { tamano: '12', caudalLmin: 4.8, colorEs: 'Rojo frambuesa', colorEn: 'Raspberry red', ral: '3027-P', hex: '#B42041', verificado: true },
  { tamano: '14', caudalLmin: 5.6, colorEs: 'Amarillo oliva', colorEn: 'Olive yellow', ral: '1020-P', hex: '#A08F65', verificado: true },
  { tamano: '15', caudalLmin: 6.0, colorEs: 'Verde amarillo', colorEn: 'Yellow green', ral: '6018-P', hex: '#48A43F', verificado: true },
  { tamano: '16', caudalLmin: 6.4, colorEs: 'Marrón anaranjado', colorEn: 'Orange brown', ral: '8023-P', hex: '#A65E2F', verificado: true },
  {
    tamano: '18',
    caudalLmin: 7.2,
    colorEs: 'Azul turquesa',
    colorEn: 'Turquoise blue',
    ral: '5024-P',
    hex: '#6A93B0',
    verificado: true,
    nota: 'La norma lo nombra Turquoise blue; el nombre RAL de 5024 es Pastel blue.',
  },
  {
    tamano: '20',
    caudalLmin: 8.0,
    colorEs: null,
    colorEn: null,
    ral: null,
    hex: null,
    verificado: 'parcial',
    nota:
      'Caudal verificado en el prologo de ISO 10625:2018 (8,0 L/min, tamaño 20). El color ' +
      'esta en la Tabla 2 (caudales altos), que no aparece en la vista previa disponible: ' +
      'queda PENDIENTE y no se rellena por extrapolación.',
  },
];

export function filaIso(tamano) {
  return TABLA_ISO_10625.find((f) => f.tamano === tamano) ?? null;
}
