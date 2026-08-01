// Recetas: el ORDEN en que las pantallas se encadenan para lograr un
// objetivo declarado, y el estado de cada paso.
//
// Por que existe esto y por que NO es un wizard:
//
//   La aplicacion ya recalcula en vivo, ya resuelve en los dos sentidos
//   y ya hereda el dato de una pantalla a la siguiente (ui/heredado.js).
//   Lo que faltaba no era encerrar al usuario en un carril, sino DECIR
//   el orden: diez pestanas sin jerarquia visible, con una cadena de
//   dependencias real (Avance manda sobre Gasto de agua, que manda sobre
//   Mezcla y Forzamiento) que en pantalla no se ve por ningun lado.
//
//   Una receta es una LISTA DE PASOS QUE SE PUEDEN SALTAR, no un carril.
//   Cada paso apunta a una pantalla que ya existe y dice si su dato ya
//   esta o falta. Quien recalibra una sola cosa entra directo a su
//   pestana, como siempre; quien no sabe por donde empezar, sigue la
//   receta.
//
// Este modulo es puro: no toca DOM ni almacenamiento. Recibe una
// INSTANTANEA —un objeto plano que la interfaz arma con lo que ya
// derivan `ctx` y el almacen— y devuelve estado. Asi el orden de la
// cadena y la regla de "este paso ya esta" se prueban en Node, igual
// que el resto del dominio.

// ---------------------------------------------------------------------
// Requisitos: la pregunta "¿este paso ya tiene su dato?"
//
// Cada uno recibe la instantanea y devuelve { listo, detalle, fecha }.
// `detalle` es lo que se pinta en el chip del paso: SIEMPRE dice de
// donde salio el numero, nunca solo "listo". Un paso en verde sin
// procedencia se lee como un dato propio, y entonces nadie sospecha
// cuando esta viejo. Es la misma regla del chip de ui/heredado.js.
// ---------------------------------------------------------------------

function faltante(detalle) {
  return { listo: false, detalle, fecha: null };
}

function desdeResultado(resultado, sinDato) {
  if (!Number.isFinite(resultado?.valor)) return faltante(sinDato);
  return { listo: true, detalle: resultado.detalle ?? null, fecha: resultado.fecha ?? null };
}

export const REQUISITOS = {
  // La velocidad de trabajo que Avance tiene capturada ahora mismo. La
  // deriva ctx.velocidadDeAvance(), que es la unica version de ese
  // calculo en la aplicacion.
  velocidad(instantanea) {
    const v = instantanea.velocidad;
    if (!Number.isFinite(v?.velocidadKmh)) {
      return faltante('Captura los segundos por tramo o elige una marcha con su régimen.');
    }
    return { listo: true, detalle: v.etiqueta ?? null, fecha: null };
  },

  // El volumen objetivo de la jornada. Puede venir del rancho, asi que
  // nunca esta "vacio"; lo que interesa es que exista un numero con el
  // que filtrar boquillas y comparar.
  objetivo(instantanea) {
    if (!Number.isFinite(instantanea.lhaObjetivo)) {
      return faltante('Captura el volumen que quieres aplicar.');
    }
    return { listo: true, detalle: 'objetivo de la jornada', fecha: null };
  },

  // El L/ha calculado con la ficha de la boquilla, en Gasto de agua.
  lhaCalculado(instantanea) {
    return desdeResultado(
      instantanea.lhaCalculado,
      'Elige la boquilla y captura la presión de trabajo.'
    );
  },

  // El L/ha medido por aforo, en la Prueba de captura. Es el unico que
  // sale de la barra real y no de una ficha.
  lhaMedido(instantanea) {
    return desdeResultado(instantanea.lhaMedido, 'Afora las boquillas para verificar el cálculo.');
  },

  // El volumen de aplicacion VIGENTE: lo aforado si lo hay, si no lo
  // calculado. Es lo que consumen Mezcla y Forzamiento.
  volumenVigente(instantanea) {
    const vigente = instantanea.lhaMedido ?? instantanea.lhaCalculado ?? null;
    return desdeResultado(
      vigente,
      'Calcula el gasto de agua en Gasto de agua, o afora en la Prueba de captura.'
    );
  },

  // La masa de etileno por tabla que calcula Forzamiento y que Gas
  // etileno pide como objetivo.
  masaPorTabla(instantanea) {
    return desdeResultado(
      instantanea.masaPorTablaG,
      'Captura la dosis de forzamiento y el volumen de agua.'
    );
  },

  // La dosis del producto capturada en Mezcla. No produce un resultado
  // compartido —la dosis es de este tanque y de este producto—, asi que
  // el requisito mira el borrador de la pantalla.
  dosisMezcla(instantanea) {
    if (!Number.isFinite(instantanea.dosisMezcla)) {
      return faltante('Captura el volumen del tanque y la dosis del producto.');
    }
    return { listo: true, detalle: 'dosis capturada en Mezcla', fecha: null };
  },

  // El flujo del rotametro capturado en Gas etileno.
  flujoGas(instantanea) {
    if (!Number.isFinite(instantanea.flujoGas)) {
      return faltante('Captura la lectura del rotámetro o el objetivo de masa.');
    }
    return { listo: true, detalle: 'lectura capturada en Gas etileno', fecha: null };
  },
};

