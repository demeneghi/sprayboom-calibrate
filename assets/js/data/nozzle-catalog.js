// Catalogo de boquillas de siembra. COMPLETAMENTE EDITABLE por el
// usuario; estas entradas son la semilla inicial y todas provienen de
// tablas publicadas por el fabricante. NO hay numeros inventados.
//
// Fuentes (TeeJet y Albuz consultadas 2026-07-30; Lechler, Hypro y
// Magnojet consultadas 2026-08-01):
//
// [TJ] TeeJet Technologies, Catalog 51A-M (metrico),
//      https://www.teejet.com/-/media/dam/agricultural/usa/sales-material/catalog/cat51a_metric.pdf
//      Caudales en L/min por presion en bar y clase de gota por presion
//      tomados de las tablas de cada serie (paginas 7-15 y 40-41 del
//      PDF; la FullJet en la 30 y las StreamJet en la 49 y la 50). Las
//      clases de gota del catalogo TeeJet estan clasificadas conforme a
//      ASABE S572.1. Para las series de dos angulos se tomo la columna
//      del angulo indicado en cada ficha. El angulo del cono de la
//      FullJet sale de la tabla de alturas de la pagina 140, que lo
//      declara en 120 grados.
//
// [LE] Lechler, Agricultural Spray Nozzles and Accessories, catalogo
//      2025 (edicion en ingles),
//      https://www.lechler.com/fileadmin/media/kataloge/pdfs/agrar/EN/lechler_agriculture_catalogue_2025_en.pdf
//      Serie ID (pagina 51) y serie IDK (pagina 53). La tabla de la
//      serie IDK comparte renglon entre IDK e IDKN en los tamanos 03 y
//      04, con dos columnas de clase rotuladas "IDKN IDK": aqui se toma
//      la SEGUNDA columna (IDK), que es la que continua la progresion
//      de la serie IDK y la mas fina de las dos, coherente con que
//      Lechler declare el 90 % de reduccion de deriva para IDKN 03-04 y
//      solo para IDK 05-06. La misma tabla, con el mismo rotulo, esta
//      en la ficha suelta de la serie:
//      https://www.lechler.com/fileadmin/media/datenblaetter/agrar/EN/lechler_agrar_datenblatt_idk-idkn_en.pdf
//
// [HY] Pentair Hypro, Hypro Nozzles Crop Spraying Guide (guia del
//      fabricante, consultada en el sitio de un distribuidor),
//      https://cropservices.co.uk/wp-content/uploads/2025/03/Pentair-Hypro-Crop-Spraying-Guide.pdf
//      Tablas GuardianAIR 110 grados (pagina 8) y ULD 120 grados
//      (pagina 10). La guia NO publica clase de gota por presion: solo
//      la categoria AHDB a 3 bar y la calificacion LERAP de deriva, que
//      no son clases de un estandar de tamano de gota. Por eso esas
//      fichas van con clasesGota vacia.
//
// [MJ] Magnojet, catalogo general 2019/2020 (trilingue),
//      https://magnojet.co.za/wp-content/uploads/2023/12/MagnoJet-Catalogue-Downloadable.pdf
//      Tablas de las series ST (pagina 16), ST-IA (18), AD (20),
//      AD-IA (24) y MUG (12). El catalogo es un PDF de imagenes, sin
//      texto: las tablas se leyeron pagina por pagina y cada renglon se
//      comprobo contra su propia columna de l/ha, que el catalogo
//      calcula como q x 600 / (v x f) con v = 4 km/h y f = 0,5 m.
//
// [AL] Albuz (CoorsTek), ficha ATR 80 cono hueco, catalogo 2024,
//      https://albuz-spray.com/en/pdf/arbo-viticulture-NON-ISO-ATR-80.pdf
//      Tabla de caudal 5-25 bar; angulo 80 grados a 5 bar; presion
//      recomendada 10 bar; codigo de color europeo NO ISO. La ficha
//      describe la gota como fina pero no publica clase por presion,
//      asi que clasesGota queda vacia y la clase no participa en el
//      filtrado de esas boquillas.
//
// Los rangos de clasesGota se construyeron a partir de los puntos
// muestreados por presion del catalogo: la frontera entre dos clases se
// coloca en el punto medio entre la ultima presion con una clase y la
// primera con la siguiente. Es una interpolacion documentada del dato
// discreto del fabricante, no un dato nuevo.
//
// EDICION DEL ESTANDAR EN LAS FICHAS MAGNOJET: el catalogo publica la
// clase "según BCPC (British Crop Protection Council)" con simbolos en
// portugues. Se registran como S572.1 porque es la misma escala de ocho
// clases y los mismos colores: el propio catalogo de TeeJet dice que sus
// clasificaciones "are based on BCPC specifications and in accordance
// with ASABE Standard S572.1", asi que las fichas TeeJet ya sembradas
// vienen de esa misma equivalencia. Traduccion de simbolos:
// MF (muito fina) = VF, F = F, M = M, G (grossa) = C, MG (muito grossa)
// = VC, EG (extremamente grossa) = XC, UG (ultra grossa) = UC.
//
// EDICION DEL ESTANDAR EN LAS FICHAS LECHLER: el catalogo 2025 publica
// la clase "según ISO 25358". Aqui se registran como S572.3 porque esa
// edicion de ASABE esta alineada con ISO 25358:2018 (ver el encabezado
// de droplet-classes.js): son la misma escala, no dos escalas que haya
// que comparar. El simbolo EC de Lechler ("Extremely coarse") es el XC
// de la aplicacion; UC es UC.
//
// El exponente presion-caudal es 0.5 en las series TeeJet, Lechler e
// Hypro (sus tablas siguen la raiz cuadrada: ln(q2/q1)/ln(p2/p1) da
// 0.49-0.51 en los extremos de cada tabla, y la diferencia es el
// redondeo a dos decimales del propio catalogo). En ATR 80 se ajusto a
// la propia tabla del fabricante entre 5 y 20 bar, de ahi los valores
// 0.47-0.49. En Magnojet se ajusto ficha por ficha por minimos cuadrados
// sobre TODOS los puntos publicados de esa boquilla (ln q contra ln p),
// con la curva obligada a pasar por su renglon de referencia: sus tablas
// se apartan de la raiz cuadrada lo suficiente como para que un 0.5
// forzado no las reprodujera, y el ajuste tiene que medirse contra la
// curva que la aplicacion usa de verdad, que es la que sale del par
// (presionRefBar, caudalRefLmin).
//
// Presion de referencia: 3 bar donde el fabricante la tabula. Magnojet
// tabula en libras por pulgada cuadrada redondeadas a bar y no tiene
// renglon de 3 bar, asi que cada ficha usa el renglon publicado mas
// cercano a 3 (3.1 bar = 45 lbf/pol2, o 3.4 bar = 50, o 2.7 = 40) y el
// caudal que le corresponde, sin interpolar nada.
//
// ANGULOS: una boquilla de 80 grados NO es la de 110 con otro nombre.
// Manda la altura de barra y el traslape, y a la misma presion da una
// gota mas gruesa —el catalogo TeeJet publica una columna de clase por
// angulo—. Por eso cada angulo tiene su propia ficha, con el mismo
// caudal (el orificio no sabe de angulo) y su clase.
//
// Quedan fuera los angulos de las series que no estan sembradas de por
// si (TP, DG y XRC en 80 grados), y los 90 grados de Lechler y los 140
// de la ST-IA de Magnojet, que son el mismo caso pero de otro angulo:
// se pueden sembrar igual el dia que hagan falta.
//
// Pendiente declarado (no sembrado por falta de fuente verificable
// durante la construccion): ARAG. El usuario puede capturarlo en el
// editor del catalogo citando su ficha tecnica.

