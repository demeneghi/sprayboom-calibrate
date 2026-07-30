// Valores de siembra de TODOS los parametros de la aplicacion.
//
// Principio rector: todo es parametro. Ningun numero de este archivo se
// escribe literal dentro de una funcion de calculo: las funciones de
// domain/ reciben estos valores por argumento. La interfaz y storage.js
// leen de aqui para sembrar el estado inicial y para pintar formularios
// (etiqueta, unidad, cotas y origen como ayuda contextual).
//
// Banderas de verificacion:
//   verificado: true        dato confirmado contra fuente
//   verificado: 'estimacion'  semilla razonable, el usuario debe calibrarla
//   verificado: 'pendiente'   dato faltante o sin confirmar; NO se inventa

// ---------------------------------------------------------------------
// Grupos de parametros escalares
// Cada campo: { valor, etiqueta, unidad, magnitud (clave de units.js o
// null), min, max, entero?, opcional?, origen, verificado? }
// ---------------------------------------------------------------------
export const PARAMETROS = {
  geometria: {
    etiqueta: 'Geometria de tabla y barra',
    campos: {
      largoTabla: {
        valor: 646,
        etiqueta: 'Largo de tabla',
        unidad: 'm',
        magnitud: 'distancia',
        min: 1,
        max: 5000,
        origen: 'Valor de siembra del rancho; metros lineales de una tabla.',
      },
      anchoBarra: {
        valor: 15.47,
        etiqueta: 'Ancho de barra de aplicacion',
        unidad: 'm',
        magnitud: 'distancia',
        min: 0.5,
        max: 100,
        origen: 'Ancho efectivo de la barra de aspersion.',
      },
      numBoquillas: {
        valor: 24,
        etiqueta: 'Numero de boquillas instaladas',
        unidad: '',
        magnitud: null,
        min: 1,
        max: 200,
        entero: true,
        verificado: 'estimacion',
        origen:
          'Estimacion de siembra; confirmar contando las boquillas de la barra antes de darlo por bueno.',
      },
      distanciaReferencia: {
        valor: 100,
        etiqueta: 'Distancia de referencia del reporte',
        unidad: 'm',
        magnitud: 'distancia',
        min: 1,
        max: 1000,
        origen: 'Tramo sobre el que el personal reporta segundos en campo.',
      },
      espaciamientoCapturado: {
        valor: null,
        etiqueta: 'Espaciamiento entre boquillas (capturado)',
        unidad: 'm',
        magnitud: 'distanciaCorta',
        min: 0.01,
        max: 10,
        opcional: true,
        origen:
          'Captura directa para barras con boquillas no uniformes. Si difiere del derivado (ancho entre numero de boquillas), la aplicacion lo advierte en vez de elegir uno en silencio.',
      },
    },
  },

  caldo: {
    etiqueta: 'Caldo de aplicacion',
    campos: {
      densidadRelativa: {
        valor: 1.0,
        etiqueta: 'Densidad relativa del caldo',
        unidad: '',
        magnitud: null,
        min: 0.8,
        max: 2.0,
        origen:
          'Agua = 1.0. Un caldo mas denso sale mas despacio por la misma boquilla a la misma presion: q_caldo = q_agua / raiz(densidad relativa).',
      },
    },
  },

  sitio: {
    etiqueta: 'Sitio',
    campos: {
      presionAtmosfericaLocal: {
        valor: 14.7,
        etiqueta: 'Presion atmosferica local',
        unidad: 'psia',
        magnitud: null,
        min: 8,
        max: 16,
        origen:
          'Presion absoluta del sitio. Cerca del nivel del mar coincide con la estandar de calibracion del rotametro; a mayor altitud dejan de coincidir y el despeje de presion debe restar la local.',
      },
    },
  },

  agronomicos: {
    etiqueta: 'Parametros agronomicos de forzamiento',
    campos: {
      dosisEtilenoReferencia: {
        valor: 2272,
        etiqueta: 'Dosis de etileno de referencia',
        unidad: 'g/ha',
        magnitud: null,
        min: 0,
        max: 20000,
        verificado: true,
        origen: 'Bartholomew et al., 2003. Cota de sanidad de la literatura.',
      },
      volumenAguaReferencia: {
        valor: 7000,
        etiqueta: 'Volumen de agua de referencia',
        unidad: 'L/ha',
        magnitud: 'volumenAplicacion',
        min: 0,
        max: 30000,
        verificado: true,
        origen: 'Bartholomew et al., 2003.',
      },
      dosisEtilenoObjetivo: {
        valor: 2090,
        etiqueta: 'Dosis de etileno objetivo propia',
        unidad: 'g/ha',
        magnitud: null,
        min: 0,
        max: 20000,
        origen:
          'Decision del rancho tras calibrar por pesaje del cilindro. El pesaje tiene prioridad sobre cualquier calculo teorico.',
      },
      volumenAguaObjetivo: {
        valor: null,
        etiqueta: 'Volumen de agua objetivo propio',
        unidad: 'L/ha',
        magnitud: 'volumenAplicacion',
        min: 0,
        max: 30000,
        opcional: true,
        verificado: 'pendiente',
        origen: 'Pendiente de capturar por el usuario. No se inventa.',
      },
      toleranciaAlerta: {
        valor: 15,
        etiqueta: 'Tolerancia de alerta',
        unidad: '%',
        magnitud: null,
        min: 1,
        max: 100,
        origen:
          'Desviacion respecto a la dosis objetivo a partir de la cual el forzamiento levanta alerta.',
      },
    },
  },

  umbrales: {
    etiqueta: 'Umbrales y tolerancias',
    campos: {
      umbralAtipicas: {
        valor: 10,
        etiqueta: 'Umbral de boquilla atipica',
        unidad: '%',
        magnitud: null,
        min: 1,
        max: 50,
        origen:
          'Criterio de la literatura de extension: desviacion respecto a la media de la barra a partir de la cual se recomienda reemplazo.',
      },
      umbralDesviacionVelocidad: {
        valor: 8,
        etiqueta: 'Umbral de desviacion de velocidad',
        unidad: '%',
        magnitud: null,
        min: 1,
        max: 100,
        origen:
          'Desviacion entre velocidad teorica y medida a partir de la cual se alerta: patinaje excesivo tambien es sintoma mecanico.',
      },
      toleranciaIso: {
        valor: 5,
        etiqueta: 'Tolerancia de caudal ISO',
        unidad: '%',
        magnitud: null,
        min: 1,
        max: 20,
        origen: 'Tolerancia de caudal de la norma ISO 10625 a 3 bar.',
      },
      umbralDiscrepanciaMetodos: {
        valor: 1,
        etiqueta: 'Umbral de discrepancia entre metodos',
        unidad: '%',
        magnitud: null,
        min: 0.1,
        max: 20,
        origen:
          'Propio de la aplicacion: diferencia entre el metodo por boquilla y por barra que amerita advertencia; indica inconsistencia fisica entre espaciamiento, numero de boquillas y ancho.',
      },
      espaciamientoMinimoPlausible: {
        valor: 0.05,
        etiqueta: 'Espaciamiento minimo plausible',
        unidad: 'm',
        magnitud: 'distanciaCorta',
        min: 0.01,
        max: 1,
        origen:
          'Debajo de este valor el espaciamiento parece capturado en centimetros por error (la formula del 600 lo pide en metros).',
      },
      tiempoPruebaCaptura: {
        valor: 60,
        etiqueta: 'Tiempo de prueba de captura',
        unidad: 's',
        magnitud: null,
        min: 5,
        max: 600,
        origen: 'Tiempo tipico de aforo por boquilla en la practica de extension.',
      },
    },
  },
};

