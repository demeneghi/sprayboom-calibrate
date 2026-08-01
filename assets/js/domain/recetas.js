// Recetas del asistente: la secuencia de DATOS que hace falta para
// lograr un objetivo declarado.
//
// La unidad de un paso es el DATO, no la pantalla. Esa es toda la
// diferencia con la version anterior de este archivo, y es la que
// arregla el defecto que se vio en campo: cuando los pasos eran
// pantallas, una calibracion guiada pedia la presion en Gasto de agua y
// otra vez en la Prueba de captura, y el espaciamiento y el objetivo
// tres veces. No era un defecto de la guia: cada pantalla declaraba sus
// campos por su cuenta y todas se pedian de nuevo.
//
// Ahora cada dato se pregunta UNA vez —vive en `estado.jornada`, ver
// domain/datos.js— y un paso solo aparece si su dato todavia no esta
// resuelto o si quien calibra lo abre a proposito.
//
// Las pestañas NO desaparecen: siguen siendo la via para recalcular una
// sola cosa, para ver el desglose completo y para trabajar sin guia.
// El asistente y las pestañas escriben en el MISMO sitio, asi que se
// puede saltar de uno a otro a media calibracion.

// ---------------------------------------------------------------------
// Los pasos, declarados una vez y compartidos entre recetas
//
// `tipo` dice que interfaz monta el paso (ui/tabs/guia/pasos.js).
// `datos` son las claves de domain/datos.js que ese paso captura; sirven
// para saber si ya esta resuelto sin preguntarle a la interfaz.
// `resuelto` es la regla propia cuando el paso no se reduce a sus datos.
// ---------------------------------------------------------------------
export const PASOS = {
  velocidad: {
    id: 'velocidad',
    tipo: 'velocidad',
    titulo: 'Velocidad de avance',
    pregunta: '¿A qué velocidad vas a pasar?',
    porque: 'El volumen por hectárea y el tiempo por tabla dependen de ella.',
    datos: ['velocidadKmh'],
  },
  barra: {
    id: 'barra',
    tipo: 'datos',
    titulo: 'La barra',
    pregunta: 'Confirma la barra con la que sales',
    porque: 'El ancho, el número de boquillas y el espaciamiento reparten el caudal.',
    datos: ['anchoBarraM', 'numBoquillas', 'espaciamientoM'],
    // Estos tres salen de la barra configurada, asi que casi siempre ya
    // tienen valor: el paso es de CONFIRMACION, y por eso se marca visto
    // en vez de resuelto.
    confirmacion: true,
  },
  objetivo: {
    id: 'objetivo',
    tipo: 'datos',
    titulo: 'Volumen objetivo',
    pregunta: '¿Cuántos litros por hectárea quieres aplicar?',
    porque: 'Es contra lo que se compara todo lo demás.',
    datos: ['lhaObjetivo'],
  },
  boquilla: {
    id: 'boquilla',
    tipo: 'boquilla',
    titulo: 'Boquilla y presión',
    pregunta: '¿Qué boquilla traes y a qué presión?',
    porque: 'De las dos sale el caudal por boquilla.',
    datos: ['boquillaId', 'presionBar'],
  },
  candidatas: {
    id: 'candidatas',
    tipo: 'candidatas',
    titulo: 'Elegir del catálogo',
    pregunta: '¿Cuál boquilla llega a tu objetivo?',
    porque: 'Con la velocidad y el espaciamiento, el catálogo se reduce a unas cuantas.',
    datos: ['boquillaId', 'presionBar'],
  },
  aforo: {
    id: 'aforo',
    tipo: 'aforo',
    titulo: 'Verificar por aforo',
    pregunta: '¿Qué recogiste de cada boquilla?',
    porque: 'La ficha describe una boquilla nueva; el aforo mide la barra de hoy.',
    datos: [],
    opcional: true,
    resuelto: (instantanea) => Number.isFinite(instantanea.lhaMedido?.valor),
  },
  volumenAplicacion: {
    id: 'volumenAplicacion',
    tipo: 'datos',
    titulo: 'Volumen de aplicación',
    pregunta: '¿Con cuántos litros por hectárea sale la barra?',
    porque: 'De este número dependen la dosis del tanque y el etileno.',
    datos: ['volumenAplicacionLha'],
  },
  tanque: {
    id: 'tanque',
    tipo: 'datos',
    titulo: 'Tanque y dosis',
    pregunta: '¿Qué tanque cargas y qué dosis dice la etiqueta?',
    porque: 'Con el volumen de aplicación dan el producto por carga.',
    datos: ['volumenTanqueL', 'modoDosis', 'dosisCantidad', 'unidadProducto', 'superficieObjetivoHa'],
  },
  etileno: {
    id: 'etileno',
    tipo: 'datos',
    titulo: 'Dosis de etileno',
    pregunta: '¿Cuánto etileno por hectárea?',
    porque: 'Con el agua por tabla da la masa que hay que inyectar.',
    datos: ['dosisObjetivoGha'],
  },
  rotametro: {
    id: 'rotametro',
    tipo: 'rotametro',
    titulo: 'Rotámetro',
    pregunta: '¿Qué marca el rotámetro?',
    porque: 'La lectura y la presión de la aguja dan el gas que de verdad entra.',
    datos: ['scfm', 'psiManometrica'],
  },
};