// ---------------------------------------------------------------------
// Las recetas
//
// Son CUATRO a proposito. Una por trabajo real de campo, no una por
// pantalla: si hubiera una receta por pestana, la guia seria la misma
// lista de tabs con otro nombre.
//
// `ajustes` declara que perillas admite la hoja de resultado al final.
// Solo se declaran las dos que quien calibra tiene FISICAMENTE en el
// tractor —la presion del manometro y la velocidad— y solo en las
// recetas donde el numero que mueven (el L/ha) es el resultado de la
// receta. En Mezcla y Forzamiento el L/ha es una ENTRADA: moverlo desde
// la hoja cambiaria la dosis del tanque sin que se vea el calculo, y esa
// cuenta se ve completa en su pantalla.
// ---------------------------------------------------------------------
export const RECETAS = [
  {
    id: 'gasto-agua',
    titulo: 'Ajustar el gasto de agua',
    objetivo: 'Quiero aplicar cierto volumen por hectárea y saber a qué presión ir.',
    pasos: [
      {
        id: 'velocidad',
        seccion: 'calibrar',
        tab: 'avance',
        titulo: 'Velocidad de avance',
        porque: 'El volumen por hectárea depende de qué tan rápido pasa la barra.',
        requisito: 'velocidad',
      },
      {
        id: 'calculo',
        seccion: 'calibrar',
        tab: 'gasto',
        titulo: 'Gasto de agua',
        porque: 'La boquilla y la presión de trabajo dan el volumen por hectárea.',
        requisito: 'lhaCalculado',
      },
      {
        id: 'aforo',
        seccion: 'registrar',
        tab: 'captura',
        titulo: 'Verificar por aforo',
        porque: 'La ficha describe una boquilla nueva; el aforo mide la barra de hoy.',
        requisito: 'lhaMedido',
        opcional: true,
      },
    ],
    ajustes: ['presion', 'velocidad'],
  },
  {
    id: 'elegir-boquilla',
    titulo: 'Elegir la boquilla',
    objetivo: 'Quiero saber qué boquilla del catálogo llega a mi objetivo.',
    pasos: [
      {
        id: 'velocidad',
        seccion: 'calibrar',
        tab: 'avance',
        titulo: 'Velocidad de avance',
        porque: 'Sin velocidad no se puede filtrar el catálogo.',
        requisito: 'velocidad',
      },
      {
        id: 'candidatas',
        seccion: 'calibrar',
        tab: 'boquillas',
        titulo: 'Candidatas del catálogo',
        porque: 'Con el objetivo y la velocidad, el catálogo se reduce a unas cuantas.',
        requisito: 'objetivo',
      },
      {
        id: 'calculo',
        seccion: 'calibrar',
        tab: 'gasto',
        titulo: 'Confirmar con la elegida',
        porque: 'La boquilla elegida se comprueba a la presión con la que vas a trabajar.',
        requisito: 'lhaCalculado',
      },
    ],
    ajustes: ['presion', 'velocidad'],
  },
  {
    id: 'mezcla-tanque',
    titulo: 'Preparar la mezcla',
    objetivo: 'Quiero saber cuánto producto va en el tanque.',
    pasos: [
      {
        id: 'volumen',
        seccion: 'calibrar',
        tab: 'gasto',
        titulo: 'Volumen de aplicación',
        porque: 'La dosis del tanque se calcula sobre el volumen que de verdad aplicas.',
        requisito: 'volumenVigente',
      },
      {
        id: 'mezcla',
        seccion: 'calibrar',
        tab: 'mezcla',
        titulo: 'Mezcla del tanque',
        porque: 'Con el volumen y la dosis sale el producto por tanque y por tabla.',
        requisito: 'dosisMezcla',
      },
    ],
    ajustes: [],
  },
  {
    id: 'forzamiento-etileno',
    titulo: 'Forzar con etileno',
    objetivo: 'Quiero dosificar el etileno por rotámetro para el forzamiento.',
    pasos: [
      {
        id: 'velocidad',
        seccion: 'calibrar',
        tab: 'avance',
        titulo: 'Velocidad de avance',
        porque: 'De la velocidad sale el tiempo de inyección por tabla.',
        requisito: 'velocidad',
      },
      {
        id: 'volumen',
        seccion: 'calibrar',
        tab: 'gasto',
        titulo: 'Volumen de aplicación',
        porque: 'El etileno se dosifica sobre el agua que se aplica.',
        requisito: 'volumenVigente',
      },
      {
        id: 'masa',
        seccion: 'calibrar',
        tab: 'forzamiento',
        titulo: 'Masa de etileno por tabla',
        porque: 'Es el objetivo que después se convierte en flujo del rotámetro.',
        requisito: 'masaPorTabla',
      },
      {
        id: 'rotametro',
        seccion: 'calibrar',
        tab: 'gas',
        titulo: 'Flujo del rotámetro',
        porque: 'Es el número que se ajusta en el fierro, con su corrección de presión.',
        requisito: 'flujoGas',
      },
    ],
    ajustes: [],
  },
];

