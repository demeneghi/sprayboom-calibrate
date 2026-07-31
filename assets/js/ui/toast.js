// Toast: avisos breves no bloqueantes. Sin librerias.
import { el } from './dom.js';

let contenedor = null;

function asegurarContenedor() {
  if (!contenedor || !contenedor.isConnected) {
    contenedor = el('div', { clase: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(contenedor);
  }
  return contenedor;
}

export function mostrarToast(mensaje, opciones = {}) {
  const { tipo = 'normal', duracionMs = 4500, accionTexto = null, alAccionar = null } = opciones;
  const zona = asegurarContenedor();
  const toast = el(
    'div',
    {
      clase: `toast${tipo === 'destructivo' ? ' toast--destructivo' : ''}`,
      role: tipo === 'destructivo' ? 'alert' : null,
    },
    el('span', {}, mensaje)
  );
  if (accionTexto) {
    toast.append(
      el('button', {
        clase: 'boton boton--fantasma boton--sm',
        alClic: () => {
          if (alAccionar) alAccionar();
          toast.remove();
        },
      }, accionTexto)
    );
  }
  zona.append(toast);
  if (duracionMs > 0) {
    setTimeout(() => toast.remove(), duracionMs);
  }
  return toast;
}

// Aviso persistente que no se autodescarta (p. ej. almacenamiento roto).
export function mostrarAvisoPersistente(mensaje) {
  return mostrarToast(mensaje, { tipo: 'destructivo', duracionMs: 0, accionTexto: 'Cerrar' });
}
