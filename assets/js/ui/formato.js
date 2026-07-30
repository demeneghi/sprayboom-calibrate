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

// Interpreta una captura de texto como numero (acepta coma decimal).
// Regresa null para vacio o no numerico: el llamador decide el aviso.
export function aNumero(texto) {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto).trim().replace(/\s/g, '').replace(',', '.');
  if (limpio === '') return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}
