// Clasificacion de tamano de gota ANSI/ASABE S572, en sus dos ediciones
// vigentes en catalogos: S572.1 (la que todavia usan muchos fabricantes,
// incluido el catalogo TeeJet 51A-M) y S572.3 (feb 2020, alineada con
// ISO 25358:2018).
//
// REGLA DE LA APLICACION: cada ficha del catalogo registra con que
// edicion fue clasificada, y NO se comparan clases entre ediciones
// distintas. Entre S572.1 y S572.3:
//   - Subieron los umbrales C/VC, VC/XC y XC/UC (una boquilla VC, XC o
//     UC bajo S572.1 puede caer un grado mas fino bajo S572.3).
//   - Se INVIRTIERON los colores de Gruesa y Muy gruesa: en S572.1/.2
//     C = azul y VC = verde; en S572.3 (= ISO 25358) C = verde y
//     VC = azul. Fuente: UGA Extension, "Considerations for Sprayer
//     Nozzle Selection" (2025) y ASABE, "Spray Nozzle Classification by
//     Droplet Spectra" (elibrary.asabe.org, id 51101), consultadas
//     2026-07-30.
//
// Los rangos de micras son APROXIMADOS e informativos (los umbrales
// normativos se definen con boquillas de referencia, no con numeros
// fijos):
//   - S572.1: VMD estimado del grafico de referencia del estandar,
//     segun la hoja "ASABE S572.1 Droplet Size Classification"
//     distribuida por TeeJet (cdn2.hubspot.net, consultada 2026-07-30).
//   - S572.3: Dv0.5 estimado por Proulx del grafico de referencia del
//     estandar, en NDSU Extension AE1246 (rev. octubre 2024), Tabla 1
//     (consultada 2026-07-30).

export const EDICIONES_S572 = ['S572.1', 'S572.3'];

export const CLASES_S572_1 = {
  edicion: 'S572.1',
  nota: 'Colores: C azul y VC verde. Muchos catalogos de fabricante siguen publicando con esta edición.',
  categorias: [
    { simbolo: 'XF', nombre: 'Extremadamente fina', color: 'morado', vmdMinUm: null, vmdMaxUm: 60 },
    { simbolo: 'VF', nombre: 'Muy fina', color: 'rojo', vmdMinUm: 61, vmdMaxUm: 105 },
    { simbolo: 'F', nombre: 'Fina', color: 'naranja', vmdMinUm: 106, vmdMaxUm: 235 },
    { simbolo: 'M', nombre: 'Media', color: 'amarillo', vmdMinUm: 236, vmdMaxUm: 340 },
    { simbolo: 'C', nombre: 'Gruesa', color: 'azul', vmdMinUm: 341, vmdMaxUm: 403 },
    { simbolo: 'VC', nombre: 'Muy gruesa', color: 'verde', vmdMinUm: 404, vmdMaxUm: 502 },
    { simbolo: 'XC', nombre: 'Extremadamente gruesa', color: 'blanco', vmdMinUm: 503, vmdMaxUm: 665 },
    { simbolo: 'UC', nombre: 'Ultra gruesa', color: 'negro', vmdMinUm: 666, vmdMaxUm: null },
  ],
};

export const CLASES_S572_3 = {
  edicion: 'S572.3',
  nota:
    'Alineada con ISO 25358:2018. Colores de C y VC invertidos respecto a S572.1: C verde y ' +
    'VC azul. Los umbrales de las clases gruesas subieron respecto a S572.1.',
  categorias: [
    { simbolo: 'XF', nombre: 'Extremadamente fina', color: 'morado', dv05MinUm: null, dv05MaxUm: 99 },
    { simbolo: 'VF', nombre: 'Muy fina', color: 'rojo', dv05MinUm: 100, dv05MaxUm: 149 },
    { simbolo: 'F', nombre: 'Fina', color: 'naranja', dv05MinUm: 150, dv05MaxUm: 194 },
    { simbolo: 'M', nombre: 'Media', color: 'amarillo', dv05MinUm: 195, dv05MaxUm: 269 },
    { simbolo: 'C', nombre: 'Gruesa', color: 'verde', dv05MinUm: 270, dv05MaxUm: 349 },
    { simbolo: 'VC', nombre: 'Muy gruesa', color: 'azul', dv05MinUm: 350, dv05MaxUm: 484 },
    { simbolo: 'XC', nombre: 'Extremadamente gruesa', color: 'blanco', dv05MinUm: 485, dv05MaxUm: 664 },
    { simbolo: 'UC', nombre: 'Ultra gruesa', color: 'negro', dv05MinUm: 665, dv05MaxUm: null },
  ],
};

export const CLASES_POR_EDICION = {
  'S572.1': CLASES_S572_1,
  'S572.3': CLASES_S572_3,
};

// Orden creciente de tamano, comun a ambas ediciones.
export const ORDEN_CLASES = ['XF', 'VF', 'F', 'M', 'C', 'VC', 'XC', 'UC'];

// Guia operativa (informativa, nunca recomendacion automatica): gota
// fina mejora cobertura pero aumenta la deriva; gota gruesa reduce
// deriva pero puede comprometer la cobertura en aplicaciones de
// contacto. La decision depende del producto y de las condiciones del
// dia, que la aplicacion no conoce.
export const GUIA_USO_GOTA = {
  F: 'Mejor cobertura y retención; mayor riesgo de deriva.',
  M: 'El punto medio más usado cuando la etiqueta no especifica.',
  C: 'Menos deriva; típica para sistémicos.',
  VC: 'Poca deriva; puede comprometer cobertura de contacto.',
};
