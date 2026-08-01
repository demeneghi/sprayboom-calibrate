// Receta activa: instantanea para el dominio, estado guardado y tira de
// avance del encabezado.
//
// La tira es lo que convierte una lista de pestanas en una secuencia sin
// encerrar a nadie: dice "paso 2 de 4", de donde vienes y que sigue, y
// se pinta ENCIMA del panel desde main.js. Por eso vive aqui y no en
// cada pantalla: las diez pestanas no saben nada de la guia, y no tienen
// por que saberlo.

import { el } from './dom.js';
import { iconoSvg } from './svg.js';
import { recetaPorId, posicionEnReceta, progresoDeReceta } from '../domain/recetas.js';

export const TAB_GUIA = { seccion: 'calibrar', tab: 'guia' };

// ---------------------------------------------------------------------
// Instantanea: lo que el dominio necesita para decir si un paso ya esta.
//
// Todo sale de derivados que YA existen en ctx. Aqui no se recalcula
// nada ni se copia a ningun lado: se lee. Es la regla del documento de
// conexiones entre pestanas —derivar, no copiar— aplicada a la guia.
// ---------------------------------------------------------------------
export function instantaneaDe(ctx) {
  const estado = ctx.estado();
  const mezcla = ctx.borrador('mezcla');
  const gas = ctx.borrador('gas');
  return {
    ahora: new Date().toISOString(),
    velocidad: ctx.velocidadDeAvance(),
    lhaObjetivo: ctx.objetivoVolumenLha(),
    lhaCalculado: ctx.resultado('lhaCalculado'),
    lhaMedido: ctx.resultado('lhaMedido'),
    masaPorTablaG: ctx.resultado('masaPorTablaG'),
    dosisMezcla: Number.isFinite(mezcla.dosisCantidad) ? mezcla.dosisCantidad : null,
    flujoGas: Number.isFinite(gas.scfm) ? gas.scfm : null,
    tema: estado.preferencias.tema,
  };
}

// ---------------------------------------------------------------------
// Estado guardado de la guia
//
// Se escribe como 'contexto' —no como 'borrador'— porque entrar o salir
// de una receta cambia lo que se PINTA (la tira del encabezado), y el
// borrador a proposito no re-renderiza.
// ---------------------------------------------------------------------
export function recetaActivaId(ctx) {
  return ctx.borrador('guia').recetaId ?? null;
}

export function recetaActiva(ctx) {
  return recetaPorId(recetaActivaId(ctx));
}

export function fijarRecetaActiva(ctx, recetaId) {
  ctx.almacen.actualizar((estado) => {
    if (!estado.borradores) estado.borradores = {};
    estado.borradores.guia = { ...(estado.borradores.guia ?? {}), recetaId };
  }, 'contexto');
}

export function avanceDeRecetaActiva(ctx) {
  const receta = recetaActiva(ctx);
  if (!receta) return null;
  return { receta, ...progresoDeReceta(receta, instantaneaDe(ctx)) };
}

// ---------------------------------------------------------------------
// Tira de avance
//
// Se pinta solo si hay receta activa Y la pantalla actual es uno de sus
// pasos: en una pantalla ajena a la receta, una tira que dijera "paso 2
// de 4" mentiria sobre donde estas.
// ---------------------------------------------------------------------
export function crearTiraReceta(ctx, ruta) {
  const receta = recetaActiva(ctx);
  if (!receta) return null;
  const posicion = posicionEnReceta(receta, ruta);
  if (!posicion) return null;

  const irA = (paso) => ctx.navegarA(paso.seccion, paso.tab);

  const anterior = el(
    'button',
    {
      clase: 'boton boton--contorno boton--icono boton--sm',
      'aria-label': posicion.anterior
        ? `Paso anterior: ${posicion.anterior.titulo}`
        : 'No hay paso anterior',
      disabled: !posicion.anterior,
      alClic: () => posicion.anterior && irA(posicion.anterior),
    },
    iconoSvg('flecha-izquierda')
  );

  const siguiente = el(
    'button',
    {
      clase: 'boton boton--contorno boton--icono boton--sm',
      'aria-label': posicion.siguiente
        ? `Paso siguiente: ${posicion.siguiente.titulo}`
        : 'Este es el último paso',
      disabled: !posicion.siguiente,
      alClic: () => posicion.siguiente && irA(posicion.siguiente),
    },
    iconoSvg('flecha-derecha')
  );

  return el(
    'div',
    { clase: 'tira-receta', role: 'group', 'aria-label': `Guía: ${receta.titulo}` },
    anterior,
    el(
      'button',
      {
        clase: 'tira-receta__centro',
        'aria-label': `Ver los pasos de la guía ${receta.titulo}`,
        alClic: () => ctx.navegarA(TAB_GUIA.seccion, TAB_GUIA.tab),
      },
      el(
        'span',
        { clase: 'tira-receta__paso texto-meta' },
        `Paso ${posicion.numero} de ${posicion.total} · ${receta.titulo}`
      ),
      el('span', { clase: 'tira-receta__titulo' }, posicion.paso.titulo)
    ),
    siguiente
  );
}
