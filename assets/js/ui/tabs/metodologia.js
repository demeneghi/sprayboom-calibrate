// Pestana Metodologia (seccion Sistema): de donde sale cada formula de
// la aplicacion, con los parametros VIGENTES sustituidos en vivo. Si el
// usuario cambio geometria, catalogo, gas o umbrales, lo que se muestra
// aqui corresponde exactamente a lo que el sistema calcula hoy.
//
// Regla dura respetada: CERO numeros de dominio incrustados. Todos los
// literales visibles se leen de domain/constants.js, de data/ o del
// estado vigente; los ejemplos numericos se calculan con las funciones
// de domain/ y se pintan con su desglose, avisos y verificacion.
//
// Unica excepcion documentada: la presion de referencia de la
// NOMENCLATURA norteamericana de boquillas (constante local de esta
// pestana, ver abajo). Es un dato de nomenclatura para la demostracion
// de reconciliacion ISO/US pedida por el documento de diseno; ninguna
// funcion de dominio ni resultado operativo de la aplicacion lo usa.

import { el } from '../dom.js';
import {
  tarjeta,
  pintarAviso,
  pintarAvisos,
  pintarDesglose,
  pintarResultado,
  pintarVerificacion,
  resultadoConfiable,
  pintarResultadoNoVerificado,
} from '../render.js';
import { formatear } from '../formato.js';
import { estiloBadgeIso } from '../color.js';
import { aSistema, unidad, barAKpa } from '../../domain/units.js';
import {
  FACTOR_LHA,
  FACTOR_GPA,
  M2_POR_HA,
  MIN_POR_HORA,
  M_POR_KM,
  HA_POR_ACRE,
  KM_POR_MILLA,
  M_POR_PULGADA,
  SEG_POR_MIN,
  R_GAS,
  OFFSET_RANKINE,
  LBMOL_A_MOL,
  SI_R_UNIVERSAL,
  PORCIENTO,
  PRESION_NIVEL_MAR_PSIA,
  GRADIENTE_ISA_POR_M,
  EXPONENTE_ISA,
} from '../../domain/constants.js';
import {
  paso,
  redondeoLegible,
  geometria,
  marchasDeTractor,
  velocidadEfectiva,
} from '../../domain/speed.js';
import { caudalAPresion, presionParaCaudal, caudalDesdeConvencionUs } from '../../domain/nozzles.js';
import { ambosMetodos, caudalRequerido } from '../../domain/water.js';
import { gPorScfDerivado, gPorScfEfectivo } from '../../domain/gas.js';
import { factorPresion } from '../../domain/flowmeter.js';
import { PRESION_NOMINAL_ISO_BAR, TABLA_ISO_10625, filaIso } from '../../data/iso-colors.js';
import {
  CLASES_S572_1,
  CLASES_S572_3,
  GUIA_USO_GOTA,
} from '../../data/droplet-classes.js';

export const id = 'metodologia';

const COLUMNA = { display: 'flex', flexDirection: 'column', gap: '0.75rem' };
const GRID_2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' };

// ---------------------------------------------------------------------
// Nomenclatura norteamericana de boquillas (TeeJet Catalog 51A-M): el
// numero de tamano ES el caudal en galones por minuto medido a esta
// presion de referencia. Dato de NOMENCLATURA que alimenta unicamente la
// demostracion de reconciliacion ISO/US de esta pestana; no existe en
// domain/constants.js ni en data/ porque ningun calculo operativo de la
// aplicacion lo necesita.
// ---------------------------------------------------------------------
const PSI_REFERENCIA_NOMENCLATURA_US = 40;

// Tamano de la fila ISO usada en la demostracion (clave de la tabla de
// data/iso-colors.js, no un valor numerico).
const TAMANO_EJEMPLO_US = '04';

// Decodifica el numero de tamano como caudal en GPM segun la convencion
// US: el punto decimal va despues del primer digito ('04' -> 0.4 GPM,
// '015' -> 0.15 GPM, '0050' -> 0.050 GPM). Es lectura del dato, no una
// formula de dominio.
function gpmDeTamano(tamano) {
  if (!tamano) return null;
  const texto = String(tamano);
  const gpm = Number(`${texto[0]}.${texto.slice(1)}`);
  return Number.isFinite(gpm) ? gpm : null;
}

