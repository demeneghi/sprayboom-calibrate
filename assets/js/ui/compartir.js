// Compartir una calibracion por URL (opcional aprobado): el estado de
// la pantalla activa viaja codificado en la fraccion hash, que nunca
// llega al servidor (funciona en GitHub Pages y sin conexion).
//
// Al abrir un enlace compartido, la aplicacion PREGUNTA antes de
// aplicar: se cargan el borrador de esa pantalla y el contexto
// (tractor, equipo, unidades), nada mas.

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

export function codificarEstadoCompartido({ seccion, tab, borrador, contexto }) {
  const carga = { v: VERSION_COMPARTIR, seccion, tab, borrador, contexto };
  return codificarBase64Url(JSON.stringify(carga));
}

export function decodificarEstadoCompartido(cadena) {
  try {
    const carga = JSON.parse(decodificarBase64Url(cadena));
    if (!carga || carga.v !== VERSION_COMPARTIR || !carga.seccion || !carga.tab) return null;
    return carga;
  } catch {
    return null;
  }
}

export function armarUrlCompartir({ seccion, tab, borrador, contexto }) {
  const codigo = codificarEstadoCompartido({ seccion, tab, borrador, contexto });
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
    await navigator.clipboard.writeText(url);
    return 'copiado';
  }
  return 'sin-soporte';
}
