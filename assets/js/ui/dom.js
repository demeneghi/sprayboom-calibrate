// Construccion de nodos DOM sin innerHTML. Regla del proyecto: ningun
// dato capturado por el usuario pasa por innerHTML; todo texto entra
// por textContent (createTextNode) y los atributos por setAttribute.

export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'clase') {
      nodo.className = valor;
    } else if (clave === 'dataset') {
      for (const [k, v] of Object.entries(valor)) nodo.dataset[k] = v;
    } else if (clave === 'estilo') {
      for (const [k, v] of Object.entries(valor)) nodo.style[k] = v;
    } else if (clave === 'alClic') {
      nodo.addEventListener('click', valor);
    } else if (clave === 'alCambiar') {
      nodo.addEventListener('change', valor);
    } else if (clave === 'alEntrada') {
      nodo.addEventListener('input', valor);
    } else if (clave === 'for') {
      nodo.setAttribute('for', valor);
    } else if (valor === true) {
      nodo.setAttribute(clave, '');
    } else {
      nodo.setAttribute(clave, String(valor));
    }
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

export function limpiar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

export function reemplazar(nodo, ...hijos) {
  limpiar(nodo);
  nodo.append(...hijos.flat(Infinity).filter(Boolean));
  return nodo;
}