function tj(id, serie, modelo, tamanoIso, angulo, tipoPatron, material, caudal3bar, presionMin, presionMax, clasesGota, notas = '') {
  return {
    id,
    fabricante: 'TeeJet',
    serie,
    modelo,
    tipoPatron,
    anguloGrados: angulo,
    tamanoIso,
    caudalRefLmin: caudal3bar,
    presionRefBar: 3,
    presionMinBar: presionMin,
    presionMaxBar: presionMax,
    exponente: 0.5,
    material,
    edicionEstandar: 'S572.1',
    clasesGota,
    notas,
    fuente: 'TeeJet Catalog 51A-M (métrico), tabla de la serie; clase de gota ASABE S572.1.',
  };
}

function rangos(...tramos) {
  // tramos: [presionMin, presionMax, clase]
  return tramos.map(([presionMinBar, presionMaxBar, clase]) => ({ presionMinBar, presionMaxBar, clase }));
}

export const CATALOGO_SIEMBRA = [
  // ----- XR TeeJet 110 (abanico plano rango extendido, 1-4 bar) -----
  tj('xr11001', 'XR', 'XR11001', '01', 110, 'abanico-plano', 'inox/polimero', 0.39, 1, 4,
    rangos([1, 3.5, 'F'], [3.5, 4, 'VF'])),
  tj('xr110015', 'XR', 'XR110015', '015', 110, 'abanico-plano', 'inox/polimero', 0.59, 1, 4,
    rangos([1, 4, 'F'])),
  tj('xr11002', 'XR', 'XR11002', '02', 110, 'abanico-plano', 'inox/polimero', 0.79, 1, 4,
    rangos([1, 1.25, 'M'], [1.25, 4, 'F'])),
  tj('xr110025', 'XR', 'XR110025', '025', 110, 'abanico-plano', 'inox/polimero', 0.99, 1, 4,
    rangos([1, 1.25, 'M'], [1.25, 4, 'F'])),
  tj('xr11003', 'XR', 'XR11003', '03', 110, 'abanico-plano', 'inox/polimero', 1.18, 1, 4,
    rangos([1, 1.75, 'M'], [1.75, 4, 'F'])),
  tj('xr11004', 'XR', 'XR11004', '04', 110, 'abanico-plano', 'inox/polimero', 1.58, 1, 4,
    rangos([1, 2.75, 'M'], [2.75, 4, 'F'])),
  tj('xr11005', 'XR', 'XR11005', '05', 110, 'abanico-plano', 'inox/polimero', 1.97, 1, 4,
    rangos([1, 3.5, 'M'], [3.5, 4, 'F'])),
  tj('xr11006', 'XR', 'XR11006', '06', 110, 'abanico-plano', 'inox/polimero', 2.37, 1, 4,
    rangos([1, 1.25, 'C'], [1.25, 3.5, 'M'], [3.5, 4, 'F'])),
  tj('xr11008', 'XR', 'XR11008', '08', 110, 'abanico-plano', 'inox/polimero', 3.16, 1, 4,
    rangos([1, 2.25, 'C'], [2.25, 4, 'M'])),
  // Los tamanos 10 y 15 llevan cruz en el catalogo: solo existen en
  // acero inoxidable, no en la version de polimero del resto de la serie.
  tj('xr11010', 'XR', 'XR11010', '10', 110, 'abanico-plano', 'inox', 3.95, 1, 4,
    rangos([1, 1.25, 'VC'], [1.25, 2.75, 'C'], [2.75, 4, 'M']),
    'Solo en acero inoxidable.'),
  tj('xr11015', 'XR', 'XR11015', '15', 110, 'abanico-plano', 'inox', 5.92, 1, 4,
    rangos([1, 2.25, 'VC'], [2.25, 4, 'C']),
    'Solo en acero inoxidable. Es el tamaño más grande de la serie XR.'),

  // ----- XR TeeJet 80 (el mismo caudal, otro angulo y otra gota) -----
  // El angulo NO es cosmetico: manda la altura de barra y el traslape, y
  // cambia la clase de gota a la misma presion. El catalogo publica una
  // columna por angulo y aqui va la de 80 grados; el caudal, que solo
  // depende del orificio, es el mismo de la ficha de 110.
  //
  // Toda la serie en 80 grados es de acero inoxidable o ceramica: la
  // version de polimero del catalogo es de 110 grados nada mas.
  tj('xr8001', 'XR', 'XR8001', '01', 80, 'abanico-plano', 'inox', 0.39, 1, 4,
    rangos([1, 4, 'F'])),
  tj('xr80015', 'XR', 'XR80015', '015', 80, 'abanico-plano', 'inox', 0.59, 1, 4,
    rangos([1, 1.25, 'M'], [1.25, 4, 'F'])),
  tj('xr8002', 'XR', 'XR8002', '02', 80, 'abanico-plano', 'inox', 0.79, 1, 4,
    rangos([1, 1.25, 'M'], [1.25, 4, 'F'])),
  tj('xr80025', 'XR', 'XR80025', '025', 80, 'abanico-plano', 'inox', 0.99, 1, 4,
    rangos([1, 1.75, 'M'], [1.75, 4, 'F'])),
  tj('xr8003', 'XR', 'XR8003', '03', 80, 'abanico-plano', 'inox', 1.18, 1, 4,
    rangos([1, 1.75, 'M'], [1.75, 4, 'F'])),
  // El tamaño 035 solo existe en 80 grados: no tiene par en la serie de 110.
  tj('xr80035', 'XR', 'XR80035', '035', 80, 'abanico-plano', 'inox', 1.38, 1, 4,
    rangos([1, 2.75, 'M'], [2.75, 4, 'F']),
    'Este tamaño solo existe en 80 grados.'),
  tj('xr8004', 'XR', 'XR8004', '04', 80, 'abanico-plano', 'inox', 1.58, 1, 4,
    rangos([1, 1.25, 'C'], [1.25, 3.5, 'M'], [3.5, 4, 'F'])),
  tj('xr8005', 'XR', 'XR8005', '05', 80, 'abanico-plano', 'inox', 1.97, 1, 4,
    rangos([1, 1.75, 'C'], [1.75, 3.5, 'M'], [3.5, 4, 'F'])),
  tj('xr8006', 'XR', 'XR8006', '06', 80, 'abanico-plano', 'inox', 2.37, 1, 4,
    rangos([1, 1.75, 'C'], [1.75, 4, 'M'])),
  tj('xr8008', 'XR', 'XR8008', '08', 80, 'abanico-plano', 'inox', 3.16, 1, 4,
    rangos([1, 2.25, 'VC'], [2.25, 2.75, 'C'], [2.75, 4, 'M'])),
  tj('xr8010', 'XR', 'XR8010', '10', 80, 'abanico-plano', 'inox', 3.95, 1, 4,
    rangos([1, 1.25, 'XC'], [1.25, 1.75, 'VC'], [1.75, 4, 'C']),
    'Solo en acero inoxidable.'),
  tj('xr8015', 'XR', 'XR8015', '15', 80, 'abanico-plano', 'inox', 5.92, 1, 4,
    rangos([1, 1.75, 'XC'], [1.75, 2.75, 'VC'], [2.75, 4, 'C']),
    'Solo en acero inoxidable.'),

  // ----- XRC TeeJet 110 (rango extendido en ceramica) -----
  // Solo se siembra el tamano 20: es el unico abanico plano del catalogo
  // por encima del 15, y en los demas tamanos XRC repite los caudales de
  // la serie XR ya sembrada.
  tj('xrc11020', 'XRC', 'XRC11020', '20', 110, 'abanico-plano', 'ceramica', 7.89, 1, 4,
    rangos([1, 2.5, 'XC'], [2.5, 4, 'VC']),
    'Versión cerámica de la serie de rango extendido. Es el abanico plano de mayor caudal del catálogo.'),

  // ----- Turbo TeeJet 110 (abanico plano con preorificio, 1-6 bar) -----
  tj('tt11001', 'TT', 'TT11001', '01', 110, 'abanico-preorificio', 'polimero', 0.39, 1, 6,
    rangos([1, 1.5, 'C'], [1.5, 3.5, 'M'], [3.5, 6, 'F'])),
  tj('tt110015', 'TT', 'TT110015', '015', 110, 'abanico-preorificio', 'polimero', 0.59, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 3.5, 'M'], [3.5, 6, 'F'])),
  tj('tt11002', 'TT', 'TT11002', '02', 110, 'abanico-preorificio', 'polimero', 0.79, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 2.5, 'C'], [2.5, 4.5, 'M'], [4.5, 6, 'F'])),
  tj('tt110025', 'TT', 'TT110025', '025', 110, 'abanico-preorificio', 'polimero', 0.99, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 2.5, 'C'], [2.5, 4.5, 'M'], [4.5, 6, 'F'])),
  tj('tt11003', 'TT', 'TT11003', '03', 110, 'abanico-preorificio', 'polimero', 1.18, 1, 6,
    rangos([1, 1.5, 'VC'], [1.5, 2.5, 'C'], [2.5, 6, 'M'])),
  tj('tt11004', 'TT', 'TT11004', '04', 110, 'abanico-preorificio', 'polimero', 1.58, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 3.5, 'C'], [3.5, 6, 'M'])),
  tj('tt11005', 'TT', 'TT11005', '05', 110, 'abanico-preorificio', 'polimero', 1.97, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 4.5, 'C'], [4.5, 6, 'M'])),
  tj('tt11006', 'TT', 'TT11006', '06', 110, 'abanico-preorificio', 'polimero', 2.37, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 3.5, 'VC'], [3.5, 5.5, 'C'], [5.5, 6, 'M'])),
  tj('tt11008', 'TT', 'TT11008', '08', 110, 'abanico-preorificio', 'polimero', 3.16, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 4.5, 'C'], [4.5, 6, 'M'])),

  // ----- AIXR TeeJet 110 (abanico induccion de aire, 1-6 bar) -----
  tj('aixr110015', 'AIXR', 'AIXR110015', '015', 110, 'abanico-induccion', 'polimero', 0.59, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 4.5, 'C'], [4.5, 6, 'M'])),
  tj('aixr11002', 'AIXR', 'AIXR11002', '02', 110, 'abanico-induccion', 'polimero', 0.79, 1, 6,
    rangos([1, 1.5, 'XC'], [1.5, 2.5, 'VC'], [2.5, 5.5, 'C'], [5.5, 6, 'M'])),
  tj('aixr110025', 'AIXR', 'AIXR110025', '025', 110, 'abanico-induccion', 'polimero', 0.99, 1, 6,
    rangos([1, 2.5, 'XC'], [2.5, 3.5, 'VC'], [3.5, 6, 'C'])),
  tj('aixr11003', 'AIXR', 'AIXR11003', '03', 110, 'abanico-induccion', 'polimero', 1.18, 1, 6,
    rangos([1, 2.5, 'XC'], [2.5, 3.5, 'VC'], [3.5, 6, 'C'])),
  tj('aixr11004', 'AIXR', 'AIXR11004', '04', 110, 'abanico-induccion', 'polimero', 1.58, 1, 6,
    rangos([1, 1.5, 'UC'], [1.5, 2.5, 'XC'], [2.5, 4.5, 'VC'], [4.5, 6, 'C'])),
  tj('aixr11005', 'AIXR', 'AIXR11005', '05', 110, 'abanico-induccion', 'polimero', 1.97, 1, 6,
    rangos([1, 1.5, 'UC'], [1.5, 3.5, 'XC'], [3.5, 4.5, 'VC'], [4.5, 6, 'C'])),
  tj('aixr11006', 'AIXR', 'AIXR11006', '06', 110, 'abanico-induccion', 'polimero', 2.37, 1, 6,
    rangos([1, 1.5, 'UC'], [1.5, 3.5, 'XC'], [3.5, 4.5, 'VC'], [4.5, 6, 'C'])),

  // ----- TTI TeeJet 110 (induccion Turbo, gota ultra gruesa, 1-7 bar) -----
  tj('tti110015', 'TTI', 'TTI110015', '015', 110, 'abanico-induccion', 'polimero', 0.59, 1, 7,
    rangos([1, 3.5, 'UC'], [3.5, 7, 'XC'])),
  tj('tti11002', 'TTI', 'TTI11002', '02', 110, 'abanico-induccion', 'polimero', 0.79, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti110025', 'TTI', 'TTI110025', '025', 110, 'abanico-induccion', 'polimero', 0.99, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11003', 'TTI', 'TTI11003', '03', 110, 'abanico-induccion', 'polimero', 1.18, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11004', 'TTI', 'TTI11004', '04', 110, 'abanico-induccion', 'polimero', 1.58, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11005', 'TTI', 'TTI11005', '05', 110, 'abanico-induccion', 'polimero', 1.97, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),
  tj('tti11006', 'TTI', 'TTI11006', '06', 110, 'abanico-induccion', 'polimero', 2.37, 1, 7,
    rangos([1, 4.5, 'UC'], [4.5, 7, 'XC'])),

  // ----- AI TeeJet 110 (induccion de aire alta presion, 2-8 bar) -----
  tj('ai11002', 'AI', 'AI11002', '02', 110, 'abanico-induccion', 'inox', 0.79, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai110025', 'AI', 'AI110025', '025', 110, 'abanico-induccion', 'inox', 0.99, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai11003', 'AI', 'AI11003', '03', 110, 'abanico-induccion', 'inox', 1.18, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai11004', 'AI', 'AI11004', '04', 110, 'abanico-induccion', 'inox', 1.58, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai11005', 'AI', 'AI11005', '05', 110, 'abanico-induccion', 'inox', 1.97, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai11006', 'AI', 'AI11006', '06', 110, 'abanico-induccion', 'inox', 2.37, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C'])),
  tj('ai11008', 'AI', 'AI11008', '08', 110, 'abanico-induccion', 'inox', 3.16, 2, 8,
    rangos([2, 3.5, 'UC'], [3.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C'])),

  // ----- AIC TeeJet 110 (induccion de aire, tamanos grandes) -----
  // Solo se siembran 08, 10 y 15: son los caudales de inducción de aire
  // que ninguna otra serie del catalogo alcanza. En los tamanos chicos
  // AIC repite los caudales de la serie AI ya sembrada.
  tj('aic11008', 'AIC', 'AIC11008', '08', 110, 'abanico-induccion', 'inox/polimero', 3.16, 2, 8,
    rangos([2, 3.5, 'UC'], [3.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C'])),
  tj('aic11010', 'AIC', 'AIC11010', '10', 110, 'abanico-induccion', 'inox/polimero', 3.95, 2, 8,
    rangos([2, 3.5, 'UC'], [3.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C'])),
  tj('aic11015', 'AIC', 'AIC11015', '15', 110, 'abanico-induccion', 'inox', 5.92, 2, 8,
    rangos([2, 3.5, 'UC'], [3.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C']),
    'Solo en acero inoxidable. Es la boquilla de inducción de aire de mayor caudal del catálogo.'),

  // ----- AI TeeJet 80 (induccion de aire, el otro angulo de la serie) -----
  // Mismo caudal que la ficha de 110 y la clase de gota de la columna de
  // 80 grados. El tamaño 08 solo existe en 110.
  tj('ai80015', 'AI', 'AI80015', '015', 80, 'abanico-induccion', 'inox', 0.59, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai8002', 'AI', 'AI8002', '02', 80, 'abanico-induccion', 'inox', 0.79, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai80025', 'AI', 'AI80025', '025', 80, 'abanico-induccion', 'inox', 0.99, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 7.5, 'VC'], [7.5, 8, 'C'])),
  tj('ai8003', 'AI', 'AI8003', '03', 80, 'abanico-induccion', 'inox', 1.18, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 8, 'VC'])),
  tj('ai8004', 'AI', 'AI8004', '04', 80, 'abanico-induccion', 'inox', 1.58, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 6.5, 'VC'], [6.5, 8, 'C'])),
  tj('ai8005', 'AI', 'AI8005', '05', 80, 'abanico-induccion', 'inox', 1.97, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 5.5, 'XC'], [5.5, 7.5, 'VC'], [7.5, 8, 'C'])),
  tj('ai8006', 'AI', 'AI8006', '06', 80, 'abanico-induccion', 'inox', 2.37, 2, 8,
    rangos([2, 3.5, 'UC'], [3.5, 7.5, 'XC'], [7.5, 8, 'VC'])),

  // ----- TX ConeJet VisiFlo (cono hueco ceramico, 80 grados a 7 bar) -----
  // Tamanos propios de TeeJet, NO ISO. Uso tipico a 3 bar o mas.
  tj('txvk6', 'TX', 'TX-VK6', null, 80, 'cono-hueco', 'ceramica', 0.393, 2, 20,
    rangos([2, 3.5, 'F'], [3.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk8', 'TX', 'TX-VK8', null, 80, 'cono-hueco', 'ceramica', 0.525, 2, 20,
    rangos([2, 3.5, 'F'], [3.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk10', 'TX', 'TX-VK10', null, 80, 'cono-hueco', 'ceramica', 0.657, 2, 20,
    rangos([2, 4.5, 'F'], [4.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk12', 'TX', 'TX-VK12', null, 80, 'cono-hueco', 'ceramica', 0.788, 2, 20,
    rangos([2, 4.5, 'F'], [4.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk18', 'TX', 'TX-VK18', null, 80, 'cono-hueco', 'ceramica', 1.18, 2, 20,
    rangos([2, 6.5, 'F'], [6.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),
  tj('txvk26', 'TX', 'TX-VK26', null, 80, 'cono-hueco', 'ceramica', 1.71, 2, 20,
    rangos([2, 7.5, 'F'], [7.5, 20, 'VF']),
    'Tamaño propio TeeJet (no ISO). Angulo 80 grados a 7 bar.'),

  // ----- TXA ConeJet (cono hueco ceramico con codigo ISO, 80 grados) -----
  tj('txa800050', 'TXA', 'TXA800050VK', '0050', 80, 'cono-hueco', 'ceramica', 0.196, 2, 20,
    rangos([2, 2.5, 'F'], [2.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa800067', 'TXA', 'TXA800067VK', '0067', 80, 'cono-hueco', 'ceramica', 0.262, 2, 20,
    rangos([2, 2.5, 'F'], [2.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8001', 'TXA', 'TXA8001VK', '01', 80, 'cono-hueco', 'ceramica', 0.393, 2, 20,
    rangos([2, 3.5, 'F'], [3.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa80015', 'TXA', 'TXA80015VK', '015', 80, 'cono-hueco', 'ceramica', 0.591, 2, 20,
    rangos([2, 5.5, 'F'], [5.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8002', 'TXA', 'TXA8002VK', '02', 80, 'cono-hueco', 'ceramica', 0.788, 2, 20,
    rangos([2, 4.5, 'F'], [4.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8003', 'TXA', 'TXA8003VK', '03', 80, 'cono-hueco', 'ceramica', 1.18, 2, 20,
    rangos([2, 6.5, 'F'], [6.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
  tj('txa8004', 'TXA', 'TXA8004VK', '04', 80, 'cono-hueco', 'ceramica', 1.58, 2, 20,
    rangos([2, 6.5, 'F'], [6.5, 20, 'VF']), 'Angulo 80 grados a 7 bar.'),
];

// ----- Albuz ATR 80 (cono hueco ceramico, codigo de color europeo NO ISO) -----
function atr(id, color, caudal10bar, exponente) {
  return {
    id,
    fabricante: 'Albuz',
    serie: 'ATR',
    modelo: `ATR 80 ${color}`,
    tipoPatron: 'cono-hueco',
    anguloGrados: 80,
    tamanoIso: null,
    caudalRefLmin: caudal10bar,
    presionRefBar: 10,
    presionMinBar: 5,
    presionMaxBar: 20,
    exponente,
    material: 'ceramica',
    edicionEstandar: null,
    clasesGota: [],
    notas:
      'Código de color europeo, NO ISO. Angulo 80 grados a 5 bar; presión recomendada 10 bar. ' +
      'La ficha describe gota fina pero no publica clase por presión. Exponente ajustado a la ' +
      'tabla del fabricante (5-20 bar).',
    fuente: 'Albuz, ficha ATR 80 catálogo 2024 (albuz-spray.com).',
  };
}

CATALOGO_SIEMBRA.push(
  atr('atr80-lila', 'lila', 0.5, 0.48),
  atr('atr80-cafe', 'cafe', 0.67, 0.477),
  atr('atr80-amarillo', 'amarillo', 1.03, 0.49),
  atr('atr80-naranja', 'naranja', 1.39, 0.485),
  atr('atr80-rojo', 'rojo', 1.92, 0.476),
  atr('atr80-gris', 'gris', 2.08, 0.471)
);

// ----- Lechler: abanico de induccion de aire, 120 grados -----
// El catalogo publica la clase segun ISO 25358; se registra como S572.3,
// que es la edicion de ASABE alineada con esa norma (ver el encabezado).
function le(id, serie, modelo, tamanoIso, caudal3bar, presionMin, presionMax, clasesGota, notas) {
  return {
    id,
    fabricante: 'Lechler',
    serie,
    modelo,
    tipoPatron: 'abanico-induccion',
    anguloGrados: 120,
    tamanoIso,
    caudalRefLmin: caudal3bar,
    presionRefBar: 3,
    presionMinBar: presionMin,
    presionMaxBar: presionMax,
    exponente: 0.5,
    material: 'polimero',
    edicionEstandar: 'S572.3',
    clasesGota,
    notas,
    fuente:
      'Lechler, catálogo agrícola 2025 (inglés), tabla de la serie; clase de gota según ' +
      'ISO 25358 (equivale a ASABE S572.3).',
  };
}

const NOTA_LECHLER_MATERIAL = 'También se fabrica en cerámica (sufijo C), con el mismo caudal.';

CATALOGO_SIEMBRA.push(
  // Serie ID: inyector largo, tamanos 01-10, 2-8 bar (3-8 bar en 01 y 015).
  le('id120-01', 'ID', 'ID-120-01', '01', 0.39, 3, 8,
    rangos([3, 3.5, 'XC'], [3.5, 6.5, 'VC'], [6.5, 8, 'C']), NOTA_LECHLER_MATERIAL),
  le('id120-015', 'ID', 'ID-120-015', '015', 0.59, 3, 8,
    rangos([3, 5.5, 'VC'], [5.5, 8, 'C']), NOTA_LECHLER_MATERIAL),
  le('id120-02', 'ID', 'ID-120-02', '02', 0.8, 2, 8,
    rangos([2, 2.5, 'XC'], [2.5, 5.5, 'VC'], [5.5, 7.5, 'C'], [7.5, 8, 'M']), NOTA_LECHLER_MATERIAL),
  le('id120-025', 'ID', 'ID-120-025', '025', 0.99, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 3.5, 'XC'], [3.5, 8, 'VC']), NOTA_LECHLER_MATERIAL),
  le('id120-03', 'ID', 'ID-120-03', '03', 1.19, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 3.5, 'XC'], [3.5, 8, 'VC']), NOTA_LECHLER_MATERIAL),
  le('id120-04', 'ID', 'ID-120-04', '04', 1.58, 2, 8,
    rangos([2, 3.5, 'XC'], [3.5, 8, 'VC']), NOTA_LECHLER_MATERIAL),
  le('id120-05', 'ID', 'ID-120-05', '05', 1.97, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 3.5, 'XC'], [3.5, 8, 'VC']), NOTA_LECHLER_MATERIAL),
  le('id120-06', 'ID', 'ID-120-06', '06', 2.36, 2, 8,
    rangos([2, 3.5, 'XC'], [3.5, 8, 'VC']), NOTA_LECHLER_MATERIAL),
  le('id120-08', 'ID', 'ID-120-08', '08', 3.16, 2, 8,
    rangos([2, 3.5, 'XC'], [3.5, 8, 'VC']), NOTA_LECHLER_MATERIAL),
  le('id120-10', 'ID', 'ID-120-10', '10', 3.94, 2, 8,
    rangos([2, 2.5, 'UC'], [2.5, 4.5, 'XC'], [4.5, 8, 'VC']), NOTA_LECHLER_MATERIAL),

  // Serie IDK: la misma idea en cuerpo compacto, tamanos 01-10, 1-6 bar.
  le('idk120-01', 'IDK', 'IDK 120-01', '01', 0.39, 1, 6,
    rangos([1, 1.25, 'XC'], [1.25, 3.5, 'VC'], [3.5, 5, 'C'], [5, 6, 'M']), NOTA_LECHLER_MATERIAL),
  le('idk120-015', 'IDK', 'IDK 120-015', '015', 0.59, 1, 6,
    rangos([1, 1.25, 'XC'], [1.25, 2.5, 'VC'], [2.5, 5, 'C'], [5, 6, 'M']), NOTA_LECHLER_MATERIAL),
  le('idk120-02', 'IDK', 'IDK 120-02', '02', 0.8, 1, 6,
    rangos([1, 1.25, 'XC'], [1.25, 3.5, 'VC'], [3.5, 5, 'C'], [5, 6, 'M']), NOTA_LECHLER_MATERIAL),
  le('idk120-025', 'IDK', 'IDK 120-025', '025', 0.99, 1, 6,
    rangos([1, 1.25, 'XC'], [1.25, 2.5, 'VC'], [2.5, 5, 'C'], [5, 6, 'M']), NOTA_LECHLER_MATERIAL),
  le('idk120-03', 'IDK', 'IDK 120-03', '03', 1.19, 1, 6,
    rangos([1, 1.25, 'XC'], [1.25, 3.5, 'VC'], [3.5, 5, 'C'], [5, 6, 'M']),
    `${NOTA_LECHLER_MATERIAL} La variante IDKN de este tamaño da gota más gruesa; aquí va la columna IDK.`),
  le('idk120-04', 'IDK', 'IDK 120-04', '04', 1.58, 1, 6,
    rangos([1, 1.25, 'UC'], [1.25, 2.5, 'XC'], [2.5, 3.5, 'VC'], [3.5, 6, 'C']),
    `${NOTA_LECHLER_MATERIAL} La variante IDKN de este tamaño da gota más gruesa; aquí va la columna IDK.`),
  le('idk120-05', 'IDK', 'IDK 120-05', '05', 1.97, 1, 6,
    rangos([1, 1.75, 'XC'], [1.75, 4.5, 'VC'], [4.5, 6, 'C']), NOTA_LECHLER_MATERIAL),
  le('idk120-06', 'IDK', 'IDK 120-06', '06', 2.36, 1, 6,
    rangos([1, 1.25, 'XC'], [1.25, 3.5, 'VC'], [3.5, 6, 'C']), NOTA_LECHLER_MATERIAL),
  le('idk120-08', 'IDK', 'IDK 120-08', '08', 3.16, 1, 6,
    rangos([1, 1.75, 'XC'], [1.75, 5, 'VC'], [5, 6, 'C']), NOTA_LECHLER_MATERIAL),
  le('idk120-10', 'IDK', 'IDK 120-10', '10', 3.94, 1, 6,
    rangos([1, 1.25, 'UC'], [1.25, 2.5, 'XC'], [2.5, 5, 'VC'], [5, 6, 'C']), NOTA_LECHLER_MATERIAL)
);

// ----- Hypro (Pentair): abanico de induccion de aire -----
// La guia del fabricante no publica clase de gota por presion, solo la
// categoria AHDB a 3 bar y la calificacion de deriva LERAP. Sin clase no
// hay edicion de estandar que registrar, y estas fichas no participan en
// el filtrado por clase de gota.
function hy(id, serie, modelo, tamanoIso, angulo, caudal3bar, presionMin, presionMax, notas) {
  return {
    id,
    fabricante: 'Hypro',
    serie,
    modelo,
    tipoPatron: 'abanico-induccion',
    anguloGrados: angulo,
    tamanoIso,
    caudalRefLmin: caudal3bar,
    presionRefBar: 3,
    presionMinBar: presionMin,
    presionMaxBar: presionMax,
    exponente: 0.5,
    material: 'polimero',
    edicionEstandar: null,
    clasesGota: [],
    notas: `${notas} La guía del fabricante no publica clase de gota por presión.`,
    fuente: 'Pentair Hypro, Hypro Nozzles Crop Spraying Guide, tabla de la serie.',
  };
}

const NOTA_ULD = 'Gota gruesa llena de aire, para cuando lo que manda es no derivar.';
const NOTA_GA = 'Inclinada hacia atrás; equilibra cobertura y deriva.';

CATALOGO_SIEMBRA.push(
  // ULD 120: Ultra Lo-Drift, tamanos 015-08, 2-5 bar.
  hy('uld120-015', 'ULD', 'ULD120-015', '015', 120, 0.6, 2, 5, NOTA_ULD),
  hy('uld120-02', 'ULD', 'ULD120-02', '02', 120, 0.8, 2, 5, NOTA_ULD),
  hy('uld120-025', 'ULD', 'ULD120-025', '025', 120, 1.0, 2, 5, NOTA_ULD),
  hy('uld120-03', 'ULD', 'ULD120-03', '03', 120, 1.2, 2, 5, NOTA_ULD),
  hy('uld120-04', 'ULD', 'ULD120-04', '04', 120, 1.6, 2, 5, NOTA_ULD),
  hy('uld120-05', 'ULD', 'ULD120-05', '05', 120, 2.0, 2, 5, NOTA_ULD),
  hy('uld120-06', 'ULD', 'ULD120-06', '06', 120, 2.4, 2, 5, NOTA_ULD),
  hy('uld120-08', 'ULD', 'ULD120-08', '08', 120, 3.2, 2, 5, NOTA_ULD),

  // GuardianAIR 110: tamanos 015-05, 1-5 bar.
  hy('ga110-015', 'GuardianAIR', 'GA110-015', '015', 110, 0.6, 1, 5, NOTA_GA),
  hy('ga110-02', 'GuardianAIR', 'GA110-02', '02', 110, 0.8, 1, 5, NOTA_GA),
  hy('ga110-025', 'GuardianAIR', 'GA110-025', '025', 110, 1.0, 1, 5, NOTA_GA),
  hy('ga110-03', 'GuardianAIR', 'GA110-03', '03', 110, 1.2, 1, 5, NOTA_GA),
  hy('ga110-035', 'GuardianAIR', 'GA110-035', '035', 110, 1.4, 1, 5, NOTA_GA),
  hy('ga110-04', 'GuardianAIR', 'GA110-04', '04', 110, 1.6, 1, 5, NOTA_GA),
  hy('ga110-05', 'GuardianAIR', 'GA110-05', '05', 110, 2.0, 1, 5, NOTA_GA)
);

// ----- Magnojet: abanico de barra, ceramica tecnica (99 % alumina) -----
// La clase de gota viene del catalogo en simbolos BCPC en portugues; se
// traduce a los simbolos de la aplicacion y se registra como S572.1 (ver
// el encabezado). El exponente va ajustado a la tabla de cada ficha, con
// la curva anclada en su renglon de referencia: es la curva que la
// aplicacion usa de verdad, asi que es la que tiene que reproducir la
// tabla.
//
// Se siembran las cinco series SIMPLES de barra. Quedan fuera, y a
// proposito: las de dos y tres abanicos (ST/D, AD/D, AD/T, AD-IA/D,
// AD-IA/T, MD-IA/D), porque tipoPatron no distingue el abanico doble del
// simple y sembrarlas seria decir que son lo mismo; y las de uso
// especial (MGA de fertilizante liquido, PB, BX, cono MAG, serie X), que
// no son boquillas de barra.
//
// Tampoco se sembraron TRES fichas cuya tabla publicada NO se deja
// representar por la ley presion-caudal con la que calcula la
// aplicacion, con el mismo 5 % de tolerancia que usa la compuerta contra
// ISO: ST 005 (la curva se aparta 13 % de la tabla), ST 01 (5.9 %) y
// ST-IA 005 (7.2 %, y 5 % del caudal ISO). En los tres el caudal
// publicado va en centesimas de litro sobre valores de 0,12 a 0,29
// L/min, donde el redondeo del catalogo pesa mas que la fisica. Un dato
// que no se puede reproducir es peor que no tenerlo: quien las use puede
// capturarlas en el editor midiendo su propio caudal.
function mj(id, serie, modelo, tamanoIso, angulo, patron, caudalRef, presionRef, presionMin, presionMax, exponente, clasesGota, notas = '') {
  return {
    id: `mj-${id}`,
    fabricante: 'Magnojet',
    serie,
    modelo,
    tipoPatron: patron === 'induccion' ? 'abanico-induccion' : 'abanico-preorificio',
    anguloGrados: angulo,
    tamanoIso,
    caudalRefLmin: caudalRef,
    presionRefBar: presionRef,
    presionMinBar: presionMin,
    presionMaxBar: presionMax,
    exponente,
    material: 'ceramica',
    edicionEstandar: 'S572.1',
    clasesGota,
    notas,
    fuente:
      'Magnojet, catálogo general 2019/2020, tabla de la serie; clase de gota según BCPC ' +
      '(equivale a ASABE S572.1).',
  };
}

CATALOGO_SIEMBRA.push(

  // ----- ST -----
  mj('st-015', 'ST', 'ST 015', '015', 135, 'preorificio', 0.61, 3.1, 1.4, 6.2, 0.514,
    rangos([1.4, 3.6, 'C'], [3.6, 6.2, 'M'])),
  mj('st-02', 'ST', 'ST 02', '02', 135, 'preorificio', 0.82, 3.1, 1.4, 6.2, 0.482,
    rangos([1.4, 2.55, 'VC'], [2.55, 4.65, 'C'], [4.65, 6.2, 'M'])),
  mj('st-025', 'ST', 'ST 025', '025', 135, 'preorificio', 1.04, 3.1, 1.4, 6.2, 0.481,
    rangos([1.4, 2.55, 'VC'], [2.55, 5.7, 'C'], [5.7, 6.2, 'M'])),
  mj('st-03', 'ST', 'ST 03', '03', 135, 'preorificio', 1.25, 3.1, 1.4, 6.2, 0.482,
    rangos([1.4, 2.55, 'VC'], [2.55, 5.7, 'C'], [5.7, 6.2, 'M'])),
  mj('st-04', 'ST', 'ST 04', '04', 135, 'preorificio', 1.62, 3.1, 1.4, 6.2, 0.486,
    rangos([1.4, 2.55, 'VC'], [2.55, 6.2, 'C'])),
  mj('st-05', 'ST', 'ST 05', '05', 135, 'preorificio', 2.07, 3.1, 1.4, 6.2, 0.477,
    rangos([1.4, 2.55, 'VC'], [2.55, 6.2, 'C'])),
  mj('st-06', 'ST', 'ST 06', '06', 135, 'preorificio', 2.49, 3.1, 1.4, 6.2, 0.470,
    rangos([1.4, 2.55, 'VC'], [2.55, 6.2, 'C'])),

  // ----- ST-IA -----
  mj('stia-01', 'ST-IA', 'ST-IA 01', '01', 110, 'induccion', 0.38, 2.7, 2.7, 6.2, 0.473,
    rangos([2.7, 4.1, 'XC'], [4.1, 6.2, 'VC'])),
  mj('stia-015', 'ST-IA', 'ST-IA 015', '015', 110, 'induccion', 0.65, 3.4, 2, 6.2, 0.509,
    rangos([2, 4.1, 'XC'], [4.1, 6.2, 'VC'])),
  mj('stia-02', 'ST-IA', 'ST-IA 02', '02', 110, 'induccion', 0.89, 3.4, 2, 6.2, 0.491,
    rangos([2, 6.2, 'XC'])),
  mj('stia-025', 'ST-IA', 'ST-IA 025', '025', 110, 'induccion', 1.09, 3.4, 2, 6.2, 0.497,
    rangos([2, 6.2, 'XC'])),
  mj('stia-03', 'ST-IA', 'ST-IA 03', '03', 110, 'induccion', 1.33, 3.4, 2, 6.2, 0.509,
    rangos([2, 6.2, 'XC'])),
  mj('stia-04', 'ST-IA', 'ST-IA 04', '04', 110, 'induccion', 1.73, 3.4, 2, 6.2, 0.494,
    rangos([2, 6.2, 'XC'])),

  // ----- AD -----
  mj('ad-01', 'AD', 'AD 01', '01', 110, 'preorificio', 0.41, 3.1, 2, 4.1, 0.471,
    rangos([2, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj('ad-015', 'AD', 'AD 015', '015', 110, 'preorificio', 0.61, 3.1, 2, 4.1, 0.465,
    rangos([2, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj('ad-02', 'AD', 'AD 02', '02', 110, 'preorificio', 0.82, 3.1, 2, 4.1, 0.504,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj('ad-025', 'AD', 'AD 025', '025', 110, 'preorificio', 1.03, 3.1, 2, 4.1, 0.360,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj('ad-03', 'AD', 'AD 03', '03', 110, 'preorificio', 1.25, 3.1, 2, 4.1, 0.501,
    rangos([2, 4.1, 'M'])),
  mj('ad-04', 'AD', 'AD 04', '04', 110, 'preorificio', 1.62, 3.1, 2, 4.1, 0.492,
    rangos([2, 4.1, 'M'])),
  mj('ad-05', 'AD', 'AD 05', '05', 110, 'preorificio', 2.07, 3.1, 2, 4.1, 0.497,
    rangos([2, 2.55, 'C'], [2.55, 4.1, 'M'])),

  // ----- AD-IA -----
  mj('adia-007', 'AD-IA', 'AD-IA 007', '0075', 110, 'induccion', 0.28, 2.7, 2.7, 7.6, 0.463,
    rangos([2.7, 3.05, 'XC'], [3.05, 5.5, 'VC'], [5.5, 7.6, 'C'])),
  mj('adia-01', 'AD-IA', 'AD-IA 01', '01', 110, 'induccion', 0.38, 2.7, 2.7, 7.6, 0.473,
    rangos([2.7, 3.05, 'XC'], [3.05, 5.5, 'VC'], [5.5, 7.6, 'C'])),
  mj('adia-015', 'AD-IA', 'AD-IA 015', '015', 110, 'induccion', 0.65, 3.4, 2, 7.6, 0.492,
    rangos([2, 2.7, 'XC'], [2.7, 6.9, 'VC'], [6.9, 7.6, 'C'])),
  mj('adia-02', 'AD-IA', 'AD-IA 02', '02', 110, 'induccion', 0.89, 3.4, 2, 7.6, 0.477,
    rangos([2, 4.1, 'XC'], [4.1, 6.9, 'VC'], [6.9, 7.6, 'C'])),
  mj('adia-025', 'AD-IA', 'AD-IA 025', '025', 110, 'induccion', 1.09, 3.4, 2, 7.6, 0.491,
    rangos([2, 4.1, 'XC'], [4.1, 6.9, 'VC'], [6.9, 7.6, 'C'])),
  mj('adia-03', 'AD-IA', 'AD-IA 03', '03', 110, 'induccion', 1.33, 3.4, 2, 7.6, 0.499,
    rangos([2, 4.1, 'XC'], [4.1, 7.6, 'VC'])),
  mj('adia-04', 'AD-IA', 'AD-IA 04', '04', 110, 'induccion', 1.73, 3.4, 2, 7.6, 0.495,
    rangos([2, 4.1, 'XC'], [4.1, 7.6, 'VC'])),
  mj('adia-05', 'AD-IA', 'AD-IA 05', '05', 110, 'induccion', 2.14, 3.4, 2, 7.6, 0.494,
    rangos([2, 5.5, 'XC'], [5.5, 7.6, 'VC'])),
  mj('adia-06', 'AD-IA', 'AD-IA 06', '06', 110, 'induccion', 2.57, 3.4, 2, 7.6, 0.501,
    rangos([2, 5.5, 'XC'], [5.5, 7.6, 'VC'])),
  mj('adia-08', 'AD-IA', 'AD-IA 08', '08', 110, 'induccion', 3.46, 3.4, 2, 7.6, 0.478,
    rangos([2, 5.5, 'XC'], [5.5, 7.6, 'VC'])),

  // ----- MUG -----
  mj('mug-015', 'MUG', 'MUG 015', '015', 110, 'induccion', 0.65, 3.4, 2, 6.2, 0.587,
    rangos([2, 6.2, 'UC']),
    'El renglón de 6,2 bar del catálogo (0,95 L/min) se sale del patrón de la serie: los demás ' +
      'tamaños suben con exponente cercano a 0,50 y este pide 0,59, y la ST-IA 015 —misma tabla de ' +
      'caudal en todos los otros renglones— publica 0,86 ahí. Se sembró el dato tal como está ' +
      'publicado (su columna de L/ha lo confirma), pero conviene medirla antes de trabajar a esa presión.'),
  mj('mug-02', 'MUG', 'MUG 02', '02', 110, 'induccion', 0.89, 3.4, 2, 6.2, 0.491,
    rangos([2, 6.2, 'UC'])),
  mj('mug-025', 'MUG', 'MUG 025', '025', 110, 'induccion', 1.09, 3.4, 2, 6.2, 0.497,
    rangos([2, 6.2, 'UC'])),
  mj('mug-03', 'MUG', 'MUG 03', '03', 110, 'induccion', 1.33, 3.4, 2, 6.2, 0.509,
    rangos([2, 6.2, 'UC'])),
  mj('mug-035', 'MUG', 'MUG 035', '035', 110, 'induccion', 1.53, 3.4, 2, 6.2, 0.482,
    rangos([2, 6.2, 'UC'])),
  mj('mug-04', 'MUG', 'MUG 04', '04', 110, 'induccion', 1.73, 3.4, 2, 6.2, 0.494,
    rangos([2, 6.2, 'UC'])),
  mj('mug-05', 'MUG', 'MUG 05', '05', 110, 'induccion', 2.14, 3.4, 2, 6.2, 0.498,
    rangos([2, 6.2, 'UC']))
);

// ----- TeeJet sin clase de gota publicada: cono lleno y chorro solido -----
// Dos familias que el catalogo tabula con caudal por presion pero SIN
// columna de tamaño de gota, asi que van con clasesGota vacia y no
// participan en el filtrado por clase, igual que las Albuz y las Hypro:
//
//   FL FullJet, cono lleno de angulo ancho (120 grados, tabla de alturas
//   de la pagina 140 del catalogo). Su numero es capacidad propia de
//   TeeJet, NO el codigo de tamaño ISO, asi que no lleva tamanoIso ni
//   color de la norma.
//
//   SJ3 y SJ7 StreamJet, de fertilizante liquido: tres o siete chorros
//   solidos y paralelos. NO tienen angulo de aspersion —no abren abanico
//   ni cono— y por eso su ficha lo deja vacio; el chorro solido casi no
//   deriva y moja en franjas, que es justo lo que se busca para no
//   quemar la hoja. Su numero si es el codigo de capacidad de TeeJet, y
//   el caudal cae dentro de la tolerancia de la norma en todos los
//   tamaños salvo el que lleva nota.
//
// El exponente va ajustado a la tabla de cada ficha, como en Magnojet:
// estas series se apartan de la raiz cuadrada mucho mas que un abanico
// (de 0.38 a 0.57), porque el orificio dosificador no es el que forma el
// patron.
function sinClase(id, serie, modelo, tamanoIso, angulo, tipoPatron, material, caudal3bar, presionMin, presionMax, exponente, notas = '') {
  return {
    id,
    fabricante: 'TeeJet',
    serie,
    modelo,
    tipoPatron,
    anguloGrados: angulo,
    tamanoIso,
    caudalRefLmin: caudal3bar,
    presionRefBar: 3,
    presionMinBar: presionMin,
    presionMaxBar: presionMax,
    exponente,
    material,
    edicionEstandar: null,
    clasesGota: [],
    notas,
    fuente: 'TeeJet Catalog 51A-M (métrico), tabla de la serie. No publica clase de gota.',
  };
}

CATALOGO_SIEMBRA.push(

  // ----- FL -----
  sinClase('fl-5', 'FL', 'FL-5', null, 120, 'cono-lleno', 'inox/polimero', 1.97, 1, 3, 0.453),
  sinClase('fl-65', 'FL', 'FL-6.5', null, 120, 'cono-lleno', 'inox/polimero', 2.56, 1, 3, 0.447),
  sinClase('fl-8', 'FL', 'FL-8', null, 120, 'cono-lleno', 'inox/polimero', 3.15, 1, 3, 0.461),
  sinClase('fl-10', 'FL', 'FL-10', null, 120, 'cono-lleno', 'inox/polimero', 3.93, 1, 3, 0.451),
  sinClase('fl-15', 'FL', 'FL-15', null, 120, 'cono-lleno', 'inox/polimero', 5.9, 1, 3, 0.462),

  // ----- SJ3 -----
  sinClase('sj3-015', 'SJ3', 'SJ3-015', '015', null, 'chorro', 'polimero', 0.58, 1.5, 4, 0.391),
  sinClase('sj3-02', 'SJ3', 'SJ3-02', '02', null, 'chorro', 'polimero', 0.78, 1.5, 4, 0.450),
  sinClase('sj3-03', 'SJ3', 'SJ3-03', '03', null, 'chorro', 'polimero', 1.18, 1.5, 4, 0.376),
  sinClase('sj3-04', 'SJ3', 'SJ3-04', '04', null, 'chorro', 'polimero', 1.56, 1.5, 4, 0.412),
  sinClase('sj3-05', 'SJ3', 'SJ3-05', '05', null, 'chorro', 'polimero', 1.96, 1.5, 4, 0.450),
  sinClase('sj3-06', 'SJ3', 'SJ3-06', '06', null, 'chorro', 'polimero', 2.4, 1.5, 4, 0.479),
  sinClase('sj3-08', 'SJ3', 'SJ3-08', '08', null, 'chorro', 'polimero', 3.13, 1.5, 4, 0.401),
  sinClase('sj3-10', 'SJ3', 'SJ3-10', '10', null, 'chorro', 'polimero', 3.91, 1.5, 4, 0.489),
  sinClase('sj3-15', 'SJ3', 'SJ3-15', '15', null, 'chorro', 'polimero', 5.86, 1.5, 4, 0.572),
  sinClase('sj3-20', 'SJ3', 'SJ3-20', '20', null, 'chorro', 'polimero', 8.05, 1.5, 4, 0.528),

  // ----- SJ7 -----
  sinClase('sj7-015', 'SJ7', 'SJ7-015', null, null, 'chorro', 'polimero', 0.57, 1.5, 4, 0.543,
    'Su caudal a 3 bar queda 5 % por debajo del nominal del tamaño 015 (0,6 L/min), justo en ' +
      'el límite de la tolerancia de la norma: por eso no se le declara tamaño ISO.'),
  sinClase('sj7-02', 'SJ7', 'SJ7-02', '02', null, 'chorro', 'polimero', 0.8, 1.5, 4, 0.542),
  sinClase('sj7-03', 'SJ7', 'SJ7-03', '03', null, 'chorro', 'polimero', 1.18, 1.5, 4, 0.422),
  sinClase('sj7-04', 'SJ7', 'SJ7-04', '04', null, 'chorro', 'polimero', 1.55, 1.5, 4, 0.393),
  sinClase('sj7-05', 'SJ7', 'SJ7-05', '05', null, 'chorro', 'polimero', 1.95, 1.5, 4, 0.378),
  sinClase('sj7-06', 'SJ7', 'SJ7-06', '06', null, 'chorro', 'polimero', 2.35, 1.5, 4, 0.398),
  sinClase('sj7-08', 'SJ7', 'SJ7-08', '08', null, 'chorro', 'polimero', 3.15, 1.5, 4, 0.437),
  sinClase('sj7-10', 'SJ7', 'SJ7-10', '10', null, 'chorro', 'polimero', 3.94, 1.5, 4, 0.442),
  sinClase('sj7-15', 'SJ7', 'SJ7-15', '15', null, 'chorro', 'polimero', 5.87, 1.5, 4, 0.497)
);

// ----- Magnojet AD-IA en 80 grados -----
// A diferencia de TeeJet, Magnojet NO publica una columna de clase por
// angulo: la misma fila de la tabla lleva los dos codigos (80 y 110
// grados) y una sola columna de caudal y de tamaño de gota. Estas fichas
// se derivan de las de 110 en vez de retranscribir sus numeros, para que
// no puedan separarse si mañana se corrige la tabla.
//
// Solo seis tamanos llevan codigo de 80 grados. Los demas (007, 05, 06 y
// 08) existen unicamente en 110 y no se inventan.
const AD_IA_EN_80 = ['01', '015', '02', '025', '03', '04'];

CATALOGO_SIEMBRA.push(
  ...AD_IA_EN_80.map((tamano) => {
    const base = CATALOGO_SIEMBRA.find((b) => b.id === `mj-adia-${tamano}`);
    return {
      ...base,
      id: `mj-adia80-${tamano}`,
      modelo: `AD-IA 80 ${tamano}`,
      anguloGrados: 80,
      clasesGota: base.clasesGota.map((r) => ({ ...r })),
      notas:
        'El catálogo publica una sola tabla de caudal y de clase de gota para los dos ángulos ' +
        'de este tamaño: lo que cambia entre la de 80 y la de 110 grados es el código de pieza.',
    };
  })
);

export const TIPOS_PATRON = [
  'abanico-plano',
  'abanico-preorificio',
  'abanico-induccion',
  'abanico-impacto',
  'cono-lleno',
  'cono-hueco',
  'chorro',
];

export const MATERIALES = ['ceramica', 'inox', 'inox/polimero', 'polimero', 'laton'];

export const FABRICANTES_SUGERIDOS = [
  'TeeJet',
  'Albuz',
  'Lechler',
  'Hypro',
  'Magnojet',
  'ARAG',
  'generica',
];
