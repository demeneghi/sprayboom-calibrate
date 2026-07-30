// Conversiones de unidades y constantes fisicas, todas nombradas.
// Unica ubicacion permitida para literales numericos de conversion del
// dominio. Regla del proyecto: ningun numero de dominio se escribe
// literal dentro de una funcion de calculo; los valores de siembra viven
// en defaults.js y en data/, y llegan a las funciones por argumento.

// ---------------------------------------------------------------------
// Tiempo
// ---------------------------------------------------------------------
export const SEG_POR_MIN = 60;
export const MIN_POR_HORA = 60;
export const SEG_POR_HORA = 3600;

// ---------------------------------------------------------------------
// Longitud y superficie (base metrica)
// ---------------------------------------------------------------------
export const M2_POR_HA = 10000;
export const CM_POR_M = 100;
export const M_POR_KM = 1000;

// Dividir km/h entre esta constante da m/s (3600 s/h entre 1000 m/km).
export const KMH_A_MS = 3.6;

// ---------------------------------------------------------------------
// Factor de gasto de agua, metrico
// L/ha = caudal_Lmin * FACTOR_LHA / (velocidad_kmh * espaciamiento_m)
// Sale de la conversion entre L/min, km/h, metros y hectareas:
// 10000 m2/ha * 60 min/h / 1000 m/km = 600.
// Con esta constante el espaciamiento va en METROS. Varias calculadoras
// en linea publican la formula con espaciamiento en centimetros
// manteniendo el 600, lo cual es un error de dos ordenes de magnitud.
// ---------------------------------------------------------------------
export const FACTOR_LHA = 600;

// ---------------------------------------------------------------------
// Factor de gasto de agua, imperial
// GPA = GPM * FACTOR_GPA / (mph * espaciamiento_pulgadas)
// Constante estandar de la industria; su consistencia dimensional con
// FACTOR_LHA se verifica en tests/constants.test.js. La interfaz nunca
// la usa como segunda implementacion: el calculo interno es metrico y
// se convierte en la frontera.
// ---------------------------------------------------------------------
export const FACTOR_GPA = 5940;

// ---------------------------------------------------------------------
// Conversion metrico-imperial
// ---------------------------------------------------------------------
export const L_POR_GALON_US = 3.785411784;
export const PSI_POR_BAR = 14.5037738;
export const KPA_POR_BAR = 100;
export const KM_POR_MILLA = 1.609344;
export const M_POR_PIE = 0.3048;
export const PULGADAS_POR_PIE = 12;
export const M_POR_PULGADA = 0.0254; // 0.3048 m/pie entre 12 pulgadas/pie
export const HA_POR_ACRE = 0.4046856;
export const G_POR_LIBRA = 453.59237;
export const OZ_POR_LIBRA = 16;
export const ML_POR_ONZA_FLUIDA = 29.5735295625; // onza fluida US

// ---------------------------------------------------------------------
// Escalas metricas internas
// ---------------------------------------------------------------------
export const G_POR_KG = 1000;
export const ML_POR_L = 1000;
export const L_POR_M3 = 1000;

// ---------------------------------------------------------------------
// Gas ideal en unidades imperiales
// R_GAS trabaja en LIBRAS-mol, no en moles: omitir LBMOL_A_MOL deja el
// resultado tres ordenes de magnitud abajo.
// ---------------------------------------------------------------------
export const R_GAS = 10.7316; // psi*ft3 / (lbmol * grado Rankine)
export const OFFSET_RANKINE = 459.67; // grados F a grados Rankine
export const LBMOL_A_MOL = 453.592; // mol por lbmol

// ---------------------------------------------------------------------
// Porcentaje
// ---------------------------------------------------------------------
export const PORCIENTO = 100;

// Base de la dosis expresada "por cada 100 L de caldo" que usan algunas
// etiquetas de producto.
export const BASE_DOSIS_100L = 100;

// =====================================================================
// Grupo SI para la ruta redundante de calculo (domain/verify.js).
//
// Deliberadamente duplicado: la segunda ruta de calculo no comparte
// constantes con la canonica, de modo que un error de dedo en cualquiera
// de los dos grupos hace que las rutas discrepen y el error se detecte
// en vez de propagarse en silencio. La consistencia entre ambos grupos
// se verifica en tests/constants.test.js.
// =====================================================================
export const SI_SEG_POR_MIN = 60;
export const SI_SEG_POR_HORA = 3600;
export const SI_M_POR_KM = 1000;
export const SI_M2_POR_HA = 10000;
export const SI_L_POR_M3 = 1000;
export const SI_ML_POR_L = 1000;
export const SI_PA_POR_PSI = 6894.757293168; // pascal por psi
export const SI_M3_POR_FT3 = 0.028316846592; // (0.3048 m/pie) al cubo
export const SI_R_UNIVERSAL = 8.314462618; // Pa*m3 / (mol*K), valor SI 2019
export const SI_K_OFFSET_CELSIUS = 273.15;
export const SI_F_A_C_RESTA = 32; // grados F que se restan antes de escalar a C
export const SI_F_A_C_FACTOR = 5 / 9; // factor de escala de grados F a C
