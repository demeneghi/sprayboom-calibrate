// Pintado de resultados del dominio: avisos tipados, desglose paso a
// paso con los numeros sustituidos, y la linea de verificacion del
// calculo redundante. Regla dura: si la verificacion redundante fallo,
// NO se pinta el numero; se pinta el estado de error.
import { el } from './dom.js';
import { formatear } from './formato.js';

export function pintarAviso(aviso) {
  const clase =
    aviso.tipo === 'error'
      ? 'alerta alerta--destructiva'
      : aviso.tipo === 'advertencia'
        ? 'alerta alerta--advertencia'
        : 'alerta alerta--info';
  return el(
    'div',
    { clase, role: aviso.tipo === 'info' ? 'status' : 'alert' },
    el('p', { clase: 'alerta__descripcion' }, aviso.mensaje)
  );
}

export function pintarAvisos(avisos) {
  return (avisos ?? []).map(pintarAviso);
}

export function pintarDesglose(desglose, { abierto = false, titulo = 'Desglose paso a paso' } = {}) {
  if (!desglose || desglose.length === 0) return null;
  return el(
    'details',
    { clase: 'desglose', open: abierto || null },
    el('summary', {}, titulo),
    el(
      'div',
      { clase: 'desglose__cuerpo' },
      desglose.map((paso) =>
        el(
          'div',
          { clase: 'desglose__paso' },
          el('span', { clase: 'desglose__descripcion' }, paso.descripcion),
          el('span', { clase: 'desglose__formula' }, paso.formula),
          el(
            'span',
            { clase: 'desglose__sustitucion' },
            `${paso.sustitucion} = ${formatear(paso.resultado, 4, { fijos: false })}${paso.unidad ? ` ${paso.unidad}` : ''}`
          )
        )
      )
    )
  );
}

export function pintarVerificacion(verificacion) {
  if (!verificacion) return null;
  const partes = [];
  if (verificacion.redundante) {
    partes.push({
      ok: verificacion.redundante.ok,
      texto: verificacion.redundante.ok
        ? `Verificado por dos rutas de cálculo (error relativo ${verificacion.redundante.errorRelativo.toExponential(1)})`
        : 'FALLO la verificación por dos rutas: no uses este resultado.',
    });
  }
  if (verificacion.idaVuelta) {
    partes.push({
      ok: verificacion.idaVuelta.ok,
      texto: verificacion.idaVuelta.ok
        ? `Ida y vuelta verificada: el resultado reproduce el objetivo (error relativo ${verificacion.idaVuelta.errorRelativo.toExponential(1)})`
        : 'FALLO la ida y vuelta: no uses este resultado.',
    });
  }
  if (partes.length === 0) return null;
  return el(
    'div',
    {},
    partes.map((parte) =>
      el(
        'p',
        { clase: `verificacion ${parte.ok ? 'verificacion--ok' : 'verificacion--fallo'}` },
        parte.texto
      )
    )
  );
}

// Verdadero si el resultado se puede mostrar (ninguna verificacion
// presente fallo).
export function resultadoConfiable(resultado) {
  const v = resultado?.verificacion;
  if (!v) return true;
  if (v.redundante && !v.redundante.ok) return false;
  if (v.idaVuelta && !v.idaVuelta.ok) return false;
  return true;
}

export function pintarResultado({ etiqueta, valor, unidad = '', decimales = 2, principal = false }) {
  return el(
    'div',
    { clase: `resultado${principal ? ' resultado--principal' : ''}` },
    el('span', { clase: 'resultado__etiqueta' }, etiqueta),
    el(
      'span',
      { clase: 'resultado__valor' },
      formatear(valor, decimales),
      unidad ? el('span', { clase: 'resultado__unidad' }, ` ${unidad}`) : null
    )
  );
}

export function pintarResultadoNoVerificado(etiqueta) {
  return el(
    'div',
    { clase: 'resultado resultado--error' },
    el('span', { clase: 'resultado__etiqueta' }, etiqueta),
    el(
      'span',
      { clase: 'resultado__valor' },
      'Cálculo no verificado: las dos rutas no coinciden. No uses este número; reporta el error.'
    )
  );
}

// Tarjeta estandar de pantalla.
export function tarjeta({ titulo, descripcion = null }, ...contenido) {
  return el(
    'section',
    { clase: 'card' },
    el(
      'div',
      { clase: 'card__encabezado' },
      el('h2', { clase: 'card__titulo' }, titulo),
      descripcion ? el('p', { clase: 'card__descripcion' }, descripcion) : null
    ),
    el('div', { clase: 'card__contenido' }, ...contenido)
  );
}
