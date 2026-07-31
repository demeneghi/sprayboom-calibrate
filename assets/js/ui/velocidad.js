// Campo de velocidad de avance heredado de la pestana Avance.
//
// La velocidad de trabajo se captura UNA sola vez, en Avance, y las
// pantallas que la necesitan (gasto de agua, boquillas, prueba de
// captura) la heredan por defecto: es el mismo numero del mismo tractor
// en el mismo trabajo. Copiarlo a mano de una pantalla a otra era la
// via mas corta a calibrar con una velocidad vieja.
//
// La captura manual no se pierde: en cuanto se escribe un numero en el
// campo, ese manda y el borrador lo marca (`velocidadManual`) para que
// sobreviva al re-pintado y a la recarga. Un boton devuelve el campo a
// la velocidad de Avance cuando se quiere volver a heredarla.

import { el, reemplazar } from './dom.js';
import { crearCampoNumerico } from './campos.js';
import { formatear } from './formato.js';
import { mostrarToast } from './toast.js';
import { aSistema, deSistema, unidad } from '../domain/units.js';
import { velocidadDeAvance } from '../domain/speed.js';

const SIN_DATOS = { velocidadKmh: null, origen: null, etiqueta: null, marcha: null, avisos: [] };

// Velocidad que Avance tiene capturada en este momento, leida del
// estado de la aplicacion. Nunca lanza: una configuracion invalida se
// trata igual que la falta de datos, porque este campo es una precarga
// y no puede tumbar la pantalla que lo usa.
export function velocidadHeredadaDeAvance(ctx) {
  try {
    const estado = ctx.estado();
    const tractor = ctx.tractorActivo();
    return velocidadDeAvance({
      captura: ctx.borrador('avance'),
      tractor,
      mediciones: (estado.factoresDesviacion ?? [])
        .filter((m) => m.tractorId === tractor?.id)
        .map((m) => ({ rpm: m.rpm, factor: m.factor })),
      distanciaReferencia: estado.parametros.geometria.distanciaReferencia,
      umbralDesviacionPct: estado.parametros.umbrales.umbralDesviacionVelocidad,
    });
  } catch {
    return SIN_DATOS;
  }
}

export function crearCampoVelocidad({
  ctx,
  tabId,
  sistema,
  etiqueta = 'Velocidad de avance',
  alCambiar = null,
}) {
  const unidadVelocidad = unidad('velocidad', sistema);
  const borrador = ctx.borrador(tabId);
  const heredada = velocidadHeredadaDeAvance(ctx);
  const hayHeredada = Number.isFinite(heredada.velocidadKmh);
  const hayGuardada = Number.isFinite(borrador.velocidadKmh);

  // Manda Avance salvo que haya captura manual. El valor guardado sin
  // marca de manual solo se conserva cuando Avance no tiene nada (por
  // ejemplo, al abrir un enlace compartido).
  let manual = borrador.velocidadManual === true && hayGuardada;
  const inicialKmh = manual
    ? borrador.velocidadKmh
    : hayHeredada
      ? heredada.velocidadKmh
      : hayGuardada
        ? borrador.velocidadKmh
        : null;

  // El borrador guarda SIEMPRE en base metrica; al pintar se convierte
  // al sistema activo (toPrecision evita colas de punto flotante en el
  // input tras una ida y vuelta metrico-imperial).
  function aCampo(valorMetrico) {
    if (!Number.isFinite(valorMetrico)) return null;
    return Number(aSistema('velocidad', valorMetrico, sistema).toPrecision(6));
  }

  const campo = crearCampoNumerico({
    etiqueta,
    unidad: unidadVelocidad,
    valorInicial: aCampo(inicialKmh),
    ayuda:
      'Sale de lo capturado en Avance: el reporte de campo (segundos por tramo) o la marcha con ' +
      'su régimen. Si escribes un número aquí, manda el tuyo y la velocidad de Avance no se toca.',
    alCambiar: (valor) => {
      manual = true;
      ctx.guardarBorrador(tabId, {
        velocidadKmh: deSistema('velocidad', valor, sistema),
        velocidadManual: true,
      });
      pintarEstado();
      if (alCambiar) alCambiar(valor);
    },
  });

  // Lo heredado se copia al borrador: asi lo que se comparte por
  // enlace, lo que se recarga y lo que se guarda en bitacora es el
  // mismo numero que esta en pantalla.
  if (!manual && hayHeredada) {
    ctx.guardarBorrador(tabId, { velocidadKmh: heredada.velocidadKmh, velocidadManual: false });
  }

  // De donde salio el numero es ESTADO del dato, no ayuda: va siempre a
  // la vista, en un chip que se lee sin leer (el texto explicativo vive
  // en el globo del boton "?", que lo arma campos.js).
  const estado = el('div', { clase: 'fila-control' });
  const boton = el('button', { clase: 'boton boton--contorno' });
  boton.addEventListener('click', () => {
    if (hayHeredada) {
      manual = false;
      campo.fijar(aCampo(heredada.velocidadKmh));
      ctx.guardarBorrador(tabId, {
        velocidadKmh: heredada.velocidadKmh,
        velocidadManual: false,
      });
      pintarEstado();
      if (alCambiar) alCambiar(campo.obtener());
      mostrarToast(
        `Velocidad de Avance ${heredada.etiqueta}: ` +
          `${formatear(aSistema('velocidad', heredada.velocidadKmh, sistema), 2)} ${unidadVelocidad}.`
      );
      return;
    }
    ctx.navegarA('calibrar', 'avance');
  });

  function textoHeredado() {
    return (
      `${formatear(aSistema('velocidad', heredada.velocidadKmh, sistema), 2)} ` +
      `${unidadVelocidad} ${heredada.etiqueta}`
    );
  }

  function pintarEstado() {
    if (!hayHeredada) {
      reemplazar(
        estado,
        el(
          'span',
          { clase: 'badge badge--advertencia' },
          manual ? 'capturada a mano' : 'sin dato en Avance'
        ),
        el(
          'span',
          { clase: 'texto-meta' },
          manual
            ? 'Avance no tiene datos con qué compararla.'
            : 'Captura en Avance los segundos por tramo o una marcha con régimen, o escribe la velocidad aquí.'
        )
      );
      boton.textContent = 'Capturar la velocidad en Avance';
      boton.classList.remove('oculto');
      return;
    }
    if (manual) {
      reemplazar(
        estado,
        el('span', { clase: 'badge badge--contorno' }, 'capturada a mano'),
        el('span', { clase: 'texto-meta' }, `En Avance hay ${textoHeredado()}.`)
      );
      boton.textContent = 'Volver a la velocidad de Avance';
      boton.classList.remove('oculto');
      return;
    }
    reemplazar(
      estado,
      el('span', { clase: 'badge badge--secundario' }, 'de Avance'),
      el('span', { clase: 'texto-meta' }, textoHeredado())
    );
    boton.classList.add('oculto');
  }

  pintarEstado();

  const raiz = el(
    'div',
    { estilo: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
    campo.elemento,
    estado,
    boton
  );

  return {
    elemento: raiz,
    entrada: campo.entrada,
    obtener: () => campo.obtener(),
    obtenerTexto: () => campo.obtenerTexto(),
    // En base metrica, que es donde vive el dominio.
    obtenerKmh: () => deSistema('velocidad', campo.obtener(), sistema),
    fijarError: (mensaje) => campo.fijarError(mensaje),
    esManual: () => manual,
    heredada,
  };
}