// ---------------------------------------------------------------------
// Cotas de las colecciones editables (tractores, equipos, gases,
// rotametros, velocidades por marcha, factores de desviacion).
// validate.js las usa para formularios e importacion por igual.
// ---------------------------------------------------------------------
export const COTAS_TRACTOR = {
  regimenNominal: { min: 500, max: 5000, unidad: 'rpm', etiqueta: 'Regimen nominal' },
  regimenMinimo: { min: 400, max: 5000, unidad: 'rpm', etiqueta: 'Regimen minimo de trabajo' },
  regimenMaximo: { min: 500, max: 5000, unidad: 'rpm', etiqueta: 'Regimen maximo admisible' },
  regimenHabitual: { min: 400, max: 5000, unidad: 'rpm', etiqueta: 'Regimen habitual de trabajo' },
  numRangos: { min: 1, max: 6, entero: true, unidad: '', etiqueta: 'Numero de rangos' },
  marchasPorRango: { min: 1, max: 8, entero: true, unidad: '', etiqueta: 'Marchas por rango' },
};

export const COTAS_VELOCIDAD_MARCHA = {
  kmhNominal: { min: 0.1, max: 60, unidad: 'km/h', etiqueta: 'Velocidad nominal de la marcha' },
};

export const COTAS_EQUIPO = {
  tdfNominal: { min: 300, max: 1200, unidad: 'rpm', etiqueta: 'Regimen de TDF nominal' },
  rpmMotorTdfNominal: {
    min: 500,
    max: 5000,
    unidad: 'rpm',
    etiqueta: 'Regimen del motor para TDF nominal',
  },
  rpmCalibracion: {
    min: 400,
    max: 5000,
    unidad: 'rpm',
    opcional: true,
    etiqueta: 'Regimen del motor en la ultima calibracion',
  },
  presionCalibracion: {
    min: 0.1,
    max: 50,
    unidad: 'bar',
    opcional: true,
    etiqueta: 'Presion de la ultima calibracion',
  },
  volumenTanque: { min: 1, max: 50000, unidad: 'L', etiqueta: 'Volumen del tanque' },
};

