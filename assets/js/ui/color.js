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
export function estiloBadgeIso(hexFondo) {
  return {
    backgroundColor: hexFondo,
    color: textoSobreColor(hexFondo),
  };
}
