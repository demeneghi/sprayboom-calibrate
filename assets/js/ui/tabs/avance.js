// Pestana Avance (dominio A): velocidad desde marcha y regimen, o desde
// el reporte de campo en segundos por tramo. Muestra siempre la
// velocidad teorica y la corregida por factores medidos, con el tiempo
// por tabla y el estado de la TDF.
//
// Aqui NO se repite la geometria derivada. La tarjeta que la traia era
// cuatro cifras que esta pantalla no usa para nada: dos de ellas (area
// en m2 y superficie en ha) son el mismo numero dividido entre 10000,
// "tramos por tabla" ya sale en la tarjeta de Resultado unos dedos mas
// arriba, y el espaciamiento manda en Gasto de agua, no en Avance. El
// bloque completo vive en Sistema, Configuracion, pegado a los campos
// que lo producen, y los avisos de espaciamiento (captura en
// centimetros, discrepancia contra el derivado) se siguen pintando ahi
// y en las tres pantallas que si usan el espaciamiento.
//
// Es la pestana EJEMPLAR del proyecto: borradores con autosave,
// cuadricula de marchas generada desde la transmision, resultados con
// desglose auditable, avisos tipados y edicion de estado via dialogo.

import { el, reemplazar } from '../dom.js';
import {
  tarjeta,
  tarjetaSinContexto,
  pintarAvisos,
  pintarDesglose,
  pintarResultado,
  alertaDeError,
} from '../render.js';
import { crearCampoNumerico } from '../campos.js';
import { crearCronometro } from '../cronometro.js';
import { formatear, formatearTiempo, formatearPorcentaje, formatearFecha } from '../formato.js';
import { confirmar } from '../dialog.js';
import { mostrarToast } from '../toast.js';
import { aSistema, unidad } from '../../domain/units.js';
import {
  marchasDeTractor,
  marchaHabitualDe,
  marchasParaVelocidad,
  velocidadEfectiva,
  avance,
  avanceDesdeReporte,
  velocidadDesdeReporte,
  calibrarMarcha,
  factorDesviacion,
  velocidadCorregida,
  validarRegimen,
} from '../../domain/speed.js';
import { tdfRpm } from '../../domain/pump.js';
import { PORCIENTO, TOLERANCIA_RPM_COINCIDENCIA } from '../../domain/constants.js';
import { validarValor } from '../../domain/validate.js';
import { COTAS_VELOCIDAD_MARCHA } from '../../domain/defaults.js';

export const id = 'avance';

// Marca corta del origen de la velocidad de cada marcha, visible en la
// cuadricula. Antes solo se marcaba la estimacion: al calibrar, la
// unica senal era que el numero cambiaba, y una calibracion realista lo
// mueve poco. Ahora cada estado se lee en la casilla.
const MARCA_ORIGEN = {
  estimacion: ' (est.)',
  capturado: ' (manual)',
  calibrado: ' (medida)',
};

