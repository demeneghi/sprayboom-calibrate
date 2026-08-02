// La misma cifra en la unidad que el rancho NO tiene elegida.
//
// En Sistema, Configuracion se elige UN sistema y todo se captura en el.
// Pero quien calibra aprendio en el lote y mezcla unidades: el manometro
// de la barra lo piensa en bar, la ficha de la boquilla la lee en GPM y
// el tanque esta rotulado en galones. Por eso toda cifra que se pinta
// lleva debajo, en letra chica, la misma cifra en el otro sistema.
//
// Es APOYO DE LECTURA, no un segundo sistema: la equivalencia no se
// captura, no se guarda y no cambia lo que calcula el dominio. La
// conversion la hace `domain/units.js` con el unico factor de la
// magnitud, asi que no aparece aqui ningun numero nuevo.

import { el } from './dom.js';
import { formatear } from './formato.js';
import { equivalenteAlterno } from '../domain/units.js';

// Cuantos decimales lleva la equivalencia.
//
// Los del dato original son el PISO, nunca el techo: la equivalencia no
// puede decir menos que la cifra que explica. Pero tampoco bastan,
// porque el otro sistema mueve la coma de sitio: la fila de captura del
// gas cuenta los psi de uno en uno —cero decimales— y esos 30 psi son
// 2.07 bar, que redondeados igual se leerian "2 bar"; 5 mL con un
// decimal se leerian "0.2 oz fl". Asi que se suben los decimales que
// hagan falta para conservar TRES digitos significativos.
//
// El aumento se topa en cuatro decimales —mas alla es precision falsa
// para una cifra de apoyo—, pero el tope solo limita lo que se sube: un
// dato que ya trae seis decimales los conserva.
const DIGITOS_SIGNIFICATIVOS = 3;
const TOPE_DECIMALES = 4;

export function decimalesAlternos(valor, decimales) {
  const abs = Math.abs(valor);
  if (!Number.isFinite(abs) || abs === 0) return decimales;
  const orden = Math.floor(Math.log10(abs));
  const necesarios = DIGITOS_SIGNIFICATIVOS - 1 - orden;
  return Math.max(decimales, Math.min(TOPE_DECIMALES, necesarios));
}

// El texto de la equivalencia ("= 30.0 psi"), o null si esa unidad no
// se convierte: los segundos, las rpm, el por ciento, los SCFM del
// rotametro y los g/SCF no tienen otro sistema.
//
// El signo de igual va delante a proposito: dice que es LA MISMA cifra
// escrita de otro modo, no un segundo dato del calculo.
export function textoAlterno(valor, unidadTexto, { magnitud = null, decimales = 2 } = {}) {
  const equivalente = equivalenteAlterno(valor, unidadTexto, magnitud);
  if (!equivalente) return null;
  const cifra = formatear(equivalente.valor, decimalesAlternos(equivalente.valor, decimales));
  return `= ${cifra} ${equivalente.unidad}`;
}

// El mismo texto ya montado. `clase` agrega modificadores del sitio
// donde cuelga (centrado dentro de una perilla, por ejemplo) sin que
// cada pantalla vuelva a declarar tipografia ni color.
export function nodoAlterno(valor, unidadTexto, { magnitud = null, decimales = 2, clase = '' } = {}) {
  const texto = textoAlterno(valor, unidadTexto, { magnitud, decimales });
  if (texto === null) return null;
  return el('span', { clase: `alterna${clase ? ` ${clase}` : ''}` }, texto);
}
