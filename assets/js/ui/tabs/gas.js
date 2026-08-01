// Pestana Gas etileno (dominio C): los cuatro modos del rotametro.
//
// Modos con botones segmentados (convencion de avance.js): consumo
// (masa), presion requerida, tiempo requerido y lectura del flotador.
// La masa por pie cubico estandar efectiva del gas activo se muestra
// SIEMPRE, con badge de anulacion manual o derivacion y su desglose.
// Los DOS instrumentos de la linea se dibujan en SVG desde su escala
// configurada —el tubo del rotametro y el manometro de la entrada— y
// son ademas la superficie de captura: se toca el dibujo, o se sube y
// baja con los botones mas y menos, y el escalon es la resolucion
// legible del aparato. El flotador y la aguja se posicionan en el valor
// vigente del modo; fuera de escala se fijan al extremo en color de
// advertencia mostrando el numero real, nunca recortado. El modo que
// DESPEJA una de las dos variables deja de capturarla: ahi el
// instrumento es un resultado.
//
// Convenciones de la pestana ejemplar: borradores con autosave en base
// metrica, resultados con desglose auditable, avisos tipados, gate de
// verificacion y errores de dominio atrapados como alerta destructiva
// (jamas NaN en pantalla).

import { el, reemplazar } from '../dom.js';
import {
  tarjeta,
  pintarAvisos,
  pintarDesglose,
  pintarResultado,
  pintarVerificacion,
  resultadoConfiable,
  pintarResultadoNoVerificado,
} from '../render.js';
import { crearCampoNumerico } from '../campos.js';
import { crearCampoHeredado } from '../heredado.js';
import { formatear, formatearTiempo } from '../formato.js';
import { nodosTubo } from './gas/tubo.js';
import { nodosManometro } from './gas/manometro.js';
import { decimalesDe, ajustar } from './gas/escala.js';
import { mostrarToast } from '../toast.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import { masaGas, despejePresion, despejeTiempo, despejeScfm } from '../../domain/flowmeter.js';
import { valorDefault } from '../../domain/defaults.js';
import { gPorScfEfectivo } from '../../domain/gas.js';

export const id = 'gas';

const GRID_2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };
const COLUMNA = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };

