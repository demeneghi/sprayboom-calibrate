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
import { formatear, formatearPorcentaje, formatearTiempo } from '../formato.js';
import { mostrarToast } from '../toast.js';
import { aSistema, deSistema, unidad } from '../../domain/units.js';
import {
  redondeoLegible,
  geometria,
  marchasDeTractor,
  avance,
  avanceDesdeReporte,
  velocidadEfectiva,
  factorDesviacion,
  velocidadCorregida,
} from '../../domain/speed.js';
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
  const tractor = ctx.tractorActivo();
  const gas = ctx.gasActivo();
  const rotametro = ctx.rotametroActivo();
  const p0 = ctx.estado().parametros;

  const unidadVolAplicacion = unidad('volumenAplicacion', sistema);
  const unidadVolumen = unidad('volumen', sistema);

  let modoDespeje = borrador.modoDespeje ?? 'scfm';
  let ultimoObjetivo = null; // resultado del sentido objetivo->ajuste listo para bitacora
  let ultimoAjuste = null; // resultado del sentido ajuste->dosis listo para bitacora

  const columna = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
  const rejilla = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };

  // Valor inicial de un campo: el borrador vive en base metrica y se
  // muestra convertido al sistema vigente, con redondeo legible.
  function precarga(magnitud, valorMetrico) {
    if (valorMetrico === null || valorMetrico === undefined) return null;
    return redondeoLegible(aSistema(magnitud, valorMetrico, sistema));
  }

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

  function parametrosGeometria() {
    const p = ctx.estado().parametros;
    return {
      largoTabla: p.geometria.largoTabla,
      anchoBarra: p.geometria.anchoBarra,
      numBoquillas: p.geometria.numBoquillas,
      distanciaReferencia: p.geometria.distanciaReferencia,
      espaciamientoCapturado: p.geometria.espaciamientoCapturado,
      espaciamientoMinimoPlausible: p.umbrales.espaciamientoMinimoPlausible,
      umbralDiscrepanciaPct: p.umbrales.umbralDiscrepanciaMetodos,
    };
  }

  function hectareasDeTabla() {
    return geometria(parametrosGeometria()).valores.hectareasPorTabla;
  }

  // Linea de contexto del circuito de gas: que numeros se estan usando.
  function contextoGas(efectivo) {
    const p = ctx.estado().parametros;
    return el(
      'p',
      { clase: 'ayuda' },
      `Gas ${gas.nombre}: ${formatear(efectivo.valores.gPorScf, 2)} g/SCF ` +
        `${efectivo.valores.anulado ? '(anulación manual)' : '(derivado del peso molecular)'}. ` +
        `Rotámetro ${rotametro.modelo}, escala de ${formatear(rotametro.escalaMin, 1)} a ` +
        `${formatear(rotametro.escalaMax, 1)} SCFM. Presión atmosférica local ` +
        `${formatear(p.sitio.presionAtmosfericaLocal, 1)} psia; estándar de calibración ` +
        `${formatear(gas.presionEstandarPsia, 1)} psia.`
    );
  }

  // ---------------- Las dos dosis, siempre juntas ----------------
  const zonaDosis = el('div', { estilo: columna });
  function pintarDosis() {
    const p = ctx.estado().parametros;
    const defReferencia = defCampo('agronomicos', 'dosisEtilenoReferencia');
    const defObjetivo = defCampo('agronomicos', 'dosisEtilenoObjetivo');
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
        }),
        pintarResultado({
          etiqueta: 'Objetivo propia del rancho',
          valor: p.agronomicos.dosisEtilenoObjetivo,
          unidad: 'g/ha',
          decimales: 0,
          principal: true,
        })
      ),
      el('p', { clase: 'ayuda' }, `Referencia: ${defReferencia.origen}`),
      el('p', { clase: 'ayuda' }, `Objetivo: ${defObjetivo.origen}`),
      el(
        'p',
        { clase: 'ayuda' },
        'Ambas se editan en Sistema, Configuración. El cálculo usa la objetivo; la referencia es la cota de sanidad contra la que se alerta.'
      )
    );
  }

  // ---------------- Capturas del sentido objetivo -> ajuste ----------------
  const campoDosis = crearCampoNumerico({
    etiqueta: 'Dosis objetivo',
    unidad: 'g/ha',
    valorInicial: borrador.dosisObjetivoGha ?? p0.agronomicos.dosisEtilenoObjetivo,
    ayuda:
      'Se precarga la dosis objetivo propia del rancho, calibrada por pesaje del cilindro; el pesaje manda sobre cualquier cálculo.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { dosisObjetivoGha: valor });
      recalcularObjetivo();
      recalcularAjuste();
    },
  });

  const campoVolumenAgua = crearCampoNumerico({
    etiqueta: 'Volumen de agua',
    unidad: unidadVolAplicacion,
    valorInicial: precarga(
      'volumenAplicacion',
      borrador.volumenAguaLha ?? p0.agronomicos.volumenAguaObjetivo
    ),
    ayuda:
      'Volumen de agua objetivo propio. Si está pendiente de capturar, la aplicación NO lo rellena con la referencia de la literatura: captúralo aquí o en Configuración.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { volumenAguaLha: deSistema('volumenAplicacion', valor, sistema) });
      recalcularObjetivo();
      recalcularAjuste();
    },
  });

  const zonaHectareas = el('div', {});

  const campoTiempo = crearCampoNumerico({
    etiqueta: 'Tiempo por tabla',
    unidad: 's',
    valorInicial: borrador.tiempoPorTablaS ?? null,
    ayuda: 'Lo que tarda la barra en recorrer una tabla completa. Tráelo de Avance o captúralo.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { tiempoPorTablaS: valor });
      recalcularObjetivo();
    },
  });
  const botonTraerTiempo = el(
    'button',
    { clase: 'boton boton--contorno' },
    'Traer tiempo de Avance'
  );
  botonTraerTiempo.addEventListener('click', traerTiempoDeAvance);

  function traerTiempoDeAvance() {
    const capturaAvance = ctx.borrador('avance');
    const p = ctx.estado().parametros;
    try {
      let resultado = null;
      let origen = '';
      if (
        capturaAvance.segundosPorTramo !== null &&
        capturaAvance.segundosPorTramo !== undefined
      ) {
        resultado = avanceDesdeReporte({
          segundosPorTramo: capturaAvance.segundosPorTramo,
          distanciaReferencia: p.geometria.distanciaReferencia,
          largoTabla: p.geometria.largoTabla,
        });
        origen = 'del reporte de campo';
      } else if (
        capturaAvance.marcha &&
        capturaAvance.rpm !== null &&
        capturaAvance.rpm !== undefined
      ) {
        const fila = marchasDeTractor(tractor).find(
          (f) => f.rango === capturaAvance.marcha.rango && f.marcha === capturaAvance.marcha.marcha
        );
        if (fila && fila.kmhNominal !== null) {
          const teorica = velocidadEfectiva({
            kmhNominal: fila.kmhNominal,
            rpm: capturaAvance.rpm,
            regimenNominal: tractor.regimenNominal,
          });
          const mediciones = ctx
            .estado()
            .factoresDesviacion.filter((m) => m.tractorId === tractor.id)
            .map((m) => ({ rpm: m.rpm, factor: m.factor }));
          const factor = factorDesviacion({ mediciones, rpm: capturaAvance.rpm });
          const corregida = velocidadCorregida({
            velocidadTeoricaKmh: teorica,
            factor: factor.factor,
            umbralDesviacionPct: p.umbrales.umbralDesviacionVelocidad,
          });
          const velocidadKmh = corregida.valores.velocidadCorregidaKmh ?? teorica;
          resultado = avance({
            velocidadKmh,
            distanciaReferencia: p.geometria.distanciaReferencia,
            largoTabla: p.geometria.largoTabla,
          });
          origen =
            corregida.valores.velocidadCorregidaKmh !== null
              ? `de la marcha ${fila.etiqueta} con factor medido`
              : `de la marcha ${fila.etiqueta} (teórica sin verificar)`;
        }
      }
      if (!resultado) {
        mostrarToast(
          'No hay datos utilizables en Avance: captura ahí los segundos por tramo o una marcha con régimen.',
          { tipo: 'destructivo' }
        );
        return;
      }
      const redondeado = Math.round(resultado.valores.tiempoTotalS * 10) / 10;
      campoTiempo.fijar(redondeado);
      ctx.guardarBorrador(id, { tiempoPorTablaS: redondeado });
      recalcularObjetivo();
      mostrarToast(`Tiempo por tabla traído de Avance: ${formatearTiempo(redondeado)} (${origen}).`);
    } catch (error) {
      mostrarToast(String(error.message ?? error), { tipo: 'destructivo' });
    }
  }

  const selectModo = crearCampoSelect({
    etiqueta: 'Variable a despejar del rotámetro',
    opciones: [
      { valor: 'scfm', texto: 'Lectura del flotador (SCFM)' },
      { valor: 'psi', texto: 'Presión del rotámetro (psi)' },
      { valor: 'tiempo', texto: 'Tiempo de inyección (s)' },
    ],
    valorInicial: modoDespeje,
    ayuda: 'La variable elegida se calcula a partir de las otras dos, que se capturan como dadas.',
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
    ayuda: `Escala del ${rotametro.modelo}: ${formatear(rotametro.escalaMin, 1)} a ${formatear(rotametro.escalaMax, 1)} SCFM, resolución ${formatear(rotametro.resolucion, 2)} SCFM.`,
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { scfmDado: valor });
      recalcularObjetivo();
    },
  });
  const campoPsiDado = crearCampoNumerico({
    etiqueta: 'Presión del rotámetro (dada)',
    unidad: 'psi',
    valorInicial: borrador.psiDado ?? null,
    ayuda:
      'Presión manométrica a la que trabaja el rotámetro; cero si descarga a la presión atmosférica.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { psiDado: valor });
      recalcularObjetivo();
    },
  });
  const zonaScfmDado = el('div', {}, campoScfmDado.elemento);
  const zonaPsiDado = el('div', {}, campoPsiDado.elemento);
  const zonaTiempo = el('div', { estilo: columna }, campoTiempo.elemento, botonTraerTiempo);

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
      });
    }
    if (v.modoDespeje === 'psi') {
      return pintarResultado({
        etiqueta: ETIQUETA_AJUSTE.psi,
        valor: v.ajuste.psiManometrica,
        unidad: 'psi',
        decimales: 1,
        principal: true,
      });
    }
    return pintarResultado({
      etiqueta: `${ETIQUETA_AJUSTE.tiempo} (${formatearTiempo(v.ajuste.tiempoS)})`,
      valor: v.ajuste.tiempoS,
      unidad: 's',
      decimales: 0,
      principal: true,
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
          etiqueta: 'Hectáreas por tabla (solo lectura)',
          valor: ha,
          unidad: 'ha',
          decimales: 4,
        }),
        el(
          'p',
          { clase: 'ayuda' },
          'Derivadas de la geometría configurada (largo de tabla por ancho de barra); se editan en Sistema, Configuración.'
        )
      );
    } catch (error) {
      reemplazar(zonaHectareas, alertaDestructiva(error));
    }

    const nodos = [];
    ultimoObjetivo = null;
    try {
      const p = ctx.estado().parametros;
      const dosisObjetivoGha = campoDosis.obtener();
      const volumenAguaLha = deSistema('volumenAplicacion', campoVolumenAgua.obtener(), sistema);
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
            presionAtmosfericaLocal: p.sitio.presionAtmosfericaLocal,
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
                  valor: v.masaPorTablaG,
                  unidad: 'g',
                  decimales: 1,
                }),
                pintarResultado({
                  etiqueta: 'Agua por tabla',
                  valor: aSistema('volumen', v.volumenAguaPorTablaL, sistema),
                  unidad: unidadVolumen,
                  decimales: 0,
                }),
                pintarResultado({
                  etiqueta: 'Concentración en tanque',
                  valor: v.concentracionGL,
                  unidad: 'g/L',
                  decimales: 3,
                }),
                pintarResultado({
                  etiqueta: 'Desviación contra la referencia',
                  valor: v.desviacionContraReferenciaPct,
                  unidad: '%',
                  decimales: 1,
                })
              ),
              pintarAjusteDespejado(v),
              pintarVerificacion(resultado.verificacion),
              pintarDesglose(resultado.desglose),
              contextoGas(efectivo)
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
              presionAtmosfericaLocal: p.sitio.presionAtmosfericaLocal,
              presionEstandarCalibracion: gas.presionEstandarPsia,
              masaPorTablaG: v.masaPorTablaG,
              volumenAguaPorTablaL: v.volumenAguaPorTablaL,
              concentracionGL: v.concentracionGL,
              desviacionContraReferenciaPct: v.desviacionContraReferenciaPct,
              scfmRequerido: v.modoDespeje === 'scfm' ? v.ajuste.scfm : null,
              psiRequerida: v.modoDespeje === 'psi' ? v.ajuste.psiManometrica : null,
              tiempoRequeridoS: v.modoDespeje === 'tiempo' ? v.ajuste.tiempoS : null,
            };
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
    ayuda: 'La lectura a la que quedó el flotador en la operación real.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { scfmReal: valor });
      recalcularAjuste();
    },
  });
  const campoPsiReal = crearCampoNumerico({
    etiqueta: 'Presión del rotámetro',
    unidad: 'psi',
    valorInicial: borrador.psiReal ?? null,
    ayuda: 'Presión manométrica real en el rotámetro; cero si descarga a la atmósfera.',
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { psiReal: valor });
      recalcularAjuste();
    },
  });
  const campoTiempoReal = crearCampoNumerico({
    etiqueta: 'Tiempo de inyección por tabla',
    unidad: 's',
    valorInicial: borrador.tiempoRealS ?? null,
    ayuda: 'El tiempo que realmente se inyecta gas en cada tabla.',
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
          const volumenAguaLha = deSistema(
            'volumenAplicacion',
            campoVolumenAgua.obtener(),
            sistema
          );
          const resultado = forzamientoDesdeAjuste({
            scfm,
            psiManometrica: psi,
            tiempoPorTablaS: tiempoS,
            hectareasPorTabla: ha,
            gPorScf: efectivo.valores.gPorScf,
            presionAtmosfericaLocal: p.sitio.presionAtmosfericaLocal,
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
              }),
              el(
                'div',
                { estilo: rejilla },
                pintarResultado({
                  etiqueta: 'Masa inyectada por tabla',
                  valor: v.masaPorTablaG,
                  unidad: 'g',
                  decimales: 1,
                }),
                pintarResultado({
                  etiqueta: 'Concentración en tanque',
                  valor: v.concentracionGL,
                  unidad: 'g/L',
                  decimales: 3,
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
              pintarDesglose(resultado.desglose),
              contextoGas(efectivo)
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
              presionAtmosfericaLocal: p.sitio.presionAtmosfericaLocal,
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
  panel.append(
    tarjeta(
      {
        titulo: 'Advertencia de solubilidad',
        descripcion: 'Léela antes de confiar en cualquier número de esta pantalla.',
      },
      pintarAvisos([AVISO_SOLUBILIDAD])
    ),
    tarjeta(
      {
        titulo: 'Las dos dosis',
        descripcion: 'La referencia de la literatura y la objetivo propia, siempre juntas.',
      },
      zonaDosis
    ),
    tarjeta(
      {
        titulo: 'De la dosis objetivo al ajuste',
        descripcion: 'Qué marcar en el rotámetro para aplicar la dosis objetivo en cada tabla.',
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
    tarjeta({ titulo: 'Ajuste del rotámetro' }, zonaResultadoObjetivo, botonBitacoraObjetivo),
    tarjeta(
      {
        titulo: 'Del ajuste real a la dosis',
        descripcion: 'Con el rotámetro como quedó: qué dosis se está inyectando en realidad.',
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