export function recetaPorId(id) {
  return RECETAS.find((r) => r.id === id) ?? null;
}

// ---------------------------------------------------------------------
// Estado de un paso y avance de la receta
// ---------------------------------------------------------------------

// Un dato fechado de OTRO dia se marca. No se invalida ni se borra: un
// aforo de la semana pasada puede seguir siendo el bueno, y decidir eso
// es de quien calibra. Lo que no puede pasar es que no se note.
export function esDeOtroDia(fecha, ahora) {
  if (!fecha || !ahora) return false;
  return String(fecha).slice(0, 10) !== String(ahora).slice(0, 10);
}

export function estadoDePaso(paso, instantanea) {
  const requisito = REQUISITOS[paso.requisito];
  if (!requisito) throw new Error(`Requisito desconocido: ${paso.requisito}`);
  const r = requisito(instantanea);
  return {
    ...paso,
    listo: r.listo,
    detalle: r.detalle,
    fecha: r.fecha,
    viejo: r.listo && esDeOtroDia(r.fecha, instantanea.ahora),
  };
}

// El avance de la receta. `siguiente` es el primer paso pendiente NO
// opcional; si solo quedan opcionales, apunta al primero de esos, y si
// no queda ninguno es null. Los pasos opcionales no cuentan para el
// total: una receta con el aforo pendiente esta completa, porque el
// aforo verifica y no habilita.
export function progresoDeReceta(receta, instantanea) {
  const pasos = receta.pasos.map((paso) => estadoDePaso(paso, instantanea));
  const obligatorios = pasos.filter((p) => !p.opcional);
  const listos = obligatorios.filter((p) => p.listo).length;
  const siguiente =
    obligatorios.find((p) => !p.listo) ?? pasos.find((p) => p.opcional && !p.listo) ?? null;
  return {
    pasos,
    listos,
    total: obligatorios.length,
    completa: listos === obligatorios.length,
    siguiente,
    // Un dato viejo no bloquea, pero la receta lo dice de una vez para
    // que no haya que abrir los pasos uno por uno.
    hayViejos: pasos.some((p) => p.viejo),
  };
}

// Posicion de una pantalla dentro de la receta activa, para la tira de
// avance del encabezado. Un mismo tab puede aparecer una sola vez por
// receta; si no aparece, se devuelve null y la tira no se pinta.
export function posicionEnReceta(receta, { seccion, tab }) {
  const indice = receta.pasos.findIndex((p) => p.seccion === seccion && p.tab === tab);
  if (indice < 0) return null;
  return {
    indice,
    numero: indice + 1,
    total: receta.pasos.length,
    paso: receta.pasos[indice],
    anterior: indice > 0 ? receta.pasos[indice - 1] : null,
    siguiente: indice < receta.pasos.length - 1 ? receta.pasos[indice + 1] : null,
  };
}
