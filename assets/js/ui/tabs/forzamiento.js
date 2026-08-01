// Pestana Forzamiento: enlace de los tres dominios (avance, agua, gas)
// para el forzamiento por percolacion. La dosis de etileno se disuelve
// en el agua del tanque y se aplica dirigida a la roseta; el calculo se
// resuelve en los dos sentidos: de la dosis objetivo al ajuste del
// rotametro y del ajuste real a la dosis resultante.
//
// Convenciones de la pestana ejemplar (avance.js): borradores con
// autosave en base metrica, resultados con desglose auditable, avisos
// tipados del dominio, gate de verificacion y errores de calculo
// atrapados como alerta destructiva (jamas NaN en pantalla).

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
import { crearCampoNumerico, crearCampoSelect } from '../campos.js';
import { crearCampoHeredado } from '../heredado.js';
import { crearCampoDato } from '../dato.js';
import { nodosAvanceParaTiempo } from '../marchas.js';
import { formatear, formatearPorcentaje, formatearTiempo } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { aSistema, unidad } from '../../domain/units.js';
import { geometria } from '../../domain/speed.js';
import { gPorScfEfectivo } from '../../domain/gas.js';
import {
  AVISO_SOLUBILIDAD,
  forzamientoDesdeObjetivo,
  forzamientoDesdeAjuste,
} from '../../domain/forcing.js';
import { defCampo } from '../../domain/defaults.js';

export const id = 'forzamiento';

