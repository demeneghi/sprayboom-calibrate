// Herramienta SOLO de desarrollo: corrige la ortografia espanola de los
// TEXTOS VISIBLES (literales de cadena que contienen espacios) sin
// tocar identificadores, clases CSS, codigos kebab-case ni rutas.
//
// Reglas de seguridad:
// - Solo se procesan literales '...', "..." y `...` que contengan al
//   menos un espacio (los codigos y clases no llevan espacios).
// - Dentro de plantillas, los tramos ${...} se dejan intactos.
// - Diccionario de palabras con limite de palabra + frases exactas para
//   los casos ambiguos (verbos en pasado, "esta" vs "está").
//
// Uso: node tools/acentuar.mjs archivo1.js archivo2.js ...
import { readFileSync, writeFileSync } from 'node:fs';

const FRASES = [
  ['no se importo nada', 'no se importó nada'],
  ['no se calibro nada', 'no se calibró nada'],
  ['no se calculo nada', 'no se calculó nada'],
  ['se obtuvo', 'se obtuvo'],
  [' esta en ', ' está en '],
  [' esta PENDIENTE', ' está PENDIENTE'],
  [' esta pendiente', ' está pendiente'],
  [' esta anulada', ' está anulada'],
  [' esta llena', ' está llena'],
  [' esta vacia', ' está vacía'],
  ['ya esta ', 'ya está '],
  ['Estas operando', 'Estás operando'],
  ['no esta ', 'no está '],
  ['Aqui ', 'Aquí '],
  [' aqui', ' aquí'],
];

const PALABRAS = {
  numero: 'número', numeros: 'números', presion: 'presión', regimen: 'régimen',
  regimenes: 'regímenes', Regimen: 'Régimen', calculo: 'cálculo', calculos: 'cálculos',
  aplicacion: 'aplicación', calibracion: 'calibración', configuracion: 'configuración',
  Configuracion: 'Configuración', medicion: 'medición', estimacion: 'estimación',
  ESTIMACION: 'ESTIMACIÓN', importacion: 'importación', Importacion: 'Importación',
  exportacion: 'exportación', validacion: 'validación', verificacion: 'verificación',
  navegacion: 'navegación', seccion: 'sección', aspersion: 'aspersión',
  percolacion: 'percolación', extrapolacion: 'extrapolación', clasificacion: 'clasificación',
  edicion: 'edición', version: 'versión', Version: 'Versión', conversion: 'conversión',
  retencion: 'retención', solucion: 'solución', tambien: 'también', jamas: 'jamás',
  mas: 'más', alla: 'allá', asi: 'así', dia: 'día', dias: 'días', unico: 'único',
  unica: 'única', ultimo: 'último', ultima: 'última', minimo: 'mínimo', minima: 'mínima',
  maximo: 'máximo', maxima: 'máxima', teorica: 'teórica', teorico: 'teórico',
  TEORICA: 'TEÓRICA', teoricas: 'teóricas', teoricos: 'teóricos', practica: 'práctica',
  fisica: 'física', metodo: 'método', metodos: 'métodos', formula: 'fórmula',
  formulas: 'fórmulas', parametro: 'parámetro', parametros: 'parámetros',
  Parametros: 'Parámetros', codigo: 'código', codigos: 'códigos', estandar: 'estándar',
  Estandar: 'Estándar', estandares: 'estándares', hectarea: 'hectárea',
  hectareas: 'hectáreas', Hectareas: 'Hectáreas', area: 'área', Area: 'Área',
  atipica: 'atípica', atipicas: 'atípicas', ATIPICAS: 'ATÍPICAS', tipico: 'típico',
  tipica: 'típica', grafico: 'gráfico', util: 'útil',
  pestana: 'pestaña', pestanas: 'pestañas', Pestana: 'Pestaña', Pestanas: 'Pestañas', tamano: 'tamaño',
  tamanos: 'tamaños', Tamano: 'Tamaño', senal: 'señal', pina: 'piña', diseno: 'diseño',
  dano: 'daño', espanol: 'español', trafico: 'tráfico', purpura: 'púrpura',
  marron: 'marrón', Marron: 'Marrón', segun: 'según', despues: 'después',
  quimica: 'química', quimico: 'químico', standar: 'estándar', metrico: 'métrico',
  Metrico: 'Métrico', metricas: 'métricas', automatico: 'automático',
  Automatico: 'Automático', automatica: 'automática', Bitacora: 'Bitácora',
  bitacora: 'bitácora', catalogo: 'catálogo', Catalogo: 'Catálogo', CATALOGO: 'CATÁLOGO',
  Metodologia: 'Metodología', metodologia: 'metodología', rotametro: 'rotámetro',
  rotametros: 'rotámetros', Rotametro: 'Rotámetro', Rotametros: 'Rotámetros',
  manometro: 'manómetro', manometrica: 'manométrica', tacometro: 'tacómetro',
  cronometro: 'cronómetro', Cronometro: 'Cronómetro', etileno: 'etileno',
  atmosferica: 'atmosférica', ATMOSFERICA: 'ATMOSFÉRICA', hidraulica: 'hidráulica',
  hidraulicas: 'hidráulicas', hidraulico: 'hidráulico', Hidraulico: 'Hidráulico',
  centrifuga: 'centrífuga', Centrifuga: 'Centrífuga', cilindricas: 'cilíndricas',
  ceramica: 'cerámica', polimero: 'polímero', genericas: 'genéricas',
  induccion: 'inducción', molecular: 'molecular', cubico: 'cúbico', cubicos: 'cúbicos',
  historica: 'histórica', historicos: 'históricos', agronomica: 'agronómica',
  agronomicos: 'agronómicos', geometria: 'geometría', Geometria: 'Geometría',
  energia: 'energía', bateria: 'batería', tuberia: 'tubería', averia: 'avería',
  todavia: 'todavía', literatura: 'literatura', extension: 'extensión',
  proposito: 'propósito', sintoma: 'síntoma', capitulo: 'capítulo',
  deposito: 'depósito', proximo: 'próximo', practicas: 'prácticas',
  persistio: 'persistió',
  fallo: 'falló',
  desviacion: 'desviación', Desviacion: 'Desviación', relacion: 'relación',
  Relacion: 'Relación', interpolacion: 'interpolación', informacion: 'información',
  proporcion: 'proporción', razon: 'razón', Razon: 'Razón', duracion: 'duración',
  resolucion: 'resolución', Resolucion: 'Resolución', correccion: 'corrección',
  Correccion: 'Corrección', seleccion: 'selección', Seleccion: 'Selección',
  concentracion: 'concentración', Concentracion: 'Concentración',
  descripcion: 'descripción', precision: 'precisión', Presion: 'Presión',
  Numero: 'Número', Medicion: 'Medición', sistemicos: 'sistémicos',
  exigiria: 'exigiría', Calculo: 'Cálculo', Formula: 'Fórmula', Metodo: 'Método',
  Codigo: 'Código', Edicion: 'Edición', Tecnica: 'Técnica', posicion: 'posición',
  operacion: 'operación', Operacion: 'Operación', reduccion: 'reducción',
  derivacion: 'derivación', Derivacion: 'Derivación', ecuacion: 'ecuación',
  Ecuacion: 'Ecuación', anulacion: 'anulación', Anulacion: 'Anulación',
  restauracion: 'restauración', condicion: 'condición', deteccion: 'detección',
};

