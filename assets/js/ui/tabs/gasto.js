// Pestana Gasto de agua (dominio B): caudal de la boquilla a la presion
// de trabajo, volumen de aplicacion por los DOS metodos (por boquilla y
// por barra completa, siempre juntos), modo inverso desde el volumen
// objetivo y efecto del regimen del motor sobre la bomba.
//
// Convenciones de la pestana ejemplar (avance.js): borradores con
// autosave en base metrica, resultados con desglose auditable, avisos
// tipados del dominio y errores de calculo atrapados como alerta
// destructiva (jamas NaN en pantalla).

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
import { crearCampoSelect } from '../campos.js';
import { crearCampoDato, valorDeDato, fijarDato } from '../dato.js';
import { crearCampoHeredado } from '../heredado.js';
import { formatear } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { crearCombobox } from '../combobox.js';
import { estiloBadgeIso } from '../color.js';
import { aSistema, unidad } from '../../domain/units.js';
import { redondeoLegible, geometria, calibrarMarcha } from '../../domain/speed.js';
import {
  caudalAPresionDetallado,
  caudalConDensidadDetallado,
  volumenEquivalenteEnAgua,
  clasificarGota,
  distanciaAlCentroDeRango,
} from '../../domain/nozzles.js';
import { ambosMetodos, presionRequerida, velocidadRequerida } from '../../domain/water.js';
import {
  estadoBombaARegimen,
  contrasteVolumenPorRegimen,
  ESCENARIOS_BOMBA,
} from '../../domain/pump.js';
import { filaIso } from '../../data/iso-colors.js';
import { CLASES_POR_EDICION, GUIA_USO_GOTA } from '../../data/droplet-classes.js';

