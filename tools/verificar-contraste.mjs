// Herramienta SOLO de desarrollo: verifica contraste AA (>= 4.5:1 para
// texto normal) de los pares de tokens en ambos temas y del texto
// elegido por luminancia sobre cada color ISO sembrado.
//
// Uso: node tools/verificar-contraste.mjs
// Sale con codigo 1 si algun par queda debajo de AA.

import { readFileSync } from 'node:fs';
import { TABLA_ISO_10625 } from '../assets/js/data/iso-colors.js';
import {
  razonDeContraste,
  textoSobreColor,
  luminanciaRelativa,
} from '../assets/js/ui/color.js';

const css = readFileSync(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');

function extraerBloque(selectorRegex) {
  const match = css.match(selectorRegex);
  if (!match) throw new Error(`No se encontro el bloque ${selectorRegex}`);
  const cuerpo = match[1];
  const vars = {};
  for (const [, nombre, valor] of cuerpo.matchAll(/--([a-z-]+):\s*([\d.]+ [\d.]+% [\d.]+%)/g)) {
    vars[nombre] = valor;
  }
  return vars;
}

const claro = extraerBloque(/:root \{([\s\S]*?)\n\}/);
const oscuro = extraerBloque(/:root\[data-theme='oscuro'\] \{([\s\S]*?)\n\}/);

function hslAHex(triple) {
  const [h, s, l] = triple.split(' ').map((parte) => parseFloat(parte));
  const sat = s / 100;
  const luz = l / 100;
  const c = (1 - Math.abs(2 * luz - 1)) * sat;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = luz - c / 2;
  const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const PARES = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['warning-foreground', 'warning'],
  ['destructive-texto', 'background'],
  ['destructive-texto', 'card'],
  ['warning', 'background'],
  // Ambar como TEXTO sobre la tarjeta: la cifra del flotador cuando la
  // lectura queda fuera de la escala del rotametro.
  ['warning', 'card'],
  // Chips de estado semantico: el texto del chip sobre SU fondo.
  ['exito', 'exito-fondo'],
  ['exito-foreground', 'exito'],
  ['info', 'info-fondo'],
  ['info-foreground', 'info'],
  ['warning', 'warning-fondo'],
  ['destructive-texto', 'destructive-fondo'],
  ['neutro', 'neutro-fondo'],
  // Los mismos colores usados como TEXTO sobre la superficie del tema
  // (linea de verificacion, cifra destacada, titulo con acento).
  ['exito', 'background'],
  ['exito', 'card'],
  ['info', 'card'],
  ['primary', 'background'],
  ['primary', 'card'],
  // Acento por seccion: rotula el modulo en la banda de la tarjeta.
  ['acento-calibrar', 'card'],
  ['acento-registrar', 'card'],
  ['acento-sistema', 'card'],
];

let fallos = 0;
for (const [nombreTema, tema] of [['claro', claro], ['oscuro', oscuro]]) {
  for (const [texto, fondo] of PARES) {
    if (!tema[texto] || !tema[fondo]) {
      console.log(`AVISO: ${nombreTema} no define ${texto} o ${fondo}`);
      continue;
    }
    const razon = razonDeContraste(hslAHex(tema[texto]), hslAHex(tema[fondo]));
    const ok = razon >= 4.5;
    if (!ok) fallos += 1;
    console.log(
      `${ok ? 'OK ' : 'FALLA'} [${nombreTema}] ${texto} sobre ${fondo}: ${razon.toFixed(2)}:1`
    );
  }
}

console.log('--- Colores ISO (texto elegido por luminancia) ---');
for (const fila of TABLA_ISO_10625) {
  if (!fila.hex) continue;
  const texto = textoSobreColor(fila.hex);
  const razon = razonDeContraste(fila.hex, texto);
  const ok = razon >= 4.5;
  if (!ok) fallos += 1;
  console.log(
    `${ok ? 'OK ' : 'FALLA'} ISO ${fila.tamano} ${fila.hex} texto ${texto}: ${razon.toFixed(2)}:1 (L=${luminanciaRelativa(fila.hex).toFixed(3)})`
  );
}

if (fallos > 0) {
  console.error(`\n${fallos} pares debajo de AA (4.5:1).`);
  process.exit(1);
}
console.log('\nTodos los pares cumplen AA (4.5:1).');
