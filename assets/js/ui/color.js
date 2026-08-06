// Contraste de texto sobre los colores ISO (y cualquier hex).
//
// Los colores ISO son datos y deben verse iguales en ambos temas; el
// color del texto encima se decide por luminancia WCAG para cumplir
// contraste AA: texto oscuro sobre colores claros y claro sobre los
// oscuros. tools/verificar-contraste.mjs valida esta eleccion para toda
// la tabla sembrada.

export function hexARgb(hex) {
  const limpio = hex.replace('#', '');
  return {
    r: parseInt(limpio.slice(0, 2), 16),
    g: parseInt(limpio.slice(2, 4), 16),
    b: parseInt(limpio.slice(4, 6), 16),
  };
}

function canalLineal(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminanciaRelativa(hex) {
  const { r, g, b } = hexARgb(hex);
  return 0.2126 * canalLineal(r) + 0.7152 * canalLineal(g) + 0.0722 * canalLineal(b);
}

export function razonDeContraste(hexA, hexB) {
  const la = luminanciaRelativa(hexA);
  const lb = luminanciaRelativa(hexB);
  const [claro, oscuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

// Texto negro o blanco, el que de mayor contraste sobre el fondo.
export function textoSobreColor(hexFondo) {
  const conNegro = razonDeContraste(hexFondo, '#000000');
  const conBlanco = razonDeContraste(hexFondo, '#FFFFFF');
  return conNegro >= conBlanco ? '#000000' : '#FFFFFF';
}

// Estilo en linea para un badge de color ISO.
//
// Sin hex no hay estilo que dar: la tabla ISO trae filas con el color
// PENDIENTE a proposito (el tamano 20 vive en la Tabla 2 de la norma, que
// no esta en la vista previa disponible, y no se rellena por
// extrapolacion). Devolver {} en vez de reventar es lo que evita que una
// ficha con ese tamano tumbe la pantalla que la pinta: el consumidor
// elige entonces el chip de contorno.
export function estiloBadgeIso(hexFondo) {
  if (!hexFondo) return {};
  return {
    backgroundColor: hexFondo,
    color: textoSobreColor(hexFondo),
  };
}