export const id = 'gasto';

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const tractor = ctx.tractorActivo();
  const equipo = ctx.equipoActivo();
  const catalogo = ctx.estado().catalogo;

  const unidadPresion = unidad('presion', sistema);
  const unidadVelocidad = unidad('velocidad', sistema);
  const unidadCaudal = unidad('caudal', sistema);
  const unidadVolumen = unidad('volumenAplicacion', sistema);
  const unidadEspaciamiento = unidad('distanciaCorta', sistema);

  // Seleccion de boquilla: el borrador gana; si no hay, la instalada en
  // el equipo activo.
  let boquillaId = valorDeDato(ctx, 'boquillaId').valor;
  let variableLibre = borrador.variableLibre ?? 'presion';
  let ultimoCalculo = null; // resultado central listo para bitacora

  function boquillaActiva() {
    return catalogo.find((b) => b.id === boquillaId) ?? null;
  }

  // Valor inicial de un campo: el borrador vive en base metrica y se
  // muestra convertido al sistema vigente, con redondeo legible para no
  // pintar colas de flotante en el input.
  function precarga(magnitud, valorMetrico) {
    if (valorMetrico === null || valorMetrico === undefined) return null;
    return redondeoLegible(aSistema(magnitud, valorMetrico, sistema));
  }

  // Caudal de la boquilla a una presion dada: con agua y con el caldo
  // (un caldo mas denso sale mas despacio por la misma boquilla). Se usan
  // las variantes detalladas del dominio para regresar tambien el
  // desglose auditable: un solo desglose que combina el escalado
  // presion-caudal y, si aplica, la correccion por densidad.
  function caudales(boquilla, presionBar, densidadRelativa) {
    const conAgua = caudalAPresionDetallado({
      caudalRef: boquilla.caudalRefLmin,
      presionRef: boquilla.presionRefBar,
      presion: presionBar,
      exponente: boquilla.exponente,
    });
    const agua = conAgua.valores.caudalLmin;
    if (densidadRelativa === 1) {
      return { agua, caldo: agua, desglose: conAgua.desglose };
    }
    const conCaldo = caudalConDensidadDetallado({ caudalAguaLmin: agua, densidadRelativa });
    return {
      agua,
      caldo: conCaldo.valores.caudalCaldoLmin,
      desglose: [...conAgua.desglose, ...conCaldo.desglose],
    };
  }

  function alertaDestructiva(error) {
    return el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    );
  }

  // ---------------- Combobox de boquilla ----------------
  const opcionesBoquilla = catalogo.map((b) => {
    const iso = b.tamanoIso ? filaIso(b.tamanoIso) : null;
    return {
      valor: b.id,
      texto: `${b.fabricante} ${b.modelo}`,
      detalle: `${formatear(aSistema('caudal', b.caudalRefLmin, sistema), 2)} ${unidadCaudal} a ${formatear(aSistema('presion', b.presionRefBar, sistema), 1)} ${unidadPresion}`,
      colorHex: iso?.hex ?? null,
    };
  });
  const combo = crearCombobox({
    id: 'gasto-boquilla',
    opciones: opcionesBoquilla,
    placeholder: 'Buscar en el catálogo…',
    alSeleccionar: (opcion) => {
      boquillaId = opcion.valor;
      fijarDato(ctx, 'boquillaId', boquillaId);
      pintarBoquilla();
      recalcular();
    },
  });
  {
    const inicial = boquillaActiva();
    if (inicial) combo.fijarTexto(`${inicial.fabricante} ${inicial.modelo}`);
  }
  const zonaBoquilla = el('div', {});

  function pintarBoquilla() {
    const b = boquillaActiva();
    if (!b) {
      reemplazar(
        zonaBoquilla,
        el(
          'p',
          { clase: 'texto-suave' },
          'Sin boquilla elegida. Búscala en el catálogo o asígnala a la barra en Sistema, Configuración.'
        )
      );
      return;
    }
    const iso = b.tamanoIso ? filaIso(b.tamanoIso) : null;
    reemplazar(
      zonaBoquilla,
      el(
        'div',
        { clase: 'fila-control' },
        iso && iso.hex
          ? el('span', { clase: 'badge badge--iso', estilo: estiloBadgeIso(iso.hex) }, `ISO ${b.tamanoIso}`)
          : el('span', { clase: 'badge badge--contorno' }, b.tamanoIso ? `ISO ${b.tamanoIso}` : 'sin código ISO'),
        el('span', {}, `${b.fabricante} ${b.modelo}`),
        b.id === equipo?.boquillaId
          ? el('span', { clase: 'badge badge--secundario' }, 'instalada en la barra')
          : null
      ),
      el(
        'p',
        { clase: 'ayuda' },
        `Rango de presión de la ficha: ${formatear(aSistema('presion', b.presionMinBar, sistema), 1)} a ` +
          `${formatear(aSistema('presion', b.presionMaxBar, sistema), 1)} ${unidadPresion}. ` +
          `Exponente presión-caudal de esta boquilla: ${b.exponente}.`
      )
    );
  }

  // ---------------- Captura de trabajo ----------------
  // Los cinco datos que esta pantalla comparte con el asistente y con
  // la Prueba de captura los monta `ui/dato.js` a partir del registro
  // (domain/datos.js): la etiqueta, la unidad, la ayuda y —sobre todo—
  // el SITIO donde se guardan salen de ahi. Antes cada pantalla los
  // declaraba por su cuenta y guardaba su propia copia en su borrador,
  // asi que una calibracion guiada pedia la misma presion tres veces.
  const campoPresion = crearCampoDato(ctx, 'presionBar', {
    sistema,
    alCambiar: () => recalcular(),
  });

  // La velocidad de trabajo se hereda de Avance por defecto; escribir
  // aqui la vuelve captura manual y esa manda.
  const campoVelocidad = crearCampoDato(ctx, 'velocidadKmh', {
    sistema,
    alCambiar: () => recalcular(),
  });

  const campoAncho = crearCampoDato(ctx, 'anchoBarraM', {
    sistema,
    ayuda: `Viene de la barra «${equipo?.nombre ?? 'sin barra'}». Cambiarlo aquí no toca la configuración.`,
    alCambiar: () => recalcular(),
  });
  const campoNumBoquillas = crearCampoDato(ctx, 'numBoquillas', {
    sistema,
    alCambiar: () => recalcular(),
  });
  const campoEspaciamiento = crearCampoDato(ctx, 'espaciamientoM', {
    sistema,
    alCambiar: () => recalcular(),
  });

  function lecturas() {
    return {
      // Los campos de dato devuelven el valor en base metrica: la
      // conversion vive dentro del campo, no repetida en cada lectura.
      presionBar: campoPresion.obtenerBase(),
      velocidadKmh: campoVelocidad.obtenerBase(),
      anchoBarraM: campoAncho.obtenerBase(),
      numBoquillas: campoNumBoquillas.obtenerBase(),
      espaciamientoM: campoEspaciamiento.obtenerBase(),
      lhaObjetivo: campoObjetivo.obtenerBase(),
      rpmTrabajo: campoRpmTrabajo.obtener(),
    };
  }

  // ---------------- Clase de gota ----------------
  function nodoClaseGota(boquilla, presionBar, prefijo) {
    const clase = clasificarGota({ boquilla, presionBar });
    if (clase === null) {
      return el(
        'p',
        { clase: 'ayuda' },
        `${prefijo}: la ficha de esta boquilla no publica clase de gota a esta presión.`
      );
    }
    const edicion = boquilla.edicionEstandar;
    const categoria =
      (CLASES_POR_EDICION[edicion]?.categorias ?? []).find((c) => c.simbolo === clase) ?? null;
    return el(
      'div',
      {},
      el(
        'p',
        {},
        el('span', { clase: 'badge badge--secundario' }, clase),
        ` ${prefijo}: ${categoria ? categoria.nombre.toLowerCase() : 'clase ' + clase}, clasificada según ` +
          `${edicion ?? 'el estándar del fabricante'} (las clases no se comparan entre ediciones distintas).`
      ),
      GUIA_USO_GOTA[clase] ? el('p', { clase: 'ayuda' }, GUIA_USO_GOTA[clase]) : null
    );
  }

  // ---------------- Caudal de la boquilla ----------------
  const zonaCaudal = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

  function pintarCaudal() {
    const nodos = [];
    try {
      const b = boquillaActiva();
      const { presionBar } = lecturas();
      const dr = ctx.estado().parametros.caldo.densidadRelativa;
      if (!b || presionBar === null) {
        nodos.push(
          el('p', { clase: 'texto-suave' }, 'Elige una boquilla y captura la presión para calcular su caudal.')
        );
      } else {
        const distancia = distanciaAlCentroDeRango({
          presion: presionBar,
          presionMin: b.presionMinBar,
          presionMax: b.presionMaxBar,
        });
        if (distancia > 1) {
          nodos.push(
            el(
              'div',
              { clase: 'alerta alerta--advertencia', role: 'alert' },
              el(
                'p',
                { clase: 'alerta__descripcion' },
                `La presión capturada queda fuera del rango de operación de la ficha ` +
                  `(${formatear(aSistema('presion', b.presionMinBar, sistema), 1)} a ` +
                  `${formatear(aSistema('presion', b.presionMaxBar, sistema), 1)} ${unidadPresion}): ` +
                  'el caudal calculado se extrapola y el patrón de aspersión puede ser defectuoso.'
              )
            )
          );
        }
        const q = caudales(b, presionBar, dr);
        if (dr === 1) {
          nodos.push(
            pintarResultado({
              etiqueta: 'Caudal de la boquilla a esta presión',
              valor: aSistema('caudal', q.agua, sistema),
              unidad: unidadCaudal,
              decimales: 3,
              principal: true,
              ayuda:
                'Lo que entrega una boquilla nueva de este modelo a la presión capturada, según ' +
                'la curva de su ficha. Es un valor de catálogo: para saber lo que da la barra ' +
                'hoy hay que aforarla en Captura por boquilla.',
            }),
            pintarDesglose(q.desglose)
          );
        } else {
          nodos.push(
            el(
              'div',
              { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
              pintarResultado({
                etiqueta: 'Caudal con agua',
                valor: aSistema('caudal', q.agua, sistema),
                unidad: unidadCaudal,
                decimales: 3,
                ayuda:
                  'Lo que marca la ficha de la boquilla a esta presión. Las fichas se miden con ' +
                  'agua limpia, así que este es el número que verías si aforas con agua.',
              }),
              pintarResultado({
                etiqueta: 'Caudal con el caldo',
                valor: aSistema('caudal', q.caldo, sistema),
                unidad: unidadCaudal,
                decimales: 3,
                principal: true,
                ayuda:
                  'Lo que sale de verdad con el caldo cargado: más denso que el agua, sale más ' +
                  'despacio por el mismo orificio. Es el caudal con el que se calcula el volumen ' +
                  'por hectárea.',
              })
            ),
            pintarDesglose(q.desglose),
            el(
              'p',
              { clase: 'ayuda' },
              `Densidad relativa del caldo: ${formatear(dr, 2)}. Un caldo más denso sale más despacio ` +
                'por la misma boquilla (q_caldo = q_agua / raíz(dr)), y el volumen se calcula con ese ' +
                'caudal, que es el que de verdad sale.'
            )
          );
        }
        nodos.push(nodoClaseGota(b, presionBar, 'Clase de gota a esta presión'));
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaCaudal, nodos);
  }

  // ---------------- Resultado central: los dos metodos ----------------
  const zonaCentral = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

  function pintarCentral() {
    const nodos = [];
    ultimoCalculo = null;
    try {
      const b = boquillaActiva();
      const { presionBar, velocidadKmh, anchoBarraM, numBoquillas, espaciamientoM } = lecturas();
      const p = ctx.estado().parametros;
      const dr = p.caldo.densidadRelativa;
      if (
        !b ||
        presionBar === null ||
        velocidadKmh === null ||
        anchoBarraM === null ||
        numBoquillas === null ||
        espaciamientoM === null
      ) {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Captura boquilla, presión, velocidad, ancho de barra, número de boquillas y espaciamiento para calcular los dos métodos.'
          )
        );
      } else {
        // Guardas de plausibilidad del espaciamiento capturado (dominio):
        // detecta captura en centimetros y discrepancia contra el
        // derivado del ancho entre el numero de boquillas configurados.
        try {
          const g = geometria({ ...ctx.parametrosGeometria(), espaciamientoCapturado: espaciamientoM });
          nodos.push(...pintarAvisos(g.avisos));
        } catch {
          // La geometria configurada no bloquea el calculo central: los
          // dos metodos solo dependen de las capturas del dia.
        }
        const q = caudales(b, presionBar, dr);
        const resultado = ambosMetodos({
          caudalBoquillaLmin: q.caldo,
          numBoquillas,
          velocidadKmh,
          espaciamientoM,
          anchoBarraM,
          umbralDiscrepanciaPct: p.umbrales.umbralDiscrepanciaMetodos,
        });
        nodos.push(...pintarAvisos(resultado.avisos));
        if (!resultadoConfiable(resultado)) {
          nodos.push(
            pintarResultadoNoVerificado('Volumen de aplicación'),
            pintarVerificacion(resultado.verificacion)
          );
        } else {
          nodos.push(
            el(
              'div',
              { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
              pintarResultado({
                etiqueta: 'Método por boquilla',
                valor: aSistema('volumenAplicacion', resultado.valores.lhaPorBoquilla, sistema),
                unidad: unidadVolumen,
                decimales: 1,
                principal: true,
                ayuda:
                  'Los litros por hectárea calculados con UNA boquilla y la distancia que hay ' +
                  'entre ellas. Mira la franja que moja una sola boquilla.',
              }),
              pintarResultado({
                etiqueta: 'Método por barra',
                valor: aSistema('volumenAplicacion', resultado.valores.lhaPorBarra, sistema),
                unidad: unidadVolumen,
                decimales: 1,
                principal: true,
                ayuda:
                  'Los mismos litros por hectárea, pero con el caudal de TODA la barra y su ' +
                  'ancho completo. Son dos caminos distintos al mismo número: si coinciden, la ' +
                  'geometría capturada cuadra.',
              })
            ),
            el(
              'div',
              { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
              pintarResultado({
                etiqueta: 'Discrepancia entre métodos',
                valor: resultado.valores.discrepanciaPct,
                unidad: '%',
                decimales: 2,
                ayuda:
                  'Qué tanto se separan los dos métodos. Cerca de cero es lo normal. Si se abre, ' +
                  'el espaciamiento por el número de boquillas no da el ancho de barra: hay un ' +
                  'dato mal capturado o la barra no es como está configurada.',
              }),
              pintarResultado({
                etiqueta: 'Caudal total de la barra',
                valor: aSistema('caudal', resultado.valores.caudalTotalLmin, sistema),
                unidad: unidadCaudal,
                decimales: 2,
                ayuda:
                  'Todo lo que sale por la barra junta: el caudal de una boquilla por el número ' +
                  'de boquillas. Sirve para saber si la bomba alcanza a surtirla.',
              })
            ),
            pintarVerificacion(resultado.verificacion),
            pintarDesglose(resultado.desglose)
          );
          ultimoCalculo = {
            boquillaId: b.id,
            fabricante: b.fabricante,
            modeloBoquilla: b.modelo,
            presionBar,
            velocidadKmh,
            anchoBarraM,
            numBoquillas,
            espaciamientoM,
            densidadRelativa: dr,
            caudalAguaLmin: q.agua,
            caudalCaldoLmin: q.caldo,
            caudalTotalLmin: resultado.valores.caudalTotalLmin,
            claseGota: clasificarGota({ boquilla: b, presionBar }),
            edicionEstandar: b.edicionEstandar ?? null,
            lhaPorBoquilla: resultado.valores.lhaPorBoquilla,
            lhaPorBarra: resultado.valores.lhaPorBarra,
            discrepanciaPct: resultado.valores.discrepanciaPct,
          };
          // El volumen calculado queda a disposicion de las pantallas que
          // lo necesitan de entrada (Mezcla y Forzamiento). Solo se
          // publica el verificado: un numero que no paso el gate de
          // verificacion no se muestra aqui, asi que menos todavia puede
          // irse a decidir la dosis de producto de otro tanque. Se publica
          // el metodo por boquilla, que es el que responde a lo capturado
          // en esta pantalla; la discrepancia contra el de barra ya se
          // advierte arriba.
          ctx.guardarResultado('lhaCalculado', {
            valor: resultado.valores.lhaPorBoquilla,
            origen: 'gasto',
            detalle: `calculada en Gasto de agua con ${b.fabricante} ${b.modelo}`,
          });
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaCentral, nodos);
  }

  const botonBitacora = el('button', { clase: 'boton' }, 'Guardar en bitácora');
  botonBitacora.addEventListener('click', () => {
    if (!ultimoCalculo) {
      mostrarToast('Completa el cálculo central antes de guardar: faltan capturas o el resultado no está verificado.', {
        tipo: 'destructivo',
      });
      return;
    }
    const c = ultimoCalculo;
    const registroBase = {
      id: `gasto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'gasto-agua',
      fecha: new Date().toISOString(),
      titulo: `Gasto de agua: ${c.fabricante} ${c.modeloBoquilla}`,
      resumen:
        `${formatear(c.lhaPorBoquilla, 1)} L/ha por boquilla y ${formatear(c.lhaPorBarra, 1)} L/ha por barra, ` +
        `a ${formatear(c.presionBar, 2)} bar y ${formatear(c.velocidadKmh, 2)} km/h.`,
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
    mostrarToast('Cálculo de gasto guardado en la bitácora.');
  });

  // ---------------- Modo inverso ----------------
  const campoObjetivo = crearCampoDato(ctx, 'lhaObjetivo', {
    sistema,
    alCambiar: () => recalcularInverso(),
  });
  const selectVariable = crearCampoSelect({
    etiqueta: 'Variable libre a despejar',
    opciones: [
      { valor: 'presion', texto: 'Presión requerida en la boquilla elegida' },
      { valor: 'velocidad', texto: 'Velocidad requerida' },
      { valor: 'boquilla', texto: 'Boquilla recomendada del catálogo' },
    ],
    valorInicial: variableLibre,
    alCambiar: (valor) => {
      variableLibre = valor;
      ctx.guardarBorrador(id, { variableLibre });
      recalcularInverso();
    },
  });
  const zonaInverso = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

  function recalcularInverso() {
    const nodos = [];
    try {
      const b = boquillaActiva();
      const { presionBar, velocidadKmh, espaciamientoM, lhaObjetivo } = lecturas();
      const dr = ctx.estado().parametros.caldo.densidadRelativa;

      if (lhaObjetivo !== null && dr !== 1) {
        const objetivoAgua = volumenEquivalenteEnAgua({
          volumenCaldoLha: lhaObjetivo,
          densidadRelativa: dr,
        });
        nodos.push(
          pintarResultado({
            etiqueta: 'Objetivo equivalente en agua',
            valor: aSistema('volumenAplicacion', objetivoAgua, sistema),
            unidad: unidadVolumen,
            decimales: 1,
            ayuda:
              'El objetivo traducido a agua limpia. Las curvas de las fichas están medidas con ' +
              'agua, así que los despejes de abajo trabajan contra este número y no contra el ' +
              'objetivo de caldo.',
          }),
          el(
            'p',
            { clase: 'ayuda' },
            'Si aforas con agua limpia, apunta a este equivalente: el caldo, más denso, saldrá más ' +
              'despacio y entregará el volumen que buscas.'
          )
        );
      }

      if (variableLibre === 'boquilla') {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'La recomendación de boquilla tiene su propia pestaña: ahí se filtra el catálogo por caudal requerido y clase de gota.'
          )
        );
        const botonIr = el('button', { clase: 'boton boton--contorno' }, 'Ir a Boquillas');
        botonIr.addEventListener('click', () => ctx.navegarA('calibrar', 'boquillas'));
        nodos.push(botonIr);
      } else if (lhaObjetivo === null) {
        nodos.push(el('p', { clase: 'texto-suave' }, 'Captura el volumen objetivo para despejar.'));
      } else if (variableLibre === 'presion') {
        if (!b || velocidadKmh === null || espaciamientoM === null) {
          nodos.push(
            el(
              'p',
              { clase: 'texto-suave' },
              'Para despejar la presión hacen falta la boquilla, la velocidad y el espaciamiento capturados arriba.'
            )
          );
        } else {
          const objetivoParaDespeje =
            dr === 1
              ? lhaObjetivo
              : volumenEquivalenteEnAgua({ volumenCaldoLha: lhaObjetivo, densidadRelativa: dr });
          const resultado = presionRequerida({
            lhaObjetivo: objetivoParaDespeje,
            velocidadKmh,
            espaciamientoM,
            boquilla: b,
          });
          nodos.push(...pintarAvisos(resultado.avisos));
          if (!resultadoConfiable(resultado)) {
            nodos.push(
              pintarResultadoNoVerificado('Presión requerida'),
              pintarVerificacion(resultado.verificacion)
            );
          } else {
            nodos.push(
              pintarResultado({
                etiqueta: 'Presión requerida',
                valor: aSistema('presion', resultado.valores.presionRequeridaBar, sistema),
                unidad: unidadPresion,
                decimales: 2,
                principal: true,
                ayuda:
                  'A cuánto hay que poner el manómetro de la barra para que esta boquilla, a ' +
                  'esta velocidad, deje el volumen objetivo. Si el número cae fuera del rango de ' +
                  'la ficha, cambiar de tamaño de boquilla es mejor que forzar la presión.',
              }),
              pintarResultado({
                etiqueta: 'Caudal requerido por boquilla (en agua)',
                valor: aSistema('caudal', resultado.valores.caudalRequeridoLmin, sistema),
                unidad: unidadCaudal,
                decimales: 3,
                ayuda:
                  'El caudal que hay que lograr por boquilla, y del que sale la presión de ' +
                  'arriba. Va en agua porque así está medida la curva de la ficha.',
              }),
              nodoClaseGota(b, resultado.valores.presionRequeridaBar, 'Clase de gota a la presión requerida'),
              pintarVerificacion(resultado.verificacion),
              pintarDesglose(resultado.desglose)
            );
            if (dr !== 1) {
              nodos.push(
                el(
                  'p',
                  { clase: 'ayuda' },
                  'El despeje usa el objetivo equivalente en agua porque la curva presión-caudal de la ficha está medida con agua.'
                )
              );
            }
          }
        }
      } else if (variableLibre === 'velocidad') {
        if (!b || presionBar === null || espaciamientoM === null) {
          nodos.push(
            el(
              'p',
              { clase: 'texto-suave' },
              'Para despejar la velocidad hacen falta la boquilla, la presión y el espaciamiento capturados arriba.'
            )
          );
        } else {
          const q = caudales(b, presionBar, dr);
          const resultado = velocidadRequerida({
            caudalLmin: q.caldo,
            lhaObjetivo,
            espaciamientoM,
          });
          nodos.push(...pintarAvisos(resultado.avisos));
          if (!resultadoConfiable(resultado)) {
            nodos.push(
              pintarResultadoNoVerificado('Velocidad requerida'),
              pintarVerificacion(resultado.verificacion)
            );
          } else {
            nodos.push(
              pintarResultado({
                etiqueta: 'Velocidad requerida',
                valor: aSistema('velocidad', resultado.valores.velocidadKmh, sistema),
                unidad: unidadVelocidad,
                decimales: 2,
                principal: true,
                ayuda:
                  'A qué velocidad hay que ir para dejar el volumen objetivo sin tocar la ' +
                  'presión ni cambiar de boquilla. En Avance ves qué marcha y qué régimen la ' +
                  'reproducen.',
              }),
              pintarVerificacion(resultado.verificacion),
              pintarDesglose(resultado.desglose),
              el(
                'p',
                { clase: 'ayuda' },
                dr === 1
                  ? 'Con el caudal de la boquilla a la presión capturada. Revisa en Avance qué marcha y régimen reproducen esta velocidad.'
                  : 'Con el caudal del caldo a la presión capturada contra el objetivo de caldo. Revisa en Avance qué marcha y régimen reproducen esta velocidad.'
              )
            );
          }
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaInverso, nodos);
  }

  // ---------------- Efecto del regimen en la bomba ----------------
  // El regimen sale de Avance, con chip de procedencia y boton para
  // volver a heredarlo: antes era una precarga muda que leia el borrador
  // de Avance de frente y, en cuanto se tocaba una vez, quedaba
  // desconectada para siempre sin que nada lo dijera.
  const rpmDeAvance = ctx.borrador('avance').rpm ?? tractor?.regimenHabitual ?? null;
  const campoRpmTrabajo = crearCampoHeredado({
    ctx,
    tabId: id,
    clave: 'rpmTrabajo',
    claveManual: 'rpmTrabajoManual',
    etiqueta: 'Régimen de trabajo del motor',
    unidad: 'rpm',
    ayuda:
      'Viene de Avance. Si hoy trabajas a otro, escríbelo: según el tipo de bomba cambian la ' +
      'presión, el caudal y el volumen por hectárea.',
    fuente: 'Avance',
    nombreDato: 'el régimen',
    heredado: {
      valor: rpmDeAvance,
      etiqueta:
        Number.isFinite(ctx.borrador('avance').rpm)
          ? 'capturado en Avance'
          : `régimen habitual del ${tractor?.nombre ?? 'tractor'}`,
    },
    formatearValor: (valor) => `${formatear(valor, 0)} rpm`,
    destino: { seccion: 'calibrar', tab: 'avance' },
    textoSinDato: 'Captura el régimen del motor en Avance, o escríbelo aquí.',
    guardadoSinMarcaEsManual: true,
    alCambiar: () => recalcularBomba(),
  });
  const zonaBomba = el('div', { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } });

  const ETIQUETAS_ESCENARIO = {
    [ESCENARIOS_BOMBA.PRESION_SOSTENIDA]: 'Presión sostenida por el regulador',
    [ESCENARIOS_BOMBA.CENTRIFUGA_SIN_REGULACION]: 'Centrífuga sin regulación',
  };
  const EXPLICACION_ESCENARIO = {
    [ESCENARIOS_BOMBA.PRESION_SOSTENIDA]:
      'El regulador sostiene la presión y el gasto por boquilla, pero la velocidad de avance sí cambia con el régimen: el volumen por hectárea escala 1 entre la razón de régimen, sin que el manómetro lo delate.',
    [ESCENARIOS_BOMBA.CENTRIFUGA_SIN_REGULACION]:
      'Presión y caudal caen junto con la velocidad de avance: el volumen por hectárea se mantiene aproximadamente igual.',
  };

  function recalcularBomba() {
    const nodos = [];
    try {
      if (!equipo) {
        nodos.push(el('p', { clase: 'texto-suave' }, 'Sin barra de aplicación configurada.'));
      } else {
        if (equipo.rpmCalibracion === null || equipo.rpmCalibracion === undefined) {
          nodos.push(
            el(
              'div',
              { clase: 'alerta', role: 'status' },
              el(
                'p',
                { clase: 'alerta__descripcion' },
                'No hay registrado el régimen del motor de la última calibración de presión. ' +
                  'Captúralo en Sistema, Configuración para poder estimar el efecto del régimen sobre el gasto.'
              )
            )
          );
        } else {
          const b = boquillaActiva();
          const { presionBar, velocidadKmh, espaciamientoM, rpmTrabajo } = lecturas();
          const dr = ctx.estado().parametros.caldo.densidadRelativa;
          if (rpmTrabajo === null) {
            nodos.push(
              el('p', { clase: 'texto-suave' }, 'Captura el régimen de trabajo para estimar el estado de la bomba.')
            );
          } else {
            // Presion de referencia de la calibracion: la registrada en el
            // equipo; si falta, la presion capturada arriba (se asume que
            // es la de la calibracion vigente y se avisa).
            const presionBase = equipo.presionCalibracion ?? presionBar;
            const caudalBase = b && presionBase !== null ? caudales(b, presionBase, dr).caldo : null;
            if (
              equipo.presionCalibracion === null ||
              equipo.presionCalibracion === undefined
            ) {
              nodos.push(
                el(
                  'p',
                  { clase: 'ayuda' },
                  'La barra no tiene presión de calibración registrada: se usa la presión capturada arriba como referencia.'
                )
              );
            }
            const contrastable =
              caudalBase !== null && velocidadKmh !== null && espaciamientoM !== null;
            if (contrastable) {
              const contraste = contrasteVolumenPorRegimen({
                tipoBomba: equipo.tipoBomba,
                conRegulador: equipo.conRegulador,
                rpmTrabajo,
                rpmCalibracion: equipo.rpmCalibracion,
                presionCalibracionBar: presionBase,
                caudalCalibracionLmin: caudalBase,
                // Misma marcha a ambos regimenes: la velocidad capturada
                // se refiere al regimen de trabajo.
                kmhNominalMarcha: calibrarMarcha({
                  velocidadMedidaKmh: velocidadKmh,
                  rpmMedidas: rpmTrabajo,
                  regimenNominal: tractor.regimenNominal,
                }),
                regimenNominalTractor: tractor.regimenNominal,
                espaciamientoM,
              });
              // El aviso de modelo aproximado ya se pinta fijo abajo.
              nodos.push(
                ...pintarAvisos(contraste.avisos.filter((a) => a.codigo !== 'modelo-aproximado-bomba'))
              );
              const escenario = contraste.valores.escenario;
              nodos.push(
                el(
                  'p',
                  {},
                  el('span', { clase: 'badge badge--contorno' }, ETIQUETAS_ESCENARIO[escenario] ?? String(escenario)),
                  ` Razón de régimen: ${formatear(contraste.valores.razonRegimen, 3)}.`
                ),
                el('p', { clase: 'ayuda' }, EXPLICACION_ESCENARIO[escenario] ?? ''),
                el(
                  'div',
                  { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
                  pintarResultado({
                    etiqueta: 'Presión estimada',
                    valor: aSistema('presion', contraste.valores.presionEstimadaBar, sistema),
                    unidad: unidadPresion,
                    decimales: 2,
                    ayuda:
                      'A cuánto queda la presión de la barra al régimen de trabajo, partiendo de ' +
                      'la que tenía cuando se calibró. Es un modelo del comportamiento de la ' +
                      'bomba: el manómetro en el lote manda sobre esta estimación.',
                  }),
                  pintarResultado({
                    etiqueta: 'Caudal estimado por boquilla',
                    valor: aSistema('caudal', contraste.valores.caudalEstimadoLmin, sistema),
                    unidad: unidadCaudal,
                    decimales: 3,
                    ayuda:
                      'Lo que saldría por boquilla con esa presión estimada. También es modelo, ' +
                      'no medición: el aforo al régimen real manda.',
                  })
                )
              );
              if (!resultadoConfiable(contraste)) {
                nodos.push(
                  pintarResultadoNoVerificado('Contraste de volumen por hectárea'),
                  pintarVerificacion(contraste.verificacion)
                );
              } else {
                nodos.push(
                  el(
                    'div',
                    { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
                    pintarResultado({
                      etiqueta: 'Volumen al régimen de calibración',
                      valor: aSistema('volumenAplicacion', contraste.valores.volumenCalibracionLha, sistema),
                      unidad: unidadVolumen,
                      decimales: 1,
                      ayuda:
                        'Los litros por hectárea que dejaba la barra el día que se calibró, con ' +
                        'aquel régimen de motor. Es el punto de partida de la comparación.',
                    }),
                    pintarResultado({
                      etiqueta: 'Volumen al régimen de trabajo',
                      valor: aSistema('volumenAplicacion', contraste.valores.volumenTrabajoLha, sistema),
                      unidad: unidadVolumen,
                      decimales: 1,
                      ayuda:
                        'Los litros por hectárea estimados con el régimen al que estás ' +
                        'trabajando hoy. Cambian dos cosas a la vez: la bomba da otra presión y ' +
                        'el tractor va a otra velocidad.',
                    })
                  ),
                  pintarResultado({
                    etiqueta: 'Desviación del volumen por hectárea',
                    valor: contraste.valores.desviacionPct,
                    unidad: '%',
                    decimales: 1,
                    principal: true,
                    ayuda:
                      'Cuánto se movió el volumen por hectárea por trabajar a un régimen distinto ' +
                      'al de la calibración. Es la cifra que dice si vale la pena volver a ' +
                      'calibrar o ajustar la presión antes de entrar al lote.',
                  }),
                  pintarVerificacion(contraste.verificacion),
                  pintarDesglose(contraste.desglose)
                );
              }
            } else {
              const bomba = estadoBombaARegimen({
                tipoBomba: equipo.tipoBomba,
                conRegulador: equipo.conRegulador,
                rpmMotor: rpmTrabajo,
                rpmCalibracion: equipo.rpmCalibracion,
                presionCalibracionBar: presionBase,
                caudalCalibracionLmin: caudalBase,
              });
              nodos.push(...pintarAvisos(bomba.avisos));
              const escenario = bomba.valores.escenario;
              nodos.push(
                el(
                  'p',
                  {},
                  el('span', { clase: 'badge badge--contorno' }, ETIQUETAS_ESCENARIO[escenario] ?? String(escenario)),
                  ` Razón de régimen: ${formatear(bomba.valores.razonRegimen, 3)}.`
                ),
                el('p', { clase: 'ayuda' }, EXPLICACION_ESCENARIO[escenario] ?? ''),
                el(
                  'div',
                  { estilo: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' } },
                  pintarResultado({
                    etiqueta: 'Presión estimada',
                    valor: aSistema('presion', bomba.valores.presionEstimadaBar, sistema),
                    unidad: unidadPresion,
                    decimales: 2,
                    ayuda:
                      'A cuánto queda la presión de la barra al régimen de trabajo, partiendo de ' +
                      'la que tenía cuando se calibró. Es un modelo del comportamiento de la ' +
                      'bomba: el manómetro en el lote manda sobre esta estimación.',
                  }),
                  pintarResultado({
                    etiqueta: 'Caudal estimado por boquilla',
                    valor: aSistema('caudal', bomba.valores.caudalEstimadoLmin, sistema),
                    unidad: unidadCaudal,
                    decimales: 3,
                    ayuda:
                      'Lo que saldría por boquilla con esa presión estimada. También es modelo, ' +
                      'no medición: el aforo al régimen real manda.',
                  })
                ),
                pintarDesglose(bomba.desglose),
                el(
                  'p',
                  { clase: 'texto-suave' },
                  'Captura también boquilla, presión, velocidad y espaciamiento para ver el contraste de volumen por hectárea entre los dos regímenes.'
                )
              );
            }
          }
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    // Aviso SIEMPRE visible, con o sin calculo.
    nodos.push(
      el(
        'div',
        { clase: 'alerta', role: 'status' },
        el(
          'p',
          { clase: 'alerta__descripcion' },
          'Estos son modelos aproximados del comportamiento de la bomba: el aforo al régimen real de trabajo manda sobre cualquier estimación.'
        )
      )
    );
    reemplazar(zonaBomba, nodos);
  }

  function recalcular() {
    pintarCaudal();
    pintarCentral();
    recalcularInverso();
    recalcularBomba();
  }

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Gasto de agua',
        descripcion: 'Boquilla y captura de trabajo: los valores de geometría se precargan de la configuración pero aquí se capturan los del día.',
      },
      el(
        'div',
        { clase: 'campo' },
        el('label', { clase: 'etiqueta', for: 'gasto-boquilla' }, 'Boquilla'),
        combo.elemento
      ),
      zonaBoquilla,
      campoPresion.elemento,
      campoVelocidad.elemento,
      campoAncho.elemento,
      campoNumBoquillas.elemento,
      campoEspaciamiento.elemento
    ),
    tarjeta(
      {
        titulo: 'Caudal de la boquilla',
        descripcion: 'A la presión capturada, con el exponente presión-caudal de la ficha de la boquilla.',
      },
      zonaCaudal
    ),
    tarjeta(
      {
        titulo: 'Volumen de aplicación',
        descripcion: 'Los dos métodos siempre lado a lado: por boquilla y por barra completa.',
        ayuda:
          'Si los dos métodos difieren más del umbral, el espaciamiento por número de ' +
          'boquillas no cuadra con el ancho de barra.',
      },
      zonaCentral,
      botonBitacora
    ),
    tarjeta(
      {
        titulo: 'Modo inverso',
        descripcion: 'Del volumen objetivo a la variable de máquina que lo logra.',
      },
      campoObjetivo.elemento,
      selectVariable.elemento,
      zonaInverso
    ),
    tarjeta(
      {
        titulo: 'Efecto del régimen en la bomba',
        descripcion: 'Si la bomba va en la TDF, el régimen del motor cambia presión, caudal y volumen aplicado según el tipo de bomba.',
      },
      campoRpmTrabajo.elemento,
      zonaBomba
    )
  );

  pintarBoquilla();
  recalcular();
}
