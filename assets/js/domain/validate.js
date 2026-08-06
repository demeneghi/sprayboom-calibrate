// Validacion contra cotas y guardas de calculo.
//
// La MISMA funcion valida un valor capturado en un formulario y un valor
// que llega por importacion de JSON: el criterio de aceptacion exige que
// ambos caminos produzcan el mismo mensaje, asi que solo existe esta
// implementacion.

// def: { etiqueta, unidad, min, max, entero?, opcional? }
// Regresa { ok: true } o { ok: false, mensaje }.
export function validarValor(def, valor) {
  const etiqueta = def.etiqueta || 'Valor';
  const unidad = def.unidad ? ` ${def.unidad}` : '';

  if (valor === null || valor === undefined || valor === '') {
    if (def.opcional) return { ok: true };
    return { ok: false, mensaje: `${etiqueta}: es obligatorio.` };
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) {
    return { ok: false, mensaje: `${etiqueta}: debe ser un número.` };
  }
  if (def.entero && !Number.isInteger(numero)) {
    return { ok: false, mensaje: `${etiqueta}: debe ser un número entero.` };
  }
  if (numero < def.min || numero > def.max) {
    return {
      ok: false,
      mensaje: `${etiqueta}: debe estar entre ${def.min} y ${def.max}${unidad}.`,
    };
  }
  // numero: el valor ya normalizado a Number, para que la importacion y
  // los formularios guarden numeros y no cadenas.
  return { ok: true, numero };
}

// Valida un objeto contra un mapa de definiciones { campo: def }.
// Regresa { ok, errores: [{ campo, mensaje }] }.
export function validarObjeto(defs, objeto) {
  const errores = [];
  for (const [campo, def] of Object.entries(defs)) {
    const resultado = validarValor(def, objeto ? objeto[campo] : undefined);
    if (!resultado.ok) errores.push({ campo, mensaje: resultado.mensaje });
  }
  return { ok: errores.length === 0, errores };
}

// Guardas de calculo: las funciones de dominio truenan con mensaje claro
// en vez de regresar Infinity o NaN. La interfaz atrapa el error y lo
// muestra como estado neutro con el mensaje.

// Error cuyo mensaje esta REDACTADO para quien calibra: «la velocidad debe
// ser mayor que cero» se muestra tal cual y dice que hacer.
//
// Existe para separarlo de lo que NO es de dominio. El mismo canal de la
// interfaz mostraba los dos, asi que un defecto interno llegaba a la
// pantalla como «Cannot read properties of null (reading 'replace')»: en
// ingles, en medio de una pantalla en español, y sin decir si el problema
// era del dato capturado o de la aplicacion. Son dos acciones distintas
// —corregir la captura contra reportar el error— y ahora se distinguen.
export class ErrorDeDominio extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorDeDominio';
  }
}

export function requiereFinito(nombre, valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorDeDominio(`No se puede calcular: ${nombre} debe ser un número.`);
  }
  return valor;
}

export function requierePositivo(nombre, valor) {
  requiereFinito(nombre, valor);
  if (valor <= 0) {
    throw new ErrorDeDominio(`No se puede calcular: ${nombre} debe ser mayor que cero.`);
  }
  return valor;
}

export function requiereNoNegativo(nombre, valor) {
  requiereFinito(nombre, valor);
  if (valor < 0) {
    throw new ErrorDeDominio(`No se puede calcular: ${nombre} no puede ser negativo.`);
  }
  return valor;
}

// Constructor uniforme de avisos del dominio.
// tipo: 'info' | 'advertencia' | 'error'
export function aviso(tipo, codigo, mensaje, datos = null) {
  return datos === null ? { tipo, codigo, mensaje } : { tipo, codigo, mensaje, datos };
}
