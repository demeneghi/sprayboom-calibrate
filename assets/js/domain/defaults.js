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
  // Geometria de la TABLA (el terreno), no de la barra: el ancho, el
  // numero de boquillas y el espaciamiento viven en cada barra
  // (COTAS_BARRA), porque dos barras distintas tienen anchos distintos y
  // con estos tres campos globales la segunda barra calculaba con los
  // numeros de la primera.
  geometria: {
    etiqueta: 'Geometría de la tabla',
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
      distanciaReferencia: {
        valor: 100,
        etiqueta: 'Distancia de referencia del reporte',
        unidad: 'm',
        magnitud: 'distancia',
        min: 1,
        max: 1000,
        origen: 'Tramo sobre el que el personal reporta segundos en campo.',
      },
    },
  },

  caldo: {
    etiqueta: 'Caldo de aplicación',
    campos: {
      densidadRelativa: {
        valor: 1.0,
        etiqueta: 'Densidad relativa del caldo',
        unidad: '',
        magnitud: null,
        min: 0.8,
        max: 2.0,
        origen:
          'Agua = 1.0. Un caldo más denso sale más despacio por la misma boquilla a la misma presión: q_caldo = q_agua / raiz(densidad relativa).',
      },
    },
  },

  // La presion atmosferica del sitio ya NO se captura a mano: se deriva
  // de la altitud con la atmosfera estandar (domain/atmosphere.js), que
  // es el dato que quien calibra si conoce —y que el GPS del telefono
  // puede rellenar. El campo de presion se queda como anulacion manual,
  // igual que gPorScfManual en los gases: vacio significa derivada.
  sitio: {
    etiqueta: 'Sitio',
    campos: {
      altitudM: {
        valor: 0,
        etiqueta: 'Altitud del sitio',
        unidad: 'm',
        magnitud: 'distancia',
        // Las cotas cubren desde una depresion continental hasta la
        // agricultura mas alta del mundo, y son las que fijan el rango
        // util de la anulacion manual de aqui abajo.
        min: -500,
        max: 5000,
        origen:
          'Metros sobre el nivel del mar del lote. De aquí sale la presión atmosférica que corrige el rotámetro: la presión baja 1 psi cada 574 m, así que un valor aproximado ya es mucho mejor que suponer el nivel del mar. Se puede rellenar con el GPS del teléfono.',
      },
      presionAtmosfericaLocal: {
        valor: null,
        etiqueta: 'Presión atmosférica local (anulación manual)',
        unidad: 'psia',
        magnitud: null,
        min: 7.5,
        max: 16,
        opcional: true,
        origen:
          'Vacío significa derivada de la altitud, que es lo normal. Captúrala solo si tienes una lectura barométrica del día para este lote: entonces gana sobre la derivada. El despeje de presión resta esta atmosférica LOCAL, no la estándar de calibración del rotámetro.',
      },
    },
  },

  manometro: {
    etiqueta: 'Manómetro del rotámetro',
    campos: {
      escalaMaxPsi: {
        valor: 60,
        etiqueta: 'Fondo de escala del manómetro',
        unidad: 'psi',
        magnitud: null,
        min: 5,
        max: 600,
        origen:
          'La carátula del manómetro a la entrada del tubo, de 0 a este valor. Solo dibuja el instrumento y avisa cuando la presión sale de escala: nunca recorta un cálculo.',
      },
      resolucionPsi: {
        valor: 1,
        etiqueta: 'Resolución legible del manómetro',
        unidad: 'psi',
        magnitud: null,
        min: 0.1,
        max: 25,
        origen:
          'La raya más fina de la carátula. Es también el escalón de los botones más y menos con los que se captura la presión en campo.',
      },
    },
  },

  agronomicos: {
    etiqueta: 'Parámetros agronómicos de forzamiento',
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
          'Decision del rancho tras calibrar por pesaje del cilindro. El pesaje tiene prioridad sobre cualquier cálculo teórico.',
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
          'Desviación respecto a la dosis objetivo a partir de la cual el forzamiento levanta alerta.',
      },
    },
  },

  umbrales: {
    etiqueta: 'Umbrales y tolerancias',
    campos: {
      umbralAtipicas: {
        valor: 10,
        etiqueta: 'Umbral de boquilla atípica',
        unidad: '%',
        magnitud: null,
        min: 1,
        max: 50,
        origen:
          'Criterio de la literatura de extensión: desviación respecto a la media de la barra a partir de la cual se recomienda reemplazo.',
      },
      umbralDesviacionVelocidad: {
        valor: 8,
        etiqueta: 'Umbral de desviación de velocidad',
        unidad: '%',
        magnitud: null,
        min: 1,
        max: 100,
        origen:
          'Desviación entre velocidad teórica y medida a partir de la cual se alerta: patinaje excesivo también es síntoma mecanico.',
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
        etiqueta: 'Umbral de discrepancia entre métodos',
        unidad: '%',
        magnitud: null,
        min: 0.1,
        max: 20,
        origen:
          'Propio de la aplicación: diferencia entre el método por boquilla y por barra que amerita advertencia; indica inconsistencia física entre espaciamiento, número de boquillas y ancho.',
      },
      espaciamientoMinimoPlausible: {
        valor: 0.05,
        etiqueta: 'Espaciamiento mínimo plausible',
        unidad: 'm',
        magnitud: 'distanciaCorta',
        min: 0.01,
        max: 1,
        origen:
          'Debajo de este valor el espaciamiento parece capturado en centimetros por error (la fórmula del 600 lo pide en metros).',
      },
      tiempoPruebaCaptura: {
        valor: 60,
        etiqueta: 'Tiempo de prueba de captura',
        unidad: 's',
        magnitud: null,
        min: 5,
        max: 600,
        origen: 'Tiempo típico de aforo por boquilla en la práctica de extensión.',
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
  regimenNominal: { min: 500, max: 5000, unidad: 'rpm', magnitud: null, etiqueta: 'Régimen nominal' },
  regimenMinimo: { min: 400, max: 5000, unidad: 'rpm', magnitud: null, etiqueta: 'Régimen mínimo de trabajo' },
  regimenMaximo: { min: 500, max: 5000, unidad: 'rpm', magnitud: null, etiqueta: 'Régimen máximo admisible' },
  regimenHabitual: { min: 400, max: 5000, unidad: 'rpm', magnitud: null, etiqueta: 'Régimen habitual de trabajo' },
  numRangos: { min: 1, max: 6, entero: true, unidad: '', magnitud: null, etiqueta: 'Número de rangos' },
  marchasPorRango: { min: 1, max: 8, entero: true, unidad: '', magnitud: null, etiqueta: 'Marchas por rango' },
};

export const COTAS_VELOCIDAD_MARCHA = {
  kmhNominal: { min: 0.1, max: 60, unidad: 'km/h', magnitud: 'velocidad', etiqueta: 'Velocidad nominal de la marcha' },
};

// Geometria PROPIA de cada barra de aplicacion. Va aparte de
// COTAS_EQUIPO —aunque COTAS_EQUIPO la incluya— para que la pantalla de
// Configuración pinte estos tres campos juntos, arriba y con sus valores
// derivados, en vez de perderlos entre los datos de la bomba.
export const COTAS_BARRA = {
  anchoBarra: {
    min: 0.5,
    max: 100,
    unidad: 'm',
    magnitud: 'distancia',
    etiqueta: 'Ancho de barra de aplicación',
    ayuda: 'Ancho efectivo de esta barra de aspersión. Cada barra tiene el suyo: es lo que divide al volumen por hectárea.',
  },
  numBoquillas: {
    min: 1,
    max: 200,
    unidad: '',
    magnitud: null,
    entero: true,
    etiqueta: 'Número de boquillas instaladas',
    ayuda: 'Cuéntalas en la barra antes de darlo por bueno; el valor de siembra es una estimación.',
  },
  espaciamientoCapturado: {
    min: 0.01,
    max: 10,
    unidad: 'm',
    magnitud: 'distanciaCorta',
    opcional: true,
    etiqueta: 'Espaciamiento entre boquillas (capturado)',
    ayuda:
      'Opcional: vacío significa derivado del ancho entre el número de boquillas. Captúralo solo si las boquillas de esta barra no están repartidas por igual. Si difiere del derivado, la aplicación lo advierte en vez de elegir uno en silencio.',
  },
};

export const COTAS_EQUIPO = {
  ...COTAS_BARRA,
  tdfNominal: { min: 300, max: 1200, unidad: 'rpm', magnitud: null, etiqueta: 'Régimen de TDF nominal' },
  rpmMotorTdfNominal: {
    min: 500,
    max: 5000,
    unidad: 'rpm',
    magnitud: null,
    etiqueta: 'Régimen del motor para TDF nominal',
  },
  rpmCalibracion: {
    min: 400,
    max: 5000,
    unidad: 'rpm',
    magnitud: null,
    opcional: true,
    etiqueta: 'Régimen del motor en la última calibración',
  },
  presionCalibracion: {
    min: 0.1,
    max: 50,
    unidad: 'bar',
    magnitud: 'presion',
    opcional: true,
    etiqueta: 'Presión de la última calibración',
  },
  volumenTanque: { min: 1, max: 50000, unidad: 'L', magnitud: 'volumen', etiqueta: 'Volumen del tanque' },
};

export const COTAS_GAS = {
  pesoMolecular: { min: 1, max: 200, unidad: 'g/mol', magnitud: null, etiqueta: 'Peso molecular' },
  presionEstandarPsia: {
    min: 5,
    max: 20,
    unidad: 'psia',
    magnitud: null,
    etiqueta: 'Presión estándar de calibración',
  },
  temperaturaEstandarF: {
    min: 32,
    max: 120,
    unidad: 'F',
    magnitud: null,
    etiqueta: 'Temperatura estándar de calibración',
  },
  gPorScfManual: {
    min: 1,
    max: 200,
    unidad: 'g/SCF',
    magnitud: null,
    opcional: true,
    etiqueta: 'Masa por pie cúbico estándar (anulación manual)',
  },
};

// Cotas de las fichas del catalogo de boquillas. Las comparten el
// formulario de captura y la importacion JSON: mismo criterio y mismo
// mensaje en ambos caminos.
export const COTAS_BOQUILLA = {
  caudalRefLmin: { min: 0.01, max: 200, unidad: 'L/min', magnitud: 'caudal', etiqueta: 'Caudal de referencia' },
  presionRefBar: { min: 0.1, max: 50, unidad: 'bar', magnitud: 'presion', etiqueta: 'Presión de referencia' },
  presionMinBar: { min: 0.1, max: 50, unidad: 'bar', magnitud: 'presion', etiqueta: 'Presión mínima de operación' },
  presionMaxBar: { min: 0.1, max: 50, unidad: 'bar', magnitud: 'presion', etiqueta: 'Presión máxima de operación' },
  exponente: { min: 0.2, max: 0.8, unidad: '', magnitud: null, etiqueta: 'Exponente presión-caudal' },
  anguloGrados: { min: 10, max: 180, unidad: 'grados', magnitud: null, etiqueta: 'Ángulo de aspersión' },
};

// Semilla del formulario "agregar boquilla": los valores de arranque de
// una ficha nueva viven aqui (todo es parametro; la UI no incrusta
// numeros de dominio). 3 bar es el estandar ISO de referencia; el rango
// 1-4 bar y el exponente 0.5 son los tipicos de abanico convencional.
export const BOQUILLA_NUEVA = {
  tipoPatron: 'abanico-plano',
  anguloGrados: 110,
  presionRefBar: 3,
  presionMinBar: 1,
  presionMaxBar: 4,
  exponente: 0.5,
  material: 'polimero',
};

export const COTAS_ROTAMETRO = {
  escalaMin: { min: 0, max: 100, unidad: 'SCFM', magnitud: null, etiqueta: 'Escala mínima' },
  escalaMax: { min: 0, max: 100, unidad: 'SCFM', magnitud: null, etiqueta: 'Escala máxima' },
  resolucion: { min: 0.01, max: 5, unidad: 'SCFM', magnitud: null, etiqueta: 'Resolución legible' },
};

export const COTAS_FACTOR_DESVIACION = {
  rpm: { min: 400, max: 5000, unidad: 'rpm', magnitud: null, etiqueta: 'Régimen de la medición' },
  velocidadTeorica: { min: 0.1, max: 60, unidad: 'km/h', magnitud: 'velocidad', etiqueta: 'Velocidad teórica' },
  velocidadMedida: { min: 0.1, max: 60, unidad: 'km/h', magnitud: 'velocidad', etiqueta: 'Velocidad medida' },
};

// ---------------------------------------------------------------------
// Tractores de siembra
//
// Las velocidades por marcha son las TABLAS DEL FABRICANTE (origen:
// 'capturado'), no estimaciones. Cada tabla vale para el regimen nominal
// y el neumatico trasero anotados en su tractor: la velocidad escala con
// la circunferencia de rodadura, asi que un rodado distinto obliga a
// reescalar la tabla por el cociente de circunferencias.
//
// Siguen siendo velocidades TEORICAS: la tabla se calcula con la rueda
// girando sin resbalar. El patinaje NO esta aqui y se corrige aparte con
// los factores medidos en campo (factorDesviacion en speed.js).
//
// La interfaz distingue estimacion / capturado / calibrado con badges;
// 'calibrado' sigue mandando sobre 'capturado' porque sale de una
// medicion de esta unidad.
//
// El regimen habitual (1800 rpm) es el que se precarga al seleccionar el
// tractor: este rancho opera entre 1500 y 1800 rpm, no en el nominal.
// ---------------------------------------------------------------------
function tablaVelocidades(kmhPorMarcha, origen = 'estimacion') {
  // kmhPorMarcha: arreglo por rango de arreglos por marcha, en orden.
  return kmhPorMarcha.flatMap((marchas, indiceRango) =>
    marchas.map((kmh, indiceMarcha) => ({
      rango: indiceRango,
      marcha: indiceMarcha + 1,
      kmhNominal: kmh,
      origen, // estimacion | capturado | calibrado
      fecha: null,
    }))
  );
}

export const TRACTORES_SIEMBRA = [
  {
    id: 'jd5715',
    nombre: 'John Deere 5715',
    regimenNominal: 2400,
    regimenNominalVerificado: true,
    regimenNominalOrigen:
      'Ficha de motor del fabricante publicada por TractorData (2400 rpm nominales); ' +
      'concuerda con el encabezado de la tabla de velocidades del mismo modelo.',
    regimenMinimo: 1400,
    regimenMaximo: 2400,
    regimenHabitual: 1800,
    numRangos: 3,
    marchasPorRango: 3,
    etiquetasRango: ['A', 'B', 'C'],
    // Tabla del fabricante a 2400 rpm con neumatico trasero 16.9-30
    // (transmision Top Shaft Synchronized, 9 adelante y 3 atras).
    // Reversa declarada por el fabricante: AR 3.5, BR 8.4, CR 23.0 km/h.
    velocidades: tablaVelocidades(
      [
        [2.1, 3.1, 4.5],
        [5.0, 7.2, 10.8],
        [13.7, 19.8, 29.8],
      ],
      'capturado'
    ),
  },
  {
    id: 'jd6603',
    nombre: 'John Deere 6603',
    regimenNominal: 2100,
    regimenNominalVerificado: true,
    regimenNominalOrigen:
      'Prueba de tractores de Nebraska (informe 1809, enero de 2002, ' +
      'John Deere 6603 Diesel de 9 marchas); 2100 rpm nominales.',
    regimenMinimo: 1400,
    regimenMaximo: 2400,
    regimenHabitual: 1800,
    numRangos: 3,
    marchasPorRango: 3,
    etiquetasRango: ['A', 'B', 'C'],
    // Tabla del fabricante a 2100 rpm con neumatico trasero 18.4-38
    // (transmision Top Shaft Synchronized, 9 adelante y 3 atras).
    // Reversa declarada por el fabricante: AR 5.0, BR 11.3, CR 29.3 km/h.
    velocidades: tablaVelocidades(
      [
        [3.1, 4.3, 5.3],
        [6.6, 9.0, 11.3],
        [18.3, 25.1, 31.2],
      ],
      'capturado'
    ),
  },
];

// ---------------------------------------------------------------------
// Barras de aplicacion de siembra
//
// En el codigo la coleccion se sigue llamando `equipos` (es la clave del
// estado guardado y de los archivos exportados; renombrarla romperia los
// respaldos de los telefonos). En pantalla se llama BARRA, que es la
// palabra que usa quien calibra.
// ---------------------------------------------------------------------
export const TIPOS_BOMBA = ['positiva', 'centrifuga', 'independiente'];
export const ACCIONAMIENTOS = ['tdf', 'hidraulico', 'motor-propio'];

export const EQUIPOS_SIEMBRA = [
  {
    id: 'barra-principal',
    nombre: 'Barra de aspersión principal',
    anchoBarra: 15.47,
    numBoquillas: 24,
    numBoquillasVerificado: 'estimacion', // contarlas en la barra antes de confiar
    espaciamientoCapturado: null, // vacio: se deriva del ancho entre boquillas
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
