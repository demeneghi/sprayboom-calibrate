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
//      Tablas de TODAS las series de puntas del catalogo, paginas 12 a
//      46: MUG (12), APS (14), BD-AV (15), ST (16), ST/D (17), ST-IA
//      (18), ST-IA/D (19), AD (20), AD/D (21), AD/T (22), ADGA (23),
//      AD-IA (24), AD-IA/D (25), AD-IA/T (26), BD (27), AS7030 (28),
//      AS-IA7030 (29), AS-IA (30), MD-IA/D (31), MDC (32), TM-IA (33),
//      PB (34), PB-IA (35), MAG (36), serie X (37), MGA 90 (38-39),
//      MGA 60 (40), MGA 40 (41), BX-AP/70 (42), BX-AP/90 (43), CV-IA
//      (44), MAG CH (45) y CH 100 (46). La pagina impresa es la del PDF
//      menos dos. El catalogo es un PDF de imagenes, sin texto: las
//      tablas se leyeron pagina por pagina y cada renglon se comprobo
//      contra su propia columna de l/ha, que el catalogo calcula como
//      q x 600 / (v x f) con v = 4 km/h y f = 0,5 m.
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
// si (TP, DG y XRC en 80 grados) y los 90 grados de Lechler, que son el
// mismo caso pero de otro angulo: se pueden sembrar igual el dia que
// hagan falta. De Magnojet ya no falta ninguno.
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
// Este bloque trae las cinco series SIMPLES de barra. El resto del
// catalogo Magnojet —los abanicos dobles y triples, los asimetricos, los
// deflectores, los conos huecos y los conos llenos— va mas abajo, en su
// propio bloque, con el mismo procedimiento y las mismas compuertas.
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


// ----- Magnojet: el resto del catalogo -----
// Las cinco series de barra ya sembradas arriba (ST, ST-IA, AD, AD-IA y
// MUG) eran las SIMPLES. Aqui van las demas: las de dos y tres abanicos,
// las asimetricas, los deflectores, los conos huecos y los conos llenos.
// Todas salen del mismo catalogo general 2019/2020 [MJ] y se construyen
// con el mismo procedimiento que las anteriores:
//
//   - presionRefBar es el renglon publicado mas cercano a 3 bar y
//     caudalRefLmin el caudal de ESE renglon, sin interpolar nada;
//   - el exponente se ajusta por minimos cuadrados sobre TODOS los puntos
//     publicados de la ficha (ln q contra ln p), con la curva obligada a
//     pasar por su renglon de referencia, y se redondea a tres decimales;
//   - los rangos de clase de gota ponen la frontera en el punto medio
//     entre la ultima presion de una clase y la primera de la siguiente;
//   - presionMinBar y presionMaxBar son el primer y el ultimo renglon
//     publicado de esa ficha, que no siempre coinciden con el rango que
//     el encabezado declara para la serie entera.
//
// TIPOS DE PATRON NUEVOS: un abanico doble o triple NO es un abanico
// simple con otro nombre —cambia el traslape, la altura de barra y la
// penetracion en el follaje—, asi que estas fichas estrenan
// 'abanico-doble', 'abanico-doble-induccion', 'abanico-triple',
// 'abanico-triple-induccion' y 'cono-hueco-induccion'. Antes se dejaron
// fuera justo porque tipoPatron no las distinguia del abanico simple.
//
// SIN SEMBRAR, y por que: DIEZ fichas cuya tabla publicada NO se deja
// representar por la ley presion-caudal con la que calcula la aplicacion,
// con el mismo 5 % de tolerancia que usa la compuerta contra ISO. En
// todas, el renglon que se sale es UNO solo —casi siempre el de la
// presion mas baja— y su propia columna de l/ha lo confirma, asi que no
// es una lectura mal hecha sino el dato tal como esta impreso:
//
// BD-AV 11008: la curva se aparta -16.0 % de la tabla
// AD/T 06: la curva se aparta -13.1 % de la tabla
// AD-IA/T 02: la curva se aparta 5.7 % de la tabla
// AS-IA7030 01: la curva se aparta 13.6 % de la tabla
// MDC 0,5: la curva se aparta -6.2 % de la tabla
// MDC 2: la curva se aparta 7.0 % de la tabla
// PB-IA 06: la curva se aparta -10.1 % de la tabla
// MAG 6: la curva se aparta -5.4 % de la tabla
// X 0,50: la curva se aparta -10.0 % de la tabla
// CH 100 6: la curva se aparta -6.3 % de la tabla
//
// SEMBRADAS PERO SIN TAMANO ISO: cuatro fichas que el catalogo rotula con
// un codigo de tamano que su caudal no sostiene, o que no existe en la
// tabla ISO 10625 de la aplicacion. El caudal es util igual; el tamano
// declarado seria falso, asi que va vacio y la ficha lo dice en sus notas:
//
// BD-AV 11025: rotulada 25, fuera de la tabla ISO de la aplicación
// AS7030 01: rotulada 01, se desvía 22.9 % del nominal
// MGA 90 04: rotulada 04, se desvía 5.9 % del nominal
// CV-IA 01: rotulada 01, se desvía 5.8 % del nominal
//
// Quedan fuera, y no son boquillas: los porta-boquillas, los filtros, los
// adaptadores y los accesorios (paginas 48 en adelante del catalogo).

const NOTA_MJ = {
  'APS': 'Aplicación selectiva, para implementos WEED-IT y WEED SEEKER.',
  'BD-AV': 'Baja deriva de alto caudal; el catálogo no publica clase de gota para esta serie.',
  'ST/D': 'Dos abanicos de 130° con 40° entre ellos (uno hacia adelante y otro hacia atrás).',
  'ST-IA/D': 'Dos abanicos de 130° con 40° entre ellos, con inducción de aire.',
  'AD/D': 'Dos abanicos de 110° con 40° entre ellos (uno hacia adelante y otro hacia atrás).',
  'AD/T': 'Tres abanicos de 110° (adelante, atrás y al centro), con 40° entre ellos.',
  'ADGA': 'Antideriva de gran ángulo: 120° permiten acercar la barra al objetivo.',
  'AD-IA/D': 'Dos abanicos de 110° con 40° entre ellos, con inducción de aire.',
  'AD-IA/T': 'Tres abanicos de 110° con inducción de aire.',
  'BD': 'Baja deriva. El catálogo publica un código de pieza para 80° y otro para 110°, con una sola tabla.',
  'AS7030': 'Dos abanicos planos asimétricos de 110°: 70 % del caudal a un lado y 30 % al otro.',
  'AS-IA7030': 'Dos abanicos asimétricos de 110° (70/30) con inducción de aire.',
  'AS-IA': 'Abanico asimétrico con inducción de aire; el catálogo no publica clase de gota para esta serie.',
  'MD-IA/D': 'Magno divergente doble con inducción de aire.',
  'MDC': 'Deflector de cerámica: el chorro se abre al chocar contra una superficie. Tamaño propio Magnojet, no ISO.',
  'TM-IA': 'Turbo Magno con inducción de aire, 150° de apertura. Tamaño propio Magnojet, no ISO.',
  'PB': 'Abanico plano de 60°.',
  'PB-IA': 'Abanico plano de 60° con inducción de aire.',
  'MAG': 'Cono hueco de 80°. Tamaño propio Magnojet, no ISO.',
  'X': 'Cono hueco de 85° a alta presión y caudal muy bajo; también se usa para humidificar aviarios. Tamaño propio Magnojet, no ISO.',
  'MGA': 'Cono hueco de gotas atomizadas, para turbopulverizador y para barra.',
  'BX-AP/70': 'Cono hueco de baja presión y alta penetración, 70°.',
  'CV-IA': 'Cono hueco de 100° con inducción de aire, para herbicidas sistémicos, preemergentes e incorporados.',
  'MAG CH': 'Cono lleno de 80°. Tamaño propio Magnojet, no ISO.',
  'CH 100': 'Cono lleno de 100° sin inducción de aire. Tamaño propio Magnojet, no ISO.',
};

