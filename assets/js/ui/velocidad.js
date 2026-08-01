// Campo de velocidad de avance heredado de la pestana Avance.
//
// La velocidad de trabajo se captura UNA sola vez, en Avance, y las
// pantallas que la necesitan (gasto de agua, boquillas, prueba de
// captura) la heredan por defecto: es el mismo numero del mismo tractor
// en el mismo trabajo. Copiarlo a mano de una pantalla a otra era la
// via mas corta a calibrar con una velocidad vieja.
//
// El patron (precarga + chip de procedencia + captura manual que manda)
// vive en ui/heredado.js, porque hoy lo usan cinco campos. Aqui solo
// queda lo propio de la velocidad: de donde sale y como se escribe.
//
// El valor heredado lo deriva ctx.velocidadDeAvance(), que es la UNICA
// version de ese calculo en toda la aplicacion.

import { crearCampoHeredado } from './heredado.js';
import { formatear } from './formato.js';
import { aSistema, deSistema, unidad } from '../domain/units.js';

export function crearCampoVelocidad({
  ctx,
  tabId,
  sistema,
  etiqueta = 'Velocidad de avance',
  alCambiar = null,
}) {
  const unidadVelocidad = unidad('velocidad', sistema);
  const heredada = ctx.velocidadDeAvance();

  // toPrecision evita colas de punto flotante en el input tras una ida y
  // vuelta metrico-imperial.
  const aCampo = (kmh) =>
    Number.isFinite(kmh) ? Number(aSistema('velocidad', kmh, sistema).toPrecision(6)) : null;

  const campo = crearCampoHeredado({
    ctx,
    tabId,
    clave: 'velocidadKmh',
    claveManual: 'velocidadManual',
    etiqueta,
    magnitud: 'velocidad',
    sistema,
    ayuda:
      'Viene de Avance: los segundos por tramo o la marcha con su régimen. Si escribes un ' +
      'número aquí, manda el tuyo.',
    fuente: 'Avance',
    nombreDato: 'la velocidad',
    heredado: {
      valor: heredada.velocidadKmh,
      etiqueta: heredada.etiqueta,
      avisos: heredada.avisos,
    },
    aCampo,
    deCampo: (valor) => deSistema('velocidad', valor, sistema),
    formatearValor: (valor) => `${formatear(valor, 2)} ${unidadVelocidad}`,
    destino: { seccion: 'calibrar', tab: 'avance' },
    textoSinDato:
      'Captura en Avance los segundos por tramo o una marcha con régimen, o escribe la ' +
      'velocidad aquí.',
    alCambiar,
  });

  return {
    ...campo,
    obtenerKmh: campo.obtenerBase,
    heredada,
  };
}