export const COTAS_GAS = {
  pesoMolecular: { min: 1, max: 200, unidad: 'g/mol', etiqueta: 'Peso molecular' },
  presionEstandarPsia: {
    min: 5,
    max: 20,
    unidad: 'psia',
    etiqueta: 'Presion estandar de calibracion',
  },
  temperaturaEstandarF: {
    min: 32,
    max: 120,
    unidad: 'F',
    etiqueta: 'Temperatura estandar de calibracion',
  },
  gPorScfManual: {
    min: 1,
    max: 200,
    unidad: 'g/SCF',
    opcional: true,
    etiqueta: 'Masa por pie cubico estandar (anulacion manual)',
  },
};

export const COTAS_ROTAMETRO = {
  escalaMin: { min: 0, max: 100, unidad: 'SCFM', etiqueta: 'Escala minima' },
  escalaMax: { min: 0, max: 100, unidad: 'SCFM', etiqueta: 'Escala maxima' },
  resolucion: { min: 0.01, max: 5, unidad: 'SCFM', etiqueta: 'Resolucion legible' },
};

export const COTAS_FACTOR_DESVIACION = {
  rpm: { min: 400, max: 5000, unidad: 'rpm', etiqueta: 'Regimen de la medicion' },
  velocidadTeorica: { min: 0.1, max: 60, unidad: 'km/h', etiqueta: 'Velocidad teorica' },
  velocidadMedida: { min: 0.1, max: 60, unidad: 'km/h', etiqueta: 'Velocidad medida' },
};

// ---------------------------------------------------------------------
// Tractores de siembra
//
// TODAS las velocidades por marcha son estimaciones no verificadas
// contra el manual de ninguna unidad (origen: 'estimacion'); son semilla
// para que la aplicacion arranque, no especificacion. La interfaz debe
// distinguir estimacion / capturado / calibrado con badges.
//
// El regimen habitual (1800 rpm) es el que se precarga al seleccionar el
// tractor: este rancho opera entre 1500 y 1800 rpm, no en el nominal.
// ---------------------------------------------------------------------
function tablaVelocidades(kmhPorMarcha) {
  // kmhPorMarcha: arreglo por rango de arreglos por marcha, en orden.
  return kmhPorMarcha.flatMap((marchas, indiceRango) =>
    marchas.map((kmh, indiceMarcha) => ({
      rango: indiceRango,
      marcha: indiceMarcha + 1,
      kmhNominal: kmh,
      origen: 'estimacion', // estimacion | capturado | calibrado
      fecha: null,
    }))
  );
}

