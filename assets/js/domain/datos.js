// Registro de los datos compartidos de la calibración.
//
// Un DATO es algo que se pregunta UNA vez: la presión de trabajo, la
// velocidad, la boquilla. No es "un campo de una pantalla": es el
// número, y vive en `estado.jornada`.
//
// Por que existe este archivo:
//
//   Cada pantalla declaraba sus campos por su cuenta, asi que la presion
//   estaba escrita tres veces —en Gasto de agua, en la Prueba de captura
//   y, con otro nombre, en el asistente— con tres etiquetas, tres textos
//   de ayuda y tres sitios donde guardarla. Mientras cada pantalla se
//   usara sola no se notaba. En cuanto el asistente las puso en fila, la
//   calibracion pedia la misma presion tres veces, y eso no es un
//   defecto de la guia: es que la unidad de captura era la PANTALLA y
//   tenia que ser el DATO.
//
// Aqui se declara cada dato una sola vez y de aqui construyen las dos
// superficies: el asistente y las pestañas. Este modulo es puro —no toca
// DOM ni almacenamiento—; quien resuelve el valor vigente contra el
// estado es `ui/dato.js`.

// De donde sale el valor cuando la jornada todavia no lo tiene. Son
// nombres, no funciones, porque el dominio no conoce el almacen:
// `ui/dato.js` los resuelve.
//
//   'avance'          la velocidad que Avance tiene capturada ahora
//   'barra'           el espaciamiento efectivo de la barra activa
//   'equipo.<campo>'  un campo de la barra activa
//   'config.<campo>'  un parametro agronomico del rancho
//   'resultado.<clave>' un resultado compartido entre pantallas
export const DATOS = {
  velocidadKmh: {
    etiqueta: 'Velocidad de avance',
    magnitud: 'velocidad',
    nombreEnFrase: 'la velocidad',
    decimales: 2,
    respaldo: 'avance',
    // Marca de captura manual: escribir un numero a mano manda sobre lo
    // que trae la fuente, y un boton lo devuelve.
    manual: 'velocidadManual',
    fuente: 'Avance',
    destino: { seccion: 'calibrar', tab: 'avance' },
    ayuda:
      'Viene de Avance: los segundos por tramo o la marcha con su régimen. Si escribes un ' +
      'número aquí, manda el tuyo.',
    sinDato:
      'Captura en Avance los segundos por tramo o una marcha con régimen, o escribe la ' +
      'velocidad aquí.',
  },

  presionBar: {
    etiqueta: 'Presión en la boquilla',
    magnitud: 'presion',
    nombreEnFrase: 'la presión',
    decimales: 2,
    respaldo: 'equipo.presionCalibracion',
    ayuda:
      'La que marca el manómetro trabajando. Viene la de la última calibración de esta barra; ' +
      'cámbiala por la de hoy.',
  },

  anchoBarraM: {
    etiqueta: 'Ancho de la barra',
    magnitud: 'distancia',
    nombreEnFrase: 'el ancho de la barra',
    decimales: 2,
    respaldo: 'equipo.anchoBarra',
    ayuda: 'Viene de la barra activa. Cambiarlo aquí no toca la configuración.',
  },

  numBoquillas: {
    etiqueta: 'Número de boquillas',
    magnitud: null,
    nombreEnFrase: 'el número de boquillas',
    decimales: 0,
    respaldo: 'equipo.numBoquillas',
    ayuda: 'Viene de la barra activa. Cuéntalas antes de confiar en el número.',
  },

  espaciamientoM: {
    etiqueta: 'Espaciamiento entre boquillas',
    magnitud: 'distanciaCorta',
    nombreEnFrase: 'el espaciamiento',
    decimales: 3,
    respaldo: 'barra',
    manual: 'espaciamientoManual',
    fuente: 'la barra',
    destino: { seccion: 'sistema', tab: 'configuracion' },
    ayuda:
      'Sale de la barra activa: el capturado o, si no lo hay, el ancho entre el número de ' +
      'boquillas. Cambiarlo aquí no toca la configuración.',
    sinDato:
      'Captura el ancho y el número de boquillas de la barra en Sistema, Configuración, o ' +
      'escribe aquí el espaciamiento.',
  },

  // Los tres de arriba están amarrados: `ancho = número * espaciamiento`.
  // Este dato dice CUÁL de ellos se calcula de los otros dos, y por eso
  // vive con ellos y no en el borrador de una pantalla: la barra propone
  // el suyo y quien calibra puede cambiarlo para la jornada.
  geometriaCalculada: {
    etiqueta: '¿Cuál se calcula?',
    tipo: 'opcion',
    nombreEnFrase: 'cuál dato de la barra se calcula',
    opciones: [
      { valor: 'anchoBarra', texto: 'El ancho de la barra' },
      { valor: 'numBoquillas', texto: 'El número de boquillas' },
      { valor: 'espaciamiento', texto: 'El espaciamiento' },
      { valor: 'ninguno', texto: 'Ninguno: capturo los tres' },
    ],
    respaldo: 'equipo.geometriaCalculada',
    predeterminado: 'espaciamiento',
    ayuda:
      'Los tres datos de la barra están amarrados: el ancho es el número de boquillas por el ' +
      'espaciamiento. Elige cuál se calcula solo y captura los otros dos.',
  },

  lhaObjetivo: {
    etiqueta: 'Volumen objetivo',
    magnitud: 'volumenAplicacion',
    nombreEnFrase: 'el volumen objetivo',
    decimales: 1,
    respaldo: 'config.volumenAguaObjetivo',
    ayuda: 'El volumen que quieres aplicar. Viene el último que capturaste.',
    // Ademas de la jornada, el objetivo se publica como resultado
    // compartido: es lo que leen las pantallas que lo comparan contra lo
    // calculado.
    publicaResultado: 'lhaObjetivo',
  },

  boquillaId: {
    etiqueta: 'Boquilla',
    tipo: 'boquilla',
    nombreEnFrase: 'la boquilla',
    respaldo: 'equipo.boquillaId',
    ayuda: 'La que está montada en la barra. Cambiarla aquí no toca la configuración.',
  },

  volumenAplicacionLha: {
    etiqueta: 'Volumen de aplicación',
    magnitud: 'volumenAplicacion',
    nombreEnFrase: 'el volumen de aplicación',
    decimales: 1,
    respaldo: 'volumenReal',
    manual: 'volumenAplicacionManual',
    fuente: 'Gasto de agua',
    destino: { seccion: 'calibrar', tab: 'gasto' },
    ayuda:
      'El L/ha REAL con el que va a salir la barra: de este número dependen la mezcla y el ' +
      'etileno. Viene del aforo y, si no lo hay, de Gasto de agua.',
    sinDato:
      'Calcula el gasto de agua o afora la barra en la prueba de captura, o escribe aquí el ' +
      'volumen de aplicación.',
  },

  // ------------------------------------------------------------------
  // Datos de UNA sola pantalla
  //
  // No se repiten en ningun lado, asi que su sitio canonico ya es el
  // borrador de esa pantalla: `guarda` lo declara y el asistente escribe
  // exactamente ahi. Estan en el registro porque el asistente los pide y
  // necesita su etiqueta, su unidad y su ayuda; no por duplicarlos.
  // ------------------------------------------------------------------
  volumenTanqueL: {
    etiqueta: 'Volumen del tanque',
    magnitud: 'volumen',
    nombreEnFrase: 'el volumen del tanque',
    decimales: 0,
    guarda: { tab: 'mezcla', clave: 'volumenTanqueL' },
    respaldo: 'equipo.volumenTanque',
    ayuda: 'Viene del tanque de la barra activa. Cámbialo si hoy cargas distinto.',
  },
  modoDosis: {
    etiqueta: 'Forma de la dosis',
    tipo: 'opcion',
    opciones: [
      { valor: 'por-ha', texto: 'Por hectárea' },
      { valor: 'por-100L', texto: 'Por cada 100 L de caldo' },
    ],
    guarda: { tab: 'mezcla', clave: 'modoDosis' },
    predeterminado: 'por-ha',
    ayuda: 'Las dos formas en que viene una etiqueta. Revisa la tuya antes de elegir.',
  },
  dosisCantidad: {
    etiqueta: 'Dosis del producto',
    magnitud: null,
    nombreEnFrase: 'la dosis',
    decimales: 2,
    guarda: { tab: 'mezcla', clave: 'dosisCantidad' },
    ayuda: 'La cantidad tal como viene en la etiqueta, con la forma y la unidad que elegiste.',
  },
  unidadProducto: {
    etiqueta: 'Unidad del producto',
    tipo: 'opcion',
    opciones: [
      { valor: 'L', texto: 'L (producto líquido)' },
      { valor: 'kg', texto: 'kg (producto sólido)' },
    ],
    guarda: { tab: 'mezcla', clave: 'unidadProducto' },
    predeterminado: 'L',
    ayuda: 'Si el producto es sólido, lo que ocupa en el tanque no se cuenta.',
  },
  superficieObjetivoHa: {
    etiqueta: 'Superficie objetivo (opcional)',
    magnitud: 'superficie',
    nombreEnFrase: 'la superficie',
    decimales: 2,
    guarda: { tab: 'mezcla', clave: 'superficieObjetivoHa' },
    opcional: true,
    ayuda: 'Si la pones, se arma el plan de cargas con el último tanque a medias.',
  },
  dosisObjetivoGha: {
    etiqueta: 'Dosis objetivo de etileno',
    magnitud: null,
    unidadTexto: 'g/ha',
    nombreEnFrase: 'la dosis de etileno',
    decimales: 1,
    guarda: { tab: 'forzamiento', clave: 'dosisObjetivoGha' },
    respaldo: 'config.dosisEtilenoObjetivo',
    ayuda: 'El etileno por hectárea del plan de forzamiento del rancho.',
  },
  scfm: {
    etiqueta: 'Lectura del flotador',
    magnitud: null,
    unidadTexto: 'SCFM',
    nombreEnFrase: 'la lectura del flotador',
    decimales: 2,
    guarda: { tab: 'gas', clave: 'scfm' },
    ayuda: 'La raya de la escala donde flota la bola, en pies cúbicos estándar por minuto.',
  },
  psiManometrica: {
    etiqueta: 'Presión manométrica en el rotámetro',
    magnitud: null,
    unidadTexto: 'psi',
    nombreEnFrase: 'la presión del rotámetro',
    decimales: 1,
    guarda: { tab: 'gas', clave: 'psiManometrica' },
    ayuda:
      'La presión a la entrada del tubo. Con el gas comprimido la bola se queda corta y la ' +
      'corrección lo compensa.',
  },
};

