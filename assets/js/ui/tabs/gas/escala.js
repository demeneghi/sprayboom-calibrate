// Escalones de una escala de instrumento: decisiones de PRESENTACION,
// no valores de dominio. Las comparten el tubo del rotametro, el
// manometro y las filas de captura rapida de la pestana.

// Paso de numeracion legible de la escala: el menor candidato que deja
// nueve etiquetas o menos (para la F-550 de 0.5 a 4.5 sale 0.5 SCFM).
export function pasoLegible(amplitud) {
  const candidatos = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
  for (const paso of candidatos) {
    if (amplitud / paso <= 9) return paso;
  }
  return candidatos[candidatos.length - 1];
}

// Decimales que exige un escalon (0.1 -> 1, 1 -> 0, 0.25 -> 2).
export function decimalesDe(paso) {
  const texto = String(paso);
  const punto = texto.indexOf('.');
  return punto === -1 ? 0 : Math.min(texto.length - punto - 1, 3);
}

// Pega un valor al escalon del instrumento y lo acota a su escala. El
// toFixed final quita la basura binaria (0.30000000000000004) que si no
// acabaria capturada en el borrador.
export function ajustar(valor, paso, minimo, maximo) {
  const pegado = paso > 0 ? Math.round(valor / paso) * paso : valor;
  const acotado = Math.min(Math.max(pegado, minimo), maximo);
  return Number(acotado.toFixed(decimalesDe(paso)));
}
