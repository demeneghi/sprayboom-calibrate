// Pintado de resultados del dominio: avisos tipados, desglose paso a
// paso con los numeros sustituidos, y la linea de verificacion del
// calculo redundante. Regla dura: si la verificacion redundante fallo,
// NO se pinta el numero; se pinta el estado de error.
import { el } from './dom.js';
import { formatear } from './formato.js';
import { crearAyuda } from './campos.js';
import { nodoAlterno } from './alterna.js';
import { ErrorDeDominio } from '../domain/validate.js';

/* Un error atrapado, pintado como alerta.

   Distingue las dos clases de error, que piden dos acciones distintas:

   - ErrorDeDominio: el mensaje esta redactado para quien calibra («la
     velocidad debe ser mayor que cero») y se muestra tal cual. Es un dato
     que falta o que esta fuera de rango, y se corrige capturando.
   - Cualquier otro: es un defecto de la aplicacion. Se dice con esas
     palabras y el detalle tecnico queda a la vista para reportarlo, en vez
     de soltar «Cannot read properties of null» en medio de una pantalla en
     español y dejar a quien lo lee sin saber si el problema es suyo.

   Vive aqui y no repetida en cada pestaña porque nueve superficies tenian
   su propia copia identica de esta funcion. */
export function alertaDeError(error) {
  const deDominio = error instanceof ErrorDeDominio;
  return el(
    'div',
    { clase: 'alerta alerta--destructiva', role: 'alert' },
    deDominio ? null : el('p', { clase: 'alerta__titulo' }, 'Esto es un error de la aplicación'),
    el(
      'p',
      { clase: 'alerta__descripcion' },
      deDominio
        ? String(error.message)
        : `No es un dato que falte: repórtalo. Detalle técnico: ${String(error?.message ?? error)}`
    )
  );
}

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

let consecutivoResultado = 0;

/* Resultado de pantalla: la etiqueta, la cifra y —si se pasa `ayuda`— el
   mismo boton "?" que ya usan los campos y las tarjetas, montado a la
   derecha de la etiqueta.

   Una cifra sin nombre completo no se entiende sola: "CV de la barra",
   "factor requerido" o "método por barra" dicen poco a quien calibra de
   pie en el lote, y el desglose paso a paso responde COMO se calculo,
   no QUE significa ni que hacer con el numero. Eso es lo que entra al
   globo.

   La frontera es la de siempre: al globo va lo ESTABLE —que es la cifra,
   de donde sale, con que compararla—, y se sigue imprimiendo lo que
   cambia con el calculo: la cifra misma, el aviso accionable y el estado
   de lo capturado. Sin `ayuda` el resultado se pinta igual que antes,
   con la etiqueta pelada y sin envoltorio de mas.

   Bajo la cifra va SIEMPRE la misma cifra en el otro sistema, en letra
   chica, cuando la unidad se convierte (`ui/alterna.js`). No hay que
   pedirla: quien calibra mezcla unidades porque asi aprendio, y tener
   que sacar la calculadora del telefono a media calibracion es de donde
   salen los errores de factor. `magnitud` solo hace falta cuando el
   texto de la unidad es ambiguo —'m' es metro de tramo y de
   espaciamiento—, y `alterna: false` la apaga donde la cifra ya se pinta
   en las dos unidades. */
export function pintarResultado({
  etiqueta,
  valor,
  unidad = '',
  decimales = 2,
  principal = false,
  ayuda = null,
  magnitud = null,
  alterna = true,
}) {
  consecutivoResultado += 1;
  const idResultado = `resultado-${consecutivoResultado}`;
  const rotulo = el('span', { clase: 'resultado__etiqueta', id: idResultado }, etiqueta);
  const ayudaResultado = ayuda
    ? crearAyuda({ idCampo: idResultado, etiqueta, texto: ayuda })
    : null;
  return el(
    'div',
    { clase: `resultado${principal ? ' resultado--principal' : ''}` },
    ayudaResultado
      ? el('div', { clase: 'resultado__cabecera' }, rotulo, ayudaResultado.boton)
      : rotulo,
    el(
      'span',
      { clase: 'resultado__valor' },
      formatear(valor, decimales),
      unidad ? el('span', { clase: 'resultado__unidad' }, ` ${unidad}`) : null
    ),
    alterna ? nodoAlterno(valor, unidad, { magnitud, decimales }) : null,
    ayudaResultado ? ayudaResultado.globo : null
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

/* Pantalla que no puede calcular porque falta contexto: no hay tractor, no
   hay barra, no hay gas.

   Existe porque el mismo estado se manejaba con tres criterios distintos:
   Forzamiento comprobaba y devolvia una alerta con instruccion, el
   asistente usaba encadenamiento opcional con defaults, y Avance y Gasto
   de agua no comprobaban nada y dejaban salir un TypeError que llegaba a
   la pantalla como «Cannot read properties of undefined (reading 'id')».
   Un mensaje de motor JavaScript en medio de una pantalla en español no
   dice si el problema es de quien captura o de la aplicacion.

   `faltantes` va en el idioma de quien calibra ('un tractor', 'una
   barra'), porque entra tal cual en la frase. */
export function tarjetaSinContexto(titulo, faltantes) {
  return tarjeta(
    { titulo, descripcion: 'El cálculo necesita el contexto activo de la aplicación.' },
    el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el(
        'p',
        { clase: 'alerta__descripcion' },
        `Falta ${faltantes.join(' y ')} en la configuración. Agrégalo en Sistema, ` +
          'Configuración y vuelve a esta pantalla.'
      )
    )
  );
}

let consecutivoTarjeta = 0;

/* Tarjeta estandar de pantalla.

   `ayuda` es la explicacion ESTABLE de la tarjeta —el porque del
   calculo, la advertencia que siempre aplica— y NO se imprime: vive en
   el globo del boton "?" del encabezado, el mismo patron que ya usan
   los campos. Medido en un telefono de 390px, esa prosa era entre un
   tercio y la mitad de todo lo que habia en las pantallas de campo, y
   se leia como un muro con los datos perdidos entre parrafos.

   Lo que SI se sigue imprimiendo es el `.ayuda` que habla de ESTE
   calculo y cambia con el ("se calcularon 3 de 5 renglones", "2
   boquillas logran el caudal"): eso es resultado, no explicacion, y
   esconderlo tras un boton seria esconder lo que se vino a ver. */
export function tarjeta({ titulo, descripcion = null, ayuda = null }, ...contenido) {
  consecutivoTarjeta += 1;
  const idTarjeta = `tarjeta-${consecutivoTarjeta}`;
  const rotulo = el('h2', { clase: 'card__titulo', id: idTarjeta }, titulo);
  const ayudaTarjeta = ayuda
    ? crearAyuda({ idCampo: idTarjeta, etiqueta: titulo, texto: ayuda })
    : null;
  return el(
    'section',
    { clase: 'card' },
    el(
      'div',
      { clase: 'card__encabezado' },
      ayudaTarjeta
        ? el('div', { clase: 'card__titulo-fila' }, rotulo, ayudaTarjeta.boton)
        : rotulo,
      descripcion ? el('p', { clase: 'card__descripcion' }, descripcion) : null,
      ayudaTarjeta ? ayudaTarjeta.globo : null
    ),
    el('div', { clase: 'card__contenido' }, ...contenido)
  );
}
