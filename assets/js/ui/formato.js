// Formateo de numeros en espanol de Mexico via Intl.NumberFormat.
// Solo presentacion: el dominio nunca formatea.

const cache = new Map();

function formateador(decimales, fijos) {
  const clave = `${decimales}|${fijos}`;
  if (!cache.has(clave)) {
    cache.set(
      clave,
      new Intl.NumberFormat('es-MX', {
        maximumFractionDigits: decimales,
        minimumFractionDigits: fijos ? decimales : 0,
      })
    );
  }
  return cache.get(clave);
}

// Formatea un numero; regresa un guion largo para vacios/no numericos
// (estado neutro: jamas NaN ni Infinity en pantalla).
export function formatear(valor, decimales = 2, { fijos = true } = {}) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return formateador(decimales, fijos).format(valor);
}

export function formatearConUnidad(valor, unidad, decimales = 2) {
  const numero = formatear(valor, decimales);
  return numero === '—' ? numero : `${numero} ${unidad}`;
}

export function formatearPorcentaje(valor, decimales = 1) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return `${formateador(decimales, true).format(valor)} %`;
}

// Segundos a "m min s s" legible para tiempos largos.
export function formatearTiempo(segundos) {
  if (!Number.isFinite(segundos)) return '—';
  const s = Math.round(segundos);
  const minutos = Math.floor(s / 60);
  const resto = s % 60;
  if (minutos === 0) return `${resto} s`;
  return `${minutos} min ${resto} s`;
}

// Fecha y hora en formato corto de es-MX. El formateador se construye
// una sola vez: Intl.DateTimeFormat es caro y estas listas se repintan
// en cada cambio de borrador.
const FORMATO_FECHA = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Formatea una fecha ISO. `vacio` es lo que regresa cuando la fecha
// falta o no es valida: por defecto el guion largo del estado neutro,
// igual que `formatear`. Quien necesite RAMIFICAR sobre la ausencia
// —omitir la linea entera en vez de imprimir un guion— pasa
// `{ vacio: null }` y prueba el resultado.
export function formatearFecha(iso, { vacio = '—' } = {}) {
  const fecha = new Date(iso ?? NaN);
  return Number.isNaN(fecha.getTime()) ? vacio : FORMATO_FECHA.format(fecha);
}

// Interpreta una captura de texto como numero. Acepta la coma decimal y
// tambien la coma de MILES, que es la que esta aplicacion imprime en
// pantalla (Intl.NumberFormat es-MX escribe 2000 como «2,000»).
//
// Regresa null para vacio o no numerico: el llamador decide el aviso.
//
// Por que no basta con `replace(',', '.')`: esa forma sustituye UNA sola
// coma, asi que «2,000» salia como 2. No era un NaN que el llamador
// pudiera rechazar, sino un numero plausible tres ordenes de magnitud
// abajo, dentro de las cotas de un tanque o de una dosis y sin ningun
// aviso. Un tanque de 2,000 L capturado como 2 L es exactamente el error
// de factor que esta aplicacion existe para impedir.
//
// La regla: si hay punto, o si hay mas de una coma, entonces la coma NO
// es el separador decimal y se quita como separador de grupo. Y la forma
// AMBIGUA —«2,000» a secas, que puede ser dos mil o dos— devuelve null,
// como cualquier otra entrada que esta funcion no puede resolver.
//
// Devolverla como null y no como una de las dos lecturas es la decision
// que importa: 2 y 2000 son los dos numeros plausibles, los dos caen
// dentro de las cotas de un tanque y ninguna validacion posterior los
// distingue. Un campo vacio con su mensaje se corrige en el momento; un
// tanque de 2 L no se nota hasta que la dosis ya esta en el lote. Quien
// necesite el MENSAJE tiene `esGrupoAmbiguo`, pero la correccion no
// depende de que el llamador se acuerde de preguntar.
export function aNumero(texto) {
  if (texto === null || texto === undefined) return null;
  let limpio = String(texto).trim().replace(/\s/g, '');
  if (limpio === '') return null;
  if (esGrupoAmbiguo(limpio)) return null;
  if (limpio.includes('.') || (limpio.match(/,/g) ?? []).length > 1) {
    limpio = limpio.replace(/,/g, '');
  } else {
    limpio = limpio.replace(',', '.');
  }
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

// Verdadero cuando lo escrito es una sola coma con exactamente tres
// digitos detras y nada mas: «2,000», «15,470». Ahi no hay forma de saber
// si la coma separa miles o decimales, y las dos lecturas se diferencian
// en mil veces. Es lo que el campo usa para pedir el numero sin separador
// en vez de adivinar.
export function esGrupoAmbiguo(texto) {
  return /^\d{1,3},\d{3}$/.test(String(texto ?? '').trim().replace(/\s/g, ''));
}