export const TRACTORES_SIEMBRA = [
  {
    id: 'jd5715',
    nombre: 'John Deere 5715',
    regimenNominal: 2400,
    regimenNominalVerificado: 'pendiente',
    regimenNominalOrigen:
      'Pendiente de confirmar contra el manual de la unidad; no verificado.',
    regimenMinimo: 1400,
    regimenMaximo: 2400,
    regimenHabitual: 1800,
    numRangos: 3,
    marchasPorRango: 3,
    etiquetasRango: ['A', 'B', 'C'],
    velocidades: tablaVelocidades([
      [2.4, 3.9, 5.1],
      [6.8, 10.5, 14.0],
      [18.5, 23.8, 29.8],
    ]),
  },
  {
    id: 'jd6603',
    nombre: 'John Deere 6603',
    regimenNominal: 2100,
    regimenNominalVerificado: true,
    regimenNominalOrigen: 'Prueba de tractores de Nebraska.',
    regimenMinimo: 1400,
    regimenMaximo: 2400,
    regimenHabitual: 1800,
    numRangos: 3,
    marchasPorRango: 3,
    etiquetasRango: ['A', 'B', 'C'],
    velocidades: tablaVelocidades([
      [2.6, 4.1, 5.6],
      [7.2, 11.0, 14.6],
      [19.2, 24.6, 30.6],
    ]),
  },
];

// ---------------------------------------------------------------------
// Equipos de aplicacion de siembra
// ---------------------------------------------------------------------
export const TIPOS_BOMBA = ['positiva', 'centrifuga', 'independiente'];
export const ACCIONAMIENTOS = ['tdf', 'hidraulico', 'motor-propio'];

export const EQUIPOS_SIEMBRA = [
  {
    id: 'barra-principal',
    nombre: 'Barra de aspersion principal',
    tipoBomba: 'positiva',
    accionamiento: 'tdf',
    tdfNominal: 540,
    rpmMotorTdfNominal: 2017,
    rpmMotorTdfNominalOrigen:
      'Dato del JD 6603: la TDF entrega 540 rpm con el motor a 2017 rpm.',
    conRegulador: true,
    rpmCalibracion: null, // por capturar; no se inventa
    presionCalibracion: null, // bar; por capturar
    volumenTanque: 2000,
    volumenTanqueVerificado: 'estimacion',
    boquillaId: null, // referencia al catalogo de boquillas
  },
];

// ---------------------------------------------------------------------
// Gases de siembra
// ---------------------------------------------------------------------
export const GASES_SIEMBRA = [
  {
    id: 'etileno',
    nombre: 'Etileno',
    pesoMolecular: 28.05,
    presionEstandarPsia: 14.7,
    temperaturaEstandarF: 70,
    gPorScfManual: null, // anulacion manual: cuando esta llena gana sobre el derivado
  },
];

// ---------------------------------------------------------------------
// Rotametros de siembra
// La escala solo alimenta advertencias y el dibujo del tubo; nunca
// trunca un calculo.
// ---------------------------------------------------------------------
export const ROTAMETROS_SIEMBRA = [
  {
    id: 'f550',
    modelo: 'Blue-White F-550',
    escalaMin: 0.5,
    escalaMax: 4.5,
    resolucion: 0.1,
  },
];

// ---------------------------------------------------------------------
// Preferencias de interfaz
// ---------------------------------------------------------------------
export const PREFERENCIAS_SIEMBRA = {
  tema: 'oscuro', // claro | oscuro | auto (default oscuro por requisito)
  unidades: 'metrico', // metrico | imperial
};

// Origen valido de una fila de velocidad por marcha.
export const ORIGENES_VELOCIDAD = ['estimacion', 'capturado', 'calibrado'];

// Utilidades de acceso comodo (sin logica de calculo).
export function valorDefault(grupo, campo) {
  return PARAMETROS[grupo].campos[campo].valor;
}

export function defCampo(grupo, campo) {
  return PARAMETROS[grupo].campos[campo];
}