export function dato(id) {
  const declaracion = DATOS[id];
  if (!declaracion) throw new Error(`Dato desconocido: ${id}`);
  return declaracion;
}

// Clave de la marca de captura manual, si el dato la tiene.
export function claveManual(id) {
  return DATOS[id]?.manual ?? null;
}

// Los datos que se guardan en la jornada, incluidas sus marcas de
// captura manual. Es lo que viaja en un enlace compartido.
export function clavesDeJornada() {
  const claves = [];
  for (const [id, declaracion] of Object.entries(DATOS)) {
    claves.push(id);
    if (declaracion.manual) claves.push(declaracion.manual);
  }
  return claves;
}

// ---------------------------------------------------------------------
// Rastro de una calibración: todo lo que deja capturado
//
// Sirve para EMPEZAR DE CERO al elegir otro objetivo en el asistente.
// Se deriva del registro —no es una segunda lista que mantener a mano—
// más dos añadidos que el registro no puede deducir solo:
//
//   1. Los borradores de los que un dato DERIVA su valor. La velocidad
//      no se guarda: sale del modo, la marcha, el régimen y los segundos
//      por tramo que vivan en el borrador de Avance. Sin borrar eso, el
//      asistente diría «reiniciado» y seguiría trayendo la velocidad de
//      la calibración anterior.
//   2. Los resultados compartidos que produce una calibración. Si
//      quedaran, el volumen de aplicación del objetivo nuevo seguiría
//      heredando el aforo del objetivo viejo.
//
// Lo que NO entra, a propósito: la configuración del rancho, las barras,
// los tractores, el catálogo y la bitácora. Eso no es la captura de hoy,
// es el fierro y el historial.
const DERIVADOS_EN_BORRADOR = {
  avance: ['modo', 'marcha', 'rpm', 'segundosPorTramo'],
  captura: ['tiempoS', 'volumenesMl'],
};

