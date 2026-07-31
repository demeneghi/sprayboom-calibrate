// Tabs ARIA con navegacion completa por teclado (flechas, Home, End).
// Se usa para la subnavegacion de cada seccion; el panel es el area de
// contenido que el llamador re-renderiza al cambiar de tab.
import { el } from './dom.js';

export function crearTabs({ id, tabs, activoId, idPanel, alCambiar }) {
  let indiceActivo = Math.max(0, tabs.findIndex((t) => t.id === activoId));

  const botones = tabs.map((tab, i) =>
    el(
      'button',
      {
        clase: 'tabs__disparador',
        role: 'tab',
        id: `${id}-tab-${tab.id}`,
        'aria-selected': i === indiceActivo ? 'true' : 'false',
        'aria-controls': idPanel,
        tabindex: i === indiceActivo ? '0' : '-1',
      },
      tab.etiqueta
    )
  );

  const lista = el(
    'div',
    { clase: 'tabs__lista', role: 'tablist', 'aria-label': 'Pestañas de la sección' },
    botones
  );

  function activar(indice, { notificar = true, enfocar = false } = {}) {
    indiceActivo = (indice + tabs.length) % tabs.length;
    botones.forEach((boton, i) => {
      const activo = i === indiceActivo;
      boton.setAttribute('aria-selected', activo ? 'true' : 'false');
      boton.setAttribute('tabindex', activo ? '0' : '-1');
    });
    const botonActivo = botones[indiceActivo];
    botonActivo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (enfocar) botonActivo.focus();
    if (notificar && alCambiar) alCambiar(tabs[indiceActivo].id);
  }

  botones.forEach((boton, i) => {
    boton.addEventListener('click', () => activar(i));
    boton.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowRight') {
        evento.preventDefault();
        activar(indiceActivo + 1, { enfocar: true });
      } else if (evento.key === 'ArrowLeft') {
        evento.preventDefault();
        activar(indiceActivo - 1, { enfocar: true });
      } else if (evento.key === 'Home') {
        evento.preventDefault();
        activar(0, { enfocar: true });
      } else if (evento.key === 'End') {
        evento.preventDefault();
        activar(tabs.length - 1, { enfocar: true });
      }
    });
  });

  return {
    elemento: lista,
    activarPorId(tabId) {
      const indice = tabs.findIndex((t) => t.id === tabId);
      if (indice >= 0) activar(indice, { notificar: false });
    },
    get activo() {
      return tabs[indiceActivo].id;
    },
  };
}