const REGEX_PALABRAS = new RegExp(
  `\\b(${Object.keys(PALABRAS).filter((p) => PALABRAS[p] !== p).join('|')})\\b`,
  'g'
);

function acentuarTexto(texto) {
  let resultado = texto;
  for (const [de, a] of FRASES) {
    resultado = resultado.split(de).join(a);
  }
  resultado = resultado.replace(REGEX_PALABRAS, (palabra) => PALABRAS[palabra] ?? palabra);
  return resultado;
}

// Procesa un literal de plantilla saltando los tramos ${...}
function acentuarPlantilla(cuerpo) {
  let resultado = '';
  let i = 0;
  while (i < cuerpo.length) {
    const inicio = cuerpo.indexOf('${', i);
    if (inicio === -1) {
      resultado += acentuarTexto(cuerpo.slice(i));
      break;
    }
    resultado += acentuarTexto(cuerpo.slice(i, inicio));
    let profundidad = 1;
    let j = inicio + 2;
    while (j < cuerpo.length && profundidad > 0) {
      if (cuerpo[j] === '{') profundidad += 1;
      else if (cuerpo[j] === '}') profundidad -= 1;
      j += 1;
    }
    resultado += cuerpo.slice(inicio, j);
    i = j;
  }
  return resultado;
}

function procesarArchivo(ruta) {
  const original = readFileSync(ruta, 'utf8');
  // Literales: comilla simple, doble o de plantilla, con escapes.
  const regexLiteral = /('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)/g;
  const nuevo = original.replace(regexLiteral, (literal) => {
    const delimitador = literal[0];
    const cuerpo = literal.slice(1, -1);
    if (!cuerpo.includes(' ')) return literal; // codigos, clases, rutas
    const acentuado = delimitador === '`' ? acentuarPlantilla(cuerpo) : acentuarTexto(cuerpo);
    return delimitador + acentuado + delimitador;
  });
  if (nuevo !== original) {
    writeFileSync(ruta, nuevo);
    console.log('acentuado:', ruta);
  }
}

for (const ruta of process.argv.slice(2)) {
  procesarArchivo(ruta);
}
