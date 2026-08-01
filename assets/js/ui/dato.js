// Un dato compartido, montado como campo.
//
// `domain/datos.js` declara QUE es cada dato —etiqueta, magnitud, ayuda,
// de donde sale su valor por defecto—; este archivo lo resuelve contra el
// estado y lo monta con los constructores de siempre (`campos.js` y
// `heredado.js`).
//
// La regla que hace que esto valga la pena: el valor vive en
// `estado.jornada`, UNA vez. Da igual si lo captura el asistente o una
// pestaña; el otro lo ve. Antes cada pantalla guardaba su copia en su
// propio borrador —con el mismo nombre en tres sitios— y por eso una
// calibracion guiada pedia la misma presion tres veces.

import { crearCampoNumerico, crearCampoSelect } from './campos.js';
import { crearCampoHeredado } from './heredado.js';
import { formatear } from './formato.js';
import { aSistema, deSistema, unidad } from '../domain/units.js';
import { geometria, redondeoLegible } from '../domain/speed.js';
import { DATOS, dato } from '../domain/datos.js';

// ---------------------------------------------------------------------
// Resolucion del respaldo: de donde sale el valor cuando la jornada
// todavia no lo tiene.
// ---------------------------------------------------------------------
export function respaldoDeDato(ctx, id) {
  const declaracion = dato(id);
  const origen = declaracion.respaldo ?? null;
  if (!origen) return { valor: null, etiqueta: null, avisos: [] };

  if (origen === 'avance') {
    const velocidad = ctx.velocidadDeAvance();
    return {
      valor: velocidad.velocidadKmh,
      etiqueta: velocidad.etiqueta,
      avisos: velocidad.avisos ?? [],
    };
  }

  if (origen === 'volumenReal') {
    // El criterio es de dominio y no de pantalla: manda lo AFORADO si lo
    // hay, si no lo calculado, y si no el objetivo del rancho. Cual se
    // esta usando se dice siempre, con su fecha.
    const real = ctx.volumenAplicacionReal();
    if (Number.isFinite(real?.valor)) {
      return {
        valor: real.valor,
        etiqueta: real.detalle ?? null,
        avisos: [],
      };
    }
    const objetivo = ctx.objetivoVolumenLha();
    return Number.isFinite(objetivo)
      ? { valor: objetivo, etiqueta: 'de volumen objetivo, todavía sin calcular ni medir', avisos: [] }
      : { valor: null, etiqueta: null, avisos: [] };
  }

  if (origen === 'barra') {
    try {
      const g = geometria(ctx.parametrosGeometria()).valores;
      return {
        valor: g.espaciamientoEfectivo,
        etiqueta: Number.isFinite(g.espaciamientoCapturado)
          ? 'capturado en la configuración de la barra'
          : 'derivado del ancho entre el número de boquillas',
        avisos: [],
      };
    } catch {
      return { valor: null, etiqueta: null, avisos: [] };
    }
  }

  const [ambito, campo] = origen.split('.');
  if (ambito === 'equipo') {
    return { valor: ctx.equipoActivo()?.[campo] ?? null, etiqueta: 'de la barra activa', avisos: [] };
  }
  if (ambito === 'config') {
    return {
      valor: ctx.estado().parametros.agronomicos?.[campo] ?? null,
      etiqueta: 'objetivo propio del rancho',
      avisos: [],
    };
  }
  if (ambito === 'resultado') {
    const resultado = ctx.resultado(campo);
    return { valor: resultado?.valor ?? null, etiqueta: resultado?.detalle ?? null, avisos: [] };
  }
  return { valor: null, etiqueta: null, avisos: [] };
}

// Donde vive un dato. Los compartidos por varias pantallas viven en la
// jornada; los de una sola pantalla, en el borrador de esa pantalla, que
// ya es un sitio unico y no hace falta mover.
function almacenDeDato(ctx, id) {
  const guarda = DATOS[id]?.guarda ?? null;
  if (!guarda) {
    return {
      leer: () => ctx.jornada(),
      escribir: (parcial) => ctx.fijarJornada(parcial),
      clave: id,
    };
  }
  return {
    leer: () => ctx.borrador(guarda.tab),
    escribir: (parcial) => {
      // El registro nombra el dato como lo nombra el asistente; la
      // pantalla puede guardarlo con otra clave, y manda la de ella.
      const traducido = {};
      for (const [clave, valor] of Object.entries(parcial)) {
        traducido[clave === id ? guarda.clave : clave] = valor;
      }
      ctx.guardarBorrador(guarda.tab, traducido);
    },
    clave: guarda.clave,
  };
}

