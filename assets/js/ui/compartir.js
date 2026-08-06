// Compartir una calibracion por URL (opcional aprobado): el estado de
// la pantalla activa viaja codificado en la fraccion hash, que nunca
// llega al servidor (funciona en GitHub Pages y sin conexion).
//
// Al abrir un enlace compartido, la aplicacion PREGUNTA antes de
// aplicar: se cargan el borrador de esa pantalla, los datos compartidos
// de la calibracion (la JORNADA: presion, velocidad, boquilla,
// espaciamiento, objetivo) y el contexto (tractor, equipo, unidades),
// nada mas.
//
// La jornada viaja aparte del borrador porque desde que cada dato vive
// una sola vez (domain/datos.js) el borrador de la pantalla ya casi no
// lleva nada: un enlace sin ella se abriria sin presion y sin boquilla.

const VERSION_COMPARTIR = 1;

// base64url seguro para unicode
function codificarBase64Url(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodificarBase64Url(cadena) {
  const base64 = cadena.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function codificarEstadoCompartido({ seccion, tab, borrador, jornada = null, contexto }) {
  const carga = { v: VERSION_COMPARTIR, seccion, tab, borrador, jornada, contexto };
  return codificarBase64Url(JSON.stringify(carga));
}

// Un enlace compartido es entrada NO CONFIABLE: lo arma el boton de
// compartir, pero viaja por mensajeria y cualquiera puede alterarlo antes
// de reenviarlo. Aqui se rechaza todo lo que no tenga la forma exacta que
// la aplicacion espera, ANTES de que main.js lo use.
//
// `rutaValida` la inyecta main.js porque el enrutador vive alli; sin ella
// bastaba que `tab` fuera una cadena cualquiera. Con `tab: '__proto__'`,
// la escritura `estado.borradores[carga.tab] = …` no creaba una propiedad:
// cambiaba el PROTOTIPO del objeto, y desde ahi el enlace sembraba el
// borrador de TODAS las pantallas de golpe —incluida la velocidad de
// Avance, de la que cuelga el volumen por hectarea— sin aparecer en
// Object.keys ni persistirse. El borrador tiene que ser ademas un objeto
// llano: un arreglo o una cadena dejaban a las pantallas leyendo indices.
export function decodificarEstadoCompartido(cadena, rutaValida = null) {
  try {
    const carga = JSON.parse(decodificarBase64Url(cadena));
    if (!carga || carga.v !== VERSION_COMPARTIR) return null;
    if (typeof carga.seccion !== 'string' || typeof carga.tab !== 'string') return null;
    if (rutaValida && !rutaValida(carga.seccion, carga.tab)) return null;
    if (!esObjetoLlano(carga.borrador) && carga.borrador !== undefined && carga.borrador !== null) {
      return null;
    }
    if (!esObjetoLlano(carga.jornada) && carga.jornada !== undefined && carga.jornada !== null) {
      return null;
    }
    if (!esObjetoLlano(carga.contexto) && carga.contexto !== undefined && carga.contexto !== null) {
      return null;
    }
    return carga;
  } catch {
    return null;
  }
}

function esObjetoLlano(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function armarUrlCompartir({ seccion, tab, borrador, jornada = null, contexto }) {
  const codigo = codificarEstadoCompartido({ seccion, tab, borrador, jornada, contexto });
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/${seccion}/${tab}?e=${codigo}`;
}

export async function compartirUrl(url, titulo) {
  if (navigator.share) {
    try {
      await navigator.share({ url, title: titulo });
      return 'compartido';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelado';
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copiado';
    } catch {
      // El portapapeles EXISTE pero rechazo: permiso denegado, documento
      // sin foco, contexto no seguro, o Safari cuando el gesto del usuario
      // ya se consumio en el navigator.share que acaba de fallar. Sin esta
      // captura la promesa subia sin manejar y el boton se quedaba mudo:
      // ni toast de exito ni de error, y la rama de rescate —mostrar el
      // enlace para copiarlo a mano— no se alcanzaba nunca, porque lo que
      // falla es la llamada, no la capacidad.
      return 'sin-soporte';
    }
  }
  return 'sin-soporte';
}
