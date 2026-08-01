// Campo que HEREDA por defecto un valor calculado en otra pantalla.
//
// El patron nacio en el campo de velocidad y hoy lo necesitan cuatro
// mas: el tiempo por tabla de Gas etileno y Forzamiento, el regimen de
// trabajo de Gasto de agua, el volumen de aplicacion de Mezcla y el
// espaciamiento de tres pantallas. Cada uno lo resolvia distinto —o no
// lo resolvia—, asi que vive aqui una sola vez.
//
// Las tres piezas del patron, y por que ninguna sobra:
//
//   1. El valor se PRECARGA de la pantalla que lo calculo. Copiarlo a
//      mano de una pantalla a otra es la via mas corta a calibrar con un
//      numero que ya no es el de hoy.
//   2. De donde salio el numero se dice SIEMPRE, en un chip que se lee
//      sin leer. Un campo precargado sin procedencia se lee como una
//      captura propia, y entonces nadie sospecha cuando esta viejo.
//   3. La captura manual manda y NO se pierde: en cuanto se escribe un
//      numero, ese gana y el borrador lo marca para que sobreviva al
//      re-pintado y a la recarga. Un boton lo devuelve a lo heredado.
//
// El valor viaja SIEMPRE en base metrica por el borrador; la conversion
// al sistema activo vive solo en la frontera de captura y de pintado.

import { el, reemplazar } from './dom.js';
import { crearCampoNumerico } from './campos.js';
import { pintarAvisos } from './render.js';
import { mostrarToast } from './toast.js';
import { formatearFecha } from './formato.js';
import { geometria } from '../domain/speed.js';

// De donde sale el volumen de aplicacion que usan Mezcla y Forzamiento,
// listo para crearCampoHeredado. Lo comparten las dos porque el criterio
// es el mismo y es de dominio, no de pantalla:
//
//   1. Lo MEDIDO en la prueba de captura, si lo hay. Sale del aforo de
//      esta barra con las boquillas como estan hoy.
//   2. Lo CALCULADO en Gasto de agua. Sale de la ficha de una boquilla
//      nueva, que es lo mejor que hay mientras no se afore.
//   3. El volumen objetivo propio del rancho, de Configuracion. Es un
//      objetivo, no una medicion, y el chip lo dice con esas palabras.
//
// Cual se esta usando va SIEMPRE a la vista, con su fecha: un aforo de
// hace un mes puede no ser el de la barra de hoy, y decidir eso es de
// quien calibra.
export function fuenteVolumenAplicacion(ctx) {
  const real = ctx.volumenAplicacionReal();
  if (real && Number.isFinite(real.valor)) {
    const fecha = formatearFecha(real.fecha, { vacio: null });
    return {
      valor: real.valor,
      etiqueta: `${real.detalle}${fecha ? ` (${fecha})` : ''}`,
      fuente: real.origen === 'captura' ? 'la prueba de captura' : 'Gasto de agua',
      destino:
        real.origen === 'captura'
          ? { seccion: 'registrar', tab: 'captura' }
          : { seccion: 'calibrar', tab: 'gasto' },
    };
  }
  const objetivo = ctx.objetivoVolumenLha();
  if (Number.isFinite(objetivo)) {
    return {
      valor: objetivo,
      etiqueta: 'de volumen objetivo, todavía sin calcular ni medir',
      fuente: 'el objetivo configurado',
      destino: { seccion: 'calibrar', tab: 'gasto' },
    };
  }
  return {
    valor: null,
    etiqueta: null,
    fuente: 'Gasto de agua',
    destino: { seccion: 'calibrar', tab: 'gasto' },
  };
}