// El valor vigente de un dato, en base metrica (o el identificador, si
// no es numerico). `manual` dice si lo escribio una persona: solo los
// datos con marca de captura manual pueden distinguirlo.
export function valorDeDato(ctx, id) {
  const declaracion = dato(id);
  const almacen = almacenDeDato(ctx, id);
  const jornada = almacen.leer();
  const guardado = jornada[almacen.clave];
  const respaldo = respaldoDeDato(ctx, id);

  if (declaracion.tipo === 'opcion') {
    // Una opción también puede venir de una fuente: la barra propone cuál
    // de los tres datos de su geometría se calcula. Manda lo elegido para
    // la jornada; si no hay, lo que dice la barra; y si tampoco, el
    // predeterminado del registro.
    return {
      valor: guardado ?? respaldo.valor ?? declaracion.predeterminado ?? null,
      manual: guardado !== undefined && guardado !== null,
      respaldo,
    };
  }

  if (declaracion.tipo === 'boquilla') {
    return {
      valor: guardado ?? respaldo.valor ?? null,
      manual: guardado !== undefined && guardado !== null,
      respaldo,
    };
  }

  const hayGuardado = Number.isFinite(guardado);
  if (declaracion.manual) {
    // Con marca: la fuente manda salvo que haya captura a mano.
    const manual = hayGuardado && jornada[declaracion.manual] === true;
    const valor = manual
      ? guardado
      : Number.isFinite(respaldo.valor)
        ? respaldo.valor
        : hayGuardado
          ? guardado
          : null;
    return { valor, manual, respaldo };
  }
  // Sin marca: lo capturado manda siempre, y el respaldo solo llena el
  // hueco. Es lo que ya hacian las pestañas con la presion y el ancho.
  return {
    valor: hayGuardado ? guardado : Number.isFinite(respaldo.valor) ? respaldo.valor : null,
    manual: hayGuardado,
    respaldo,
  };
}

export function fijarDato(ctx, id, valor) {
  const declaracion = dato(id);
  const parcial = { [id]: valor };
  if (declaracion.manual) parcial[declaracion.manual] = true;
  almacenDeDato(ctx, id).escribir(parcial);
  // El objetivo, ademas, se publica como resultado compartido: es lo que
  // leen las pantallas que lo comparan contra lo calculado.
  if (declaracion.publicaResultado && Number.isFinite(valor)) {
    ctx.guardarResultado(declaracion.publicaResultado, {
      valor,
      origen: 'jornada',
      detalle: 'objetivo de la jornada',
    });
  }
}

// ---------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------

// Campo de un dato compartido. El consumidor solo dice cual dato es y en
// que sistema se captura; la etiqueta, la unidad, la ayuda y el sitio
// donde se guarda salen del registro.
export function crearCampoDato(ctx, id, { sistema, etiqueta = null, ayuda = null, alCambiar = null } = {}) {
  const declaracion = dato(id);
  const magnitud = declaracion.magnitud ?? null;
  const decimales = declaracion.decimales ?? 2;
  const aCampo = (base) => {
    if (!Number.isFinite(base)) return null;
    if (!magnitud) return base;
    // toPrecision evita colas de punto flotante tras una ida y vuelta
    // metrico-imperial.
    return Number(aSistema(magnitud, base, sistema).toPrecision(6));
  };
  const deCampo = (valor) => (magnitud ? deSistema(magnitud, valor, sistema) : valor);

  // Con marca de captura manual, el campo es el heredado de siempre:
  // precarga, chip de procedencia y botón para volver a la fuente.
  if (declaracion.manual) {
    const respaldo = respaldoDeDato(ctx, id);
    const unidadTexto = magnitud ? unidad(magnitud, sistema) : '';
    const campo = crearCampoHeredado({
      ctx,
      tabId: null,
      clave: id,
      claveManual: declaracion.manual,
      etiqueta: etiqueta ?? declaracion.etiqueta,
      magnitud,
      sistema,
      ayuda: ayuda ?? declaracion.ayuda,
      fuente: declaracion.fuente,
      nombreDato: declaracion.nombreEnFrase,
      heredado: { valor: respaldo.valor, etiqueta: respaldo.etiqueta, avisos: respaldo.avisos },
      aCampo,
      deCampo,
      formatearValor: (valor) => `${formatear(valor, decimales)} ${unidadTexto}`.trim(),
      destino: declaracion.destino ?? null,
      textoSinDato: declaracion.sinDato ?? '',
      // Lo que ya estaba guardado sin marca es una captura de quien
      // calibra, no una copia de lo heredado: pisarla le borraria un dato
      // de su jornada.
      guardadoSinMarcaEsManual: true,
      almacen: almacenDeDato(ctx, id),
      alCambiar,
    });
    return campo;
  }

  if (declaracion.tipo === 'opcion') {
    const vigenteOpcion = valorDeDato(ctx, id);
    const campo = crearCampoSelect({
      etiqueta: etiqueta ?? declaracion.etiqueta,
      opciones: declaracion.opciones,
      valorInicial: vigenteOpcion.valor,
      ayuda: ayuda ?? declaracion.ayuda,
      alCambiar: (valor) => {
        fijarDato(ctx, id, valor);
        if (alCambiar) alCambiar(valor);
      },
    });
    return { ...campo, obtenerBase: () => campo.obtener() };
  }

  const vigente = valorDeDato(ctx, id);
  const campo = crearCampoNumerico({
    etiqueta: etiqueta ?? declaracion.etiqueta,
    magnitud,
    sistema,
    unidad: declaracion.unidadTexto ?? '',
    valorInicial: Number.isFinite(vigente.valor)
      ? magnitud
        ? redondeoLegible(aSistema(magnitud, vigente.valor, sistema))
        : vigente.valor
      : null,
    ayuda: ayuda ?? declaracion.ayuda,
    alCambiar: (valor) => {
      fijarDato(ctx, id, deCampo(valor));
      if (alCambiar) alCambiar(valor);
    },
  });
  return { ...campo, obtenerBase: () => deCampo(campo.obtener()) };
}

// Los datos que una pantalla o un paso necesita, ya resueltos, para
// pasarselos al dominio sin volver a leer el almacen campo por campo.
export function lecturaDeDatos(ctx, ids) {
  const salida = {};
  for (const id of ids) salida[id] = valorDeDato(ctx, id).valor;
  return salida;
}

export { DATOS };