const MODOS = [
  { id: 'masa', etiqueta: 'Consumo (masa)', descripcion: 'consumo de gas' },
  { id: 'presion', etiqueta: 'Presión requerida', descripcion: 'presión requerida' },
  { id: 'tiempo', etiqueta: 'Tiempo requerido', descripcion: 'tiempo requerido' },
  { id: 'lectura', etiqueta: 'Lectura del flotador', descripcion: 'lectura del flotador' },
];

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const unidadMasa = unidad('masa', sistema);
  const decMasa = sistema === 'imperial' ? 2 : 1;

  let modo = borrador.modo ?? 'masa';
  let gEfectivoValor = null; // g/SCF confiable listo para calcular
  let gEfectivoAnulado = null;
  let lecturaTubo = null; // SCFM vigente del modo (capturada o despejada)
  let presionAguja = null; // psi vigente del modo (capturada o despejada)
  let ultimoCalculo = null; // datos planos listos para bitacora

  function alertaDestructiva(error) {
    return el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    );
  }

  // ---------------- Modo ----------------
  const botonesModo = new Map();
  const filaModos = el('div', { clase: 'grupo-modo' });
  for (const def of MODOS) {
    const boton = el('button', { clase: 'boton boton--contorno', 'aria-pressed': 'false' }, def.etiqueta);
    boton.addEventListener('click', () => {
      modo = def.id;
      ctx.guardarBorrador(id, { modo });
      pintarModo();
      recalcular();
    });
    botonesModo.set(def.id, boton);
    filaModos.append(boton);
  }

  function pintarModo() {
    for (const [modoId, boton] of botonesModo) {
      // El resalte del modo elegido lo pinta components.css desde
      // `aria-pressed`: no se intercambian variantes de boton aqui.
      boton.setAttribute('aria-pressed', modoId === modo ? 'true' : 'false');
    }
    // Cada modo despeja una variable: su campo se oculta y los otros
    // tres se capturan.
    campoMasa.elemento.classList.toggle('oculto', modo === 'masa');
    campoScfm.elemento.classList.toggle('oculto', modo === 'lectura');
    campoPsi.elemento.classList.toggle('oculto', modo === 'presion');
    campoTiempo.elemento.classList.toggle('oculto', modo === 'tiempo');
  }

  // ---------------- Campos (todos con borrador) ----------------
  // La masa objetivo es la que Forzamiento calcula por tabla a partir de
  // la dosis agronomica: es el mismo numero y hasta ahora habia que
  // apuntarlo de una pantalla y teclearlo en la otra.
  const masaDeForzamiento = ctx.resultado('masaPorTablaG');
  const campoMasa = crearCampoHeredado({
    ctx,
    tabId: id,
    clave: 'masaObjetivoG',
    claveManual: 'masaObjetivoManual',
    etiqueta: 'Masa de gas objetivo',
    magnitud: 'masa',
    sistema,
    ayuda:
      'El etileno que quieres inyectar en la corrida. Viene la masa por tabla que calculó ' +
      'Forzamiento; si inyectas otra cantidad, escríbela aquí.',
    fuente: 'Forzamiento',
    nombreDato: 'la masa por tabla',
    heredado: {
      valor: masaDeForzamiento?.valor ?? null,
      etiqueta: `por tabla, ${masaDeForzamiento?.detalle ?? ''}`,
    },
    aCampo: (gramos) =>
      Number.isFinite(gramos) ? Number(aSistema('masa', gramos, sistema).toPrecision(6)) : null,
    deCampo: (valor) => deSistema('masa', valor, sistema),
    formatearValor: (valor) => `${formatear(valor, decMasa)} ${unidadMasa}`,
    destino: { seccion: 'calibrar', tab: 'forzamiento' },
    textoSinDato:
      'Calcula el ajuste en Forzamiento para traer la masa por tabla, o escribe aquí la masa ' +
      'objetivo.',
    guardadoSinMarcaEsManual: true,
    alCambiar: () => recalcular(),
  });

  const campoScfm = crearCampoNumerico({
    etiqueta: 'Lectura del flotador',
    unidad: 'SCFM',
    valorInicial: borrador.scfm ?? null,
    ayuda: 'La raya de la escala donde flota la bola, en pies cúbicos estándar por minuto.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { scfm: valor });
      recalcular();
    },
  });

  const campoPsi = crearCampoNumerico({
    etiqueta: 'Presión manométrica en el rotámetro',
    unidad: 'psi',
    valorInicial: borrador.psiManometrica ?? null,
    ayuda:
      'La presión a la entrada del tubo. Con el gas comprimido la bola se queda corta y la corrección lo compensa.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { psiManometrica: valor });
      recalcular();
    },
  });

  // El tiempo de inyeccion de una tabla completa es el tiempo por tabla
  // que sale de Avance: se hereda, con su procedencia a la vista, en vez
  // de traerse con un boton que copiaba una vez y no dejaba rastro. El
  // calculo es el UNICO de la aplicacion (ctx.avanceDeAvance); antes esta
  // pantalla tenia su propia copia, que ignoraba el modo elegido en
  // Avance y traia el reporte de campo aunque ahi estuviera elegida la
  // marcha.
  const heredadoDeAvance = ctx.avanceDeAvance();
  const campoTiempo = crearCampoHeredado({
    ctx,
    tabId: id,
    clave: 'tiempoS',
    claveManual: 'tiempoManual',
    etiqueta: 'Tiempo de inyección',
    unidad: 's',
    ayuda:
      'Tiempo con la válvula abierta. Viene el tiempo por tabla que sale de Avance; si ' +
      'inyectas otro rato, escríbelo aquí y manda el tuyo.',
    fuente: 'Avance',
    nombreDato: 'el tiempo por tabla',
    heredado: {
      valor: heredadoDeAvance.avance
        ? Math.round(heredadoDeAvance.avance.valores.tiempoTotalS * 10) / 10
        : null,
      etiqueta: `por tabla, con la velocidad ${heredadoDeAvance.velocidad.etiqueta ?? ''}`,
      avisos: heredadoDeAvance.velocidad.avisos,
    },
    formatearValor: (valor) => formatearTiempo(valor),
    destino: { seccion: 'calibrar', tab: 'avance' },
    textoSinDato:
      'Captura en Avance los segundos por tramo o una marcha con régimen, o escribe aquí el ' +
      'tiempo de inyección.',
    guardadoSinMarcaEsManual: true,
    alCambiar: () => recalcular(),
  });

  function lecturas() {
    return {
      masaObjetivoG: deSistema('masa', campoMasa.obtener(), sistema),
      scfm: campoScfm.obtener(),
      psiManometrica: campoPsi.obtener(),
      tiempoS: campoTiempo.obtener(),
    };
  }

  // ---------------- Captura desde el instrumento ----------------
  // Los dos numeros que se leen en campo —SCFM del flujometro y psi del
  // manometro— se capturan tocando el dibujo o con los botones mas y
  // menos, sin teclado y con guantes. El campo de texto sigue siendo el
  // mismo: aqui solo se escribe en el, se guarda el borrador y se
  // recalcula, igual que si la persona lo hubiera tecleado.

  function fijarCaptura(campo, clave, valor) {
    campo.fijar(String(valor));
    ctx.guardarBorrador(id, { [clave]: valor });
    recalcular();
  }

  // Fila de captura: menos, cifra grande y mas. El escalon es la
  // resolucion legible del instrumento, no un numero inventado aqui.
  function filaPasos({ campo, clave, etiqueta, unidad, paso, minimo, maximo, arranque }) {
    const decimales = decimalesDe(paso);
    const cifra = el('span', { clase: 'captura__valor' }, '—');
    const unidadNodo = el('span', { clase: 'captura__unidad' }, unidad);
    const mover = (signo) => {
      const actual = campo.obtener();
      if (!Number.isFinite(actual)) {
        fijarCaptura(campo, clave, ajustar(arranque, paso, minimo, maximo));
        return;
      }
      // Con un valor ya fuera de escala (tecleado o traido de un
      // despeje), el escalon solo puede ACERCARLO al rango: un boton de
      // mas que baja el numero de golpe al tope se lee como un error.
      const piso = Math.min(minimo, actual);
      const techo = Math.max(maximo, actual);
      fijarCaptura(campo, clave, ajustar(actual + signo * paso, paso, piso, techo));
    };
    const menos = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        type: 'button',
        'aria-label': `Bajar ${etiqueta} un escalón de ${paso} ${unidad}`,
      },
      '−'
    );
    const mas = el(
      'button',
      {
        clase: 'boton boton--contorno boton--icono',
        type: 'button',
        'aria-label': `Subir ${etiqueta} un escalón de ${paso} ${unidad}`,
      },
      '+'
    );
    menos.addEventListener('click', () => mover(-1));
    mas.addEventListener('click', () => mover(1));
    const raiz = el('div', { clase: 'captura' }, menos, cifra, unidadNodo, mas);
    return {
      elemento: raiz,
      refrescar(activo) {
        const actual = campo.obtener();
        cifra.textContent = Number.isFinite(actual) ? formatear(actual, decimales) : '—';
        menos.disabled = !activo;
        mas.disabled = !activo;
        raiz.classList.toggle('oculto', !activo);
      },
    };
  }

  // ---------------- Masa por pie cubico estandar (siempre visible) ----
  const zonaGscf = el('div', { estilo: COLUMNA });

  function pintarGscf() {
    const nodos = [];
    gEfectivoValor = null;
    gEfectivoAnulado = null;
    const gas = ctx.gasActivo();
    const p = ctx.estado().parametros;
    if (!gas) {
      nodos.push(
        el(
          'div',
          { clase: 'alerta alerta--destructiva', role: 'alert' },
          el(
            'p',
            { clase: 'alerta__descripcion' },
            'Sin gas configurado: agrégalo en Sistema, Configuración para poder calcular.'
          )
        )
      );
    } else {
      try {
        const efectivo = gPorScfEfectivo({ gas });
        gEfectivoAnulado = efectivo.valores.anulado;
        nodos.push(
          el(
            'div',
            { clase: 'fila-control' },
            efectivo.valores.anulado
              ? el('span', { clase: 'badge badge--advertencia' }, 'ANULADO manualmente')
              : el('span', { clase: 'badge badge--secundario' }, 'derivado del peso molecular'),
            el('span', {}, gas.nombre)
          )
        );
        nodos.push(...pintarAvisos(efectivo.avisos));
        if (!resultadoConfiable(efectivo)) {
          nodos.push(
            pintarResultadoNoVerificado('Masa por pie cúbico estándar'),
            pintarVerificacion(efectivo.verificacion)
          );
        } else {
          gEfectivoValor = efectivo.valores.gPorScf;
          nodos.push(
            pintarResultado({
              etiqueta: 'Masa por pie cúbico estándar',
              valor: efectivo.valores.gPorScf,
              unidad: 'g/SCF',
              decimales: 3,
              principal: true,
              ayuda:
                'Cuántos gramos de gas pesa un pie cúbico en las condiciones para las que se ' +
                'calibró el rotámetro. Es lo que convierte lo que marca el flotador —volumen— ' +
                'en gramos aplicados, así que entra en todos los cálculos de esta pantalla.',
            }),
            pintarVerificacion(efectivo.verificacion),
            pintarDesglose(efectivo.desglose)
          );
        }
        nodos.push(
          el(
            'div',
            { estilo: GRID_2 },
            pintarResultado({
              etiqueta: 'Presión estándar de calibración',
              valor: gas.presionEstandarPsia,
              unidad: 'psia',
              decimales: 2,
              ayuda:
                'La presión para la que el fabricante grabó la escala del rotámetro. Es un dato ' +
                'del aparato, no del lote, y se edita en Sistema, Configuración.',
            }),
            pintarResultado({
              etiqueta: 'Presión atmosférica local',
              valor: ctx.atmosferaSitio().valores.presionPsia,
              unidad: 'psia',
              decimales: 2,
              ayuda:
                'La presión del aire en el rancho, calculada desde su altura sobre el nivel del ' +
                'mar. Se suma a lo que marca el manómetro para llegar a la presión absoluta ' +
                'con la que trabaja la corrección.',
            })
          )
        );
      } catch (error) {
        nodos.push(alertaDestructiva(error));
      }
    }
    reemplazar(zonaGscf, nodos);
  }

  // ---------------- Resultado por modo ----------------
  const zonaResultado = el('div', { estilo: COLUMNA });

  function pintarCentral() {
    const nodos = [];
    ultimoCalculo = null;
    lecturaTubo = null;
    presionAguja = null;
    try {
      const gas = ctx.gasActivo();
      const p = ctx.estado().parametros;
      const { masaObjetivoG, scfm, psiManometrica, tiempoS } = lecturas();

      // Los instrumentos reflejan lo capturado en cuanto existe, aunque
      // el calculo del modo aun este incompleto. El modo que despeja la
      // variable no la toma de la captura: la pone su resultado.
      if (modo !== 'lectura' && Number.isFinite(scfm)) {
        lecturaTubo = scfm;
      }
      if (modo !== 'presion' && Number.isFinite(psiManometrica)) {
        presionAguja = psiManometrica;
      }

      if (!gas) {
        nodos.push(
          el('p', { clase: 'texto-suave' }, 'Sin gas configurado no hay nada que calcular.')
        );
      } else if (gEfectivoValor === null) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--destructiva', role: 'alert' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              'La masa por pie cúbico estándar no está disponible o no está verificada: revisa la tarjeta de arriba antes de calcular.'
            )
          )
        );
      } else {
        const rotametro = ctx.rotametroActivo();
        const base = {
          gPorScf: gEfectivoValor,
          presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
          presionEstandarCalibracion: gas.presionEstandarPsia,
        };
        const comunes = {
          modo,
          gasId: gas.id,
          gasNombre: gas.nombre,
          gPorScf: gEfectivoValor,
          gPorScfAnulado: gEfectivoAnulado,
          presionEstandarCalibracionPsia: gas.presionEstandarPsia,
          presionAtmosfericaLocalPsia: ctx.presionAtmosfericaLocal(),
          rotametroId: rotametro?.id ?? null,
          rotametroModelo: rotametro?.modelo ?? null,
          escalaMinScfm: rotametro?.escalaMin ?? null,
          escalaMaxScfm: rotametro?.escalaMax ?? null,
        };

        if (modo === 'masa') {
          if (scfm === null || psiManometrica === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura lectura del flotador, presión manométrica y tiempo para calcular la masa inyectada.'
              )
            );
          } else {
            const resultado = masaGas({ scfm, psiManometrica, tiempoS, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Masa de gas inyectada'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Masa de gas inyectada',
                    valor: aSistema('masa', resultado.valores.masaG, sistema),
                    unidad: unidadMasa,
                    decimales: decMasa,
                    principal: true,
                    ayuda:
                      'El gas que salió del cilindro con esa lectura, esa presión y ese tiempo. ' +
                      'Es gas INYECTADO al tanque, no el que se queda disuelto en el agua: para ' +
                      'saber lo que de verdad se fue, pesa el cilindro.',
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                    ayuda:
                      'La escala del rotámetro está grabada para una presión de referencia. Si ' +
                      'el gas entra más comprimido va más denso y el flotador se queda corto: ' +
                      'este número corrige esa diferencia. Arriba de 1 pasa más gas del que ' +
                      'marca la escala.',
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                scfm,
                psiManometrica,
                tiempoS,
                factor: resultado.valores.factor,
                masaG: resultado.valores.masaG,
              };
            }
          }
        } else if (modo === 'presion') {
          if (masaObjetivoG === null || scfm === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, lectura del flotador y tiempo para despejar la presión.'
              )
            );
          } else {
            const resultado = despejePresion({ masaObjetivoG, scfm, tiempoS, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Presión manométrica requerida'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              presionAguja = resultado.valores.psiManometrica;
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Presión manométrica requerida',
                    valor: resultado.valores.psiManometrica,
                    unidad: 'psi',
                    decimales: 2,
                    principal: true,
                    ayuda:
                      'A cuánto hay que dejar el regulador para inyectar la masa objetivo con ' +
                      'esa lectura de flotador y ese tiempo. Es lectura de manómetro: lo que ' +
                      'marca la carátula en el lote, sin sumarle la presión del aire.',
                  }),
                  pintarResultado({
                    etiqueta: 'Factor requerido',
                    valor: resultado.valores.factorRequerido,
                    unidad: '',
                    decimales: 4,
                    ayuda:
                      'La corrección por presión que haría falta para lograr el objetivo. De ' +
                      'aquí se despeja la presión de arriba: cuanto más lejos de 1, más presión ' +
                      'pide.',
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                scfm,
                tiempoS,
                factorRequerido: resultado.valores.factorRequerido,
                psiManometrica: resultado.valores.psiManometrica,
              };
            }
          }
        } else if (modo === 'tiempo') {
          if (masaObjetivoG === null || scfm === null || psiManometrica === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, lectura del flotador y presión manométrica para despejar el tiempo.'
              )
            );
          } else {
            const resultado = despejeTiempo({ masaObjetivoG, scfm, psiManometrica, ...base });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Tiempo requerido'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: `Tiempo requerido (${formatearTiempo(resultado.valores.tiempoS)})`,
                    valor: resultado.valores.tiempoS,
                    unidad: 's',
                    decimales: 0,
                    principal: true,
                    ayuda:
                      'Cuánto hay que tener abierta la válvula para inyectar la masa objetivo ' +
                      'con esa lectura y esa presión. Si sale más largo que el pase de la tabla, ' +
                      'no cabe: sube la lectura del flotador o la presión.',
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                    ayuda:
                      'La escala del rotámetro está grabada para una presión de referencia. Si ' +
                      'el gas entra más comprimido va más denso y el flotador se queda corto: ' +
                      'este número corrige esa diferencia. Arriba de 1 pasa más gas del que ' +
                      'marca la escala.',
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                scfm,
                psiManometrica,
                factor: resultado.valores.factor,
                tiempoS: resultado.valores.tiempoS,
              };
            }
          }
        } else if (modo === 'lectura') {
          if (masaObjetivoG === null || psiManometrica === null || tiempoS === null) {
            nodos.push(
              el(
                'p',
                { clase: 'texto-suave' },
                'Captura masa objetivo, presión manométrica y tiempo para despejar la lectura del flotador.'
              )
            );
          } else {
            const resultado = despejeScfm({
              masaObjetivoG,
              psiManometrica,
              tiempoS,
              ...base,
              rotametro: rotametro ?? null,
            });
            nodos.push(...pintarAvisos(resultado.avisos));
            if (!resultadoConfiable(resultado)) {
              nodos.push(
                pintarResultadoNoVerificado('Lectura de flotador requerida'),
                pintarVerificacion(resultado.verificacion)
              );
            } else {
              lecturaTubo = resultado.valores.scfm;
              nodos.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Lectura de flotador requerida',
                    valor: resultado.valores.scfm,
                    unidad: 'SCFM',
                    decimales: 2,
                    principal: true,
                    ayuda:
                      'Dónde hay que dejar el flotador del rotámetro para inyectar la masa ' +
                      'objetivo en ese tiempo y a esa presión. Si el número cae fuera de la ' +
                      'escala del aparato, ajusta presión o tiempo hasta que entre.',
                  }),
                  pintarResultado({
                    etiqueta: 'Factor de corrección por presión',
                    valor: resultado.valores.factor,
                    unidad: '',
                    decimales: 4,
                    ayuda:
                      'La escala del rotámetro está grabada para una presión de referencia. Si ' +
                      'el gas entra más comprimido va más denso y el flotador se queda corto: ' +
                      'este número corrige esa diferencia. Arriba de 1 pasa más gas del que ' +
                      'marca la escala.',
                  })
                ),
                pintarVerificacion(resultado.verificacion),
                pintarDesglose(resultado.desglose)
              );
              ultimoCalculo = {
                ...comunes,
                masaObjetivoG,
                psiManometrica,
                tiempoS,
                factor: resultado.valores.factor,
                scfm: resultado.valores.scfm,
              };
            }
          }
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaResultado, nodos);
  }

  // ---------------- Bitacora ----------------
  const botonBitacora = el('button', { clase: 'boton' }, 'Guardar en bitácora');
  botonBitacora.addEventListener('click', () => {
    if (!ultimoCalculo) {
      mostrarToast(
        'Completa el cálculo antes de guardar: faltan capturas o el resultado no está verificado.',
        { tipo: 'destructivo' }
      );
      return;
    }
    const c = ultimoCalculo;
    const etiquetaModo = MODOS.find((m) => m.id === c.modo)?.descripcion ?? c.modo;
    let resumen = '';
    if (c.modo === 'masa') {
      resumen =
        `${formatear(c.masaG, 1)} g inyectados con ${formatear(c.scfm, 2)} SCFM a ` +
        `${formatear(c.psiManometrica, 1)} psi durante ${formatearTiempo(c.tiempoS)}.`;
    } else if (c.modo === 'presion') {
      resumen =
        `Se requieren ${formatear(c.psiManometrica, 2)} psi manométricas para ${formatear(c.masaObjetivoG, 1)} g ` +
        `con ${formatear(c.scfm, 2)} SCFM en ${formatearTiempo(c.tiempoS)}.`;
    } else if (c.modo === 'tiempo') {
      resumen =
        `Se requieren ${formatearTiempo(c.tiempoS)} para ${formatear(c.masaObjetivoG, 1)} g ` +
        `con ${formatear(c.scfm, 2)} SCFM a ${formatear(c.psiManometrica, 1)} psi.`;
    } else {
      resumen =
        `Flotador en ${formatear(c.scfm, 2)} SCFM para ${formatear(c.masaObjetivoG, 1)} g ` +
        `a ${formatear(c.psiManometrica, 1)} psi en ${formatearTiempo(c.tiempoS)}.`;
    }
    const registroBase = {
      id: `gas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'gas',
      fecha: new Date().toISOString(),
      titulo: `Gas etileno: ${etiquetaModo}`,
      resumen,
      datos: { ...c },
    };
    ctx.almacen.actualizar((e) => {
      // El snapshot es COPIA de los parametros vigentes, no referencia:
      // el registro historico conserva los numeros con los que se calculo.
      e.bitacora.push({
        ...registroBase,
        parametros: JSON.parse(
          JSON.stringify({
            parametros: e.parametros,
            tractor: ctx.tractorActivo(),
            equipo: ctx.equipoActivo(),
          })
        ),
      });
    }, 'datos');
    mostrarToast('Cálculo de gas guardado en la bitácora.');
  });

  // ---------------- Tubo del rotametro en SVG ----------------
  // El dibujo vive en ./gas/tubo.js: aqui solo se le pasa el estado
  // vigente y se cuelga lo que devuelve.
  const zonaTubo = el('div', { estilo: COLUMNA });

  function dibujarTubo() {
    reemplazar(
      zonaTubo,
      nodosTubo({
        rotametro: ctx.rotametroActivo(),
        lectura: lecturaTubo,
        // En el modo que DESPEJA la lectura el tubo es un resultado.
        capturable: modo !== 'lectura',
        presionEstandarPsia: ctx.gasActivo()?.presionEstandarPsia,
        alCapturar: (valor) => fijarCaptura(campoScfm, 'scfm', valor),
      })
    );
  }

  // ---------------- Manometro en SVG ----------------
  // El fondo de escala y la resolucion de la caratula son parametros
  // (Sistema, Configuracion), igual que la escala del rotametro: aqui no
  // se inventa ningun numero de dominio. El dibujo vive en
  // ./gas/manometro.js.
  const cfgManometro = ctx.estado().parametros.manometro ?? {
    escalaMaxPsi: valorDefault('manometro', 'escalaMaxPsi'),
    resolucionPsi: valorDefault('manometro', 'resolucionPsi'),
  };
  const zonaManometro = el('div', { estilo: COLUMNA });

  function dibujarManometro() {
    reemplazar(
      zonaManometro,
      nodosManometro({
        maxPsi: cfgManometro.escalaMaxPsi,
        resPsi: cfgManometro.resolucionPsi,
        presion: presionAguja,
        capturable: modo !== 'presion',
        alCapturar: (valor) => fijarCaptura(campoPsi, 'psiManometrica', valor),
      })
    );
  }

  // ---------------- Filas de captura rapida ----------------
  const rotametroMontaje = ctx.rotametroActivo();
  const pasosScfm = filaPasos({
    campo: campoScfm,
    clave: 'scfm',
    etiqueta: 'la lectura del flotador',
    unidad: 'SCFM',
    paso: rotametroMontaje?.resolucion > 0 ? rotametroMontaje.resolucion : 0.1,
    minimo: rotametroMontaje?.escalaMin ?? 0,
    maximo: rotametroMontaje?.escalaMax ?? Number.MAX_SAFE_INTEGER,
    arranque: rotametroMontaje?.escalaMin ?? 0,
  });
  const pasosPsi = filaPasos({
    campo: campoPsi,
    clave: 'psiManometrica',
    etiqueta: 'la presión manométrica',
    unidad: 'psi',
    paso: cfgManometro.resolucionPsi,
    minimo: 0,
    maximo: cfgManometro.escalaMaxPsi,
    arranque: 0,
  });

  function recalcular() {
    pintarGscf();
    pintarCentral();
    dibujarTubo();
    dibujarManometro();
    pasosScfm.refrescar(modo !== 'lectura');
    pasosPsi.refrescar(modo !== 'presion');
  }

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Gas etileno',
        descripcion:
          'Los cuatro modos del rotámetro: mide el consumo o despeja la presión, el tiempo o la lectura que logran la masa objetivo.',
      },
      filaModos,
      el(
        'div',
        { estilo: COLUMNA },
        campoMasa.elemento,
        campoScfm.elemento,
        campoPsi.elemento,
        campoTiempo.elemento
      )
    ),
    // Los dos instrumentos van ANTES del resultado: son la superficie de
    // captura de los dos numeros que se leen en campo, no una ilustracion
    // al final de la pantalla.
    tarjeta(
      {
        titulo: 'Tubo del rotámetro',
        descripcion:
          'La escala configurada, con el flotador en la lectura vigente del modo. Es también donde se captura la lectura.',
      },
      zonaTubo,
      pasosScfm.elemento
    ),
    tarjeta(
      {
        titulo: 'Manómetro',
        descripcion:
          'La carátula a la entrada del tubo, con la aguja en la presión vigente del modo. Es también donde se captura la presión.',
      },
      zonaManometro,
      pasosPsi.elemento
    ),
    tarjeta(
      {
        titulo: 'Masa por pie cúbico estándar',
        descripcion: 'El valor efectivo del gas activo que usan todos los modos.',
        // Las dos presiones se confunden seguido, pero la aclaracion se
        // lee una vez y estorba en todas las demas: va en el "?".
        ayuda:
          'Son dos cosas distintas: la estándar es con la que el fabricante calibró el tubo; ' +
          'la local es la del sitio, y es la que resta el despeje. ' +
          (ctx.atmosferaSitio().valores.anulado
            ? 'La local está anulada a mano.'
            : `La local sale de los ${formatear(ctx.estado().parametros.sitio.altitudM, 0)} m de altitud del sitio.`) +
          ' Ambas se editan en Sistema, Configuración.',
      },
      zonaGscf
    ),
    tarjeta({ titulo: 'Resultado' }, zonaResultado, botonBitacora)
  );

  pintarModo();
  recalcular();
}