const ETIQUETA_AJUSTE = {
  scfm: 'Lectura de flotador a marcar',
  psi: 'Presión manométrica requerida',
  tiempo: 'Tiempo de inyección requerido',
};

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  const gas = ctx.gasActivo();
  const rotametro = ctx.rotametroActivo();
  const p0 = ctx.estado().parametros;

  // Sin gas o sin rotametro activos (colecciones vacias) no hay circuito
  // de inyeccion que calcular: alerta clara en lugar del TypeError,
  // misma cortesia que la pestana Gas en ese estado.
  if (!gas || !rotametro) {
    const faltantes = [];
    if (!gas) faltantes.push('un gas');
    if (!rotametro) faltantes.push('un rotámetro');
    panel.append(
      tarjeta(
        {
          titulo: 'Forzamiento por percolación',
          descripcion: 'El cálculo necesita el gas y el rotámetro activos del circuito.',
        },
        el(
          'div',
          { clase: 'alerta alerta--destructiva', role: 'alert' },
          el(
            'p',
            { clase: 'alerta__descripcion' },
            `Configura ${faltantes.join(' y ')} en Sistema, Configuración para poder calcular el forzamiento.`
          )
        )
      )
    );
    return;
  }

  const unidadVolAplicacion = unidad('volumenAplicacion', sistema);
  const unidadVolumen = unidad('volumen', sistema);
  const unidadMasa = unidad('masa', sistema);
  const unidadSuperficie = unidad('superficie', sistema);
  const decMasa = sistema === 'imperial' ? 2 : 1;

  let modoDespeje = borrador.modoDespeje ?? 'scfm';
  let ultimoObjetivo = null; // resultado del sentido objetivo->ajuste listo para bitacora
  let ultimoAjuste = null; // resultado del sentido ajuste->dosis listo para bitacora

  const columna = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
  const rejilla = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };

  function alertaDestructiva(error) {
    return el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    );
  }

  // La advertencia de solubilidad vive fija en la primera tarjeta de la
  // pantalla; en los resultados se omite para no triplicarla en una
  // columna de telefono. Cualquier otro aviso del dominio se pinta.
  function sinAvisoSolubilidad(avisos) {
    return (avisos ?? []).filter((a) => a.codigo !== AVISO_SOLUBILIDAD.codigo);
  }

  function hectareasDeTabla() {
    return geometria(ctx.parametrosGeometria()).valores.hectareasPorTabla;
  }

  /* Que numeros se estan usando en el circuito de gas. Es rastro de
     auditoria, no explicacion: se consulta cuando un resultado
     sorprende, no en cada calibracion, asi que va al globo del "?" de
     la tarjeta y no impreso bajo cada resultado. Todo lo que lee sale
     de la configuracion —el gas activo, el rotametro, la altitud del
     sitio—, que no cambia sin salir de esta pestana: calcularlo al
     montar da el mismo texto que calcularlo en cada repintado. */
  function textoContextoGas(efectivo) {
    const p = ctx.estado().parametros;
    const atmosfera = ctx.atmosferaSitio();
    return (
      `Gas ${gas.nombre}: ${formatear(efectivo.valores.gPorScf, 2)} g/SCF ` +
        `${efectivo.valores.anulado ? '(anulación manual)' : '(derivado del peso molecular)'}. ` +
        `Rotámetro ${rotametro.modelo}, escala de ${formatear(rotametro.escalaMin, 1)} a ` +
        `${formatear(rotametro.escalaMax, 1)} SCFM. Presión atmosférica local ` +
        `${formatear(atmosfera.valores.presionPsia, 1)} psia ` +
        `${atmosfera.valores.anulado ? '(anulación manual)' : `(derivada de ${formatear(p.sitio.altitudM, 0)} m de altitud)`}; ` +
        `estándar de calibración ${formatear(gas.presionEstandarPsia, 1)} psia.`
    );
  }

  // ---------------- Las dos dosis, siempre juntas ----------------
  const zonaDosis = el('div', { estilo: columna });
  function pintarDosis() {
    const p = ctx.estado().parametros;
    reemplazar(
      zonaDosis,
      el(
        'div',
        { estilo: rejilla },
        pintarResultado({
          etiqueta: 'Referencia de la literatura',
          valor: p.agronomicos.dosisEtilenoReferencia,
          unidad: 'g/ha',
          decimales: 0,
          ayuda:
            'La dosis de etileno que reporta la literatura para forzar. No es la que se ' +
            'aplica: es la cota contra la que la aplicación avisa si el ajuste se aleja mucho.',
        }),
        pintarResultado({
          etiqueta: 'Objetivo propia del rancho',
          valor: p.agronomicos.dosisEtilenoObjetivo,
          unidad: 'g/ha',
          decimales: 0,
          principal: true,
          ayuda:
            'La dosis que este rancho decidió aplicar y la que usa el cálculo. Se edita en ' +
            'Sistema, Configuración.',
        })
      )
    );
  }

  // La procedencia de las dos dosis explica la tarjeta entera, asi que
  // vive en su "?" y no en tres parrafos bajo las cifras.
  const ayudaDosis =
    `El cálculo usa la objetivo; la referencia es la cota contra la que se alerta. ` +
    `Referencia: ${defCampo('agronomicos', 'dosisEtilenoReferencia').origen} ` +
    `Objetivo: ${defCampo('agronomicos', 'dosisEtilenoObjetivo').origen} ` +
    `Ambas se editan en Sistema, Configuración.`;

  // ---------------- Capturas del sentido objetivo -> ajuste ----------------
  const campoDosis = crearCampoNumerico({
    etiqueta: 'Dosis objetivo',
    unidad: 'g/ha',
    valorInicial: borrador.dosisObjetivoGha ?? p0.agronomicos.dosisEtilenoObjetivo,
    ayuda:
      'Viene la dosis del rancho, ajustada pesando el cilindro. El pesaje manda sobre el cálculo.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { dosisObjetivoGha: valor });
      recalcularObjetivo();
      recalcularAjuste();
    },
  });

  // El agua del tanque es donde se disuelve el etileno, asi que la
  // concentracion depende del volumen REAL que sale por la barra, no del
  // objetivo. Se hereda con el mismo criterio que Mezcla: manda el aforo
  // sobre el calculo, y el objetivo propio del rancho queda como ultimo
  // respaldo, dicho con esas palabras. Lo que NO se rellena nunca es la
  // referencia de la literatura: esa es cota de sanidad, no un dato de
  // esta barra.
  // El agua del tanque es donde se disuelve el etileno, asi que la
  // concentracion depende del volumen REAL que sale por la barra, no del
  // objetivo. Es el MISMO dato que usa Mezcla y que captura el
  // asistente: se monta desde el registro (domain/datos.js) y vive una
  // sola vez en la jornada, con el aforo mandando sobre el calculo. Lo
  // que NO se rellena nunca es la referencia de la literatura: esa es
  // cota de sanidad, no un dato de esta barra.
  const campoVolumenAgua = crearCampoDato(ctx, 'volumenAplicacionLha', {
    sistema,
    etiqueta: 'Volumen de agua',
    ayuda:
      'El agua que de verdad sale por la barra; de ella depende la concentración del tanque. ' +
      'Viene del aforo y, si no lo hay, de Gasto de agua o de Configuración.',
    alCambiar: () => {
      recalcularObjetivo();
      recalcularAjuste();
    },
  });

  const zonaHectareas = el('div', {});

  // Lo que tarda la barra en recorrer una tabla completa sale de Avance:
  // se hereda con su procedencia a la vista, en vez de traerse con un
  // boton que copiaba una vez y no dejaba rastro. El calculo es el UNICO
  // de la aplicacion (ctx.avanceDeAvance); antes esta pantalla tenia su
  // propia copia —identica a la de Gas etileno— que ignoraba el modo
  // elegido en Avance y traia el reporte de campo aunque ahi estuviera
  // elegida la marcha.
  const heredadoDeAvance = ctx.avanceDeAvance();
  const campoTiempo = crearCampoHeredado({
    ctx,
    tabId: id,
    clave: 'tiempoPorTablaS',
    claveManual: 'tiempoPorTablaManual',
    etiqueta: 'Tiempo por tabla',
    unidad: 's',
    ayuda:
      'Lo que tarda la barra en recorrer una tabla. Viene de Avance; si mediste otro tiempo, ' +
      'escríbelo aquí y manda el tuyo.',
    fuente: 'Avance',
    nombreDato: 'el tiempo por tabla',
    heredado: {
      valor: heredadoDeAvance.avance
        ? Math.round(heredadoDeAvance.avance.valores.tiempoTotalS * 10) / 10
        : null,
      etiqueta: `con la velocidad ${heredadoDeAvance.velocidad.etiqueta ?? ''}`,
      avisos: heredadoDeAvance.velocidad.avisos,
    },
    formatearValor: (valor) => formatearTiempo(valor),
    destino: { seccion: 'calibrar', tab: 'avance' },
    textoSinDato:
      'Elige en Avance la marcha con la que vas —queda guardada como marcha de trabajo del ' +
      'tractor— o captura los segundos por tramo; también puedes escribir aquí el tiempo por ' +
      'tabla.',
    guardadoSinMarcaEsManual: true,
    alCambiar: () => recalcularObjetivo(),
  });

  const selectModo = crearCampoSelect({
    etiqueta: 'Variable a despejar del rotámetro',
    opciones: [
      { valor: 'scfm', texto: 'Lectura del flotador (SCFM)' },
      { valor: 'psi', texto: 'Presión del rotámetro (psi)' },
      { valor: 'tiempo', texto: 'Tiempo de inyección (s)' },
    ],
    valorInicial: modoDespeje,
    ayuda: 'La que elijas la calcula la aplicación; las otras dos las capturas tú.',
    alCambiar: (valor) => {
      modoDespeje = valor;
      ctx.guardarBorrador(id, { modoDespeje });
      pintarModoDespeje();
      recalcularObjetivo();
    },
  });

  const campoScfmDado = crearCampoNumerico({
    etiqueta: 'Lectura del flotador (dada)',
    unidad: 'SCFM',
    valorInicial: borrador.scfmDado ?? null,
    ayuda: `Escala del ${rotametro.modelo}: de ${formatear(rotametro.escalaMin, 1)} a ${formatear(rotametro.escalaMax, 1)} SCFM, con rayas cada ${formatear(rotametro.resolucion, 2)} SCFM.`,
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { scfmDado: valor });
      recalcularObjetivo();
    },
  });
  const campoPsiDado = crearCampoNumerico({
    etiqueta: 'Presión del rotámetro (dada)',
    unidad: 'psi',
    valorInicial: borrador.psiDado ?? null,
    ayuda: 'La presión a la que trabaja el rotámetro. Cero si descarga al aire libre.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { psiDado: valor });
      recalcularObjetivo();
    },
  });
  const zonaScfmDado = el('div', {}, campoScfmDado.elemento);
  const zonaPsiDado = el('div', {}, campoPsiDado.elemento);
  const zonaTiempo = el('div', { estilo: columna }, campoTiempo.elemento);

  function pintarModoDespeje() {
    zonaScfmDado.classList.toggle('oculto', modoDespeje === 'scfm');
    zonaPsiDado.classList.toggle('oculto', modoDespeje === 'psi');
    zonaTiempo.classList.toggle('oculto', modoDespeje === 'tiempo');
  }

  // ---------------- Resultado del sentido objetivo -> ajuste ----------------
  const zonaResultadoObjetivo = el('div', { estilo: columna });

  function pintarAjusteDespejado(v) {
    if (v.modoDespeje === 'scfm') {
      return pintarResultado({
        etiqueta: ETIQUETA_AJUSTE.scfm,
        valor: v.ajuste.scfm,
        unidad: 'SCFM',
        decimales: 2,
        principal: true,
        ayuda:
          'Dónde dejar el flotador del rotámetro para que la tabla reciba su masa de etileno en ' +
          'el tiempo que dura el pase, con la presión capturada. Es la cifra que se lleva al ' +
          'lote.',
      });
    }
    if (v.modoDespeje === 'psi') {
      return pintarResultado({
        etiqueta: ETIQUETA_AJUSTE.psi,
        valor: v.ajuste.psiManometrica,
        unidad: 'psi',
        decimales: 1,
        principal: true,
        ayuda:
          'A cuánto dejar el regulador para que la tabla reciba su masa de etileno con la ' +
          'lectura de flotador capturada. Es lectura de manómetro, la de la carátula.',
      });
    }
    return pintarResultado({
      etiqueta: `${ETIQUETA_AJUSTE.tiempo} (${formatearTiempo(v.ajuste.tiempoS)})`,
      valor: v.ajuste.tiempoS,
      unidad: 's',
      decimales: 0,
      principal: true,
      ayuda:
        'Cuánto hay que tener abierta la válvula para que la tabla reciba su masa de etileno ' +
        'con la lectura y la presión capturadas. Compáralo con lo que dura el pase: si no cabe, ' +
        'sube la lectura o la presión.',
    });
  }

  function recalcularObjetivo() {
    // Hectareas por tabla: derivadas de la geometria, solo lectura.
    let ha = null;
    try {
      ha = hectareasDeTabla();
      reemplazar(
        zonaHectareas,
        pintarResultado({
          etiqueta: 'Superficie por tabla (solo lectura)',
          valor: aSistema('superficie', ha, sistema),
          unidad: unidadSuperficie,
          decimales: 4,
          ayuda:
            'Las hectáreas que cubre un pase de la tabla, tomadas de la geometría configurada. ' +
            'Multiplican a la dosis por hectárea para saber cuántos gramos lleva la tabla; se ' +
            'edita en Sistema, Configuración.',
        })
      );
    } catch (error) {
      reemplazar(zonaHectareas, alertaDestructiva(error));
    }

    const nodos = [];
    ultimoObjetivo = null;
    try {
      const p = ctx.estado().parametros;
      const dosisObjetivoGha = campoDosis.obtener();
      const volumenAguaLha = campoVolumenAgua.obtenerBase();
      const tiempoPorTablaS = campoTiempo.obtener();
      const scfmDado = campoScfmDado.obtener();
      const psiDado = campoPsiDado.obtener();

      const faltantes = [];
      if (dosisObjetivoGha === null) faltantes.push('la dosis objetivo');
      if (modoDespeje !== 'tiempo' && tiempoPorTablaS === null) faltantes.push('el tiempo por tabla');
      if ((modoDespeje === 'scfm' || modoDespeje === 'tiempo') && psiDado === null) {
        faltantes.push('la presión dada del rotámetro');
      }
      if ((modoDespeje === 'psi' || modoDespeje === 'tiempo') && scfmDado === null) {
        faltantes.push('la lectura dada del flotador');
      }

      if (ha === null) {
        nodos.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Corrige la geometría en Sistema, Configuración para poder calcular.'
          )
        );
      } else if (faltantes.length > 0) {
        nodos.push(el('p', { clase: 'texto-suave' }, `Captura ${faltantes.join(', ')} para calcular.`));
      } else {
        const efectivo = gPorScfEfectivo({ gas });
        nodos.push(...pintarAvisos(efectivo.avisos));
        if (!resultadoConfiable(efectivo)) {
          nodos.push(
            pintarResultadoNoVerificado('Masa por pie cúbico estándar del gas'),
            pintarVerificacion(efectivo.verificacion)
          );
        } else {
          const gPorScf = efectivo.valores.gPorScf;
          const resultado = forzamientoDesdeObjetivo({
            dosisObjetivoGha,
            volumenAguaLha,
            hectareasPorTabla: ha,
            tiempoPorTablaS,
            gPorScf,
            presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
            presionEstandarCalibracion: gas.presionEstandarPsia,
            modoDespeje,
            scfmDado,
            psiDado,
            rotametro,
            dosisReferenciaGha: p.agronomicos.dosisEtilenoReferencia,
            toleranciaAlertaPct: p.agronomicos.toleranciaAlerta,
          });
          nodos.push(...pintarAvisos(sinAvisoSolubilidad(resultado.avisos)));
          if (!resultadoConfiable(resultado)) {
            nodos.push(
              pintarResultadoNoVerificado(ETIQUETA_AJUSTE[modoDespeje]),
              pintarVerificacion(resultado.verificacion)
            );
          } else {
            const v = resultado.valores;
            nodos.push(
              el(
                'div',
                { estilo: rejilla },
                pintarResultado({
                  etiqueta: 'Masa de etileno por tabla',
                  valor: aSistema('masa', v.masaPorTablaG, sistema),
                  unidad: unidadMasa,
                  decimales: decMasa,
                  ayuda:
                    'Los gramos de etileno que le tocan a una tabla: la dosis por hectárea por ' +
                    'las hectáreas de la tabla. De aquí sale el ajuste del rotámetro.',
                }),
                pintarResultado({
                  etiqueta: 'Agua por tabla',
                  valor: aSistema('volumen', v.volumenAguaPorTablaL, sistema),
                  unidad: unidadVolumen,
                  decimales: 0,
                  ayuda:
                    'El agua en la que va disuelto ese etileno: el volumen de aplicación por las ' +
                    'hectáreas de la tabla.',
                }),
                pintarResultado({
                  etiqueta: 'Concentración en tanque',
                  valor: v.concentracionGL,
                  unidad: 'g/L',
                  decimales: 3,
                  ayuda:
                    'Cuántos gramos de etileno lleva cada litro de agua. Sirve para saber si la ' +
                    'solución está muy cargada: el etileno se disuelve poco, y arriba de cierto ' +
                    'punto el gas de más se escapa en vez de quedarse.',
                }),
                pintarResultado({
                  etiqueta: 'Desviación contra la referencia',
                  valor: v.desviacionContraReferenciaPct,
                  unidad: '%',
                  decimales: 1,
                  ayuda:
                    'Qué tan lejos queda la dosis objetivo del rancho respecto a la referencia ' +
                    'de la literatura. No es un error: es la distancia que hay entre lo que dice ' +
                    'el libro y lo que este rancho decidió aplicar.',
                })
              ),
              pintarAjusteDespejado(v),
              pintarVerificacion(resultado.verificacion),
              pintarDesglose(resultado.desglose),
              // Cuando lo que se despeja es el TIEMPO, el numero solo se
              // cumple si la barra cruza la tabla en ese mismo rato: se
              // dice a que velocidad y con que marchas se logra. En los
              // otros dos despejes el tiempo es un dato de entrada que
              // ya viene de Avance, y no hay nada que devolver.
              ...(v.modoDespeje === 'tiempo'
                ? nodosAvanceParaTiempo({ ctx, sistema, tiempoTotalS: v.ajuste.tiempoS })
                : [])
            );
            ultimoObjetivo = {
              sentido: 'objetivo-a-ajuste',
              modoDespeje,
              dosisObjetivoGha,
              dosisReferenciaGha: p.agronomicos.dosisEtilenoReferencia,
              toleranciaAlertaPct: p.agronomicos.toleranciaAlerta,
              volumenAguaLha,
              hectareasPorTabla: ha,
              tiempoPorTablaS,
              scfmDado,
              psiDado,
              gasId: gas.id,
              gasNombre: gas.nombre,
              gPorScf,
              gPorScfAnulado: efectivo.valores.anulado,
              rotametroId: rotametro.id,
              rotametroModelo: rotametro.modelo,
              presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
              presionEstandarCalibracion: gas.presionEstandarPsia,
              masaPorTablaG: v.masaPorTablaG,
              volumenAguaPorTablaL: v.volumenAguaPorTablaL,
              concentracionGL: v.concentracionGL,
              desviacionContraReferenciaPct: v.desviacionContraReferenciaPct,
              scfmRequerido: v.modoDespeje === 'scfm' ? v.ajuste.scfm : null,
              psiRequerida: v.modoDespeje === 'psi' ? v.ajuste.psiManometrica : null,
              tiempoRequeridoS: v.modoDespeje === 'tiempo' ? v.ajuste.tiempoS : null,
            };
            // La masa que hay que inyectar en una tabla queda a
            // disposicion de Gas etileno, que la pide como «masa
            // objetivo»: es el MISMO numero, y hasta ahora habia que
            // apuntarlo y volverlo a teclear en la otra pantalla.
            ctx.guardarResultado('masaPorTablaG', {
              valor: v.masaPorTablaG,
              origen: 'forzamiento',
              detalle: `para ${formatear(dosisObjetivoGha, 0)} g/ha de dosis objetivo`,
            });
          }
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaResultadoObjetivo, nodos);
  }

  const botonBitacoraObjetivo = el('button', { clase: 'boton' }, 'Guardar en bitácora');
  botonBitacoraObjetivo.addEventListener('click', () => {
    if (!ultimoObjetivo) {
      mostrarToast(
        'Completa el cálculo del ajuste antes de guardar: faltan capturas o el resultado no está verificado.',
        { tipo: 'destructivo' }
      );
      return;
    }
    const c = ultimoObjetivo;
    const textoAjuste =
      c.modoDespeje === 'scfm'
        ? `marcar ${formatear(c.scfmRequerido, 2)} SCFM a ${formatear(c.psiDado, 1)} psi durante ${formatearTiempo(c.tiempoPorTablaS)}`
        : c.modoDespeje === 'psi'
          ? `subir a ${formatear(c.psiRequerida, 1)} psi con ${formatear(c.scfmDado, 2)} SCFM durante ${formatearTiempo(c.tiempoPorTablaS)}`
          : `inyectar durante ${formatearTiempo(c.tiempoRequeridoS)} con ${formatear(c.scfmDado, 2)} SCFM a ${formatear(c.psiDado, 1)} psi`;
    guardarEnBitacora(
      c,
      'Forzamiento: de la dosis objetivo al ajuste del rotámetro',
      `Dosis objetivo ${formatear(c.dosisObjetivoGha, 0)} g/ha (${formatear(c.masaPorTablaG, 0)} g por tabla): ${textoAjuste}.`
    );
  });

  // ---------------- Sentido ajuste -> dosis ----------------
  const campoScfmReal = crearCampoNumerico({
    etiqueta: 'Lectura del flotador',
    unidad: 'SCFM',
    valorInicial: borrador.scfmReal ?? null,
    ayuda: 'Dónde quedó la bola durante la corrida real.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { scfmReal: valor });
      recalcularAjuste();
    },
  });
  const campoPsiReal = crearCampoNumerico({
    etiqueta: 'Presión del rotámetro',
    unidad: 'psi',
    valorInicial: borrador.psiReal ?? null,
    ayuda: 'La presión que marcó el rotámetro. Cero si descarga al aire libre.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { psiReal: valor });
      recalcularAjuste();
    },
  });
  const campoTiempoReal = crearCampoNumerico({
    etiqueta: 'Tiempo de inyección por tabla',
    unidad: 's',
    valorInicial: borrador.tiempoRealS ?? null,
    ayuda: 'El tiempo que de verdad se inyecta gas en cada tabla.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { tiempoRealS: valor });
      recalcularAjuste();
    },
  });

  const zonaResultadoAjuste = el('div', { estilo: columna });

  function recalcularAjuste() {
    const nodos = [];
    ultimoAjuste = null;
    try {
      const p = ctx.estado().parametros;
      const scfm = campoScfmReal.obtener();
      const psi = campoPsiReal.obtener();
      const tiempoS = campoTiempoReal.obtener();

      const faltantes = [];
      if (scfm === null) faltantes.push('la lectura del flotador');
      if (psi === null) faltantes.push('la presión del rotámetro');
      if (tiempoS === null) faltantes.push('el tiempo de inyección');
      if (faltantes.length > 0) {
        nodos.push(el('p', { clase: 'texto-suave' }, `Captura ${faltantes.join(', ')} para calcular.`));
      } else {
        const ha = hectareasDeTabla();
        const efectivo = gPorScfEfectivo({ gas });
        nodos.push(...pintarAvisos(efectivo.avisos));
        if (!resultadoConfiable(efectivo)) {
          nodos.push(
            pintarResultadoNoVerificado('Masa por pie cúbico estándar del gas'),
            pintarVerificacion(efectivo.verificacion)
          );
        } else {
          const dosisObjetivoGha = campoDosis.obtener();
          const volumenAguaLha = campoVolumenAgua.obtenerBase();
          const resultado = forzamientoDesdeAjuste({
            scfm,
            psiManometrica: psi,
            tiempoPorTablaS: tiempoS,
            hectareasPorTabla: ha,
            gPorScf: efectivo.valores.gPorScf,
            presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
            presionEstandarCalibracion: gas.presionEstandarPsia,
            volumenAguaLha,
            dosisObjetivoGha,
            toleranciaAlertaPct: p.agronomicos.toleranciaAlerta,
          });
          nodos.push(...pintarAvisos(sinAvisoSolubilidad(resultado.avisos)));
          if (!resultadoConfiable(resultado)) {
            nodos.push(
              pintarResultadoNoVerificado('Dosis resultante'),
              pintarVerificacion(resultado.verificacion)
            );
          } else {
            const v = resultado.valores;
            nodos.push(
              pintarResultado({
                etiqueta: 'Dosis resultante',
                valor: v.dosisGha,
                unidad: 'g/ha',
                decimales: 0,
                principal: true,
                ayuda:
                  'Los gramos de etileno por hectárea que deja el ajuste que capturaste. Es el ' +
                  'camino de regreso: en vez de decirte cómo poner el rotámetro, te dice qué ' +
                  'dosis estás aplicando con el que ya traes puesto.',
              }),
              el(
                'div',
                { estilo: rejilla },
                pintarResultado({
                  etiqueta: 'Masa inyectada por tabla',
                  valor: aSistema('masa', v.masaPorTablaG, sistema),
                  unidad: unidadMasa,
                  decimales: decMasa,
                  ayuda:
                    'Los gramos de etileno que salieron del cilindro en un pase con el ajuste ' +
                    'capturado. Es gas inyectado al tanque, no gas retenido en el agua.',
                }),
                pintarResultado({
                  etiqueta: 'Concentración en tanque',
                  valor: v.concentracionGL,
                  unidad: 'g/L',
                  decimales: 3,
                  ayuda:
                    'Cuántos gramos de etileno lleva cada litro de agua con este ajuste. El ' +
                    'etileno se disuelve poco: si sube mucho, el gas de más se escapa en vez de ' +
                    'quedarse en la solución.',
                })
              )
            );
            if (v.desviacionContraObjetivoPct === null || dosisObjetivoGha === null) {
              nodos.push(
                el('p', { clase: 'ayuda' }, 'Sin dosis objetivo capturada no hay comparación.')
              );
            } else {
              nodos.push(
                el(
                  'p',
                  { clase: 'ayuda' },
                  `La dosis resultante queda ${formatearPorcentaje(Math.abs(v.desviacionContraObjetivoPct))} ` +
                    `${v.desviacionContraObjetivoPct >= 0 ? 'arriba' : 'abajo'} del objetivo de ` +
                    `${formatear(dosisObjetivoGha, 0)} g/ha.`
                )
              );
            }
            nodos.push(
              pintarVerificacion(resultado.verificacion),
              pintarDesglose(resultado.desglose)
            );
            ultimoAjuste = {
              sentido: 'ajuste-a-dosis',
              scfm,
              psiManometrica: psi,
              tiempoPorTablaS: tiempoS,
              hectareasPorTabla: ha,
              volumenAguaLha,
              dosisObjetivoGha,
              toleranciaAlertaPct: p.agronomicos.toleranciaAlerta,
              gasId: gas.id,
              gasNombre: gas.nombre,
              gPorScf: efectivo.valores.gPorScf,
              gPorScfAnulado: efectivo.valores.anulado,
              rotametroId: rotametro.id,
              rotametroModelo: rotametro.modelo,
              presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
              presionEstandarCalibracion: gas.presionEstandarPsia,
              masaPorTablaG: v.masaPorTablaG,
              dosisGha: v.dosisGha,
              concentracionGL: v.concentracionGL,
              desviacionContraObjetivoPct: v.desviacionContraObjetivoPct,
            };
          }
        }
      }
    } catch (error) {
      nodos.push(alertaDestructiva(error));
    }
    reemplazar(zonaResultadoAjuste, nodos);
  }

  const botonBitacoraAjuste = el('button', { clase: 'boton' }, 'Guardar en bitácora');
  botonBitacoraAjuste.addEventListener('click', () => {
    if (!ultimoAjuste) {
      mostrarToast(
        'Completa el cálculo de la dosis antes de guardar: faltan capturas o el resultado no está verificado.',
        { tipo: 'destructivo' }
      );
      return;
    }
    const c = ultimoAjuste;
    guardarEnBitacora(
      c,
      'Forzamiento: del ajuste del rotámetro a la dosis',
      `${formatear(c.scfm, 2)} SCFM a ${formatear(c.psiManometrica, 1)} psi durante ` +
        `${formatearTiempo(c.tiempoPorTablaS)} inyectan ${formatear(c.dosisGha, 0)} g/ha ` +
        `(${formatear(c.masaPorTablaG, 0)} g por tabla).`
    );
  });

  // ---------------- Registro en bitacora ----------------
  function guardarEnBitacora(calculo, titulo, resumen) {
    const registroBase = {
      id: `forzamiento-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: 'forzamiento',
      fecha: new Date().toISOString(),
      titulo,
      resumen,
      datos: { ...calculo },
    };
    ctx.almacen.actualizar((e) => {
      // El snapshot es COPIA de los parametros vigentes, no referencia:
      // el registro historico conserva los numeros con los que se calculo
      // aunque los parametros cambien despues.
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
    mostrarToast('Cálculo de forzamiento guardado en la bitácora.', {
      accionTexto: 'Ir a Bitácora',
      alAccionar: () => ctx.navegarA('registrar', 'bitacora'),
    });
  }

  // ---------------- Montaje ----------------
  // El contexto del circuito solo depende del gas activo, que no cambia
  // sin salir de la pestana: se arma una vez para los "?" de las dos
  // tarjetas de resultado.
  const ayudaContexto = textoContextoGas(gPorScfEfectivo({ gas }));

  panel.append(
    tarjeta(
      {
        titulo: 'Advertencia de solubilidad',
        ayuda:
          'El rotámetro mide el gas que entra, no el que se queda disuelto: buena parte se ' +
          'escapa por la superficie del tanque. Cuánto se retiene depende del difusor, de la ' +
          'temperatura del agua y del tiempo entre la carga y la aplicación.',
      },
      pintarAvisos([AVISO_SOLUBILIDAD])
    ),
    tarjeta(
      {
        titulo: 'Las dos dosis',
        descripcion: 'La referencia de la literatura y la objetivo propia, siempre juntas.',
        ayuda: ayudaDosis,
      },
      zonaDosis
    ),
    tarjeta(
      {
        titulo: 'De la dosis objetivo al ajuste',
        descripcion: 'Qué marcar en el rotámetro para aplicar la dosis objetivo en cada tabla.',
        ayuda:
          'La superficie por tabla sale de la geometría configurada (largo de tabla por ancho ' +
          'de barra) y se edita en Sistema, Configuración.',
      },
      el(
        'div',
        { estilo: columna },
        campoDosis.elemento,
        campoVolumenAgua.elemento,
        zonaHectareas,
        zonaTiempo,
        selectModo.elemento,
        zonaScfmDado,
        zonaPsiDado
      )
    ),
    tarjeta(
      { titulo: 'Ajuste del rotámetro', ayuda: ayudaContexto },
      zonaResultadoObjetivo,
      botonBitacoraObjetivo
    ),
    tarjeta(
      {
        titulo: 'Del ajuste real a la dosis',
        descripcion: 'Con el rotámetro como quedó: qué dosis se está inyectando en realidad.',
        ayuda: ayudaContexto,
      },
      el(
        'div',
        { estilo: columna },
        campoScfmReal.elemento,
        campoPsiReal.elemento,
        campoTiempoReal.elemento,
        zonaResultadoAjuste,
        botonBitacoraAjuste
      )
    )
  );

  pintarModoDespeje();
  pintarDosis();
  recalcularObjetivo();
  recalcularAjuste();
}
