// Cronometro integrado (opcional aprobado): mide segundos por tramo en
// campo y sirve de cuenta regresiva para la prueba de captura. Botones
// grandes para uso con guantes; sin dependencias.
import { el } from './dom.js';

// modo 'cronometro': arranca en cero y cuenta hacia arriba.
// modo 'regresivo': cuenta desde duracionS hacia cero y avisa al llegar.
export function crearCronometro({
  modo = 'cronometro',
  duracionS = null,
  etiquetaUsar = 'Usar en el cálculo',
  alUsar = null,
  alTerminar = null,
} = {}) {
  let inicio = null;
  let acumuladoMs = 0;
  let intervalo = null;
  let termino = false;

  const pantalla = el('div', {
    clase: 'resultado__valor mono cronometro__pantalla',
    role: 'timer',
    'aria-live': 'off',
  });

  // El alto lo manda el piso tactil de `components.css`; el consumidor
  // no parchea `min-height` (regla dura del sistema de diseno). El
  // reparto de la fila tambien vive alli: la etiqueta de "usar" es larga
  // y en una sola fila se salia de la tarjeta.
  const botonArrancar = el('button', { clase: 'boton' }, 'Arrancar');
  const botonReiniciar = el('button', { clase: 'boton boton--contorno' }, 'Reiniciar');
  const botonUsar = alUsar
    ? el('button', { clase: 'boton boton--secundario cronometro__usar' }, etiquetaUsar)
    : null;

  function transcurridoS() {
    const enCurso = inicio === null ? 0 : performance.now() - inicio;
    return (acumuladoMs + enCurso) / 1000;
  }

  function valorMostrado() {
    if (modo === 'regresivo' && duracionS !== null) {
      return Math.max(0, duracionS - transcurridoS());
    }
    return transcurridoS();
  }

  function pintar() {
    const v = valorMostrado();
    const minutos = Math.floor(v / 60);
    const segundos = v - minutos * 60;
    pantalla.textContent =
      minutos > 0
        ? `${minutos}:${segundos.toFixed(1).padStart(4, '0')}`
        : segundos.toFixed(1);
    if (modo === 'regresivo' && duracionS !== null && v <= 0 && !termino) {
      termino = true;
      detener();
      // El estado se marca con un atributo y lo pinta components.css con su
      // token: el color no se escribe en el consumidor (regla dura del
      // sistema de diseno). Asi el estado existe en el CSS, se puede
      // ajustar de un sitio y la compuerta de contraste lo ve como par.
      pantalla.dataset.cumplido = 'true';
      if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
      if (alTerminar) alTerminar();
    }
  }

  function arrancar() {
    if (intervalo) return;
    inicio = performance.now();
    intervalo = setInterval(() => {
      // Autolimpieza: si la pestaña se desmontó, el nodo ya no está en
      // el documento y el intervalo se detiene solo (sin fugas).
      if (!elemento.isConnected) {
        detener();
        return;
      }
      pintar();
    }, 100);
    botonArrancar.textContent = 'Parar';
  }

  function detener() {
    if (inicio !== null) {
      acumuladoMs += performance.now() - inicio;
      inicio = null;
    }
    if (intervalo) {
      clearInterval(intervalo);
      intervalo = null;
    }
    botonArrancar.textContent = 'Arrancar';
    pintar();
  }

  function reiniciar() {
    detener();
    acumuladoMs = 0;
    termino = false;
    delete pantalla.dataset.cumplido;
    pintar();
  }

  botonArrancar.addEventListener('click', () => {
    if (intervalo) detener();
    else arrancar();
  });
  botonReiniciar.addEventListener('click', reiniciar);
  if (botonUsar) {
    botonUsar.addEventListener('click', () => {
      detener();
      alUsar(transcurridoS());
    });
  }

  pintar();

  const elemento = el(
    'div',
    { clase: 'card cronometro' },
    pantalla,
    el('div', { clase: 'cronometro__acciones' }, botonArrancar, botonReiniciar, botonUsar)
  );

  return {
    elemento,
    reiniciar,
    fijarDuracion(nuevaDuracionS) {
      duracionS = nuevaDuracionS;
      reiniciar();
    },
    get segundos() {
      return transcurridoS();
    },
    destruir() {
      detener();
    },
  };
}
