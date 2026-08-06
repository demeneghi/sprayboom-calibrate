// Compuerta de CI: las reglas duras del sistema de diseño que se podian
// verificar y no se verificaban.
//
// Por que existe. El repositorio cumple al 100 % las cuatro reglas que ya
// tenian compuerta —cero innerHTML, contraste AA, precache al dia, textos
// acentuados— y aflojaba las equivalentes que no la tenian, en proporcion
// a lo nueva que era la superficie: diecisiete cifras sin su «ayuda»
// (quince de ellas en el asistente), un color escrito a mano en el
// cronometro y unos sesenta objetos de layout en linea. No era descuido:
// la compuerta es lo que sostiene la regla.
//
// Estas tres se pueden comprobar con un recuento de llaves y dos
// expresiones regulares, sin dependencias. Lo que NO se puede verificar
// asi —si el texto de una ayuda dice algo util, si un acento de modulo es
// el correcto— sigue siendo cosa de la revision humana, y esta declarado
// como tal en .claude/rules/design-system.md.
//
// Uso: node tools/verificar-diseno.mjs
// Sale con codigo 1 si alguna regla se incumple.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

function archivosJs(directorio) {
  const salida = [];
  for (const entrada of readdirSync(`${raiz}${directorio}`)) {
    const relativa = `${directorio}/${entrada}`;
    if (statSync(`${raiz}${relativa}`).isDirectory()) salida.push(...archivosJs(relativa));
    else if (entrada.endsWith('.js')) salida.push(relativa);
  }
  return salida;
}

const FUENTES = archivosJs('assets/js');
const fallos = [];

// ---------------------------------------------------------------------
// 1. Toda cifra que se pinta lleva su ayuda
//
// «CV de la barra», «factor requerido» o «metodo por barra» son nombres
// correctos y opacos: quien calibra de pie en el lote no deduce de ahi que
// significa el numero ni con que compararlo. El desglose paso a paso
// contesta COMO se calculo, que es otra pregunta.
// ---------------------------------------------------------------------
function bloqueDeLlamada(texto, desde) {
  const abre = texto.indexOf('{', desde);
  let profundidad = 0;
  for (let i = abre; i < texto.length; i += 1) {
    if (texto[i] === '{') profundidad += 1;
    else if (texto[i] === '}') {
      profundidad -= 1;
      if (profundidad === 0) return { bloque: texto.slice(abre, i + 1), fin: i + 1 };
    }
  }
  return { bloque: texto.slice(abre), fin: texto.length };
}

let cifras = 0;
for (const ruta of FUENTES) {
  const texto = readFileSync(`${raiz}${ruta}`, 'utf8');
  let i = 0;
  while ((i = texto.indexOf('pintarResultado({', i)) !== -1) {
    const { bloque, fin } = bloqueDeLlamada(texto, i);
    // La DECLARACION de la funcion en render.js no es una llamada.
    if (/function\s*$/.test(texto.slice(Math.max(0, i - 20), i))) {
      i = fin;
      continue;
    }
    cifras += 1;
    if (!/\bayuda:/.test(bloque)) {
      const linea = texto.slice(0, i).split('\n').length;
      const etiqueta = (bloque.match(/etiqueta:\s*(`[^`]*`|'[^']*')/) ?? [])[1] ?? '?';
      fallos.push(`${ruta}:${linea} pintarResultado sin «ayuda» (${etiqueta})`);
    }
    i = fin;
  }
}
console.log(`Cifras con ayuda: ${cifras - fallos.length} de ${cifras}.`);

// ---------------------------------------------------------------------
// 2. Ningun color escrito a mano en un consumidor
//
// Excepcion declarada: los colores ISO 10625 son DATOS y viven en
// data/iso-colors.js; ui/color.js los aplica en linea con el texto
// elegido por luminancia.
// ---------------------------------------------------------------------
const EXENTOS_COLOR = new Set(['assets/js/data/iso-colors.js', 'assets/js/ui/color.js']);
const antesColor = fallos.length;
for (const ruta of FUENTES) {
  if (EXENTOS_COLOR.has(ruta)) continue;
  const texto = readFileSync(`${raiz}${ruta}`, 'utf8');
  texto.split('\n').forEach((linea, indice) => {
    if (linea.trimStart().startsWith('//')) return;
    if (/(color|background|backgroundColor|border|borderColor)\s*[:=]\s*['"`](#|rgb\(|hsl\(\s*\d)/.test(linea)) {
      fallos.push(`${ruta}:${indice + 1} color escrito a mano; usa un token en components.css`);
    }
  });
}
console.log(`Colores sueltos: ${fallos.length - antesColor}.`);

// ---------------------------------------------------------------------
// 3. El layout no se escribe en linea
//
// El ritmo vive en components.css (.pila, .rejilla-2, .pila-campos,
// .grupo-modo, .fila-acciones): el consumidor solo declara la clase. Con
// `display: flex` en linea, una etiqueta larga se sale de la tarjeta y
// cambiar la densidad de la aplicacion obliga a recorrer doce archivos.
// ---------------------------------------------------------------------
const RITMO = [
  "display: 'flex', flexDirection: 'column', gap: '0.75rem'",
  "display: 'flex', flexDirection: 'column', gap: '0.5rem'",
  "display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem'",
];
const antesLayout = fallos.length;
for (const ruta of FUENTES) {
  const texto = readFileSync(`${raiz}${ruta}`, 'utf8');
  for (const patron of RITMO) {
    let i = 0;
    while ((i = texto.indexOf(patron, i)) !== -1) {
      const linea = texto.slice(0, i).split('\n').length;
      fallos.push(`${ruta}:${linea} layout en linea; usa .pila o .rejilla-2`);
      i += patron.length;
    }
  }
}
console.log(`Layout en linea: ${fallos.length - antesLayout}.`);

// ---------------------------------------------------------------------
// 4. El hook de sesion sigue siendo un `echo` literal
//
// `.claude/settings.json` se ejecuta en la maquina de quien abre el
// repositorio y su salida entra como instruccion al agente. El contenido
// de hoy es de conveniencia y es inofensivo; lo que esta compuerta impide
// es que un cambio de una linea lo convierta en otra cosa sin que nada lo
// vea, en un repositorio donde la entrega es por pull request revisado.
// ---------------------------------------------------------------------
try {
  const ajustes = JSON.parse(readFileSync(`${raiz}.claude/settings.json`, 'utf8'));
  const ganchos = ajustes.hooks?.SessionStart ?? [];
  for (const grupo of ganchos) {
    for (const gancho of grupo.hooks ?? []) {
      if (gancho.type !== 'command') {
        fallos.push(`.claude/settings.json: hook SessionStart de tipo «${gancho.type}»`);
        continue;
      }
      if (!/^echo '[^']*'$/.test(gancho.command)) {
        fallos.push(
          '.claude/settings.json: el hook SessionStart dejo de ser un `echo` literal; ' +
            'revisalo a mano antes de seguir'
        );
      }
    }
  }
  console.log(`Hooks de sesion revisados: ${ganchos.length}.`);
} catch (error) {
  fallos.push(`.claude/settings.json no se pudo leer: ${String(error?.message ?? error)}`);
}

// ---------------------------------------------------------------------
if (fallos.length > 0) {
  console.error(`\n${fallos.length} incumplimientos del sistema de diseño:`);
  for (const f of fallos) console.error(' -', f);
  process.exit(1);
}
console.log('\nSistema de diseño en orden.');