export const RESULTADOS_DE_CALIBRACION = [
  'lhaObjetivo',
  'lhaCalculado',
  'lhaMedido',
  'masaPorTablaG',
];

// Lo que cuenta como CAPTURA de una persona, para saber si un reinicio
// se llevaria algo por delante. No es lo mismo que el rastro que se
// borra, y la diferencia importa:
//
//   - Un dato heredado se PERSISTE solo al montar su campo —el
//     espaciamiento de la barra se escribe en la jornada con solo abrir
//     Gasto de agua— para que el enlace compartido y la bitacora lleven
//     el mismo numero que esta en pantalla. Ese no lo tecleo nadie: solo
//     cuenta cuando su marca de captura manual esta puesta.
//   - Avance persiste `modo` y `rpm` al abrirse, con el regimen habitual
//     precargado. Lo que una persona elige ahi es la MARCHA o los
//     segundos por tramo.
//
// Sin esta distincion, el asistente preguntaria «¿borro lo capturado?»
// en un telefono recien estrenado donde no hay nada que borrar.
const ELEGIDOS_EN_BORRADOR = {
  avance: ['marcha', 'segundosPorTramo'],
  captura: ['volumenesMl'],
};

export function senalesDeCaptura() {
  const rastro = rastroDeCalibracion();
  const jornada = [];
  for (const [id, declaracion] of Object.entries(DATOS)) {
    if (declaracion.guarda) continue;
    // Con marca de captura manual, manda la marca; sin ella, basta con
    // que el dato tenga valor.
    jornada.push(declaracion.manual ? { id, exigeMarca: declaracion.manual } : { id });
  }
  const borradores = {};
  for (const [tab, claves] of Object.entries(ELEGIDOS_EN_BORRADOR)) {
    borradores[tab] = [...claves];
  }
  for (const declaracion of Object.values(DATOS)) {
    if (!declaracion.guarda) continue;
    const { tab, clave } = declaracion.guarda;
    if (!borradores[tab]) borradores[tab] = [];
    if (!borradores[tab].includes(clave)) borradores[tab].push(clave);
  }
  return { jornada, borradores, resultados: rastro.resultados };
}

export function rastroDeCalibracion() {
  const borradores = {};
  for (const [tab, claves] of Object.entries(DERIVADOS_EN_BORRADOR)) {
    borradores[tab] = [...claves];
  }
  for (const declaracion of Object.values(DATOS)) {
    if (!declaracion.guarda) continue;
    const { tab, clave } = declaracion.guarda;
    if (!borradores[tab]) borradores[tab] = [];
    if (!borradores[tab].includes(clave)) borradores[tab].push(clave);
  }
  // Solo los que de verdad viven en la jornada: los que declaran
  // `guarda` viven en el borrador de su pantalla y ya salen arriba.
  const jornada = [];
  for (const [id, declaracion] of Object.entries(DATOS)) {
    if (declaracion.guarda) continue;
    jornada.push(id);
    if (declaracion.manual) jornada.push(declaracion.manual);
  }
  return { jornada, borradores, resultados: [...RESULTADOS_DE_CALIBRACION] };
}
