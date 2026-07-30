// Combobox filtrable accesible, construido a mano porque cada opcion
// muestra color, tamano y caudal (datalist no puede). Patron ARIA
// combobox + listbox con navegacion por teclado completa.
import { el, limpiar } from './dom.js';

function normalizar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// opciones: [{ valor, texto, detalle?, colorHex?, colorTexto? }]
export function crearCombobox({ id, opciones, placeholder = 'Buscar...', alSeleccionar }) {
  let listaOpciones = opciones.slice();
  let abierta = false;
  let indiceActivo = -1;
  let filtradas = listaOpciones;

  const entrada = el('input', {
    clase: 'entrada',
    id,
    type: 'text',
    role: 'combobox',
    'aria-expanded': 'false',
    'aria-autocomplete': 'list',
    'aria-controls': `${id}-lista`,
    autocomplete: 'off',
    placeholder,
  });
  const lista = el('ul', {
    clase: 'combobox__lista oculto',
    id: `${id}-lista`,
    role: 'listbox',
  });
  const raiz = el('div', { clase: 'combobox' }, entrada, lista);

  function cerrar() {
    abierta = false;
    indiceActivo = -1;
    lista.classList.add('oculto');
    entrada.setAttribute('aria-expanded', 'false');
    entrada.removeAttribute('aria-activedescendant');
  }

  function pintar() {
    limpiar(lista);
    if (filtradas.length === 0) {
      lista.append(el('li', { clase: 'combobox__vacio' }, 'Sin coincidencias en el catalogo.'));
      return;
    }
    filtradas.forEach((opcion, i) => {
      const idOpcion = `${id}-opcion-${i}`;
      const li = el(
        'li',
        {
          clase: 'combobox__opcion',
          id: idOpcion,
          role: 'option',
          'aria-selected': i === indiceActivo ? 'true' : 'false',
        },
        opcion.colorHex
          ? el('span', {
              clase: 'muestra-color',
              estilo: { backgroundColor: opcion.colorHex },
              'aria-hidden': 'true',
            })
          : null,
        el('span', {}, opcion.texto),
        opcion.detalle ? el('span', { clase: 'combobox__detalle' }, opcion.detalle) : null
      );
      li.addEventListener('pointerdown', (evento) => {
        // pointerdown para ganarle al blur del input.
        evento.preventDefault();
        elegir(opcion);
      });
      lista.append(li);
    });
  }

  function abrir() {
    abierta = true;
    lista.classList.remove('oculto');
    entrada.setAttribute('aria-expanded', 'true');
    pintar();
  }

  function filtrar() {
    const consulta = normalizar(entrada.value);
    filtradas = consulta
      ? listaOpciones.filter(
          (o) => normalizar(o.texto).includes(consulta) || normalizar(o.detalle ?? '').includes(consulta)
        )
      : listaOpciones;
    indiceActivo = -1;
    pintar();
  }

  function elegir(opcion) {
    entrada.value = opcion.texto;
    cerrar();
    if (alSeleccionar) alSeleccionar(opcion);
  }

  function moverActivo(delta) {
    if (!abierta) abrir();
    if (filtradas.length === 0) return;
    indiceActivo = (indiceActivo + delta + filtradas.length) % filtradas.length;
    entrada.setAttribute('aria-activedescendant', `${id}-opcion-${indiceActivo}`);
    pintar();
    const activo = lista.querySelector(`#${id}-opcion-${indiceActivo}`);
    if (activo) activo.scrollIntoView({ block: 'nearest' });
  }

  entrada.addEventListener('input', () => {
    if (!abierta) abrir();
    filtrar();
  });
  entrada.addEventListener('focus', () => {
    filtrar();
    abrir();
  });
  entrada.addEventListener('blur', () => cerrar());
  entrada.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      moverActivo(1);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      moverActivo(-1);
    } else if (evento.key === 'Enter') {
      if (abierta && indiceActivo >= 0 && filtradas[indiceActivo]) {
        evento.preventDefault();
        elegir(filtradas[indiceActivo]);
      }
    } else if (evento.key === 'Escape') {
      cerrar();
    } else if (evento.key === 'Home' && abierta) {
      evento.preventDefault();
      indiceActivo = -1;
      moverActivo(1);
    } else if (evento.key === 'End' && abierta) {
      evento.preventDefault();
      indiceActivo = filtradas.length;
      moverActivo(-1);
    }
  });

  return {
    elemento: raiz,
    entrada,
    fijarTexto(texto) {
      entrada.value = texto;
    },
    fijarOpciones(nuevas) {
      listaOpciones = nuevas.slice();
      filtrar();
    },
    limpiar() {
      entrada.value = '';
      filtrar();
    },
  };
}
