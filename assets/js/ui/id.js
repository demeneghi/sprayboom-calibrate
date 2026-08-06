// Identificador de un registro guardado (bitacora, prueba de captura,
// ficha del catalogo, tractor, barra).
//
// Vive aqui porque habia SEIS generadores repartidos por las pestañas: uno
// por pantalla que guarda algo, cinco de ellos con `Date.now()` mas seis
// digitos de `Math.random()` y solo el de la prueba de captura usando
// `crypto.randomUUID`. El id es la clave con la que se borra un registro
// de la lista y con la que se deduplica al importar, asi que dos registros
// con el mismo id se borrarian juntos; con 30 bits de entropia sobre el
// mismo milisegundo la colision es improbable, no imposible.
//
// No es un uso de seguridad: no hay token, ni sesion, ni credencial. El
// valor de tenerlo en un solo sitio es que se lee una vez y se deja de
// dudar si alguno de los seis importaba.
export function idRegistro(prefijo) {
  if (globalThis.crypto?.randomUUID) return `${prefijo}-${globalThis.crypto.randomUUID()}`;
  // Sin crypto (navegador viejo o contexto no seguro): el respaldo de
  // siempre, que basta para un registro local.
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