export function crearCampoHeredado({
  ctx,
  tabId,
  clave,
  claveManual,
  etiqueta,
  unidad = '',
  ayuda = null,
  // Nombre de la pantalla de la que sale el valor, tal como se dice en
  // la interfaz ('Avance', 'la prueba de captura', 'la configuración').
  fuente,
  // Como se nombra el dato en una frase: 'la velocidad', 'el tiempo por
  // tabla'. Va en el texto de los botones y del toast.
  nombreDato,
  // { valor: number|null, etiqueta: string|null, avisos?: [] } en base
  // metrica. etiqueta dice de donde salio: 'de la marcha B1'.
  heredado,
  // Conversiones de la frontera. Por defecto, sin conversion.
  aCampo = (valor) => valor,
  deCampo = (valor) => valor,
  // Como se escribe el valor heredado en el chip, ya en el sistema
  // activo: recibe el valor de campo y devuelve texto con su unidad.
  formatearValor,
  // A donde manda el boton cuando no hay nada que heredar.
  destino = null,
  // Que capturar y donde, cuando la fuente no tiene datos.
  textoSinDato,
  // Para un campo que ANTES se capturaba a mano y ahora hereda: lo que
  // ya estaba guardado sin marca es una captura del usuario, no una
  // copia de lo heredado, y pisarla le borraria un dato de su jornada.
  // Solo aplica al borrador viejo: en cuanto el campo se usa una vez, la
  // marca queda escrita y esta bandera deja de intervenir.
  guardadoSinMarcaEsManual = false,
  alCambiar = null,
}) {
  const borrador = ctx.borrador(tabId);
  const hayHeredado = Number.isFinite(heredado?.valor);
  const hayGuardado = Number.isFinite(borrador[clave]);

  // Manda la fuente salvo que haya captura manual. El valor guardado sin
  // marca de manual solo se conserva cuando la fuente no tiene nada (por
  // ejemplo, al abrir un enlace compartido).
  const marca = borrador[claveManual];
  let manual =
    hayGuardado && (marca === true || (guardadoSinMarcaEsManual && marca === undefined));
  const inicial = manual
    ? borrador[clave]
    : hayHeredado
      ? heredado.valor
      : hayGuardado
        ? borrador[clave]
        : null;

  const campo = crearCampoNumerico({
    etiqueta,
    unidad,
    valorInicial: aCampo(inicial),
    ayuda,
    alCambiar: (valor) => {
      manual = true;
      ctx.guardarBorrador(tabId, { [clave]: deCampo(valor), [claveManual]: true });
      pintarEstado();
      if (alCambiar) alCambiar(valor);
    },
  });

  // Lo heredado se copia al borrador: asi lo que se comparte por enlace,
  // lo que se recarga y lo que se guarda en bitacora es el mismo numero
  // que esta en pantalla.
  if (!manual && hayHeredado) {
    ctx.guardarBorrador(tabId, { [clave]: heredado.valor, [claveManual]: false });
  }

  const estado = el('div', { clase: 'fila-control' });
  const zonaAvisos = el('div', {});
  const boton = el('button', { clase: 'boton boton--contorno' });
  boton.addEventListener('click', () => {
    if (hayHeredado) {
      manual = false;
      campo.fijar(aCampo(heredado.valor));
      ctx.guardarBorrador(tabId, { [clave]: heredado.valor, [claveManual]: false });
      pintarEstado();
      if (alCambiar) alCambiar(campo.obtener());
      mostrarToast(`${nombreDato} de ${fuente}: ${textoHeredado()}.`);
      return;
    }
    if (destino) ctx.navegarA(destino.seccion, destino.tab);
  });

  function textoHeredado() {
    return `${formatearValor(aCampo(heredado.valor))} ${heredado.etiqueta ?? ''}`.trim();
  }

  function pintarEstado() {
    // Los avisos del dominio (por ejemplo, que la velocidad NO salio del
    // modo elegido en Avance) van con el campo, no escondidos: son la
    // razon por la que el numero podria no ser el de hoy.
    reemplazar(zonaAvisos, ...(manual ? [] : pintarAvisos(heredado?.avisos ?? [])));

    if (!hayHeredado) {
      reemplazar(
        estado,
        el(
          'span',
          { clase: 'badge badge--advertencia' },
          manual ? 'capturado a mano' : `sin dato en ${fuente}`
        ),
        el(
          'span',
          { clase: 'texto-meta' },
          manual ? `En ${fuente} no hay un valor con qué compararlo.` : textoSinDato
        )
      );
      boton.textContent = `Capturar ${nombreDato} en ${fuente}`;
      boton.classList.toggle('oculto', !destino);
      return;
    }
    if (manual) {
      reemplazar(
        estado,
        el('span', { clase: 'badge badge--contorno' }, 'capturado a mano'),
        el('span', { clase: 'texto-meta' }, `En ${fuente} hay ${textoHeredado()}.`)
      );
      boton.textContent = `Volver a ${nombreDato} de ${fuente}`;
      boton.classList.remove('oculto');
      return;
    }
    reemplazar(
      estado,
      el('span', { clase: 'badge badge--secundario' }, `de ${fuente}`),
      el('span', { clase: 'texto-meta' }, textoHeredado())
    );
    boton.classList.add('oculto');
  }

  pintarEstado();

  const raiz = el(
    'div',
    { estilo: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
    campo.elemento,
    zonaAvisos,
    estado,
    boton
  );

  return {
    elemento: raiz,
    entrada: campo.entrada,
    obtener: () => campo.obtener(),
    obtenerTexto: () => campo.obtenerTexto(),
    // En base metrica, que es donde vive el dominio.
    obtenerBase: () => deCampo(campo.obtener()),
    fijar: (valor) => campo.fijar(aCampo(valor)),
    fijarError: (mensaje) => campo.fijarError(mensaje),
    esManual: () => manual,
    heredado,
  };
}

// De donde sale el espaciamiento entre boquillas que precargan Gasto de
// agua, Boquillas y Prueba de captura, listo para crearCampoHeredado. Lo
// comparten porque el criterio es de la barra, no de la pantalla: el
// capturado en la configuracion de la barra si existe, y si no el
// derivado del ancho entre el numero de boquillas.
//
// Antes las tres lo precargaban en silencio y, en cuanto se editaba una
// vez, ese campo quedaba clavado en el valor viejo aunque la barra
// cambiara: sin chip no habia forma de notarlo.
export function fuenteEspaciamiento(ctx) {
  const destino = { seccion: 'sistema', tab: 'configuracion' };
  let g = null;
  try {
    g = geometria(ctx.parametrosGeometria()).valores;
  } catch {
    return { valor: null, etiqueta: null, fuente: 'la barra', destino };
  }
  const capturado = Number.isFinite(g.espaciamientoCapturado);
  return {
    valor: g.espaciamientoEfectivo,
    etiqueta: capturado
      ? 'capturado en la configuración de la barra'
      : 'derivado del ancho entre el número de boquillas',
    fuente: 'la barra',
    destino,
  };
}