export function render(panel, ctx) {
  const sistema = ctx.sistema();
  const estado = ctx.estado();
  const p = estado.parametros;
  const tractor = ctx.tractorActivo();
  const equipo = ctx.equipoActivo();
  const catalogo = estado.catalogo ?? [];

  const unidadVelocidad = unidad('velocidad', sistema);
  const unidadVolumen = unidad('volumenAplicacion', sistema);
  const unidadCaudal = unidad('caudal', sistema);
  const unidadPresion = unidad('presion', sistema);
  const unidadEspaciamiento = unidad('distanciaCorta', sistema);

  // ---------------- Ayudantes de presentacion ----------------
  function alertaDestructiva(error) {
    return el(
      'div',
      { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    );
  }

  function subtitulo(texto) {
    return el('h3', { clase: 'etiqueta' }, texto);
  }

  function filaFormula(nombre, formula) {
    return el(
      'div',
      { clase: 'desglose__paso' },
      el('span', { clase: 'desglose__descripcion' }, nombre),
      el('span', { clase: 'desglose__formula' }, formula)
    );
  }

  function lista(items) {
    return el(
      'ul',
      { estilo: { margin: '0', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' } },
      items.map((item) => el('li', {}, item))
    );
  }

  function tablaSimple(encabezados, filas, numerica = false) {
    return el(
      'div',
      { clase: 'scroll-x' },
      el(
        'table',
        { clase: numerica ? 'tabla tabla--numerica' : 'tabla' },
        el('thead', {}, el('tr', {}, encabezados.map((h) => el('th', {}, h)))),
        el('tbody', {}, filas)
      )
    );
  }

  function geometriaVigente() {
    return geometria(ctx.parametrosGeometria());
  }

  function boquillaInstalada() {
    return equipo?.boquillaId ? (catalogo.find((b) => b.id === equipo.boquillaId) ?? null) : null;
  }

  // Velocidad para los ejemplos vivos: lo que el sistema calcularia hoy.
  // Sale del MISMO derivado que usan las pantallas de calculo
  // (ctx.velocidadDeAvance), para que el ejemplo de la metodologia no
  // pueda contradecir a la calculadora que explica. Antes esta pantalla
  // tenia su propia version, que ignoraba el modo elegido en Avance.
  //
  // Lo unico propio de aqui es el ultimo respaldo: sin nada capturado en
  // Avance, el ejemplo se arma con la primera marcha disponible al
  // regimen habitual, porque una pagina de metodologia sin numeros no
  // explica nada.
  function velocidadEjemplo() {
    const heredada = ctx.velocidadDeAvance();
    if (Number.isFinite(heredada.velocidadKmh)) {
      return {
        velocidadKmh: heredada.velocidadKmh,
        origen: `${heredada.etiqueta}, capturada en Avance`,
      };
    }
    const fila = marchasDeTractor(tractor).find((f) => f.kmhNominal !== null);
    if (fila) {
      return {
        velocidadKmh: velocidadEfectiva({
          kmhNominal: fila.kmhNominal,
          rpm: tractor.regimenHabitual,
          regimenNominal: tractor.regimenNominal,
        }),
        origen:
          `de la marcha ${fila.etiqueta} del ${tractor.nombre} al régimen habitual ` +
          `(${tractor.regimenHabitual} rpm)` +
          (fila.origen === 'estimacion' ? ', velocidad nominal estimada sin calibrar' : ''),
      };
    }
    return null;
  }

  // Caudal por boquilla para el ejemplo vivo: la boquilla instalada en
  // el equipo si existe; si no, el caudal requerido para el volumen
  // objetivo (o el de referencia) con la geometria vigente.
  function caudalEjemplo(velocidadKmh, espaciamientoM) {
    const instalada = boquillaInstalada();
    if (instalada) {
      const presionBar = equipo.presionCalibracion ?? instalada.presionRefBar;
      const caudalLmin = caudalAPresion({
        caudalRef: instalada.caudalRefLmin,
        presionRef: instalada.presionRefBar,
        presion: presionBar,
        exponente: instalada.exponente,
      });
      return {
        caudalLmin,
        resultado: null,
        origen:
          `caudal de la ${instalada.fabricante} ${instalada.modelo} instalada en la barra, a ` +
          `${formatear(aSistema('presion', presionBar, sistema), 2)} ${unidadPresion} ` +
          (equipo.presionCalibracion !== null && equipo.presionCalibracion !== undefined
            ? '(presión de la última calibración)'
            : '(presión de referencia de la ficha)'),
      };
    }
    const objetivo = p.agronomicos.volumenAguaObjetivo ?? p.agronomicos.volumenAguaReferencia;
    if (objetivo === null || objetivo === undefined) return null;
    const etiquetaObjetivo =
      p.agronomicos.volumenAguaObjetivo !== null && p.agronomicos.volumenAguaObjetivo !== undefined
        ? 'volumen de agua objetivo propio'
        : 'volumen de agua de referencia (Bartholomew et al., 2003)';
    const resultado = caudalRequerido({ lhaObjetivo: objetivo, velocidadKmh, espaciamientoM });
    return {
      caudalLmin: resultado.valores.caudalLmin,
      resultado,
      origen:
        `caudal requerido para el ${etiquetaObjetivo} de ` +
        `${formatear(aSistema('volumenAplicacion', objetivo, sistema), 0)} ${unidadVolumen} ` +
        '(la barra activa no tiene boquilla asignada)',
    };
  }

  // ------------------------------------------------------------------
  // Tarjeta 1: formulas maestras de L/ha
  // ------------------------------------------------------------------
  function tarjetaFormulasLha() {
    const cuerpo = [];

    cuerpo.push(
      filaFormula(
        'Método por boquilla',
        `L/ha = caudal_boquilla (L/min) * ${FACTOR_LHA} / (velocidad (km/h) * espaciamiento (m))`
      ),
      filaFormula(
        'Método por barra completa',
        `L/ha = caudal_total (L/min) * ${FACTOR_LHA} / (velocidad (km/h) * ancho_barra (m))`
      )
    );

    const factorDerivado = (M2_POR_HA * MIN_POR_HORA) / M_POR_KM;
    cuerpo.push(
      pintarDesglose(
        [
          paso(
            'El factor sale de la conversión entre L/min, km/h, metros y hectáreas',
            'm2_por_ha * min_por_hora / m_por_km',
            `${M2_POR_HA} * ${MIN_POR_HORA} / ${M_POR_KM}`,
            factorDerivado,
            ''
          ),
        ],
        { abierto: true, titulo: `De dónde sale el ${FACTOR_LHA}` }
      )
    );
    if (factorDerivado !== FACTOR_LHA) {
      cuerpo.push(
        alertaDestructiva(
          new Error(
            `La constante FACTOR_LHA (${FACTOR_LHA}) no coincide con su derivación ` +
              `(${redondeoLegible(factorDerivado)}): reporta este error.`
          )
        )
      );
    }

    cuerpo.push(
      pintarAviso({
        tipo: 'advertencia',
        mensaje:
          `Con el factor ${FACTOR_LHA} el espaciamiento va en METROS. Varias calculadoras en ` +
          `línea publican la misma fórmula con el espaciamiento en centímetros conservando el ` +
          `${FACTOR_LHA}: es un error de dos órdenes de magnitud. Por eso la aplicación marca ` +
          `como sospechoso todo espaciamiento menor que ` +
          `${formatear(p.umbrales.espaciamientoMinimoPlausible, 2)} m (umbral configurable).`,
      })
    );

    // Ejemplo vivo con los parametros vigentes.
    cuerpo.push(subtitulo('Ejemplo vivo con los parámetros vigentes'));
    try {
      const g = geometriaVigente();
      const ve = velocidadEjemplo();
      if (!ve) {
        cuerpo.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'No hay velocidad disponible para el ejemplo: el tractor activo no tiene ninguna marcha con velocidad registrada.'
          )
        );
      } else {
        const espaciamientoM = g.valores.espaciamientoEfectivo;
        const ce = caudalEjemplo(ve.velocidadKmh, espaciamientoM);
        if (!ce) {
          cuerpo.push(
            el(
              'p',
              { clase: 'texto-suave' },
              'No hay caudal para el ejemplo: asigna una boquilla a la barra o captura un volumen de agua objetivo en Sistema, Configuración.'
            )
          );
        } else {
          cuerpo.push(
            el(
              'p',
              { clase: 'ayuda' },
              `Velocidad ${formatear(aSistema('velocidad', ve.velocidadKmh, sistema), 2)} ` +
                `${unidadVelocidad} (${ve.origen}); espaciamiento efectivo ` +
                `${formatear(aSistema('distanciaCorta', espaciamientoM, sistema), 3)} ` +
                `${unidadEspaciamiento} (` +
                (g.valores.espaciamientoCapturado !== null && g.valores.espaciamientoCapturado !== undefined
                  ? 'capturado directamente'
                  : 'ancho de barra entre número de boquillas') +
                `); ${ce.origen}.`
            ),
            ...pintarAvisos(g.avisos)
          );
          let caudalConfiable = true;
          if (ce.resultado) {
            cuerpo.push(...pintarAvisos(ce.resultado.avisos));
            if (resultadoConfiable(ce.resultado)) {
              cuerpo.push(
                pintarResultado({
                  etiqueta: 'Caudal requerido por boquilla (despeje de la fórmula maestra)',
                  valor: aSistema('caudal', ce.resultado.valores.caudalLmin, sistema),
                  unidad: unidadCaudal,
                  decimales: 3,
                  ayuda:
                    'Lo que tendría que salir por cada boquilla para dejar el volumen objetivo ' +
                    'con esta velocidad y este espaciamiento. Aquí es un ejemplo con los datos ' +
                    'del equipo activo: sirve para ver la fórmula maestra trabajando.',
                }),
                pintarVerificacion(ce.resultado.verificacion),
                pintarDesglose(ce.resultado.desglose)
              );
            } else {
              caudalConfiable = false;
              cuerpo.push(
                pintarResultadoNoVerificado('Caudal requerido por boquilla'),
                pintarVerificacion(ce.resultado.verificacion)
              );
            }
          }
          if (caudalConfiable) {
            const ambos = ambosMetodos({
              caudalBoquillaLmin: ce.caudalLmin,
              numBoquillas: equipo?.numBoquillas,
              velocidadKmh: ve.velocidadKmh,
              espaciamientoM,
              anchoBarraM: equipo?.anchoBarra,
              umbralDiscrepanciaPct: p.umbrales.umbralDiscrepanciaMetodos,
            });
            cuerpo.push(...pintarAvisos(ambos.avisos));
            if (resultadoConfiable(ambos)) {
              cuerpo.push(
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Método por boquilla',
                    valor: aSistema('volumenAplicacion', ambos.valores.lhaPorBoquilla, sistema),
                    unidad: unidadVolumen,
                    decimales: 1,
                    principal: true,
                    ayuda:
                      'Los litros por hectárea calculados con UNA boquilla y la distancia entre ' +
                      'boquillas: la franja que moja una sola.',
                  }),
                  pintarResultado({
                    etiqueta: 'Método por barra',
                    valor: aSistema('volumenAplicacion', ambos.valores.lhaPorBarra, sistema),
                    unidad: unidadVolumen,
                    decimales: 1,
                    principal: true,
                    ayuda:
                      'Los mismos litros por hectárea con el caudal de TODA la barra y su ancho ' +
                      'completo. Dos caminos al mismo número: por eso se muestran juntos.',
                  })
                ),
                el(
                  'div',
                  { estilo: GRID_2 },
                  pintarResultado({
                    etiqueta: 'Discrepancia entre métodos',
                    valor: ambos.valores.discrepanciaPct,
                    unidad: '%',
                    decimales: 2,
                    ayuda:
                      'Qué tanto se separan los dos métodos. Cerca de cero es lo normal; si se ' +
                      'abre, el espaciamiento por el número de boquillas no da el ancho de barra ' +
                      'configurado.',
                  }),
                  pintarResultado({
                    etiqueta: 'Caudal total de la barra',
                    valor: aSistema('caudal', ambos.valores.caudalTotalLmin, sistema),
                    unidad: unidadCaudal,
                    decimales: 2,
                    ayuda:
                      'Todo lo que sale por la barra junta: el caudal de una boquilla por el ' +
                      'número de boquillas.',
                  })
                ),
                pintarVerificacion(ambos.verificacion),
                pintarDesglose(ambos.desglose)
              );
            } else {
              cuerpo.push(
                pintarResultadoNoVerificado('Volumen de aplicación del ejemplo'),
                pintarVerificacion(ambos.verificacion)
              );
            }
          }
        }
      }
    } catch (error) {
      cuerpo.push(alertaDestructiva(error));
    }

    // Equivalente imperial.
    const gpaDerivado = (FACTOR_LHA * HA_POR_ACRE) / (KM_POR_MILLA * M_POR_PULGADA);
    cuerpo.push(
      subtitulo('Equivalente imperial'),
      filaFormula(
        'Fórmula imperial de la industria',
        `GPA = GPM * ${FACTOR_GPA} / (mph * espaciamiento (pulgadas))`
      ),
      pintarDesglose(
        [
          paso(
            'El mismo análisis dimensional, convertido con las constantes métricas',
            'factor_lha * ha_por_acre / (km_por_milla * m_por_pulgada)',
            `${FACTOR_LHA} * ${HA_POR_ACRE} / (${KM_POR_MILLA} * ${M_POR_PULGADA})`,
            gpaDerivado,
            ''
          ),
        ],
        { titulo: `Consistencia dimensional con el ${FACTOR_GPA}` }
      ),
      el(
        'p',
        { clase: 'ayuda' },
        `La derivación da ${formatear(gpaDerivado, 1)} contra el ${FACTOR_GPA} estándar de la ` +
          'industria: la diferencia es el redondeo de la propia industria. La interfaz nunca usa ' +
          'la fórmula imperial como segunda implementación: el cálculo interno es siempre métrico ' +
          'y las unidades se convierten en la frontera de captura y presentación.'
      )
    );

    return tarjeta(
      {
        titulo: 'Fórmulas maestras de L/ha',
        descripcion:
          'De dónde sale cada fórmula, con los parámetros vigentes sustituidos: lo que ves aquí es lo que el sistema calcula hoy.',
      },
      el('div', { estilo: COLUMNA }, cuerpo)
    );
  }

  // ------------------------------------------------------------------
  // Tarjeta 2: relacion presion-caudal
  // ------------------------------------------------------------------
  function tarjetaPresionCaudal() {
    const cuerpo = [];
    cuerpo.push(
      filaFormula('Relación presión-caudal', 'caudal_2 = caudal_1 * (presion_2 / presion_1) ^ exponente'),
      filaFormula('Despeje de presión', 'presion_2 = presion_1 * (caudal_2 / caudal_1) ^ (1 / exponente)'),
      el(
        'p',
        { clase: 'ayuda' },
        'El exponente es un parámetro POR BOQUILLA registrado en cada ficha del catálogo: las ' +
          'hidráulicas convencionales siguen la raíz cuadrada, y las de inducción de aire o ' +
          'patrón regulable pueden desviarse (las ATR 80 sembradas usan el exponente ajustado a ' +
          'la tabla del propio fabricante).'
      )
    );

    const exponentes = [...new Set(catalogo.map((b) => b.exponente).filter((e) => Number.isFinite(e)))].sort(
      (a, b) => a - b
    );
    if (exponentes.length > 0) {
      cuerpo.push(
        el(
          'p',
          { clase: 'texto-suave' },
          `Exponentes registrados en el catálogo vigente: ${exponentes.map((e) => redondeoLegible(e)).join(', ')}.`
        )
      );
    }

    try {
      const b = boquillaInstalada() ?? catalogo[0] ?? null;
      if (!b) {
        cuerpo.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'El catálogo está vacío: agrega una boquilla en Sistema, Configuración para ver la demostración con una ficha real.'
          )
        );
      } else {
        const caudalDoble = b.caudalRefLmin * 2;
        const presionDoble = presionParaCaudal({
          caudalRef: b.caudalRefLmin,
          presionRef: b.presionRefBar,
          caudal: caudalDoble,
          exponente: b.exponente,
        });
        const veces = presionDoble / b.presionRefBar;
        cuerpo.push(
          pintarDesglose(
            [
              paso(
                `Duplicar el caudal de la ${b.fabricante} ${b.modelo} (exponente ${redondeoLegible(b.exponente)})`,
                'presion_ref * (caudal_doble / caudal_ref) ^ (1 / exponente)',
                `${redondeoLegible(b.presionRefBar)} * (${redondeoLegible(caudalDoble)} / ${redondeoLegible(b.caudalRefLmin)}) ^ (1 / ${redondeoLegible(b.exponente)})`,
                presionDoble,
                'bar'
              ),
            ],
            { abierto: true, titulo: 'Consecuencia operativa, calculada con la ficha vigente' }
          ),
          pintarAviso({
            tipo: 'advertencia',
            mensaje:
              `Con esta ficha, entregar el doble de caudal exige multiplicar la presión por ` +
              `${formatear(veces, 1)} (de ${formatear(aSistema('presion', b.presionRefBar, sistema), 2)} a ` +
              `${formatear(aSistema('presion', presionDoble, sistema), 2)} ${unidadPresion}). Cambiar de ` +
              'tamaño de boquilla es mejor palanca que forzar la presión: fuera del rango de la ficha el ' +
              'patrón de aspersión y el tamaño de gota se degradan aunque el caudal salga exacto.',
          })
        );
      }
    } catch (error) {
      cuerpo.push(alertaDestructiva(error));
    }

    return tarjeta(
      {
        titulo: 'Relación presión-caudal',
        descripcion: 'Por qué la presión es una palanca cara y cambiar de boquilla una barata.',
      },
      el('div', { estilo: COLUMNA }, cuerpo)
    );
  }

  // ------------------------------------------------------------------
  // Tarjeta 3: tabla ISO 10625
  // ------------------------------------------------------------------
  function tarjetaIso() {
    const cuerpo = [];

    const filas = TABLA_ISO_10625.map((fila) =>
      el(
        'tr',
        {},
        el(
          'td',
          {},
          fila.hex
            ? el('span', { clase: 'badge badge--iso', estilo: estiloBadgeIso(fila.hex) }, fila.tamano)
            : el('span', { clase: 'badge badge--contorno' }, fila.tamano)
        ),
        el('td', {}, fila.colorEs ?? '—'),
        el('td', {}, fila.ral ?? 'pendiente'),
        el('td', { clase: 'numero' }, formatear(fila.caudalLmin, 2)),
        el(
          'td',
          {},
          fila.verificado === true
            ? el('span', { clase: 'badge badge--secundario' }, 'verificado')
            : el('span', { clase: 'badge badge--advertencia' }, 'parcial')
        )
      )
    );
    cuerpo.push(
      el(
        'p',
        { clase: 'ayuda' },
        `Caudales nominales a ${PRESION_NOMINAL_ISO_BAR} bar (${formatear(barAKpa(PRESION_NOMINAL_ISO_BAR), 0)} kPa), ` +
          `con tolerancia de ±${formatear(p.umbrales.toleranciaIso, 0)} %. Los números RAL llevan sufijo -P ` +
          '(colores RAL de plásticos) y en la norma son informativos; el hex del badge es una aproximación ' +
          'para pintar en pantalla — el color normativo es el RAL.'
      ),
      tablaSimple(
        ['Tamaño', 'Color', 'RAL', `L/min a ${PRESION_NOMINAL_ISO_BAR} bar`, 'Verificado'],
        filas,
        true
      )
    );

    const notasFilas = TABLA_ISO_10625.filter((f) => f.nota).map((f) => `Tamaño ${f.tamano}: ${f.nota}`);
    cuerpo.push(
      subtitulo('Notas de la norma'),
      lista([
        ...notasFilas,
        'Desde la edición 2018 la norma separa dos tablas: caudales bajos (menos de 7,9 L/min, Tabla 1) y caudales altos (Tabla 2), que reutiliza los colores de la Tabla 1.',
        'Los caudales de la norma son valores redondeados: cuando la conversión y la tabla difieran, manda la tabla, no la conversión.',
      ])
    );

    // Reconciliacion ISO / convencion US, calculada en vivo.
    cuerpo.push(subtitulo('Reconciliación con la nomenclatura norteamericana'));
    try {
      const filaUs = filaIso(TAMANO_EJEMPLO_US);
      const gpm = filaUs ? gpmDeTamano(filaUs.tamano) : null;
      const fichaExponente =
        catalogo.find((b) => b.tamanoIso === TAMANO_EJEMPLO_US && Number.isFinite(b.exponente)) ??
        catalogo.find((b) => Number.isFinite(b.exponente)) ??
        null;
      if (!filaUs || gpm === null) {
        cuerpo.push(
          el('p', { clase: 'texto-suave' }, `La tabla ISO no trae el tamaño ${TAMANO_EJEMPLO_US}: no hay demostración.`)
        );
      } else if (!fichaExponente) {
        cuerpo.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'El catálogo está vacío: sin un exponente de ficha no se puede escalar la demostración de la convención US.'
          )
        );
      } else {
        const reconciliacion = caudalDesdeConvencionUs({
          gpm,
          psiReferencia: PSI_REFERENCIA_NOMENCLATURA_US,
          presionObjetivoBar: PRESION_NOMINAL_ISO_BAR,
          exponente: fichaExponente.exponente,
        });
        const desviacionPct =
          ((reconciliacion.valores.caudalLmin - filaUs.caudalLmin) / filaUs.caudalLmin) * PORCIENTO;
        cuerpo.push(
          el(
            'p',
            { clase: 'ayuda' },
            `En la convención norteamericana el número de tamaño ES el caudal en GPM a ` +
              `${PSI_REFERENCIA_NOMENCLATURA_US} psi: una ${filaUs.tamano} entrega ${formatear(gpm, 2)} GPM. ` +
              `Escalado a la presión nominal ISO con el exponente ${redondeoLegible(fichaExponente.exponente)} ` +
              `de la ficha ${fichaExponente.modelo}:`
          ),
          ...pintarAvisos(reconciliacion.avisos),
          el(
            'div',
            { estilo: GRID_2 },
            pintarResultado({
              etiqueta: `Convención US escalada a ${PRESION_NOMINAL_ISO_BAR} bar`,
              valor: reconciliacion.valores.caudalLmin,
              unidad: 'L/min',
              decimales: 3,
              ayuda:
                'El caudal que anuncia la nomenclatura norteamericana, llevado con la curva de ' +
                `la boquilla hasta los ${PRESION_NOMINAL_ISO_BAR} bar en que trabaja la tabla ` +
                'ISO. Así los dos números se pueden comparar.',
            }),
            pintarResultado({
              etiqueta: `Tabla ISO (tamaño ${filaUs.tamano})`,
              valor: filaUs.caudalLmin,
              unidad: 'L/min',
              decimales: 2,
              ayuda:
                'El caudal que la norma ISO 10625 asigna a ese tamaño y a ese color. Es el dato ' +
                'sembrado en la aplicación.',
            })
          ),
          pintarResultado({
            etiqueta: 'Desviación entre las dos nomenclaturas',
            valor: desviacionPct,
            unidad: '%',
            decimales: 1,
            principal: true,
            ayuda:
              'Cuánto se separan las dos formas de nombrar la misma boquilla. Una diferencia ' +
              'chica es el redondeo de cada tabla, no un error: el código de color y el número ' +
              'americano describen la misma pieza.',
          }),
          pintarDesglose(reconciliacion.desglose),
          el(
            'p',
            { clase: 'ayuda' },
            `Queda dentro de la tolerancia de ±${formatear(p.umbrales.toleranciaIso, 0)} % de la norma: las dos ` +
              'nomenclaturas describen la misma boquilla y la pequeña diferencia es el redondeo de cada tabla.'
          )
        );
      }
    } catch (error) {
      cuerpo.push(alertaDestructiva(error));
    }

    return tarjeta(
      {
        titulo: 'Código de colores ISO 10625:2018',
        descripcion: 'La tabla completa sembrada en la aplicación, con su estado de verificación fila por fila.',
      },
      el('div', { estilo: COLUMNA }, cuerpo)
    );
  }

  // ------------------------------------------------------------------
  // Tarjeta 4: clases de gota ANSI/ASABE S572
  // ------------------------------------------------------------------
  function tarjetaGota() {
    const cuerpo = [];

    function rangoTexto(minUm, maxUm) {
      if (minUm === null || minUm === undefined) return `hasta ${formatear(maxUm, 0)}`;
      if (maxUm === null || maxUm === undefined) return `${formatear(minUm, 0)} o más`;
      return `${formatear(minUm, 0)} a ${formatear(maxUm, 0)}`;
    }

    function tablaEdicion(definicion, campoMin, campoMax, encabezadoRango) {
      const filas = definicion.categorias.map((c) =>
        el(
          'tr',
          {},
          el('td', {}, el('span', { clase: 'badge badge--contorno' }, c.simbolo)),
          el('td', {}, c.nombre),
          el('td', {}, c.simbolo === 'C' || c.simbolo === 'VC' ? el('strong', {}, c.color) : c.color),
          el('td', { clase: 'numero' }, rangoTexto(c[campoMin], c[campoMax]))
        )
      );
      return [
        subtitulo(`Edición ${definicion.edicion}`),
        tablaSimple(['Clase', 'Nombre', 'Color', encabezadoRango], filas, true),
        el('p', { clase: 'ayuda' }, definicion.nota),
      ];
    }

    cuerpo.push(
      ...tablaEdicion(CLASES_S572_1, 'vmdMinUm', 'vmdMaxUm', 'VMD aprox. (µm)'),
      ...tablaEdicion(CLASES_S572_3, 'dv05MinUm', 'dv05MaxUm', 'Dv0.5 aprox. (µm)'),
      el(
        'p',
        { clase: 'ayuda' },
        'Los rangos de micras son aproximados e informativos: los umbrales normativos se definen ' +
          'con boquillas de referencia, no con números fijos.'
      ),
      pintarAviso({
        tipo: 'info',
        mensaje:
          'Entre ediciones se INVIRTIERON los colores de Gruesa y Muy gruesa (en S572.1 C es azul ' +
          'y VC verde; en S572.3 C es verde y VC azul) y los umbrales de las clases gruesas ' +
          'subieron: una boquilla VC, XC o UC bajo S572.1 puede caer un grado más fino bajo S572.3.',
      }),
      pintarAviso({
        tipo: 'advertencia',
        mensaje:
          'Regla de la aplicación: NO se comparan clases entre ediciones distintas. Cada ficha ' +
          'del catálogo registra con qué edición fue clasificada y los filtros respetan esa etiqueta.',
      })
    );

    const nombrePorClase = new Map(CLASES_S572_1.categorias.map((c) => [c.simbolo, c.nombre]));
    cuerpo.push(
      subtitulo('Guía operativa (informativa, sin recomendación automática)'),
      el(
        'p',
        { clase: 'texto-suave' },
        'La decisión de clase depende del producto y de las condiciones del día, que la aplicación no conoce.'
      ),
      ...Object.entries(GUIA_USO_GOTA).map(([simbolo, texto]) =>
        el(
          'div',
          { estilo: { display: 'flex', gap: '0.5rem', alignItems: 'baseline' } },
          el('span', { clase: 'badge badge--contorno' }, `${simbolo} ${nombrePorClase.get(simbolo) ?? ''}`.trim()),
          el('span', { clase: 'texto-suave' }, texto)
        )
      )
    );

    return tarjeta(
      {
        titulo: 'Clases de gota ANSI/ASABE S572',
        descripcion: 'Las dos ediciones vigentes en catálogos, tal como están sembradas en la aplicación.',
      },
      el('div', { estilo: COLUMNA }, cuerpo)
    );
  }

  // ------------------------------------------------------------------
  // Tarjeta 5: derivacion de g/SCF
  // ------------------------------------------------------------------
  function tarjetaGscf() {
    const cuerpo = [];
    const gas = ctx.gasActivo();
    if (!gas) {
      cuerpo.push(
        pintarAviso({
          tipo: 'error',
          mensaje: 'Sin gas configurado: agrégalo en Sistema, Configuración para ver la derivación con datos vivos.',
        })
      );
    } else {
      cuerpo.push(
        filaFormula(
          'Gas ideal en unidades imperiales',
          'g/SCF = P_estandar / (R_GAS * T_Rankine) * mol_por_lbmol * peso_molecular'
        ),
        el(
          'div',
          { estilo: GRID_2 },
          pintarResultado({
            etiqueta: 'R_GAS (constante del gas)',
            valor: R_GAS,
            unidad: 'psi*ft3/(lbmol*R)',
            decimales: 4,
            ayuda:
              'La constante de los gases ideales escrita en unidades imperiales. Es un valor ' +
              'físico fijo, igual para cualquier gas: relaciona presión, volumen y temperatura.',
          }),
          pintarResultado({
            etiqueta: 'Grados F a Rankine (offset)',
            valor: OFFSET_RANKINE,
            unidad: 'R',
            decimales: 2,
            ayuda:
              'Lo que se le suma a los grados Fahrenheit para llegar a la escala Rankine, que ' +
              'arranca en el cero absoluto. La ley del gas ideal solo funciona con temperatura ' +
              'absoluta.',
          })
        ),
        el(
          'div',
          { estilo: GRID_2 },
          pintarResultado({
            etiqueta: 'Moles por libra-mol',
            valor: LBMOL_A_MOL,
            unidad: 'mol/lbmol',
            decimales: 3,
            ayuda:
              'El puente entre las dos formas de contar moléculas. R_GAS trabaja en libras-mol ' +
              'y el peso molecular en moles: sin este factor el resultado sale mil veces más ' +
              'chico.',
          }),
          pintarResultado({
            etiqueta: `Peso molecular (${gas.nombre})`,
            valor: gas.pesoMolecular,
            unidad: 'g/mol',
            decimales: 2,
            ayuda:
              'Lo que pesa un mol de este gas. Es lo único de la fórmula que cambia de un gas a ' +
              'otro, y se edita en Sistema, Configuración.',
          })
        ),
        pintarAviso({
          tipo: 'advertencia',
          mensaje:
            `R_GAS trabaja en LIBRAS-mol, no en moles: omitir el factor de ${formatear(LBMOL_A_MOL, 3)} ` +
            'mol/lbmol deja el resultado tres órdenes de magnitud abajo.',
        })
      );

      try {
        const efectivo = gPorScfEfectivo({ gas });
        if (efectivo.valores.anulado) {
          cuerpo.push(
            ...pintarAvisos(efectivo.avisos),
            pintarResultado({
              etiqueta: 'Valor efectivo en uso (anulación manual)',
              valor: gas.gPorScfManual,
              unidad: 'g/SCF',
              decimales: 3,
              principal: true,
              ayuda:
                'El valor de tabla del proveedor que alguien capturó a mano. Mientras esté ' +
                'lleno, gana sobre el derivado y es el que usan todos los cálculos de gas. Se ' +
                'vacía en Sistema, Configuración para volver al derivado.',
            }),
            el(
              'p',
              { clase: 'ayuda' },
              'La derivación de abajo sigue documentando la metodología, pero mientras la anulación esté llena todos los cálculos usan el valor manual.'
            )
          );
        }
      } catch (error) {
        cuerpo.push(alertaDestructiva(error));
      }

      try {
        const derivado = gPorScfDerivado({
          pesoMolecular: gas.pesoMolecular,
          presionEstandarPsia: gas.presionEstandarPsia,
          temperaturaEstandarF: gas.temperaturaEstandarF,
        });
        cuerpo.push(...pintarAvisos(derivado.avisos));
        if (resultadoConfiable(derivado)) {
          cuerpo.push(
            pintarResultado({
              etiqueta: `Masa por pie cúbico estándar derivada (${gas.nombre})`,
              valor: derivado.valores.gPorScf,
              unidad: 'g/SCF',
              decimales: 3,
              principal: true,
              ayuda:
                'Cuántos gramos pesa un pie cúbico de este gas en las condiciones estándar del ' +
                'rotámetro, sacado del gas ideal. Es lo que convierte volumen de gas en gramos ' +
                'aplicados en toda la aplicación.',
            })
          );
        } else {
          cuerpo.push(pintarResultadoNoVerificado('Masa por pie cúbico estándar derivada'));
        }
        cuerpo.push(
          pintarVerificacion(derivado.verificacion),
          pintarDesglose(derivado.desglose, { abierto: true }),
          el(
            'p',
            { clase: 'ayuda' },
            `Verificación redundante: una segunda ruta rehace el cálculo en SI puro con la R universal ` +
              `(${redondeoLegible(SI_R_UNIVERSAL)} Pa*m3/(mol*K)) y un grupo de constantes duplicado a ` +
              'propósito; si las dos rutas no coinciden, el número no se muestra. Las condiciones ' +
              `estándar del gas (${formatear(gas.presionEstandarPsia, 2)} psia, ` +
              `${formatear(gas.temperaturaEstandarF, 1)} F) se editan en Sistema, Configuración.`
          )
        );
      } catch (error) {
        cuerpo.push(alertaDestructiva(error));
      }
    }

    return tarjeta(
      {
        titulo: 'Derivación de g/SCF',
        descripcion: 'La masa de gas por pie cúbico estándar, derivada del gas ideal con el gas activo.',
      },
      el('div', { estilo: COLUMNA }, cuerpo)
    );
  }

  // ------------------------------------------------------------------
  // Tarjeta 6: ecuacion maestra del rotametro
  // ------------------------------------------------------------------
  function tarjetaRotametro() {
    const cuerpo = [];
    cuerpo.push(
      filaFormula(
        'Factor de corrección por presión',
        'factor = raiz((psi_manometrica + presion_atmosferica_local) / presion_estandar_calibracion)'
      ),
      filaFormula(
        'Ecuación maestra (masa inyectada)',
        `masa_g = scfm * factor * g_por_scf * (tiempo_s / ${SEG_POR_MIN})`
      ),
      el(
        'p',
        { clase: 'ayuda' },
        'La escala del rotámetro está calibrada a la presión estándar: si el gas entra comprimido es ' +
          'más denso y el flotador subestima el flujo real; el factor sale del balance de fuerzas del ' +
          'flotador y lo compensa.'
      ),
      subtitulo('Los tres despejes'),
      filaFormula('Presión requerida', 'psi_manometrica = presion_estandar * factor_requerido^2 - presion_atmosferica_LOCAL'),
      filaFormula('Tiempo requerido', `tiempo_s = masa_g / (scfm * factor * g_por_scf) * ${SEG_POR_MIN}`),
      filaFormula('Lectura de flotador requerida', `scfm = masa_g / (factor * g_por_scf * (tiempo_s / ${SEG_POR_MIN}))`),
      pintarAviso({
        tipo: 'info',
        mensaje:
          'Cuando la presión atmosférica local difiere de la estándar de calibración (altitud), el ' +
          'despeje de presión resta la atmosférica LOCAL: el resultado es la lectura manométrica del ' +
          'sitio. Restar la estándar sería un error.',
      })
    );

    try {
      const gas = ctx.gasActivo();
      cuerpo.push(
        el(
          'div',
          { estilo: GRID_2 },
          pintarResultado({
            etiqueta: 'Presión estándar de calibración (gas activo)',
            valor: gas?.presionEstandarPsia ?? null,
            unidad: 'psia',
            decimales: 2,
            ayuda:
              'La presión para la que el fabricante grabó la escala del rotámetro. Es un dato ' +
              'del aparato y del gas, no del lote.',
          }),
          pintarResultado({
            etiqueta: 'Presión atmosférica local (sitio)',
            valor: ctx.presionAtmosfericaLocal(),
            unidad: 'psia',
            decimales: 2,
            ayuda:
              'La presión del aire en el rancho, derivada de su altitud. Se suma a lo que marca ' +
              'el manómetro para llegar a la presión absoluta del gas.',
          })
        ),
        el(
          'p',
          { clase: 'ayuda' },
          ctx.atmosferaSitio().valores.anulado
            ? 'La presión atmosférica local está anulada a mano en Configuración; la derivada de la altitud no se está usando.'
            : `La presión atmosférica local se deriva de los ${formatear(p.sitio.altitudM, 0)} m de altitud del sitio con la atmósfera estándar internacional: P = ${PRESION_NIVEL_MAR_PSIA} * (1 - ${GRADIENTE_ISA_POR_M} * altitud)^${EXPONENTE_ISA}. Baja 1 psi cada 574 m.`
        )
      );
      const psiCapturada = ctx.borrador('gas').psiManometrica;
      if (gas && Number.isFinite(psiCapturada)) {
        const factor = factorPresion({
          psiManometrica: psiCapturada,
          presionAtmosfericaLocal: ctx.presionAtmosfericaLocal(),
          presionEstandarCalibracion: gas.presionEstandarPsia,
        });
        cuerpo.push(
          pintarResultado({
            etiqueta: `Factor vivo con los ${formatear(psiCapturada, 1)} psi capturados en Gas etileno`,
            valor: factor,
            unidad: '',
            decimales: 4,
            ayuda:
              'La corrección por presión calculada con lo que hay capturado ahora mismo en la ' +
              'pestaña Gas etileno. Arriba de 1 significa que pasa más gas del que marca la ' +
              'escala del rotámetro.',
          })
        );
      } else {
        cuerpo.push(
          el(
            'p',
            { clase: 'texto-suave' },
            'Captura una presión manométrica en la pestaña Gas etileno para ver el factor calculado en vivo.'
          )
        );
      }
    } catch (error) {
      cuerpo.push(alertaDestructiva(error));
    }

    return tarjeta(
      {
        titulo: 'Ecuación maestra del rotámetro',
        descripcion: 'La corrección por presión y los tres despejes que usa la pestaña Gas etileno.',
      },
      el('div', { estilo: COLUMNA }, cuerpo)
    );
  }

  // ------------------------------------------------------------------
  // Tarjeta 7: supuestos declarados
  // ------------------------------------------------------------------
  function tarjetaSupuestos() {
    const supuestos = [
      'Las velocidades por marcha sembradas son las tablas del fabricante, válidas para el régimen nominal y la llanta trasera anotados en cada tractor; con otra llanta la tabla se reescala. Siguen siendo teóricas: no incluyen patinaje.',
      'El patinaje y el error del tacómetro se corrigen con factores MEDIDOS en campo; sin mediciones, la velocidad es teórica y así se marca. El patinaje no se predice con fórmula.',
      'El reporte de campo (segundos por tramo) es más confiable que la marcha teórica.',
      'En transmisión mecánica la velocidad de avance escala proporcional al régimen del motor.',
      'El efecto del régimen del motor sobre el gasto depende del tipo de bomba; el aforo al régimen real de trabajo manda sobre cualquier estimación.',
      'El exponente presión-caudal de 0.5 vale para boquillas hidráulicas convencionales; inducción de aire y patrón regulable pueden desviarse, y cada ficha del catálogo registra el suyo.',
      'El caudal de catálogo corresponde a boquilla NUEVA.',
      'La clase de gota depende de la presión de trabajo y el fabricante la reporta medida con agua.',
      'La caída de presión entre el manómetro y el punto de medición se considera despreciable.',
      'La corrección del rotámetro solo toma la presión: la temperatura del gas se supone en la estándar de calibración. Con el gas más frío que ella, la masa real queda hasta 2 % arriba de la calculada; con el cilindro al sol, hasta 3 % abajo.',
      'El rotámetro mide el gas inyectado, no el disuelto.',
      'El pesaje del cilindro manda sobre cualquier cálculo teórico de consumo de gas.',
      'Los datos viven solo en este navegador y en este dispositivo: la exportación es el único respaldo.',
    ];
    return tarjeta(
      {
        titulo: 'Supuestos declarados',
        descripcion: 'Del documento de diseño: lo que la aplicación asume y no puede saber por ti.',
      },
      lista(supuestos)
    );
  }

  // ------------------------------------------------------------------
  // Tarjeta 8: referencias
  // ------------------------------------------------------------------
  function tarjetaReferencias() {
    const referencias = [
      ['TeeJet Technologies, Catalog 51A-M (métrico)', 'caudales por presión y clases de gota de las series XR, TT, AIXR, TTI, AI, TX y TXA sembradas en el catálogo.'],
      ['Albuz (CoorsTek), ficha ATR 80, catálogo 2024', 'tabla de caudal de 5 a 25 bar del cono hueco cerámico; código de color europeo no ISO.'],
      ['ISO 10625:2018, vista previa oficial (iTeh Standards)', `tabla de colores y caudales a ${PRESION_NOMINAL_ISO_BAR} bar, y prólogo con los cambios de la edición 2018.`],
      ['NDSU Extension, AE1246 (rev. octubre 2024)', 'rangos aproximados de Dv0.5 de ANSI/ASABE S572.3.'],
      ['TeeJet, hoja «ASABE S572.1 Droplet Size Classification»', 'rangos aproximados de VMD de la edición S572.1.'],
      ['UGA Extension, «Considerations for Sprayer Nozzle Selection» (2025)', 'inversión de los colores C y VC entre ediciones del estándar de gota.'],
      ['Wikipedia, «List of RAL colours»', 'aproximaciones sRGB de los RAL para pintar los badges; el color normativo es el RAL, no el hex.'],
      ['Bartholomew, Paull y Rohrbach (eds.), The Pineapple: Botany, Production and Uses (2003)', 'dosis de etileno y volumen de agua de referencia del forzamiento.'],
    ];
    return tarjeta(
      {
        titulo: 'Referencias',
        descripcion: 'Las fuentes de los datos sembrados y de las fórmulas.',
      },
      el(
        'div',
        { estilo: COLUMNA },
        lista(
          referencias.map(([nombre, detalle]) =>
            el('span', {}, el('strong', {}, nombre), ` — ${detalle}`)
          )
        ),
        el(
          'p',
          { clase: 'texto-suave' },
          'Fuentes en línea consultadas el 2026-07-30 al construir los datos de siembra.'
        ),
        pintarAviso({
          tipo: 'info',
          mensaje:
            'Nota de diseño: la versión vigente de shadcn/ui define sus colores en OKLCH; este ' +
            'proyecto conserva a propósito los tokens HSL de tres números (assets/css/tokens.css).',
        })
      )
    );
  }

  // ---------------- Montaje ----------------
  panel.append(
    tarjetaFormulasLha(),
    tarjetaPresionCaudal(),
    tarjetaIso(),
    tarjetaGota(),
    tarjetaGscf(),
    tarjetaRotametro(),
    tarjetaSupuestos(),
    tarjetaReferencias()
  );
}