function mj2(id, serie, modelo, tamanoIso, angulo, patron, caudalRef, presionRef, presionMin, presionMax, exponente, clasesGota, notaExtra = '') {
  return {
    id: `mj-${id}`,
    fabricante: 'Magnojet',
    serie,
    modelo,
    tipoPatron: patron,
    anguloGrados: angulo,
    tamanoIso,
    caudalRefLmin: caudalRef,
    presionRefBar: presionRef,
    presionMinBar: presionMin,
    presionMaxBar: presionMax,
    exponente,
    material: 'ceramica',
    edicionEstandar: clasesGota.length > 0 ? 'S572.1' : null,
    clasesGota,
    notas: [NOTA_MJ[serie], notaExtra].filter(Boolean).join(' '),
    fuente:
      clasesGota.length > 0
        ? 'Magnojet, catálogo general 2019/2020, tabla de la serie; clase de gota según BCPC ' +
          '(equivale a ASABE S572.1).'
        : 'Magnojet, catálogo general 2019/2020, tabla de la serie. No publica clase de gota.',
  };
}

CATALOGO_SIEMBRA.push(
  // ----- APS (página 14) -----
  mj2('aps-30-01', 'APS', 'APS 30 01', '01', 30, 'abanico-plano', 0.41, 3.1, 1, 4.1, 0.545,
    rangos([1, 4.1, 'F'])),
  mj2('aps-30-02', 'APS', 'APS 30 02', '02', 30, 'abanico-plano', 0.82, 3.1, 1, 4.1, 0.479,
    rangos([1, 1.5, 'M'], [1.5, 4.1, 'F'])),
  mj2('aps-30-03', 'APS', 'APS 30 03', '03', 30, 'abanico-plano', 1.25, 3.1, 1, 4.1, 0.49,
    rangos([1, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('aps-30-04', 'APS', 'APS 30 04', '04', 30, 'abanico-plano', 1.62, 3.1, 1, 4.1, 0.468,
    rangos([1, 2.55, 'M'], [2.55, 4.1, 'F'])),

  // ----- BD-AV (página 15) -----
  mj2('bd-av-11010', 'BD-AV', 'BD-AV 11010', '10', 110, 'abanico-preorificio', 4.18, 3.1, 1, 4.1, 0.488,
    []),
  mj2('bd-av-11015', 'BD-AV', 'BD-AV 11015', '15', 110, 'abanico-preorificio', 6.28, 3.1, 1, 4.1, 0.486,
    []),
  mj2('bd-av-11018', 'BD-AV', 'BD-AV 11018', '18', 110, 'abanico-preorificio', 7.4, 3.1, 1, 4.1, 0.477,
    []),
  mj2('bd-av-11020', 'BD-AV', 'BD-AV 11020', '20', 110, 'abanico-preorificio', 8.48, 3.1, 1, 4.1, 0.485,
    []),
  mj2('bd-av-11025', 'BD-AV', 'BD-AV 11025', null, 110, 'abanico-preorificio', 10.64, 3.1, 1, 4.1, 0.471,
    [],
    'El catálogo la rotula 25, tamaño que no trae la tabla ISO 10625 de la aplicación: va sin tamaño declarado.'),

  // ----- ST/D (página 17) -----
  mj2('st-d-01', 'ST/D', 'ST/D 01', '01', 130, 'abanico-doble', 0.41, 3.1, 2, 5.2, 0.527,
    rangos([2, 4.65, 'F'], [4.65, 5.2, 'VF'])),
  mj2('st-d-015', 'ST/D', 'ST/D 015', '015', 130, 'abanico-doble', 0.62, 3.1, 2, 5.2, 0.459,
    rangos([2, 2.55, 'M'], [2.55, 4.65, 'F'], [4.65, 5.2, 'VF'])),
  mj2('st-d-02', 'ST/D', 'ST/D 02', '02', 130, 'abanico-doble', 0.82, 3.1, 2, 5.2, 0.434,
    rangos([2, 2.55, 'M'], [2.55, 5.2, 'F'])),
  mj2('st-d-025', 'ST/D', 'ST/D 025', '025', 130, 'abanico-doble', 1.04, 3.1, 2, 5.2, 0.499,
    rangos([2, 2.55, 'M'], [2.55, 5.2, 'F'])),
  mj2('st-d-03', 'ST/D', 'ST/D 03', '03', 130, 'abanico-doble', 1.25, 3.1, 2, 5.2, 0.489,
    rangos([2, 2.55, 'M'], [2.55, 5.2, 'F'])),
  mj2('st-d-04', 'ST/D', 'ST/D 04', '04', 130, 'abanico-doble', 1.63, 3.1, 2, 5.2, 0.46,
    rangos([2, 2.55, 'M'], [2.55, 5.2, 'F'])),
  mj2('st-d-05', 'ST/D', 'ST/D 05', '05', 130, 'abanico-doble', 2.08, 3.1, 2, 5.2, 0.483,
    rangos([2, 2.55, 'M'], [2.55, 5.2, 'F'])),
  mj2('st-d-06', 'ST/D', 'ST/D 06', '06', 130, 'abanico-doble', 2.5, 3.1, 2, 5.2, 0.469,
    rangos([2, 2.55, 'M'], [2.55, 5.2, 'F'])),

  // ----- ST-IA/D (página 19) -----
  mj2('st-ia-d-015', 'ST-IA/D', 'ST-IA/D 015', '015', 130, 'abanico-doble-induccion', 0.65, 3.4, 2, 6.2, 0.509,
    rangos([2, 2.7, 'C'], [2.7, 5.5, 'M'], [5.5, 6.2, 'F'])),
  mj2('st-ia-d-02', 'ST-IA/D', 'ST-IA/D 02', '02', 130, 'abanico-doble-induccion', 0.89, 3.4, 2, 6.2, 0.491,
    rangos([2, 2.7, 'VC'], [2.7, 4.1, 'C'], [4.1, 5.5, 'M'], [5.5, 6.2, 'F'])),
  mj2('st-ia-d-025', 'ST-IA/D', 'ST-IA/D 025', '025', 130, 'abanico-doble-induccion', 1.09, 3.4, 2, 6.2, 0.497,
    rangos([2, 2.7, 'VC'], [2.7, 4.1, 'C'], [4.1, 5.5, 'M'], [5.5, 6.2, 'F'])),
  mj2('st-ia-d-03', 'ST-IA/D', 'ST-IA/D 03', '03', 130, 'abanico-doble-induccion', 1.33, 3.4, 2, 6.2, 0.509,
    rangos([2, 2.7, 'VC'], [2.7, 4.1, 'C'], [4.1, 5.5, 'M'], [5.5, 6.2, 'F'])),
  mj2('st-ia-d-04', 'ST-IA/D', 'ST-IA/D 04', '04', 130, 'abanico-doble-induccion', 1.73, 3.4, 2, 6.2, 0.494,
    rangos([2, 2.7, 'VC'], [2.7, 4.1, 'C'], [4.1, 5.5, 'M'], [5.5, 6.2, 'F'])),
  mj2('st-ia-d-05', 'ST-IA/D', 'ST-IA/D 05', '05', 130, 'abanico-doble-induccion', 2.14, 3.4, 2, 6.2, 0.498,
    rangos([2, 2.7, 'VC'], [2.7, 4.1, 'C'], [4.1, 5.5, 'M'], [5.5, 6.2, 'F'])),

  // ----- AD/D (página 21) -----
  mj2('ad-d-015', 'AD/D', 'AD/D 015', '015', 110, 'abanico-doble', 0.61, 3.1, 2, 4.1, 0.465,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj2('ad-d-02', 'AD/D', 'AD/D 02', '02', 110, 'abanico-doble', 0.82, 3.1, 2, 4.1, 0.504,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj2('ad-d-025', 'AD/D', 'AD/D 025', '025', 110, 'abanico-doble', 1.04, 3.1, 2, 4.1, 0.514,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj2('ad-d-03', 'AD/D', 'AD/D 03', '03', 110, 'abanico-doble', 1.25, 3.1, 2, 4.1, 0.501,
    rangos([2, 4.1, 'M'])),
  mj2('ad-d-04', 'AD/D', 'AD/D 04', '04', 110, 'abanico-doble', 1.62, 3.1, 2, 4.1, 0.492,
    rangos([2, 2.55, 'C'], [2.55, 4.1, 'M'])),
  mj2('ad-d-05', 'AD/D', 'AD/D 05', '05', 110, 'abanico-doble', 2.07, 3.1, 2, 4.1, 0.497,
    rangos([2, 2.55, 'C'], [2.55, 4.1, 'M'])),
  mj2('ad-d-06', 'AD/D', 'AD/D 06', '06', 110, 'abanico-doble', 2.49, 3.1, 2, 4.1, 0.483,
    rangos([2, 2.55, 'C'], [2.55, 4.1, 'M'])),
  mj2('ad-d-08', 'AD/D', 'AD/D 08', '08', 110, 'abanico-doble', 3.37, 3.1, 2, 4.1, 0.458,
    rangos([2, 3.6, 'C'], [3.6, 4.1, 'M'])),

  // ----- AD/T (página 22) -----
  mj2('ad-t-02', 'AD/T', 'AD/T 02', '02', 110, 'abanico-triple', 0.76, 2.7, 2.7, 8.9, 0.481,
    rangos([2.7, 5.5, 'F'], [5.5, 8.9, 'VF'])),
  mj2('ad-t-025', 'AD/T', 'AD/T 025', '025', 110, 'abanico-triple', 0.98, 2.7, 2.7, 8.9, 0.396,
    rangos([2.7, 6.9, 'F'], [6.9, 8.9, 'VF'])),
  mj2('ad-t-03', 'AD/T', 'AD/T 03', '03', 110, 'abanico-triple', 1.18, 2.7, 2.7, 8.9, 0.407,
    rangos([2.7, 6.9, 'F'], [6.9, 8.9, 'VF'])),
  mj2('ad-t-04', 'AD/T', 'AD/T 04', '04', 110, 'abanico-triple', 1.58, 2.7, 2.7, 8.9, 0.374,
    rangos([2.7, 3.05, 'M'], [3.05, 8.9, 'F'])),
  mj2('ad-t-05', 'AD/T', 'AD/T 05', '05', 110, 'abanico-triple', 1.97, 2.7, 2.7, 8.9, 0.381,
    rangos([2.7, 3.05, 'M'], [3.05, 8.9, 'F'])),
  mj2('ad-t-08', 'AD/T', 'AD/T 08', '08', 110, 'abanico-triple', 3.1, 2.7, 2.7, 8.9, 0.412,
    rangos([2.7, 3.75, 'M'], [3.75, 8.9, 'F'])),
  mj2('ad-t-10', 'AD/T', 'AD/T 10', '10', 110, 'abanico-triple', 3.88, 2.7, 2.7, 8.9, 0.406,
    rangos([2.7, 4.45, 'M'], [4.45, 8.9, 'F'])),

  // ----- ADGA (página 23) -----
  mj2('adga-01', 'ADGA', 'ADGA 01', '01', 120, 'abanico-preorificio', 0.41, 3.1, 1, 4.1, 0.545,
    rangos([1, 1.5, 'M'], [1.5, 4.1, 'F'])),
  mj2('adga-015', 'ADGA', 'ADGA 015', '015', 120, 'abanico-preorificio', 0.61, 3.1, 1, 4.1, 0.466,
    rangos([1, 1.5, 'M'], [1.5, 4.1, 'F'])),
  mj2('adga-02', 'ADGA', 'ADGA 02', '02', 120, 'abanico-preorificio', 0.82, 3.1, 1, 4.1, 0.479,
    rangos([1, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('adga-025', 'ADGA', 'ADGA 025', '025', 120, 'abanico-preorificio', 1.04, 3.1, 1, 4.1, 0.489,
    rangos([1, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('adga-03', 'ADGA', 'ADGA 03', '03', 120, 'abanico-preorificio', 1.25, 3.1, 1, 4.1, 0.49,
    rangos([1, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj2('adga-04', 'ADGA', 'ADGA 04', '04', 120, 'abanico-preorificio', 1.62, 3.1, 1, 4.1, 0.468,
    rangos([1, 4.1, 'M'])),

  // ----- AD-IA/D (página 25) -----
  mj2('ad-ia-d-01', 'AD-IA/D', 'AD-IA/D 01', '01', 110, 'abanico-doble-induccion', 0.38, 2.7, 2.7, 7.6, 0.473,
    rangos([2.7, 3.05, 'XC'], [3.05, 4.1, 'VC'], [4.1, 6.9, 'C'], [6.9, 7.6, 'M'])),
  mj2('ad-ia-d-015', 'AD-IA/D', 'AD-IA/D 015', '015', 110, 'abanico-doble-induccion', 0.65, 3.4, 2, 7.6, 0.492,
    rangos([2, 2.7, 'XC'], [2.7, 4.1, 'VC'], [4.1, 7.6, 'C'])),
  mj2('ad-ia-d-02', 'AD-IA/D', 'AD-IA/D 02', '02', 110, 'abanico-doble-induccion', 0.89, 3.4, 2, 7.6, 0.477,
    rangos([2, 2.7, 'XC'], [2.7, 4.1, 'VC'], [4.1, 7.6, 'C'])),
  mj2('ad-ia-d-025', 'AD-IA/D', 'AD-IA/D 025', '025', 110, 'abanico-doble-induccion', 1.09, 3.4, 2, 7.6, 0.491,
    rangos([2, 2.7, 'XC'], [2.7, 4.1, 'VC'], [4.1, 7.6, 'C'])),
  mj2('ad-ia-d-03', 'AD-IA/D', 'AD-IA/D 03', '03', 110, 'abanico-doble-induccion', 1.33, 3.4, 2, 7.6, 0.499,
    rangos([2, 2.7, 'XC'], [2.7, 4.1, 'VC'], [4.1, 7.6, 'C'])),
  mj2('ad-ia-d-04', 'AD-IA/D', 'AD-IA/D 04', '04', 110, 'abanico-doble-induccion', 1.73, 3.4, 2, 7.6, 0.493,
    rangos([2, 2.7, 'XC'], [2.7, 5.5, 'VC'], [5.5, 7.6, 'C'])),
  mj2('ad-ia-d-05', 'AD-IA/D', 'AD-IA/D 05', '05', 110, 'abanico-doble-induccion', 2.14, 3.4, 2, 7.6, 0.494,
    rangos([2, 2.7, 'XC'], [2.7, 5.5, 'VC'], [5.5, 7.6, 'C'])),
  mj2('ad-ia-d-06', 'AD-IA/D', 'AD-IA/D 06', '06', 110, 'abanico-doble-induccion', 2.6, 3.4, 2, 7.6, 0.471,
    rangos([2, 2.7, 'XC'], [2.7, 7.6, 'VC'])),

  // ----- AD-IA/T (página 26) -----
  mj2('ad-ia-t-025', 'AD-IA/T', 'AD-IA/T 025', '025', 110, 'abanico-triple-induccion', 1.07, 3.4, 2, 8.9, 0.51,
    rangos([2, 2.7, 'C'], [2.7, 4.1, 'M'], [4.1, 8.9, 'F'])),
  mj2('ad-ia-t-03', 'AD-IA/T', 'AD-IA/T 03', '03', 110, 'abanico-triple-induccion', 1.29, 3.4, 2, 8.9, 0.494,
    rangos([2, 2.7, 'C'], [2.7, 4.1, 'M'], [4.1, 8.9, 'F'])),
  mj2('ad-ia-t-04', 'AD-IA/T', 'AD-IA/T 04', '04', 110, 'abanico-triple-induccion', 1.71, 3.4, 2, 8.9, 0.502,
    rangos([2, 2.7, 'C'], [2.7, 4.1, 'M'], [4.1, 8.9, 'F'])),
  mj2('ad-ia-t-05', 'AD-IA/T', 'AD-IA/T 05', '05', 110, 'abanico-triple-induccion', 2.16, 3.4, 2, 8.9, 0.498,
    rangos([2, 2.7, 'C'], [2.7, 5.5, 'M'], [5.5, 8.9, 'F'])),
  mj2('ad-ia-t-06', 'AD-IA/T', 'AD-IA/T 06', '06', 110, 'abanico-triple-induccion', 2.65, 3.4, 2, 8.9, 0.461,
    rangos([2, 2.7, 'C'], [2.7, 5.5, 'M'], [5.5, 8.9, 'F'])),

  // ----- BD (página 27) -----
  mj2('bd-80005', 'BD', 'BD 80005', null, 80, 'abanico-preorificio', 0.22, 3.1, 1, 4.1, 0.417,
    rangos([1, 3.6, 'F'], [3.6, 4.1, 'VF'])),
  mj2('bd-110-01', 'BD', 'BD 110 01', '01', 110, 'abanico-preorificio', 0.41, 3.1, 1, 4.1, 0.545,
    rangos([1, 4.1, 'F'])),
  mj2('bd-110-015', 'BD', 'BD 110 015', '015', 110, 'abanico-preorificio', 0.61, 3.1, 1, 4.1, 0.466,
    rangos([1, 1.5, 'M'], [1.5, 4.1, 'F'])),
  mj2('bd-110-02', 'BD', 'BD 110 02', '02', 110, 'abanico-preorificio', 0.82, 3.1, 1, 4.1, 0.479,
    rangos([1, 1.5, 'M'], [1.5, 4.1, 'F'])),
  mj2('bd-110-025', 'BD', 'BD 110 025', '025', 110, 'abanico-preorificio', 1.04, 3.1, 1, 4.1, 0.489,
    rangos([1, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('bd-110-03', 'BD', 'BD 110 03', '03', 110, 'abanico-preorificio', 1.25, 3.1, 1, 4.1, 0.49,
    rangos([1, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('bd-110-04', 'BD', 'BD 110 04', '04', 110, 'abanico-preorificio', 1.62, 3.1, 1, 4.1, 0.468,
    rangos([1, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('bd-110-05', 'BD', 'BD 110 05', '05', 110, 'abanico-preorificio', 2.07, 3.1, 1, 4.1, 0.485,
    rangos([1, 1.5, 'C'], [1.5, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('bd-110-06', 'BD', 'BD 110 06', '06', 110, 'abanico-preorificio', 2.49, 3.1, 1, 4.1, 0.484,
    rangos([1, 1.5, 'C'], [1.5, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('bd-110-08', 'BD', 'BD 110 08', '08', 110, 'abanico-preorificio', 3.37, 3.1, 1, 4.1, 0.506,
    rangos([1, 1.5, 'C'], [1.5, 2.55, 'M'], [2.55, 4.1, 'F'])),

  // ----- AS7030 (página 28) -----
  mj2('as7030-01', 'AS7030', 'AS7030 01', null, 110, 'abanico-doble', 0.5, 3.1, 2, 5.2, 0.511,
    rangos([2, 2.55, 'C'], [2.55, 3.6, 'M'], [3.6, 5.2, 'F']),
    'El catálogo la rotula 01, pero su caudal se desvía 22.9 % del nominal de ese tamaño (la norma tolera 5 %): va sin tamaño ISO declarado.'),
  mj2('as7030-015', 'AS7030', 'AS7030 015', '015', 110, 'abanico-doble', 0.62, 3.1, 2, 5.2, 0.467,
    rangos([2, 2.55, 'C'], [2.55, 3.6, 'M'], [3.6, 5.2, 'F'])),
  mj2('as7030-02', 'AS7030', 'AS7030 02', '02', 110, 'abanico-doble', 0.82, 3.1, 2, 5.2, 0.318,
    rangos([2, 2.55, 'C'], [2.55, 3.6, 'M'], [3.6, 5.2, 'F'])),
  mj2('as7030-025', 'AS7030', 'AS7030 025', '025', 110, 'abanico-doble', 1.06, 3.1, 2, 5.2, 0.474,
    rangos([2, 2.55, 'C'], [2.55, 3.6, 'M'], [3.6, 5.2, 'F'])),
  mj2('as7030-03', 'AS7030', 'AS7030 03', '03', 110, 'abanico-doble', 1.22, 3.1, 2, 5.2, 0.385,
    rangos([2, 2.55, 'C'], [2.55, 4.65, 'M'], [4.65, 5.2, 'F'])),
  mj2('as7030-04', 'AS7030', 'AS7030 04', '04', 110, 'abanico-doble', 1.66, 3.1, 2, 5.2, 0.483,
    rangos([2, 2.55, 'C'], [2.55, 4.65, 'M'], [4.65, 5.2, 'F'])),
  mj2('as7030-05', 'AS7030', 'AS7030 05', '05', 110, 'abanico-doble', 2.04, 3.1, 2, 5.2, 0.426,
    rangos([2, 2.55, 'C'], [2.55, 4.65, 'M'], [4.65, 5.2, 'F'])),
  mj2('as7030-06', 'AS7030', 'AS7030 06', '06', 110, 'abanico-doble', 2.48, 3.1, 2, 5.2, 0.413,
    rangos([2, 2.55, 'C'], [2.55, 4.65, 'M'], [4.65, 5.2, 'F'])),

  // ----- AS-IA7030 (página 29) -----
  mj2('as-ia7030-015', 'AS-IA7030', 'AS-IA7030 015', '015', 110, 'abanico-doble-induccion', 0.65, 3.4, 2, 7.6, 0.465,
    rangos([2, 2.7, 'XC'], [2.7, 4.1, 'VC'], [4.1, 5.5, 'C'], [5.5, 7.6, 'M'])),
  mj2('as-ia7030-02', 'AS-IA7030', 'AS-IA7030 02', '02', 110, 'abanico-doble-induccion', 0.86, 3.4, 2, 7.6, 0.488,
    rangos([2, 2.7, 'XC'], [2.7, 4.1, 'VC'], [4.1, 5.5, 'C'], [5.5, 7.6, 'M'])),
  mj2('as-ia7030-025', 'AS-IA7030', 'AS-IA7030 025', '025', 110, 'abanico-doble-induccion', 1.07, 3.4, 2, 7.6, 0.473,
    rangos([2, 2.7, 'XC'], [2.7, 4.1, 'VC'], [4.1, 5.5, 'C'], [5.5, 7.6, 'M'])),
  mj2('as-ia7030-03', 'AS-IA7030', 'AS-IA7030 03', '03', 110, 'abanico-doble-induccion', 1.3, 3.4, 2, 7.6, 0.46,
    rangos([2, 4.1, 'XC'], [4.1, 6.9, 'C'], [6.9, 7.6, 'M'])),
  mj2('as-ia7030-04', 'AS-IA7030', 'AS-IA7030 04', '04', 110, 'abanico-doble-induccion', 1.75, 3.4, 2, 7.6, 0.48,
    rangos([2, 4.1, 'XC'], [4.1, 5.5, 'VC'], [5.5, 6.9, 'C'], [6.9, 7.6, 'M'])),
  mj2('as-ia7030-05', 'AS-IA7030', 'AS-IA7030 05', '05', 110, 'abanico-doble-induccion', 2.2, 3.4, 2, 7.6, 0.467,
    rangos([2, 4.1, 'XC'], [4.1, 5.5, 'VC'], [5.5, 6.9, 'C'], [6.9, 7.6, 'M'])),

  // ----- AS-IA (página 30) -----
  mj2('as-ia-01', 'AS-IA', 'AS-IA 01', '01', 110, 'abanico-induccion', 0.39, 2.7, 2.7, 7.6, 0.477,
    []),
  mj2('as-ia-015', 'AS-IA', 'AS-IA 015', '015', 110, 'abanico-induccion', 0.65, 3.4, 2, 7.6, 0.465,
    []),
  mj2('as-ia-02', 'AS-IA', 'AS-IA 02', '02', 110, 'abanico-induccion', 0.86, 3.4, 2, 7.6, 0.488,
    []),
  mj2('as-ia-025', 'AS-IA', 'AS-IA 025', '025', 110, 'abanico-induccion', 1.07, 3.4, 2, 7.6, 0.473,
    []),
  mj2('as-ia-03', 'AS-IA', 'AS-IA 03', '03', 110, 'abanico-induccion', 1.3, 3.4, 2, 7.6, 0.46,
    []),
  mj2('as-ia-04', 'AS-IA', 'AS-IA 04', '04', 110, 'abanico-induccion', 1.75, 3.4, 2, 7.6, 0.48,
    []),
  mj2('as-ia-05', 'AS-IA', 'AS-IA 05', '05', 110, 'abanico-induccion', 2.2, 3.4, 2, 7.6, 0.467,
    []),

  // ----- MD-IA/D (página 31) -----
  mj2('md-ia-d-01', 'MD-IA/D', 'MD-IA/D 01', '01', 110, 'abanico-doble-induccion', 0.43, 3.4, 2, 7.6, 0.419,
    rangos([2, 2.7, 'C'], [2.7, 4.1, 'M'], [4.1, 7.6, 'F'])),
  mj2('md-ia-d-015', 'MD-IA/D', 'MD-IA/D 015', '015', 110, 'abanico-doble-induccion', 0.64, 3.4, 2, 7.6, 0.475,
    rangos([2, 2.7, 'C'], [2.7, 4.1, 'M'], [4.1, 7.6, 'F'])),
  mj2('md-ia-d-02', 'MD-IA/D', 'MD-IA/D 02', '02', 110, 'abanico-doble-induccion', 0.86, 3.4, 2, 7.6, 0.484,
    rangos([2, 2.7, 'C'], [2.7, 4.1, 'M'], [4.1, 7.6, 'F'])),
  mj2('md-ia-d-025', 'MD-IA/D', 'MD-IA/D 025', '025', 110, 'abanico-doble-induccion', 1.09, 3.4, 2, 7.6, 0.474,
    rangos([2, 2.7, 'C'], [2.7, 4.1, 'M'], [4.1, 7.6, 'F'])),
  mj2('md-ia-d-03', 'MD-IA/D', 'MD-IA/D 03', '03', 110, 'abanico-doble-induccion', 1.3, 3.4, 2, 7.6, 0.518,
    rangos([2, 2.7, 'C'], [2.7, 5.5, 'M'], [5.5, 7.6, 'F'])),
  mj2('md-ia-d-04', 'MD-IA/D', 'MD-IA/D 04', '04', 110, 'abanico-doble-induccion', 1.71, 3.4, 2, 7.6, 0.494,
    rangos([2, 2.7, 'C'], [2.7, 5.5, 'M'], [5.5, 7.6, 'F'])),
  mj2('md-ia-d-05', 'MD-IA/D', 'MD-IA/D 05', '05', 110, 'abanico-doble-induccion', 2.13, 3.4, 2, 7.6, 0.497,
    rangos([2, 4.1, 'C'], [4.1, 5.5, 'M'], [5.5, 7.6, 'F'])),

  // ----- MDC (página 32) -----
  mj2('mdc-0-75', 'MDC', 'MDC 0,75', null, 130, 'abanico-impacto', 0.62, 3.1, 1, 3.1, 0.526,
    rangos([1, 1.5, 'M'], [1.5, 3.1, 'F'])),
  mj2('mdc-1', 'MDC', 'MDC 1', null, 130, 'abanico-impacto', 0.84, 3.1, 1, 3.1, 0.526,
    rangos([1, 1.5, 'M'], [1.5, 3.1, 'F'])),
  mj2('mdc-1-5', 'MDC', 'MDC 1,5', null, 130, 'abanico-impacto', 1.24, 3.1, 1, 3.1, 0.503,
    rangos([1, 1.5, 'C'], [1.5, 2.55, 'M'], [2.55, 3.1, 'F'])),
  mj2('mdc-2-5', 'MDC', 'MDC 2,5', null, 130, 'abanico-impacto', 1.98, 3.1, 1, 3.1, 0.439,
    rangos([1, 1.5, 'C'], [1.5, 2.55, 'M'], [2.55, 3.1, 'F'])),
  mj2('mdc-3', 'MDC', 'MDC 3', null, 130, 'abanico-impacto', 2.45, 3.1, 1, 3.1, 0.422,
    rangos([1, 1.5, 'C'], [1.5, 2.55, 'M'], [2.55, 3.1, 'F'])),
  mj2('mdc-4', 'MDC', 'MDC 4', null, 130, 'abanico-impacto', 3.26, 3.1, 1, 3.1, 0.454,
    rangos([1, 1.5, 'C'], [1.5, 2.55, 'M'], [2.55, 3.1, 'F'])),
  mj2('mdc-5', 'MDC', 'MDC 5', null, 130, 'abanico-impacto', 3.97, 3.1, 1, 3.1, 0.463,
    rangos([1, 1.5, 'C'], [1.5, 3.1, 'M'])),
  mj2('mdc-7-5', 'MDC', 'MDC 7,5', null, 130, 'abanico-impacto', 6.24, 3.1, 1, 3.1, 0.496,
    rangos([1, 1.5, 'C'], [1.5, 3.1, 'M'])),

  // ----- TM-IA (página 33) -----
  mj2('tm-ia-0-5', 'TM-IA', 'TM-IA 0,5', null, 150, 'abanico-induccion', 0.62, 3.1, 2, 6.2, 0.517,
    rangos([2, 5.7, 'XC'], [5.7, 6.2, 'VC'])),
  mj2('tm-ia-0-75', 'TM-IA', 'TM-IA 0,75', null, 150, 'abanico-induccion', 0.66, 3.1, 2, 6.2, 0.5,
    rangos([2, 6.2, 'XC'])),
  mj2('tm-ia-1', 'TM-IA', 'TM-IA 1', null, 150, 'abanico-induccion', 0.82, 3.1, 2, 6.2, 0.494,
    rangos([2, 6.2, 'XC'])),
  mj2('tm-ia-1-5', 'TM-IA', 'TM-IA 1,5', null, 150, 'abanico-induccion', 1.12, 3.1, 2, 6.2, 0.512,
    rangos([2, 6.2, 'XC'])),
  mj2('tm-ia-2', 'TM-IA', 'TM-IA 2', null, 150, 'abanico-induccion', 1.6, 3.1, 2, 6.2, 0.486,
    rangos([2, 6.2, 'XC'])),
  mj2('tm-ia-2-5', 'TM-IA', 'TM-IA 2,5', null, 150, 'abanico-induccion', 1.98, 3.1, 2, 6.2, 0.48,
    rangos([2, 6.2, 'XC'])),
  mj2('tm-ia-3', 'TM-IA', 'TM-IA 3', null, 150, 'abanico-induccion', 2.45, 3.1, 2, 6.2, 0.47,
    rangos([2, 6.2, 'XC'])),
  mj2('tm-ia-4', 'TM-IA', 'TM-IA 4', null, 150, 'abanico-induccion', 3.26, 3.1, 2, 6.2, 0.476,
    rangos([2, 6.2, 'XC'])),
  mj2('tm-ia-5', 'TM-IA', 'TM-IA 5', null, 150, 'abanico-induccion', 3.97, 3.1, 2, 6.2, 0.437,
    rangos([2, 6.2, 'XC'])),
  mj2('tmj-7-5', 'TM-IA', 'TMJ 7,5', null, 150, 'abanico-induccion', 6.24, 3.1, 2, 6.2, 0.372,
    rangos([2, 6.2, 'XC'])),

  // ----- PB (página 34) -----
  mj2('pb-01', 'PB', 'PB 01', '01', 60, 'abanico-plano', 0.41, 3.1, 2, 4.1, 0.521,
    rangos([2, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('pb-015', 'PB', 'PB 015', '015', 60, 'abanico-plano', 0.61, 3.1, 2, 4.1, 0.465,
    rangos([2, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('pb-02', 'PB', 'PB 02', '02', 60, 'abanico-plano', 0.82, 3.1, 2, 4.1, 0.504,
    rangos([2, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('pb-03', 'PB', 'PB 03', '03', 60, 'abanico-plano', 1.25, 3.1, 2, 4.1, 0.501,
    rangos([2, 2.55, 'M'], [2.55, 4.1, 'F'])),
  mj2('pb-04', 'PB', 'PB 04', '04', 60, 'abanico-plano', 1.62, 3.1, 2, 4.1, 0.492,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj2('pb-05', 'PB', 'PB 05', '05', 60, 'abanico-plano', 2.07, 3.1, 2, 4.1, 0.497,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),
  mj2('pb-06', 'PB', 'PB 06', '06', 60, 'abanico-plano', 2.5, 3.1, 2, 4.1, 0.452,
    rangos([2, 3.6, 'M'], [3.6, 4.1, 'F'])),

  // ----- PB-IA (página 35) -----
  mj2('pb-ia-01', 'PB-IA', 'PB-IA 01', '01', 60, 'abanico-induccion', 0.38, 2.7, 2.7, 7.6, 0.481,
    rangos([2.7, 3.05, 'XC'], [3.05, 5.5, 'VC'], [5.5, 7.6, 'C'])),
  mj2('pb-ia-015', 'PB-IA', 'PB-IA 015', '015', 60, 'abanico-induccion', 0.65, 3.4, 2, 7.6, 0.492,
    rangos([2, 2.7, 'XC'], [2.7, 6.9, 'VC'], [6.9, 7.6, 'C'])),
  mj2('pb-ia-02', 'PB-IA', 'PB-IA 02', '02', 60, 'abanico-induccion', 0.89, 3.4, 2, 7.6, 0.477,
    rangos([2, 4.1, 'XC'], [4.1, 6.9, 'VC'], [6.9, 7.6, 'C'])),
  mj2('pb-ia-025', 'PB-IA', 'PB-IA 025', '025', 60, 'abanico-induccion', 1.09, 3.4, 2, 7.6, 0.491,
    rangos([2, 4.1, 'XC'], [4.1, 6.9, 'VC'], [6.9, 7.6, 'C'])),
  mj2('pb-ia-03', 'PB-IA', 'PB-IA 03', '03', 60, 'abanico-induccion', 1.33, 3.4, 2, 7.6, 0.499,
    rangos([2, 4.1, 'XC'], [4.1, 7.6, 'VC'])),
  mj2('pb-ia-04', 'PB-IA', 'PB-IA 04', '04', 60, 'abanico-induccion', 1.73, 3.4, 2, 7.6, 0.493,
    rangos([2, 4.1, 'XC'], [4.1, 7.6, 'VC'])),
  mj2('pb-ia-05', 'PB-IA', 'PB-IA 05', '05', 60, 'abanico-induccion', 2.14, 3.4, 2, 7.6, 0.494,
    rangos([2, 5.5, 'XC'], [5.5, 7.6, 'VC'])),

  // ----- MAG (página 36) -----
  mj2('mag-1', 'MAG', 'MAG 1', null, 80, 'cono-hueco', 0.32, 4.1, 4.1, 16.6, 0.447,
    rangos([4.1, 15.55, 'F'], [15.55, 16.6, 'VF'])),
  mj2('mag-1-5', 'MAG', 'MAG 1,5', null, 80, 'cono-hueco', 0.43, 4.1, 4.1, 16.6, 0.461,
    rangos([4.1, 15.55, 'F'], [15.55, 16.6, 'VF'])),
  mj2('mag-2', 'MAG', 'MAG 2', null, 80, 'cono-hueco', 0.64, 4.1, 4.1, 16.6, 0.459,
    rangos([4.1, 16.6, 'F'])),
  mj2('mag-3', 'MAG', 'MAG 3', null, 80, 'cono-hueco', 0.88, 4.1, 4.1, 16.6, 0.459,
    rangos([4.1, 16.6, 'F'])),
  mj2('mag-4', 'MAG', 'MAG 4', null, 80, 'cono-hueco', 1.25, 4.1, 4.1, 16.6, 0.452,
    rangos([4.1, 16.6, 'F'])),
  mj2('mag-5', 'MAG', 'MAG 5', null, 80, 'cono-hueco', 1.6, 4.1, 4.1, 16.6, 0.475,
    rangos([4.1, 16.6, 'F'])),

  // ----- X (página 37) -----
  mj2('x-1', 'X', 'X 1', null, 85, 'cono-hueco', 0.13, 5.5, 5.5, 13.8, 0.382,
    rangos([5.5, 13.8, 'VF'])),
  mj2('x-2', 'X', 'X 2', null, 85, 'cono-hueco', 0.17, 5.5, 5.5, 13.8, 0.494,
    rangos([5.5, 13.8, 'VF'])),
  mj2('x-3', 'X', 'X 3', null, 85, 'cono-hueco', 0.26, 5.5, 5.5, 13.8, 0.503,
    rangos([5.5, 6.2, 'F'], [6.2, 13.8, 'VF'])),

  // ----- MGA (página 38) -----
  mj2('mga-90-005', 'MGA', 'MGA 90 005', '0050', 90, 'cono-hueco', 0.19, 2.7, 2.7, 10.4, 0.442,
    rangos([2.7, 10.4, 'VF'])),
  mj2('mga-90-0067', 'MGA', 'MGA 90 0067', '0067', 90, 'cono-hueco', 0.25, 2.7, 2.7, 10.4, 0.461,
    rangos([2.7, 10.4, 'VF'])),
  mj2('mga-90-01', 'MGA', 'MGA 90 01', '01', 90, 'cono-hueco', 0.39, 2.7, 2.7, 10.4, 0.423,
    rangos([2.7, 10.4, 'VF'])),
  mj2('mga-90-015', 'MGA', 'MGA 90 015', '015', 90, 'cono-hueco', 0.57, 2.7, 2.7, 10.4, 0.466,
    rangos([2.7, 10.4, 'VF'])),
  mj2('mga-90-02', 'MGA', 'MGA 90 02', '02', 90, 'cono-hueco', 0.75, 2.7, 2.7, 10.4, 0.482,
    rangos([2.7, 3.25, 'F'], [3.25, 10.4, 'VF'])),
  mj2('mga-90-025', 'MGA', 'MGA 90 025', '025', 90, 'cono-hueco', 0.95, 2.7, 2.7, 10.4, 0.479,
    rangos([2.7, 3.25, 'F'], [3.25, 10.4, 'VF'])),
  mj2('mga-90-03', 'MGA', 'MGA 90 03', '03', 90, 'cono-hueco', 1.15, 2.7, 2.7, 10.4, 0.476,
    rangos([2.7, 4.3, 'F'], [4.3, 10.4, 'VF'])),
  mj2('mga-90-035', 'MGA', 'MGA 90 035', '035', 90, 'cono-hueco', 1.3, 2.7, 2.7, 10.4, 0.514,
    rangos([2.7, 4.3, 'F'], [4.3, 10.4, 'VF'])),
  mj2('mga-90-04', 'MGA', 'MGA 90 04', null, 90, 'cono-hueco', 1.61, 2.7, 2.7, 10.4, 0.483,
    rangos([2.7, 5.85, 'F'], [5.85, 10.4, 'VF']),
    'El catálogo la rotula 04, pero su caudal se desvía 5.9 % del nominal de ese tamaño (la norma tolera 5 %): va sin tamaño ISO declarado.'),
  mj2('mga-90-05', 'MGA', 'MGA 90 05', '05', 90, 'cono-hueco', 1.96, 2.7, 2.7, 10.4, 0.464,
    rangos([2.7, 8.65, 'F'], [8.65, 10.4, 'VF'])),
  mj2('mga-90-06', 'MGA', 'MGA 90 06', '06', 90, 'cono-hueco', 2.34, 2.7, 2.7, 10.4, 0.465,
    rangos([2.7, 8.65, 'F'], [8.65, 10.4, 'VF'])),

  // ----- BX-AP/70 (página 42) -----
  mj2('bx-ap-70-01', 'BX-AP/70', 'BX-AP/70 01', '01', 70, 'cono-hueco', 0.4, 3.1, 3.1, 8.3, 0.538,
    rangos([3.1, 6.2, 'F'], [6.2, 8.3, 'VF'])),
  mj2('bx-ap-70-015', 'BX-AP/70', 'BX-AP/70 015', '015', 70, 'cono-hueco', 0.6, 3.1, 3.1, 8.3, 0.472,
    rangos([3.1, 6.2, 'F'], [6.2, 8.3, 'VF'])),
  mj2('bx-ap-70-02', 'BX-AP/70', 'BX-AP/70 02', '02', 70, 'cono-hueco', 0.8, 3.1, 3.1, 8.3, 0.464,
    rangos([3.1, 7.6, 'F'], [7.6, 8.3, 'VF'])),
  mj2('bx-ap-70-025', 'BX-AP/70', 'BX-AP/70 025', '025', 70, 'cono-hueco', 1, 3.1, 3.1, 8.3, 0.449,
    rangos([3.1, 7.6, 'F'], [7.6, 8.3, 'VF'])),
  mj2('bx-ap-70-03', 'BX-AP/70', 'BX-AP/70 03', '03', 70, 'cono-hueco', 1.2, 3.1, 3.1, 8.3, 0.449,
    rangos([3.1, 7.6, 'F'], [7.6, 8.3, 'VF'])),
  mj2('bx-ap-70-035', 'BX-AP/70', 'BX-AP/70 035', '035', 70, 'cono-hueco', 1.4, 3.1, 3.1, 8.3, 0.467,
    rangos([3.1, 7.6, 'F'], [7.6, 8.3, 'VF'])),
  mj2('bx-ap-70-04', 'BX-AP/70', 'BX-AP/70 04', '04', 70, 'cono-hueco', 1.6, 3.1, 3.1, 8.3, 0.465,
    rangos([3.1, 8.3, 'F'])),
  mj2('bx-ap-70-05', 'BX-AP/70', 'BX-AP/70 05', '05', 70, 'cono-hueco', 2, 3.1, 3.1, 8.3, 0.486,
    rangos([3.1, 8.3, 'F'])),

  // ----- CV-IA (página 44) -----
  mj2('cv-ia-01', 'CV-IA', 'CV-IA 01', null, 100, 'cono-hueco-induccion', 0.43, 3.1, 3.1, 10.4, 0.474,
    rangos([3.1, 6.2, 'XC'], [6.2, 9.35, 'VC'], [9.35, 10.4, 'C']),
    'El catálogo la rotula 01, pero su caudal se desvía 5.8 % del nominal de ese tamaño (la norma tolera 5 %): va sin tamaño ISO declarado.'),
  mj2('cv-ia-015', 'CV-IA', 'CV-IA 015', '015', 100, 'cono-hueco-induccion', 0.62, 3.1, 3.1, 10.4, 0.473,
    rangos([3.1, 6.2, 'XC'], [6.2, 9.35, 'VC'], [9.35, 10.4, 'C'])),
  mj2('cv-ia-02', 'CV-IA', 'CV-IA 02', '02', 100, 'cono-hueco-induccion', 0.78, 3.1, 3.1, 10.4, 0.483,
    rangos([3.1, 6.2, 'XC'], [6.2, 9.35, 'VC'], [9.35, 10.4, 'C'])),
  mj2('cv-ia-025', 'CV-IA', 'CV-IA 025', '025', 100, 'cono-hueco-induccion', 1.04, 3.1, 3.1, 10.4, 0.528,
    rangos([3.1, 6.2, 'XC'], [6.2, 10.4, 'VC'])),
  mj2('cv-ia-03', 'CV-IA', 'CV-IA 03', '03', 100, 'cono-hueco-induccion', 1.22, 3.1, 3.1, 10.4, 0.52,
    rangos([3.1, 6.2, 'XC'], [6.2, 10.4, 'VC'])),
  mj2('cv-ia-04', 'CV-IA', 'CV-IA 04', '04', 100, 'cono-hueco-induccion', 1.56, 3.1, 3.1, 10.4, 0.504,
    rangos([3.1, 6.2, 'XC'], [6.2, 10.4, 'VC'])),
  mj2('cv-ia-05', 'CV-IA', 'CV-IA 05', '05', 100, 'cono-hueco-induccion', 2, 3.1, 3.1, 10.4, 0.505,
    rangos([3.1, 7.6, 'XC'], [7.6, 10.4, 'VC'])),

  // ----- MAG CH (página 45) -----
  mj2('mag-ch-0-5', 'MAG CH', 'MAG CH 0,5', null, 80, 'cono-lleno', 0.56, 3.4, 3.4, 10.4, 0.466,
    rangos([3.4, 6.9, 'F'], [6.9, 10.4, 'VF'])),
  mj2('mag-ch-0-75', 'MAG CH', 'MAG CH 0,75', null, 80, 'cono-lleno', 0.75, 3.4, 3.4, 10.4, 0.486,
    rangos([3.4, 8.3, 'F'], [8.3, 10.4, 'VF'])),
  mj2('mag-ch-1', 'MAG CH', 'MAG CH 1', null, 80, 'cono-lleno', 1, 3.4, 3.4, 10.4, 0.493,
    rangos([3.4, 9.7, 'F'], [9.7, 10.4, 'VF'])),
  mj2('mag-ch-2', 'MAG CH', 'MAG CH 2', null, 80, 'cono-lleno', 1.28, 3.4, 3.4, 10.4, 0.482,
    rangos([3.4, 9.7, 'F'], [9.7, 10.4, 'VF'])),
  mj2('mag-ch-3', 'MAG CH', 'MAG CH 3', null, 80, 'cono-lleno', 1.5, 3.4, 3.4, 10.4, 0.477,
    rangos([3.4, 10.4, 'F'])),
  mj2('mag-ch-4', 'MAG CH', 'MAG CH 4', null, 80, 'cono-lleno', 1.94, 3.4, 3.4, 10.4, 0.455,
    rangos([3.4, 4.1, 'M'], [4.1, 10.4, 'F'])),
  mj2('mag-ch-5', 'MAG CH', 'MAG CH 5', null, 80, 'cono-lleno', 2.13, 3.4, 3.4, 10.4, 0.518,
    rangos([3.4, 4.1, 'M'], [4.1, 10.4, 'F'])),
  mj2('mag-ch-6', 'MAG CH', 'MAG CH 6', null, 80, 'cono-lleno', 2.4, 3.4, 3.4, 10.4, 0.482,
    rangos([3.4, 4.1, 'M'], [4.1, 10.4, 'F'])),

  // ----- CH 100 (página 46) -----
  mj2('ch-100-1', 'CH 100', 'CH 100 1', null, 100, 'cono-lleno', 0.6, 2.7, 2, 6.9, 0.485,
    rangos([2, 3.05, 'C'], [3.05, 6.2, 'M'], [6.2, 6.9, 'F'])),
  mj2('ch-100-1-5', 'CH 100', 'CH 100 1,5', null, 100, 'cono-lleno', 0.7, 2.7, 2, 6.9, 0.53,
    rangos([2, 3.75, 'C'], [3.75, 6.2, 'M'], [6.2, 6.9, 'F'])),
  mj2('ch-100-2', 'CH 100', 'CH 100 2', null, 100, 'cono-lleno', 0.88, 2.7, 2, 6.9, 0.473,
    rangos([2, 4.8, 'C'], [4.8, 6.9, 'M'])),
  mj2('ch-100-3', 'CH 100', 'CH 100 3', null, 100, 'cono-lleno', 1.08, 2.7, 2, 6.9, 0.485,
    rangos([2, 2.35, 'VC'], [2.35, 4.8, 'C'], [4.8, 6.9, 'M'])),
  mj2('ch-100-4', 'CH 100', 'CH 100 4', null, 100, 'cono-lleno', 1.45, 2.7, 2, 6.9, 0.46,
    rangos([2, 2.35, 'VC'], [2.35, 4.8, 'C'], [4.8, 6.9, 'M'])),
  mj2('ch-100-5', 'CH 100', 'CH 100 5', null, 100, 'cono-lleno', 1.81, 2.7, 2, 6.9, 0.442,
    rangos([2, 2.35, 'VC'], [2.35, 6.2, 'C'], [6.2, 6.9, 'M'])),
  mj2('ch-100-8', 'CH 100', 'CH 100 8', null, 100, 'cono-lleno', 2.84, 2.7, 2, 6.9, 0.468,
    rangos([2, 3.05, 'VC'], [3.05, 6.2, 'C'], [6.2, 6.9, 'M'])),
);

// Series que el catalogo publica en mas de un angulo con UNA sola tabla de
// caudal y de clase de gota: entre una y otra solo cambia el codigo de
// pieza. Se derivan de la ficha del angulo base en vez de retranscribir
// sus numeros, igual que las AD-IA de 80 grados, para que no puedan
// separarse si manana se corrige la tabla.
const MJ_OTROS_ANGULOS = [
  // ST-IA en 140 grados (página 18). La ST-IA 005 solo existe en 140, y
  // es una de las tres fichas que la ley presión-caudal no reproduce:
  // por eso no tiene par aquí.
  ['stia-01', 'stia140-01', 'ST-IA 140 01', 140],
  ['stia-015', 'stia140-015', 'ST-IA 140 015', 140],
  ['stia-02', 'stia140-02', 'ST-IA 140 02', 140],
  ['stia-025', 'stia140-025', 'ST-IA 140 025', 140],
  ['stia-03', 'stia140-03', 'ST-IA 140 03', 140],
  ['stia-04', 'stia140-04', 'ST-IA 140 04', 140],
  // APS en 60 grados (página 14).
  ['aps-30-02', 'aps-60-02', 'APS 60 02', 60],
  ['aps-30-03', 'aps-60-03', 'APS 60 03', 60],
  ['aps-30-04', 'aps-60-04', 'APS 60 04', 60],
  // BD en 80 grados (página 27).
  ['bd-110-01', 'bd-80-01', 'BD 80 01', 80],
  ['bd-110-015', 'bd-80-015', 'BD 80 015', 80],
  ['bd-110-02', 'bd-80-02', 'BD 80 02', 80],
  ['bd-110-025', 'bd-80-025', 'BD 80 025', 80],
  ['bd-110-03', 'bd-80-03', 'BD 80 03', 80],
  ['bd-110-04', 'bd-80-04', 'BD 80 04', 80],
  ['bd-110-05', 'bd-80-05', 'BD 80 05', 80],
  ['bd-110-06', 'bd-80-06', 'BD 80 06', 80],
  ['bd-110-08', 'bd-80-08', 'BD 80 08', 80],
  // MGA en 60 grados (página 40).
  ['mga-90-0067', 'mga-60-0067', 'MGA 60 0067', 60],
  ['mga-90-01', 'mga-60-01', 'MGA 60 01', 60],
  ['mga-90-015', 'mga-60-015', 'MGA 60 015', 60],
  ['mga-90-02', 'mga-60-02', 'MGA 60 02', 60],
  ['mga-90-025', 'mga-60-025', 'MGA 60 025', 60],
  ['mga-90-03', 'mga-60-03', 'MGA 60 03', 60],
  ['mga-90-035', 'mga-60-035', 'MGA 60 035', 60],
  ['mga-90-04', 'mga-60-04', 'MGA 60 04', 60],
  ['mga-90-05', 'mga-60-05', 'MGA 60 05', 60],
  ['mga-90-06', 'mga-60-06', 'MGA 60 06', 60],
  // MGA en 40 grados (página 41).
  ['mga-90-01', 'mga-40-01', 'MGA 40 01', 40],
  ['mga-90-015', 'mga-40-015', 'MGA 40 015', 40],
  ['mga-90-02', 'mga-40-02', 'MGA 40 02', 40],
  ['mga-90-025', 'mga-40-025', 'MGA 40 025', 40],
  ['mga-90-03', 'mga-40-03', 'MGA 40 03', 40],
  ['mga-90-035', 'mga-40-035', 'MGA 40 035', 40],
  ['mga-90-04', 'mga-40-04', 'MGA 40 04', 40],
  ['mga-90-05', 'mga-40-05', 'MGA 40 05', 40],
  // BX-AP/70 en 90 grados (página 43).
  ['bx-ap-70-01', 'bx-ap-90-01', 'BX-AP/90 01', 90, 'BX-AP/90'],
  ['bx-ap-70-015', 'bx-ap-90-015', 'BX-AP/90 015', 90, 'BX-AP/90'],
  ['bx-ap-70-02', 'bx-ap-90-02', 'BX-AP/90 02', 90, 'BX-AP/90'],
  ['bx-ap-70-025', 'bx-ap-90-025', 'BX-AP/90 025', 90, 'BX-AP/90'],
  ['bx-ap-70-03', 'bx-ap-90-03', 'BX-AP/90 03', 90, 'BX-AP/90'],
  ['bx-ap-70-035', 'bx-ap-90-035', 'BX-AP/90 035', 90, 'BX-AP/90'],
  ['bx-ap-70-04', 'bx-ap-90-04', 'BX-AP/90 04', 90, 'BX-AP/90'],
  ['bx-ap-70-05', 'bx-ap-90-05', 'BX-AP/90 05', 90, 'BX-AP/90'],
];

const NOTA_OTRO_ANGULO =
  'El catálogo publica una sola tabla de caudal y de clase de gota para los dos ángulos de este ' +
  'tamaño: lo que cambia entre uno y otro es el código de pieza.';

CATALOGO_SIEMBRA.push(
  ...MJ_OTROS_ANGULOS.map(([idBase, idNuevo, modelo, anguloGrados, serie]) => {
    const base = CATALOGO_SIEMBRA.find((b) => b.id === `mj-${idBase}`);
    return {
      ...base,
      id: `mj-${idNuevo}`,
      serie: serie ?? base.serie,
      modelo,
      anguloGrados,
      clasesGota: base.clasesGota.map((r) => ({ ...r })),
      notas: `${base.notas} ${NOTA_OTRO_ANGULO}`,
    };
  })
);

export const TIPOS_PATRON = [
  'abanico-plano',
  'abanico-preorificio',
  'abanico-induccion',
  'abanico-impacto',
  'abanico-doble',
  'abanico-doble-induccion',
  'abanico-triple',
  'abanico-triple-induccion',
  'cono-lleno',
  'cono-hueco',
  'cono-hueco-induccion',
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
