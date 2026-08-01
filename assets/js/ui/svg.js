// Ayudantes de SVG: construccion de nodos y conversion de un toque a
// coordenadas del dibujo.
//
// Viven aqui, y no dentro de la pestana que dibuja, porque son
// genericos: cualquier instrumento —el tubo del rotametro, el
// manometro, el que venga— los necesita igual. Cuando estaban privados
// dentro de `tabs/gas.js` una segunda rama no pudo verlos, escribio su
// propia version con otra firma y eso produjo un conflicto de merge que
// hubo que resolver a mano.
//
// El color NO se escribe aqui: cada nodo lleva su clase y el bloque
// `.instrumento*` de components.css lo pinta con tokens del tema. Por
// eso `textoSvg` recibe `clase` y no `color`, `tamano` ni `peso`.
//
// El texto entra por textContent, igual que en dom.js: nada pasa por
// innerHTML.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Nodo SVG con atributos. Los valores null/undefined se omiten, asi el
// llamador puede pasar un atributo opcional sin ramificar.
export function nodoSvg(nombre, atributos = {}) {
  const nodo = document.createElementNS(SVG_NS, nombre);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined) continue;
    nodo.setAttribute(clave, String(valor));
  }
  return nodo;
}

export function textoSvg(x, y, contenido, opciones = {}) {
  const { clase = 'instrumento__numero', anclaje = 'start', giro = null } = opciones;
  const nodo = nodoSvg('text', {
    x,
    y,
    class: clase,
    'text-anchor': anclaje,
    transform: giro,
  });
  nodo.textContent = contenido;
  return nodo;
}

export function lineaSvg(clase, x1, y1, x2, y2) {
  return nodoSvg('line', { class: clase, x1, y1, x2, y2 });
}

export function poligonoSvg(clase, puntos) {
  return nodoSvg('polygon', {
    class: clase,
    points: puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
  });
}

// Toque sobre el dibujo: convierte la posicion del evento en
// coordenadas del viewBox. El SVG se escala con la tarjeta, asi que la
// conversion pasa por el ancho real del nodo (el viewBox conserva la
// proporcion). Regresa null si el nodo todavia no tiene ancho medible.
export function puntoEnSvg(svg, evento, anchoViewBox) {
  const caja = svg.getBoundingClientRect();
  if (!(caja.width > 0)) return null;
  const factor = anchoViewBox / caja.width;
  return { x: (evento.clientX - caja.left) * factor, y: (evento.clientY - caja.top) * factor };
}

// ---------------------------------------------------------------------
// Iconos de trazo
//
// Las flechas y los signos + y − van DIBUJADOS, no como caracter: el
// subconjunto latino de las fuentes autohospedadas no los trae, asi que
// un caracter caeria en la fuente del sistema —o en un recuadro vacio— y
// cambiaria de tamano entre telefonos. Es la misma razon por la que el
// boton de unidades dibuja sus dos flechas.
// ---------------------------------------------------------------------
const CAMINOS_ICONO = {
  'flecha-izquierda': ['M15 5l-7 7 7 7'],
  'flecha-derecha': ['M9 5l7 7-7 7'],
  menos: ['M6 12h12'],
  mas: ['M6 12h12', 'M12 6v12'],
};

export function iconoSvg(nombre, { tamano = 18 } = {}) {
  const caminos = CAMINOS_ICONO[nombre];
  if (!caminos) throw new Error(`Icono desconocido: ${nombre}`);
  const svg = nodoSvg('svg', {
    viewBox: '0 0 24 24',
    width: tamano,
    height: tamano,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  for (const d of caminos) svg.append(nodoSvg('path', { d }));
  return svg;
}