export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const tractor = ctx.tractorActivo();
  // Sin tractor no hay marchas, ni regimen nominal, ni velocidad: esta
  // pantalla lo usa en la primera linea que sigue. Es la misma cortesia
  // que ya tenia Forzamiento cuando falta el gas o el rotametro.
  if (!tractor) {
    panel.append(tarjetaSinContexto('Avance', ['un tractor']));
    return;
  }
  let modo = borrador.modo ?? 'marcha';
  // La marcha guardada es de UN tractor: las marchas se identifican por
  // posicion, asi que sin este filtro cambiar de tractor en el encabezado
  // dejaba seleccionada la casilla del mismo lugar en el tractor nuevo
  // —otra velocidad nominal— sin decir nada. Un borrador anterior a este
  // sello no trae tractorId: se acepta y se vuelve a sellar abajo.
  let marchaSeleccionada =
    borrador.marcha &&
    (borrador.marcha.tractorId === undefined || borrador.marcha.tractorId === tractor.id)
      ? borrador.marcha
      : null; // {rango, marcha, tractorId}
  // Sin marcha de hoy se arranca en la MARCHA DE TRABAJO del tractor, la
  // que se eligio la vez pasada. El borrador solo recuerda una marcha a
  // la vez —es de la pantalla, no del tractor—, asi que cambiar de
  // tractor y volver dejaba la cuadricula en blanco y, con ella, sin
  // tiempo por tabla a las pantallas que lo heredan.
  if (!marchaSeleccionada) {
    const habitual = marchaHabitualDe(tractor);
    if (habitual) {
      marchaSeleccionada = { rango: habitual.rango, marcha: habitual.marcha, tractorId: tractor.id };
    }
  }
  const sistema = ctx.sistema();
  const unidadVelocidad = unidad('velocidad', sistema);
  // Longitud del tramo, en las unidades elegidas. Se arma una vez y se
  // repite en cada rotulo que hable de "tramo".
  const distanciaReferencia = ctx.estado().parametros.geometria.distanciaReferencia;
  const tramoTexto = `${formatear(aSistema('distancia', distanciaReferencia, sistema), 0)} ${unidad('distancia', sistema)}`;

  // ---------------- Modo ----------------
  const botonMarcha = el('button', { clase: 'boton boton--contorno', 'aria-pressed': 'false' }, 'Desde marcha y rpm');
  const botonReporte = el('button', { clase: 'boton boton--contorno', 'aria-pressed': 'false' }, 'Desde reporte de campo');
  function pintarModo() {
    // El resalte del modo elegido lo pinta components.css desde
    // `aria-pressed`: no se intercambian variantes de boton aqui.
    botonMarcha.setAttribute('aria-pressed', modo === 'marcha' ? 'true' : 'false');
    botonReporte.setAttribute('aria-pressed', modo === 'reporte' ? 'true' : 'false');
    zonaMarcha.classList.toggle('oculto', modo !== 'marcha');
    zonaReporte.classList.toggle('oculto', modo !== 'reporte');
  }
  botonMarcha.addEventListener('click', () => {
    modo = 'marcha';
    ctx.guardarBorrador(id, { modo });
    pintarModo();
    recalcular();
  });
  botonReporte.addEventListener('click', () => {
    modo = 'reporte';
    ctx.guardarBorrador(id, { modo });
    pintarModo();
    recalcular();
  });

  // ---------------- Cuadricula de marchas ----------------
  const cuadricula = el('div', {
    clase: 'cuadricula-marchas',
    estilo: { '--marchas-por-rango': String(tractor.marchasPorRango) },
    role: 'group',
    'aria-label': 'Marchas del tractor',
  });
  const filasMarchas = marchasDeTractor(tractor);
  const botonesMarcha = new Map();
  for (const fila of filasMarchas) {
    const clave = `${fila.rango}-${fila.marcha}`;
    const boton = el(
      'button',
      { clase: 'marcha', 'aria-pressed': 'false', disabled: fila.kmhNominal === null || null },
      el('span', { clase: 'marcha__nombre' }, fila.etiqueta),
      el(
        'span',
        { clase: 'marcha__velocidad' },
        fila.kmhNominal === null
          ? 'pendiente'
          : `${formatear(aSistema('velocidad', fila.kmhNominal, sistema), 1)} ${unidadVelocidad}${MARCA_ORIGEN[fila.origen] ?? ''}`
      )
    );
    boton.addEventListener('click', () => {
      marchaSeleccionada = { rango: fila.rango, marcha: fila.marcha, tractorId: tractor.id };
      ctx.guardarBorrador(id, { marcha: marchaSeleccionada });
      // La marcha elegida queda como marcha de TRABAJO del tractor, no
      // solo en el borrador de esta pantalla: es un dato del tractor y
      // es lo que deja llegar el tiempo por tabla a Gas etileno y a
      // Forzamiento sin tener que volver a pasar por aqui.
      recordarMarchaDeTrabajo(fila.rango, fila.marcha);
      pintarSeleccion();
      recalcular();
    });
    botonesMarcha.set(clave, boton);
    cuadricula.append(boton);
  }
  // Se guarda como 'datos' y no como 'contexto' a proposito: en esta
  // pantalla no cambia nada a la vista —la cuadricula ya se repinto
  // sola— y un re-render completo por cada toque a una marcha remontaria
  // el cronometro y el resto de la pestana.
  function recordarMarchaDeTrabajo(rango, marcha) {
    const guardada = ctx.tractorActivo()?.marchaHabitual;
    if (guardada && guardada.rango === rango && guardada.marcha === marcha) return;
    ctx.almacen.actualizar((e) => {
      const t = e.tractores.find((x) => x.id === tractor.id);
      if (t) t.marchaHabitual = { rango, marcha };
    }, 'datos');
  }

  function filaSeleccionada() {
    if (!marchaSeleccionada) return null;
    return (
      filasMarchas.find(
        (f) => f.rango === marchaSeleccionada.rango && f.marcha === marchaSeleccionada.marcha
      ) ?? null
    );
  }

  function pintarSeleccion() {
    for (const [clave, boton] of botonesMarcha) {
      const activa =
        marchaSeleccionada && clave === `${marchaSeleccionada.rango}-${marchaSeleccionada.marcha}`;
      boton.setAttribute('aria-pressed', activa ? 'true' : 'false');
    }
    const fila = filaSeleccionada();
    // El boton dice QUE marcha se va a calibrar: es la unica pieza que
    // conecta la cuadricula con el dialogo.
    botonCalibrarMarcha.textContent = fila
      ? `Calibrar ${fila.etiqueta} con una medición`
      : 'Calibrar esta marcha con una medición';
    pintarEstadoMarcha();
  }

  // Estado de la marcha seleccionada. Se deriva del dato guardado, asi
  // que sobrevive al re-pintado que dispara la calibracion: es la
  // constancia que queda en pantalla cuando el toast ya se fue.
  function pintarEstadoMarcha() {
    const fila = filaSeleccionada();
    if (!fila || fila.kmhNominal === null) {
      reemplazar(zonaEstadoMarcha);
      return;
    }
    const valor = `${formatear(aSistema('velocidad', fila.kmhNominal, sistema), 2)} ${unidadVelocidad}`;
    const fecha = formatearFecha(fila.fecha, { vacio: null });
    if (fila.origen === 'calibrado') {
      reemplazar(
        zonaEstadoMarcha,
        el(
          'div',
          { clase: 'alerta alerta--exito', role: 'status' },
          el('p', { clase: 'alerta__titulo' }, `${fila.etiqueta} calibrada con una medición de campo`),
          el(
            'p',
            { clase: 'alerta__descripcion' },
            `${valor} nominales a ${formatear(tractor.regimenNominal, 0)} rpm.` +
              // La fecha ya cierra con punto ("a. m."): no se le agrega otro.
              (fecha ? ` Medición del ${fecha}` : '')
          )
        )
      );
      return;
    }
    if (fila.origen === 'capturado') {
      reemplazar(
        zonaEstadoMarcha,
        el(
          'p',
          { clase: 'ayuda' },
          `${fila.etiqueta} usa el valor de tabla (${valor} nominales). Calíbrala en campo ` +
            'para respaldarla.'
        )
      );
      return;
    }
    // La estimacion ya lleva su propia alerta en la tarjeta de resultado:
    // no se repite aqui.
    reemplazar(zonaEstadoMarcha);
  }

  const campoRpm = crearCampoNumerico({
    etiqueta: 'Régimen del motor',
    unidad: 'rpm',
    valorInicial: borrador.rpm ?? tractor.regimenHabitual,
    ayuda: `Viene el régimen habitual del tractor (${tractor.regimenHabitual} rpm), no el nominal (${tractor.regimenNominal} rpm): así arranca donde de verdad se trabaja.`,
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { rpm: valor });
      recalcular();
    },
  });

  const botonCalibrarMarcha = el(
    'button',
    { clase: 'boton boton--contorno' },
    'Calibrar esta marcha con una medición'
  );
  botonCalibrarMarcha.addEventListener('click', () => abrirCalibracion());

  const zonaEstadoMarcha = el('div', {});

  const zonaMarcha = el(
    'div',
    { clase: 'pila' },
    cuadricula,
    campoRpm.elemento,
    botonCalibrarMarcha,
    zonaEstadoMarcha
  );

  // ---------------- Reporte de campo ----------------
  // El tramo es la distancia de referencia configurada, y va DICHA en la
  // pantalla, no escondida en la ayuda: "segundos por tramo" a secas no
  // significa nada en campo, porque el mismo tiempo es una velocidad
  // distinta en un tramo de 50 m que en uno de 100 m.
  const campoSegundos = crearCampoNumerico({
    etiqueta: `Segundos por tramo de ${tramoTexto}`,
    unidad: 's',
    valorInicial: borrador.segundosPorTramo ?? null,
    ayuda: `Lo que tardas en recorrer el tramo de ${tramoTexto}. Medirlo en campo es más confiable que la marcha de tabla. El tramo se cambia en Configuración.`,
    alCambiar: (valor) => {
      ctx.guardarBorrador(id, { segundosPorTramo: valor });
      recalcular();
    },
  });
  // Cronómetro integrado: mide los segundos por tramo en campo y los
  // pasa directo al cálculo.
  const zonaCronometro = el('div', {});
  const cronometro = crearCronometro({
    modo: 'cronometro',
    etiquetaUsar: 'Usar como segundos por tramo',
    alUsar: (segundos) => {
      const redondeado = Math.round(segundos * 10) / 10;
      campoSegundos.fijar(redondeado);
      ctx.guardarBorrador(id, { segundosPorTramo: redondeado });
      recalcular();
    },
  });
  zonaCronometro.append(cronometro.elemento);
  const zonaMarchasQueReproducen = el('div', {});
  const zonaReporte = el(
    'div',
    { clase: 'pila' },
    campoSegundos.elemento,
    zonaCronometro,
    zonaMarchasQueReproducen
  );

  // ---------------- Resultados ----------------
  const zonaResultados = el('div', { clase: 'pila' });
  const zonaTdf = el('div', { clase: 'pila' });

  function recalcular() {
    const estado = ctx.estado();
    const p = estado.parametros;
    const nodos = [];

    try {
      let velocidadTeorica = null;
      let origenVelocidad = null;

      if (modo === 'marcha') {
        const rpm = campoRpm.obtener();
        const fila = marchaSeleccionada
          ? filasMarchas.find(
              (f) => f.rango === marchaSeleccionada.rango && f.marcha === marchaSeleccionada.marcha
            )
          : null;
        if (!fila || fila.kmhNominal === null || rpm === null) {
          nodos.push(
            el('p', { clase: 'texto-suave' }, 'Elige una marcha y captura el régimen para calcular.')
          );
        } else {
          nodos.push(...pintarAvisos(validarRegimen({ rpm, tractor })));
          if (fila.origen === 'estimacion') {
            nodos.push(
              el(
                'div',
                { clase: 'alerta', role: 'status' },
                el(
                  'p',
                  { clase: 'alerta__descripcion' },
                  'La velocidad nominal de esta marcha es una ESTIMACIÓN no verificada contra el manual: calibrala en campo antes de confiar en la aplicación calculada.'
                )
              )
            );
          }
          velocidadTeorica = velocidadEfectiva({
            kmhNominal: fila.kmhNominal,
            rpm,
            regimenNominal: tractor.regimenNominal,
          });
          origenVelocidad = fila;
        }
      } else {
        const segundos = campoSegundos.obtener();
        if (segundos === null) {
          nodos.push(
            el(
              'p',
              { clase: 'texto-suave' },
              `Captura los segundos que tarda en recorrer el tramo de ${tramoTexto} para calcular.`
            )
          );
        } else {
          velocidadTeorica = velocidadDesdeReporte({
            segundosPorTramo: segundos,
            distanciaReferencia: p.geometria.distanciaReferencia,
          });
        }
      }

      if (velocidadTeorica !== null) {
        // Factores de desviacion medidos para este tractor (solo aplican
        // al modo marcha: el reporte de campo YA es velocidad real).
        let velocidadFinal = velocidadTeorica;
        if (modo === 'marcha') {
          const rpm = campoRpm.obtener();
          const mediciones = estado.factoresDesviacion
            .filter((m) => m.tractorId === tractor.id)
            .map((m) => ({ rpm: m.rpm, factor: m.factor }));
          const factor = factorDesviacion({ mediciones, rpm });
          nodos.push(...pintarAvisos(factor.avisos));
          const corregida = velocidadCorregida({
            velocidadTeoricaKmh: velocidadTeorica,
            factor: factor.factor,
            umbralDesviacionPct: p.umbrales.umbralDesviacionVelocidad,
          });
          nodos.push(...pintarAvisos(corregida.avisos));

          const etiquetaFactor =
            factor.estado === 'medido'
              ? 'factor medido en campo'
              : factor.estado === 'interpolado'
                ? 'factor interpolado'
                : factor.estado === 'sin-mediciones'
                  ? 'teórica sin verificar'
                  : 'sin medición en este régimen';

          nodos.push(
            pintarResultado({
              etiqueta: `Velocidad teórica (${origenVelocidad?.etiqueta ?? ''})`,
              valor: aSistema('velocidad', velocidadTeorica, sistema),
              unidad: unidadVelocidad,
              decimales: 2,
              ayuda:
                'La velocidad que daría esta marcha con las ruedas sin resbalar: la nominal de ' +
                'la marcha reescalada al régimen que capturaste. Es la del papel, no la del ' +
                'lote.',
            }),
            pintarResultado({
              etiqueta: `Velocidad corregida (${etiquetaFactor})`,
              ayuda:
                'La teórica multiplicada por el factor de desviación medido en campo, que ' +
                'recoge el patinaje y el radio real de la llanta. Es la velocidad con la que ' +
                'calculan las demás pantallas.',
              valor:
                corregida.valores.velocidadCorregidaKmh === null
                  ? null
                  : aSistema('velocidad', corregida.valores.velocidadCorregidaKmh, sistema),
              unidad: unidadVelocidad,
              decimales: 2,
              principal: true,
            }),
            el(
              'p',
              { clase: 'ayuda' },
              corregida.valores.desviacionPct === null
                ? 'Sin factor aplicable: se usa la teórica. El patinaje no se predice con fórmula; se mide en campo.'
                : `Desviación aplicada: ${formatearPorcentaje(Math.abs(corregida.valores.desviacionPct))} (factor ${formatear(factor.factor, 4)}).`
            )
          );
          if (corregida.valores.velocidadCorregidaKmh !== null) {
            velocidadFinal = corregida.valores.velocidadCorregidaKmh;
          }
        } else {
          nodos.push(
            pintarResultado({
              etiqueta: 'Velocidad real del reporte',
              valor: aSistema('velocidad', velocidadTeorica, sistema),
              unidad: unidadVelocidad,
              decimales: 2,
              principal: true,
              ayuda:
                `El tramo de ${tramoTexto} entre los segundos que tardaste. Ya trae dentro el ` +
                'patinaje y todo lo demás, así que no se le aplica ningún factor: es la ' +
                'velocidad de verdad.',
            })
          );
        }

        const resultadoAvance =
          modo === 'reporte'
            ? avanceDesdeReporte({
                segundosPorTramo: campoSegundos.obtener(),
                distanciaReferencia: p.geometria.distanciaReferencia,
                largoTabla: p.geometria.largoTabla,
              })
            : avance({
                velocidadKmh: velocidadFinal,
                distanciaReferencia: p.geometria.distanciaReferencia,
                largoTabla: p.geometria.largoTabla,
              });

        nodos.push(
          el(
            'div',
            { clase: 'rejilla-2' },
            pintarResultado({
              etiqueta: `Segundos por tramo de ${tramoTexto}`,
              valor: resultadoAvance.valores.segundosPorTramo,
              unidad: 's',
              decimales: 1,
              ayuda:
                `Lo que debe tardar en cruzar el tramo de ${tramoTexto} a esta velocidad. Sirve ` +
                'para comprobar en campo con el cronómetro: si el tiempo real no se parece, la ' +
                'velocidad no es la que dice.',
            }),
            pintarResultado({
              etiqueta: 'Tramos por tabla',
              valor: resultadoAvance.valores.tramosPorTabla,
              unidad: '',
              decimales: 2,
              ayuda: `Cuántos tramos de ${tramoTexto} caben en el largo de la tabla.`,
            })
          ),
          pintarResultado({
            etiqueta: `Tiempo total por tabla (${formatearTiempo(resultadoAvance.valores.tiempoTotalS)})`,
            valor: resultadoAvance.valores.tiempoTotalS,
            unidad: 's',
            decimales: 0,
            ayuda:
              'Lo que dura un pase completo de la tabla a esta velocidad. Es el tiempo que ' +
              'Forzamiento usa como ventana de inyección del gas.',
          }),
          pintarDesglose(resultadoAvance.desglose)
        );

        if (modo === 'reporte') {
          pintarMarchasQueReproducen(velocidadTeorica);
        }
      } else if (modo === 'reporte') {
        reemplazar(zonaMarchasQueReproducen);
      }
    } catch (error) {
      nodos.push(alertaDeError(error));
    }

    reemplazar(zonaResultados, nodos);
    pintarTdf();
  }

  // Solo las marchas que SI reproducen la velocidad con el motor dentro
  // de su rango de trabajo. Antes se listaban todas y cada fila cargaba
  // una columna "Estado" con su chip: en teléfono esa tercera columna no
  // cabía y la tabla se iba a scroll horizontal, para acabar mostrando
  // diez renglones inservibles. Lo que no se puede usar no se imprime;
  // el rango del motor queda en el pie.
  function pintarMarchasQueReproducen(velocidadObjetivoKmh) {
    const filas = marchasParaVelocidad({ tractor, velocidadObjetivoKmh }).filter(
      (fila) => !fila.fueraDeRango
    );
    const pie = el(
      'p',
      { clase: 'ayuda' },
      `Rango de trabajo del motor: ${tractor.regimenMinimo} a ${tractor.regimenMaximo} rpm.`
    );
    if (filas.length === 0) {
      reemplazar(
        zonaMarchasQueReproducen,
        el('h3', { clase: 'etiqueta' }, 'Marchas que reproducen esta velocidad'),
        el(
          'p',
          { clase: 'texto-suave' },
          'Ninguna marcha de este tractor reproduce esta velocidad con el motor dentro de su rango de trabajo.'
        ),
        pie
      );
      return;
    }
    reemplazar(
      zonaMarchasQueReproducen,
      el('h3', { clase: 'etiqueta' }, 'Marchas que reproducen esta velocidad'),
      el(
        'table',
        { clase: 'tabla tabla--numerica' },
        el(
          'thead',
          {},
          el('tr', {}, el('th', {}, 'Marcha'), el('th', { clase: 'numero' }, 'rpm requeridas'))
        ),
        el(
          'tbody',
          {},
          filas.map((fila) =>
            el(
              'tr',
              {},
              el('td', {}, fila.etiqueta),
              el('td', { clase: 'numero' }, formatear(fila.rpmRequeridas, 0))
            )
          )
        )
      ),
      pie
    );
  }

  function pintarTdf() {
    const equipo = ctx.equipoActivo();
    const rpm = modo === 'marcha' ? campoRpm.obtener() : null;
    const nodos = [];
    if (!equipo) {
      nodos.push(el('p', { clase: 'texto-suave' }, 'Sin barra de aplicación configurada.'));
    } else if (equipo.accionamiento !== 'tdf') {
      nodos.push(
        el(
          'p',
          { clase: 'texto-suave' },
          'La bomba de esta barra no es de TDF: su velocidad no depende del régimen del motor.'
        )
      );
    } else if (rpm === null) {
      nodos.push(
        el('p', { clase: 'texto-suave' }, 'Captura el régimen en el modo de marcha para ver la TDF.')
      );
    } else {
      const resultado = tdfRpm({
        tdfNominal: equipo.tdfNominal,
        rpmMotor: rpm,
        rpmMotorTdfNominal: equipo.rpmMotorTdfNominal,
      });
      nodos.push(
        el(
          'div',
          { clase: 'rejilla-2' },
          pintarResultado({
            etiqueta: 'TDF resultante',
            valor: resultado.valores.tdfRpm,
            unidad: 'rpm',
            decimales: 0,
            ayuda:
              'A cuántas vueltas gira la toma de fuerza con el régimen de motor capturado. La ' +
              'bomba de la barra va colgada de ella: si baja la TDF, baja la presión.',
          }),
          pintarResultado({
            etiqueta: 'Porcentaje del nominal',
            valor: resultado.valores.porcentajeNominal,
            unidad: '%',
            decimales: 1,
            ayuda:
              'Qué tanto de las vueltas nominales de la toma de fuerza estás dando. En 100 % la ' +
              'bomba trabaja como en su ficha; muy por debajo, la presión de la barra ya no es ' +
              'la de la calibración.',
          })
        ),
        pintarDesglose(resultado.desglose)
      );
      if (equipo.rpmCalibracion === null || equipo.rpmCalibracion === undefined) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta', role: 'status' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              'No hay registrado el régimen de la última calibración de presión. Capturalo en Configuración para que la aplicación pueda advertir el efecto del régimen sobre el gasto de la barra.'
            )
          )
        );
      } else if (Math.abs(rpm - equipo.rpmCalibracion) > TOLERANCIA_RPM_COINCIDENCIA) {
        nodos.push(
          el(
            'div',
            { clase: 'alerta alerta--advertencia', role: 'alert' },
            el(
              'p',
              { clase: 'alerta__descripcion' },
              `Estás operando a ${formatear(rpm, 0)} rpm y la última calibración de presión fue a ${formatear(equipo.rpmCalibracion, 0)} rpm. El efecto sobre el gasto depende del tipo de bomba: revisa el contraste en Gasto de agua. El aforo al régimen real manda.`
            )
          )
        );
      }
    }
    reemplazar(zonaTdf, nodos);
  }

  async function abrirCalibracion() {
    const fila = filaSeleccionada();
    if (!fila) {
      mostrarToast('Primero elige la marcha que vas a calibrar.', { tipo: 'destructivo' });
      return;
    }
    const p = ctx.estado().parametros;
    const campoSegundosMedidos = crearCampoNumerico({
      etiqueta: `Segundos medidos por tramo de ${tramoTexto}`,
      unidad: 's',
    });
    const campoRpmMedidas = crearCampoNumerico({
      etiqueta: 'Régimen durante la medición',
      unidad: 'rpm',
      valorInicial: campoRpm.obtener() ?? tractor.regimenHabitual,
    });
    const vista = el(
      'div',
      { clase: 'pila-campos' },
      campoSegundosMedidos.elemento,
      campoRpmMedidas.elemento
    );
    const ok = await confirmar({
      titulo: `Calibrar ${fila.etiqueta} desde una medición de campo`,
      descripcion:
        'La velocidad nominal de la marcha se recalcula al régimen nominal del tractor y la fila queda marcada como calibrada.',
      cuerpo: vista,
      confirmarTexto: 'Calibrar',
    });
    if (!ok) return;
    const segundos = campoSegundosMedidos.obtener();
    const rpmMedidas = campoRpmMedidas.obtener();
    if (segundos === null || rpmMedidas === null) {
      mostrarToast('Faltan la medición o el régimen: no se calibró nada.', { tipo: 'destructivo' });
      return;
    }
    try {
      const velocidadMedida = velocidadDesdeReporte({
        segundosPorTramo: segundos,
        distanciaReferencia: p.geometria.distanciaReferencia,
      });
      // Se redondea a 4 decimales antes de guardar: el sobrante binario
      // (16.000000000000004) no es precision, y sale a la vista en el
      // campo de Configuracion.
      const nominal =
        Math.round(
          calibrarMarcha({
            velocidadMedidaKmh: velocidadMedida,
            rpmMedidas,
            regimenNominal: tractor.regimenNominal,
          }) * 1e4
        ) / 1e4;
      // Las mismas cotas que valida el formulario de Configuracion: una
      // medicion mal tomada no puede dejar guardado un valor imposible.
      const veredicto = validarValor(COTAS_VELOCIDAD_MARCHA.kmhNominal, nominal);
      if (!veredicto.ok) {
        mostrarToast(`No se calibró ${fila.etiqueta}. ${veredicto.mensaje} Revisa la medición.`, {
          tipo: 'destructivo',
        });
        return;
      }
      const anterior = fila.kmhNominal;
      ctx.almacen.actualizar((estado) => {
        const t = estado.tractores.find((x) => x.id === tractor.id);
        const filaEstado = t.velocidades.find(
          (v) => v.rango === fila.rango && v.marcha === fila.marcha
        );
        filaEstado.kmhNominal = nominal;
        filaEstado.origen = 'calibrado';
        filaEstado.fecha = new Date().toISOString();
      }, 'contexto');
      // El toast dice el CAMBIO, no solo el valor nuevo: una calibracion
      // realista mueve el numero poco y sin el antes no se nota.
      const nuevoEnSistema = formatear(aSistema('velocidad', nominal, sistema), 2);
      const rpmNominal = formatear(tractor.regimenNominal, 0);
      let cambio = `${nuevoEnSistema} ${unidadVelocidad} nominales a ${rpmNominal} rpm.`;
      if (anterior !== null && anterior !== undefined && anterior > 0) {
        const variacionPct = ((nominal - anterior) / anterior) * PORCIENTO;
        const signo = variacionPct > 0 ? '+' : '';
        cambio =
          `pasó de ${formatear(aSistema('velocidad', anterior, sistema), 2)} a ${nuevoEnSistema} ` +
          `${unidadVelocidad} nominales a ${rpmNominal} rpm ` +
          `(${signo}${formatearPorcentaje(variacionPct)}).`;
      }
      mostrarToast(`${fila.etiqueta} calibrada: ${cambio}`, { duracionMs: 7000 });
    } catch (error) {
      mostrarToast(String(error.message ?? error), { tipo: 'destructivo' });
    }
  }

  // Lo que la pantalla YA esta usando se guarda al montar, no solo al
  // teclearlo. El regimen aparece precargado con el habitual del tractor
  // y Avance calcula con el desde el primer instante; el modo arranca en
  // 'marcha' sin que nadie pulse el boton. Mientras eso vivio solo en el
  // input, las pantallas que heredan la velocidad no lo veian: elegir una
  // marcha y aceptar el regimen que ya venia puesto las dejaba sin
  // velocidad —o heredando el reporte de campo de otro dia— mientras
  // Avance mostraba la de la marcha. La marcha se vuelve a sellar con el
  // tractor activo por lo mismo.
  if (marchaSeleccionada) {
    marchaSeleccionada = {
      rango: marchaSeleccionada.rango,
      marcha: marchaSeleccionada.marcha,
      tractorId: tractor.id,
    };
  }
  ctx.guardarBorrador(id, { modo, rpm: campoRpm.obtener(), marcha: marchaSeleccionada });

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Avance',
        descripcion: `Velocidad y tiempo por tabla del ${tractor.nombre}.`,
        ayuda: `El cronómetro arranca al entrar al tramo de ${tramoTexto} y para al salir.`,
      },
      el('div', { clase: 'grupo-modo' }, botonMarcha, botonReporte),
      zonaMarcha,
      zonaReporte
    ),
    tarjeta({ titulo: 'Resultado' }, zonaResultados),
    tarjeta(
      {
        titulo: 'Toma de fuerza y bomba',
        descripcion: 'Si la bomba es de TDF, su velocidad cae con el régimen del motor.',
      },
      zonaTdf
    )
  );

  pintarModo();
  pintarSeleccion();
  recalcular();
}