// ---------------------------------------------------------------------
// Las recetas: un objetivo y su secuencia de pasos
// ---------------------------------------------------------------------
export const RECETAS = [
  {
    id: 'gasto-agua',
    titulo: 'Ajustar el gasto de agua',
    objetivo: 'Quiero aplicar cierto volumen por hectárea y saber a qué presión ir.',
    pasos: ['velocidad', 'barra', 'boquilla', 'objetivo', 'aforo'],
    // La hoja del final deja mover estas dos perillas: son las que quien
    // calibra tiene fisicamente en el tractor.
    ajustes: ['presion', 'velocidad'],
  },
  {
    id: 'elegir-boquilla',
    titulo: 'Elegir la boquilla',
    objetivo: 'Quiero saber qué boquilla del catálogo llega a mi objetivo.',
    pasos: ['velocidad', 'barra', 'objetivo', 'candidatas'],
    ajustes: ['presion', 'velocidad'],
  },
  {
    id: 'mezcla-tanque',
    titulo: 'Preparar la mezcla',
    objetivo: 'Quiero saber cuánto producto va en el tanque.',
    pasos: ['volumenAplicacion', 'tanque'],
    ajustes: [],
  },
  {
    id: 'forzamiento-etileno',
    titulo: 'Forzar con etileno',
    objetivo: 'Quiero dosificar el etileno por rotámetro para el forzamiento.',
    pasos: ['velocidad', 'volumenAplicacion', 'etileno', 'rotametro'],
    ajustes: [],
  },
];

export function recetaPorId(id) {
  return RECETAS.find((r) => r.id === id) ?? null;
}

export function pasoPorId(id) {
  const paso = PASOS[id];
  if (!paso) throw new Error(`Paso desconocido: ${id}`);
  return paso;
}

// Los pasos de una receta, ya expandidos.
export function pasosDeReceta(receta) {
  return receta.pasos.map(pasoPorId);
}

// ---------------------------------------------------------------------
// Estado de la receta
//
// La instantanea la arma la interfaz leyendo lo que ya existe: los datos
// de la jornada, los resultados compartidos y los pasos que quien
// calibra ya visito. Este modulo no toca el almacen.
// ---------------------------------------------------------------------

// Un paso esta resuelto cuando TODOS sus datos tienen valor. Los pasos
// de confirmacion, ademas, exigen haber pasado por ahi: sus datos vienen
// de la barra configurada y estarian resueltos desde el primer segundo,
// asi que el asistente los saltaria sin que nadie los mirara.
export function estadoDePaso(paso, instantanea) {
  const faltantes = paso.datos.filter((id) => !tieneValor(instantanea.datos?.[id]));
  const conDatos = paso.datos.length === 0 || faltantes.length === 0;
  const propio = paso.resuelto ? paso.resuelto(instantanea) : true;
  const visto = instantanea.vistos?.includes(paso.id) ?? false;
  const resuelto = conDatos && propio && (!paso.confirmacion || visto);
  return { ...paso, resuelto, faltantes, visto };
}

function tieneValor(valor) {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor === 'string') return valor.length > 0;
  return true;
}

export function progresoDeReceta(receta, instantanea) {
  const pasos = pasosDeReceta(receta).map((paso) => estadoDePaso(paso, instantanea));
  const obligatorios = pasos.filter((p) => !p.opcional);
  const resueltos = obligatorios.filter((p) => p.resuelto).length;
  const siguiente =
    obligatorios.find((p) => !p.resuelto) ?? pasos.find((p) => p.opcional && !p.resuelto) ?? null;
  return {
    pasos,
    resueltos,
    total: obligatorios.length,
    completa: resueltos === obligatorios.length,
    siguiente,
  };
}

// El indice del paso que toca abrir al entrar o al continuar: el primero
// sin resolver, y si no queda ninguno, el ultimo (la hoja de resultado
// se pinta al final del recorrido).
export function indiceDelSiguiente(receta, instantanea) {
  const pasos = pasosDeReceta(receta).map((paso) => estadoDePaso(paso, instantanea));
  const indice = pasos.findIndex((p) => !p.resuelto && !p.opcional);
  return indice >= 0 ? indice : pasos.length;
}
