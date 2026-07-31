// Pestana Bitacora: consulta de las aplicaciones guardadas
// (estado.bitacora) y de las pruebas de captura (estado.pruebasCaptura).
//
// No calcula nada de dominio: pinta lo que se guardo, con la regla dura
// de los registros historicos: el numero mostrado es el del momento del
// calculo (snapshot), y si un parametro vigente ya difiere, se SENALA
// la diferencia en vez de recalcular en silencio.
//
// Convenciones tomadas de avance.js: nodos con el() (sin innerHTML),
// formateo solo con formato.js, borrador para el estado de los filtros
// y dialogos nativos via confirmar().

import { el, reemplazar } from '../dom.js';
import { tarjeta } from '../render.js';
import { crearCampoSelect } from '../campos.js';
import { formatear, formatearPorcentaje, formatearFecha } from '../formato.js';
import { confirmar } from '../dialog.js';
import { mostrarToast } from '../toast.js';
import { aCSV, descargarOCompartir } from '../../storage.js';
import { aSistema, unidad } from '../../domain/units.js';
import {
  PARAMETROS,
  COTAS_TRACTOR,
  COTAS_EQUIPO,
  COTAS_VELOCIDAD_MARCHA,
} from '../../domain/defaults.js';

export const id = 'bitacora';

// ---------------------------------------------------------------------
// Tipos de registro
// ---------------------------------------------------------------------
const ETIQUETAS_TIPO = {
  'gasto-agua': 'Gasto de agua',
  gas: 'Gas etileno',
  forzamiento: 'Forzamiento',
  mezcla: 'Mezcla',
  'prueba-captura': 'Prueba de captura',
};

const OPCIONES_FILTRO = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'gasto-agua', texto: 'Gasto de agua' },
  { valor: 'gas', texto: 'Gas etileno' },
  { valor: 'forzamiento', texto: 'Forzamiento' },
  { valor: 'mezcla', texto: 'Mezcla' },
  { valor: 'prueba-captura', texto: 'Prueba de captura' },
];

// ---------------------------------------------------------------------
// Utilerias de presentacion (sin logica de dominio)
// ---------------------------------------------------------------------
function marcaTiempo(iso) {
  const t = new Date(iso ?? NaN).getTime();
  return Number.isFinite(t) ? t : 0;
}

// Busqueda simple insensible a mayusculas y acentos.
function textoBuscable(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Valor plano legible para la tabla clave-valor del detalle. Regresa
// null para estructuras anidadas que no caben en una celda.
function valorLegible(valor) {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'number') return formatear(valor, 4, { fijos: false });
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no';
  if (typeof valor === 'string') return valor === '' ? '—' : valor;
  if (Array.isArray(valor) && valor.every((v) => typeof v === 'number' || v === null)) {
    return valor.map((v) => formatear(v, 2, { fijos: false })).join(', ');
  }
  return null;
}

function etiquetaConUnidad(etiqueta, unidadTexto) {
  return unidadTexto ? `${etiqueta} (${unidadTexto})` : etiqueta;
}

// Numero crudo para celdas CSV: punto decimal y sin separadores de
// miles, para que la columna sea procesable ademas de legible. El
// formateo es-MX (coma decimal) se reserva para la pantalla.
function numeroCSV(valor, decimales = 4) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '';
  return String(Number(valor.toFixed(decimales)));
}

// Serializa los datos planos de un registro para la columna Datos del
// CSV: pares clave=valor con los valores crudos tal como se guardaron.
function datosACadena(datos) {
  return Object.entries(datos ?? {})
    .map(([clave, valor]) => {
      if (valor === null || valor === undefined) return `${clave}=`;
      if (Array.isArray(valor)) {
        return valor.every((v) => v === null || typeof v !== 'object')
          ? `${clave}=${valor.join('|')}`
          : null;
      }
      if (typeof valor === 'object') return null;
      return `${clave}=${String(valor)}`;
    })
    .filter(Boolean)
    .join('; ');
}

function numAtipicas(resultados) {
  if (!resultados) return null;
  if (Array.isArray(resultados.atipicas)) return resultados.atipicas.length;
  if (Array.isArray(resultados.porBoquilla)) {
    return resultados.porBoquilla.filter((b) => b && b.atipica).length;
  }
  return null;
}

// ---------------------------------------------------------------------
// Comparacion del snapshot contra los parametros vigentes
//
// El snapshot es la COPIA guardada al calcular; aqui NUNCA se recalcula
// nada: solo se senala que parametros vigentes ya no son los del
// registro. Vacio (null) y ausente (undefined) cuentan como iguales.
// ---------------------------------------------------------------------
function normalizado(valor) {
  return valor === undefined ? null : valor;
}

function difieren(a, b) {
  return normalizado(a) !== normalizado(b);
}

function diferenciasSnapshot(snapshot, parametrosVigentes, tractorVigente, equipoVigente) {
  const diferencias = [];

  const snapParametros = snapshot?.parametros ?? {};
  for (const [grupo, defGrupo] of Object.entries(PARAMETROS)) {
    const valores = snapParametros[grupo];
    if (!valores) continue;
    for (const [campo, defCampo] of Object.entries(defGrupo.campos)) {
      if (!(campo in valores)) continue;
      const antes = valores[campo];
      const ahora = parametrosVigentes?.[grupo]?.[campo];
      if (difieren(antes, ahora)) {
        diferencias.push({ etiqueta: defCampo.etiqueta, unidad: defCampo.unidad, antes, ahora });
      }
    }
  }

  const snapTractor = snapshot?.tractor;
  if (snapTractor && tractorVigente) {
    if (snapTractor.id !== tractorVigente.id) {
      diferencias.push({
        etiqueta: 'Tractor activo',
        unidad: '',
        antes: snapTractor.nombre ?? snapTractor.id,
        ahora: tractorVigente.nombre ?? tractorVigente.id,
      });
    } else {
      for (const [campo, cota] of Object.entries(COTAS_TRACTOR)) {
        if (campo in snapTractor && difieren(snapTractor[campo], tractorVigente[campo])) {
          diferencias.push({
            etiqueta: cota.etiqueta,
            unidad: cota.unidad ?? '',
            antes: snapTractor[campo],
            ahora: tractorVigente[campo],
          });
        }
      }
      for (const fila of snapTractor.velocidades ?? []) {
        const vigente = (tractorVigente.velocidades ?? []).find(
          (v) => v.rango === fila.rango && v.marcha === fila.marcha
        );
        if (vigente && difieren(fila.kmhNominal, vigente.kmhNominal)) {
          const rango = tractorVigente.etiquetasRango?.[fila.rango] ?? String(fila.rango + 1);
          diferencias.push({
            etiqueta: `${COTAS_VELOCIDAD_MARCHA.kmhNominal.etiqueta} ${rango}${fila.marcha}`,
            unidad: COTAS_VELOCIDAD_MARCHA.kmhNominal.unidad,
            antes: fila.kmhNominal,
            ahora: vigente.kmhNominal,
          });
        }
      }
    }
  }

  const snapEquipo = snapshot?.equipo;
  if (snapEquipo && equipoVigente) {
    if (snapEquipo.id !== equipoVigente.id) {
      diferencias.push({
        etiqueta: 'Equipo activo',
        unidad: '',
        antes: snapEquipo.nombre ?? snapEquipo.id,
        ahora: equipoVigente.nombre ?? equipoVigente.id,
      });
    } else {
      for (const [campo, cota] of Object.entries(COTAS_EQUIPO)) {
        if (campo in snapEquipo && difieren(snapEquipo[campo], equipoVigente[campo])) {
          diferencias.push({
            etiqueta: cota.etiqueta,
            unidad: cota.unidad ?? '',
            antes: snapEquipo[campo],
            ahora: equipoVigente[campo],
          });
        }
      }
    }
  }

  return diferencias;
}

// ---------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------
export function render(panel, ctx) {
  const borrador = ctx.borrador(id);
  const sistema = ctx.sistema();
  let tipoFiltro = borrador.tipoFiltro ?? 'todas';
  let busqueda = borrador.busqueda ?? '';

  const unidadCaudal = unidad('caudal', sistema);
  const unidadPresion = unidad('presion', sistema);
  const unidadVolChico = unidad('volumenChico', sistema);
  const unidadVolAplicacion = unidad('volumenAplicacion', sistema);
  const decimalesPresion = sistema === 'imperial' ? 1 : 2;
  const decimalesVolAplicacion = sistema === 'imperial' ? 1 : 0;

  // ---------------- Nombres legibles de una prueba de captura --------
  function nombreEquipoPrueba(prueba) {
    return (
      prueba.parametros?.equipo?.nombre ??
      ctx.estado().equipos.find((e) => e.id === prueba.equipoId)?.nombre ??
      'equipo sin registrar'
    );
  }

  function nombreBoquillaPrueba(prueba) {
    if (!prueba.boquillaId) return 'sin boquilla de referencia';
    const boquilla = ctx.estado().catalogo.find((b) => b.id === prueba.boquillaId);
    return boquilla ? `${boquilla.fabricante} ${boquilla.modelo}` : prueba.boquillaId;
  }

  function resumenPrueba(prueba) {
    const r = prueba.resultados ?? {};
    const cuenta = numAtipicas(r);
    return (
      `Media ${formatear(aSistema('caudal', r.mediaLmin ?? null, sistema), 3)} ${unidadCaudal}, ` +
      `CV ${formatearPorcentaje(r.cvPoblacionalPct ?? null, 1)}, ` +
      `${cuenta === null ? '—' : cuenta} atípica(s) de ${r.n ?? '—'} boquilla(s), ` +
      `a ${formatear(aSistema('presion', prueba.presionBar ?? null, sistema), decimalesPresion)} ${unidadPresion}.`
    );
  }

  // Lista unificada: aplicaciones + pruebas de captura, con titulo y
  // resumen sintetizados para las pruebas (que no los guardan).
  function registrosUnificados() {
    const estado = ctx.estado();
    const aplicaciones = (estado.bitacora ?? []).map((registro) => ({
      origen: 'bitacora',
      id: registro.id,
      tipo: registro.tipo,
      fecha: registro.fecha,
      titulo: registro.titulo ?? ETIQUETAS_TIPO[registro.tipo] ?? 'Registro',
      resumen: registro.resumen ?? '',
      registro,
    }));
    const pruebas = (estado.pruebasCaptura ?? []).map((prueba) => ({
      origen: 'pruebas',
      id: prueba.id,
      tipo: 'prueba-captura',
      fecha: prueba.fecha,
      titulo: `Prueba de captura: ${nombreEquipoPrueba(prueba)}`,
      resumen: resumenPrueba(prueba),
      registro: prueba,
    }));
    return [...aplicaciones, ...pruebas].sort(
      (a, b) => marcaTiempo(b.fecha) - marcaTiempo(a.fecha)
    );
  }

  // ---------------- Filtros ----------------
  const selectTipo = crearCampoSelect({
    id: 'bitacora-filtro-tipo',
    etiqueta: 'Tipo de registro',
    opciones: OPCIONES_FILTRO,
    valorInicial: tipoFiltro,
    alCambiar: (valor) => {
      tipoFiltro = valor;
      ctx.guardarBorrador(id, { tipoFiltro });
      pintarLista();
    },
  });

  const entradaBusqueda = el('input', {
    clase: 'entrada',
    id: 'bitacora-busqueda',
    type: 'search',
    autocomplete: 'off',
    placeholder: 'Palabra del título o del resumen...',
    value: busqueda,
  });
  entradaBusqueda.addEventListener('input', () => {
    busqueda = entradaBusqueda.value;
    ctx.guardarBorrador(id, { busqueda });
    pintarLista();
  });
  const campoBusqueda = el(
    'div',
    { clase: 'campo' },
    el('label', { clase: 'etiqueta', for: 'bitacora-busqueda' }, 'Buscar'),
    entradaBusqueda
  );

  const zonaContador = el('p', { clase: 'ayuda' });
  const zonaLista = el('div', {
    estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  });

  // ---------------- Lista ----------------
  function pintarLista() {
    const todos = registrosUnificados();
    const aguja = textoBuscable(busqueda.trim());
    const filtrados = todos.filter(
      (entrada) =>
        (tipoFiltro === 'todas' || entrada.tipo === tipoFiltro) &&
        (aguja === '' || textoBuscable(`${entrada.titulo} ${entrada.resumen}`).includes(aguja))
    );

    if (todos.length === 0) {
      reemplazar(zonaContador);
      reemplazar(
        zonaLista,
        el(
          'p',
          { clase: 'texto-suave' },
          'Todavía no hay nada guardado. Los cálculos se guardan desde las pestañas de ' +
            'Calibrar con el botón "Guardar en bitácora" (Gasto de agua, Gas etileno, ' +
            'Forzamiento y Mezcla); los aforos, desde Registrar, Prueba de captura, con ' +
            '"Guardar prueba".'
        )
      );
      return;
    }

    reemplazar(zonaContador, `Se muestran ${filtrados.length} de ${todos.length} registro(s).`);
    if (filtrados.length === 0) {
      reemplazar(
        zonaLista,
        el('p', { clase: 'texto-suave' }, 'Ningún registro coincide con el filtro actual.')
      );
      return;
    }
    reemplazar(zonaLista, filtrados.map(filaRegistro));
  }

  function filaRegistro(entrada) {
    const botonDetalle = el('button', { clase: 'boton boton--contorno boton--sm' }, 'Ver detalle');
    botonDetalle.addEventListener('click', () => abrirDetalle(entrada));
    const botonEliminar = el(
      'button',
      { clase: 'boton boton--fantasma boton--sm', 'aria-label': `Eliminar registro: ${entrada.titulo}` },
      'Eliminar'
    );
    botonEliminar.addEventListener('click', () => eliminarRegistro(entrada));

    return el(
      'article',
      {
        estilo: {
          border: '1px solid hsl(var(--border))',
          borderRadius: 'var(--radius)',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        },
      },
      el(
        'div',
        {
          estilo: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          },
        },
        el('span', { clase: 'badge badge--secundario' }, ETIQUETAS_TIPO[entrada.tipo] ?? entrada.tipo),
        el('span', { clase: 'texto-suave', estilo: { fontSize: 'var(--text-meta)' } }, formatearFecha(entrada.fecha))
      ),
      el('p', { estilo: { fontWeight: '600', fontSize: 'var(--text-base)' } }, entrada.titulo),
      entrada.resumen
        ? el('p', { clase: 'texto-suave', estilo: { fontSize: 'var(--text-sm)' } }, entrada.resumen)
        : null,
      el('div', { estilo: { display: 'flex', gap: '0.5rem' } }, botonDetalle, botonEliminar)
    );
  }

  // ---------------- Eliminar ----------------
  async function eliminarRegistro(entrada) {
    const ok = await confirmar({
      titulo: 'Eliminar registro',
      descripcion:
        `Se elimina "${entrada.titulo}" del ${formatearFecha(entrada.fecha)}. ` +
        'Esta acción no se puede deshacer: el registro y su copia de parámetros se pierden.',
      confirmarTexto: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    ctx.almacen.actualizar((e) => {
      if (entrada.origen === 'pruebas') {
        e.pruebasCaptura = (e.pruebasCaptura ?? []).filter((r) => r.id !== entrada.id);
      } else {
        e.bitacora = (e.bitacora ?? []).filter((r) => r.id !== entrada.id);
      }
    }, 'datos');
    mostrarToast('Registro eliminado.');
    pintarLista();
  }

  // ---------------- Detalle ----------------
  function tablaClaveValor(filas) {
    return el(
      'div',
      { clase: 'scroll-x' },
      el(
        'table',
        { clase: 'tabla' },
        el(
          'tbody',
          {},
          filas.map(([clave, valor]) =>
            el('tr', {}, el('td', {}, clave), el('td', { clase: 'numero' }, valor))
          )
        )
      )
    );
  }

  // Datos guardados de un registro de aplicacion: pares clave-valor tal
  // como se guardaron (base metrica del momento del calculo; las claves
  // son los identificadores internos del registro).
  function nodosDatosAplicacion(registro) {
    const filas = Object.entries(registro.datos ?? {})
      .map(([clave, valor]) => [clave, valorLegible(valor)])
      .filter(([, valor]) => valor !== null);
    if (filas.length === 0) {
      return [el('p', { clase: 'texto-suave' }, 'Este registro no guardó datos planos.')];
    }
    return [
      tablaClaveValor(filas),
      el(
        'p',
        { clase: 'ayuda' },
        'Valores tal como se guardaron al calcular, en unidades métricas de base.'
      ),
    ];
  }

  // Datos guardados de una prueba de captura: campos conocidos con
  // etiqueta y unidad del sistema activo.
  function nodosDatosPrueba(prueba) {
    const r = prueba.resultados ?? {};
    const cuenta = numAtipicas(r);
    const volumenes =
      (prueba.volumenesMl ?? [])
        .map((v) => formatear(aSistema('volumenChico', v, sistema), 1, { fijos: false }))
        .join(', ') || '—';
    const filas = [
      ['Equipo', nombreEquipoPrueba(prueba)],
      ['Boquilla de referencia', nombreBoquillaPrueba(prueba)],
      [
        etiquetaConUnidad('Presión de trabajo', unidadPresion),
        formatear(aSistema('presion', prueba.presionBar ?? null, sistema), decimalesPresion),
      ],
      [etiquetaConUnidad('Tiempo de prueba', 's'), formatear(prueba.tiempoS ?? null, 0)],
      [etiquetaConUnidad('Volúmenes recogidos', unidadVolChico), volumenes],
      ['Boquillas capturadas', formatear(r.n ?? null, 0)],
      [
        etiquetaConUnidad('Media de la barra', unidadCaudal),
        formatear(aSistema('caudal', r.mediaLmin ?? null, sistema), 3),
      ],
      [
        etiquetaConUnidad('DE poblacional', unidadCaudal),
        formatear(aSistema('caudal', r.dePoblacional ?? null, sistema), 4),
      ],
      [
        etiquetaConUnidad('DE muestral (n − 1)', unidadCaudal),
        formatear(aSistema('caudal', r.deMuestral ?? null, sistema), 4),
      ],
      ['CV poblacional', formatearPorcentaje(r.cvPoblacionalPct ?? null, 1)],
      ['CV muestral', formatearPorcentaje(r.cvMuestralPct ?? null, 1)],
      ['Desgaste implícito contra catálogo', formatearPorcentaje(r.desgastePct ?? null, 1)],
      [
        etiquetaConUnidad('Volumen real medido', unidadVolAplicacion),
        formatear(
          aSistema('volumenAplicacion', r.lhaRealMedido ?? null, sistema),
          decimalesVolAplicacion
        ),
      ],
      ['Desviación contra objetivo', formatearPorcentaje(r.comparacionObjetivoPct ?? null, 1)],
      ['Boquillas atípicas', cuenta === null ? '—' : String(cuenta)],
    ];
    return [tablaClaveValor(filas)];
  }

  // Snapshot: diferencias contra lo vigente + copia completa plegable.
  function nodosSnapshot(snapshot) {
    if (!snapshot) {
      return [
        el(
          'div',
          { clase: 'alerta', role: 'status' },
          el(
            'p',
            { clase: 'alerta__descripcion' },
            'Este registro no guardó copia de los parámetros: no hay contra qué comparar los vigentes.'
          )
        ),
      ];
    }

    const nodos = [];
    nodos.push(
      el(
        'p',
        { clase: 'ayuda' },
        `Calculado con el tractor ${snapshot.tractor?.nombre ?? '—'} y el equipo ${snapshot.equipo?.nombre ?? '—'}.`
      )
    );

    const diferencias = diferenciasSnapshot(
      snapshot,
      ctx.estado().parametros,
      ctx.tractorActivo(),
      ctx.equipoActivo()
    );
    if (diferencias.length === 0) {
      nodos.push(
        el(
          'p',
          { clase: 'ayuda' },
          'Los parámetros vigentes coinciden con los de este registro.'
        )
      );
    } else {
      nodos.push(
        el(
          'div',
          { clase: 'alerta alerta--advertencia', role: 'alert' },
          el(
            'p',
            { clase: 'alerta__titulo' },
            `${diferencias.length} parámetro(s) vigentes ya no son los del registro`
          ),
          el(
            'ul',
            {
              estilo: {
                listStyle: 'none',
                margin: '0',
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              },
            },
            diferencias.map((d) => {
              const u = d.unidad ? ` ${d.unidad}` : '';
              return el(
                'li',
                { estilo: { display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' } },
                el('span', { clase: 'badge badge--advertencia' }, 'difiere hoy'),
                el(
                  'span',
                  { clase: 'alerta__descripcion' },
                  `${d.etiqueta}: ${valorLegible(d.antes) ?? '—'}${u} → ${valorLegible(d.ahora) ?? '—'}${u}`
                )
              );
            })
          ),
          el(
            'p',
            { clase: 'alerta__descripcion' },
            'El registro histórico conserva los números con los que se calculó; el valor vigente se muestra solo para señalar el cambio.'
          )
        )
      );
    }

    // Copia completa del snapshot, plegable para no saturar el dialogo.
    const cuerpoSnapshot = [];
    for (const [grupo, defGrupo] of Object.entries(PARAMETROS)) {
      const valores = snapshot.parametros?.[grupo];
      if (!valores) continue;
      const filas = Object.entries(defGrupo.campos)
        .filter(([campo]) => campo in valores)
        .map(([campo, defCampo]) => [
          etiquetaConUnidad(defCampo.etiqueta, defCampo.unidad),
          valorLegible(valores[campo]) ?? '—',
        ]);
      if (filas.length === 0) continue;
      cuerpoSnapshot.push(el('p', { clase: 'etiqueta' }, defGrupo.etiqueta), tablaClaveValor(filas));
    }
    if (snapshot.tractor) {
      const filas = [
        ['Nombre', snapshot.tractor.nombre ?? '—'],
        ...Object.entries(COTAS_TRACTOR)
          .filter(([campo]) => campo in snapshot.tractor)
          .map(([campo, cota]) => [
            etiquetaConUnidad(cota.etiqueta, cota.unidad),
            valorLegible(snapshot.tractor[campo]) ?? '—',
          ]),
      ];
      cuerpoSnapshot.push(el('p', { clase: 'etiqueta' }, 'Tractor del registro'), tablaClaveValor(filas));
    }
    if (snapshot.equipo) {
      const filas = [
        ['Nombre', snapshot.equipo.nombre ?? '—'],
        ...Object.entries(COTAS_EQUIPO)
          .filter(([campo]) => campo in snapshot.equipo)
          .map(([campo, cota]) => [
            etiquetaConUnidad(cota.etiqueta, cota.unidad),
            valorLegible(snapshot.equipo[campo]) ?? '—',
          ]),
      ];
      cuerpoSnapshot.push(el('p', { clase: 'etiqueta' }, 'Equipo del registro'), tablaClaveValor(filas));
    }
    if (cuerpoSnapshot.length > 0) {
      nodos.push(
        el(
          'details',
          { clase: 'desglose' },
          el('summary', {}, 'Snapshot de parámetros del registro'),
          el('div', { clase: 'desglose__cuerpo' }, cuerpoSnapshot)
        )
      );
    }
    return nodos;
  }

  async function abrirDetalle(entrada) {
    let cuerpo;
    try {
      cuerpo = el(
        'div',
        { estilo: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } },
        el(
          'div',
          { estilo: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' } },
          el('span', { clase: 'badge badge--secundario' }, ETIQUETAS_TIPO[entrada.tipo] ?? entrada.tipo),
          el('span', { clase: 'texto-suave', estilo: { fontSize: 'var(--text-meta)' } }, formatearFecha(entrada.fecha))
        ),
        entrada.resumen ? el('p', { clase: 'texto-suave' }, entrada.resumen) : null,
        el('h3', { clase: 'etiqueta' }, 'Datos guardados'),
        entrada.origen === 'pruebas'
          ? nodosDatosPrueba(entrada.registro)
          : nodosDatosAplicacion(entrada.registro),
        el('h3', { clase: 'etiqueta' }, 'Parámetros con los que se calculó'),
        nodosSnapshot(entrada.registro.parametros)
      );
    } catch (error) {
      cuerpo = el(
        'div',
        { clase: 'alerta alerta--destructiva', role: 'alert' },
        el(
          'p',
          { clase: 'alerta__descripcion' },
          `El detalle de este registro no se pudo armar: ${String(error?.message ?? error)}`
        )
      );
    }

    // Dialogo de solo lectura: se usa confirmar() con "Cerrar" como
    // unico boton. confirmar() monta el <dialog> de forma sincrona, asi
    // que el boton de cancelar (que aqui sobra) se oculta en cuanto
    // existe; ambos botones cierran sin efecto alguno.
    const promesa = confirmar({ titulo: entrada.titulo, cuerpo, confirmarTexto: 'Cerrar' });
    const dialogos = document.querySelectorAll('dialog.dialogo');
    const dialogo = dialogos[dialogos.length - 1];
    dialogo?.querySelector('.dialogo__acciones .boton--contorno')?.classList.add('oculto');
    await promesa;
  }

  // ---------------- Exportar CSV ----------------
  const botonCsvAplicaciones = el('button', { clase: 'boton' }, 'Exportar aplicaciones (CSV)');
  botonCsvAplicaciones.addEventListener('click', async () => {
    const registros = (ctx.estado().bitacora ?? [])
      .slice()
      .sort((a, b) => marcaTiempo(b.fecha) - marcaTiempo(a.fecha));
    if (registros.length === 0) {
      mostrarToast('No hay aplicaciones guardadas que exportar.', { tipo: 'destructivo' });
      return;
    }
    const filas = registros.map((r) => [
      r.fecha ?? '',
      ETIQUETAS_TIPO[r.tipo] ?? r.tipo ?? '',
      r.titulo ?? '',
      r.resumen ?? '',
      datosACadena(r.datos),
    ]);
    const csv = aCSV(['Fecha', 'Tipo', 'Título', 'Resumen', 'Datos'], filas);
    const resultado = await descargarOCompartir(
      'bitacora-aplicaciones.csv',
      csv,
      'text/csv'
    );
    if (resultado !== 'cancelado') mostrarToast('Aplicaciones exportadas.');
  });

  const botonCsvPruebas = el(
    'button',
    { clase: 'boton boton--secundario' },
    'Exportar pruebas de captura (CSV)'
  );
  botonCsvPruebas.addEventListener('click', async () => {
    const pruebas = (ctx.estado().pruebasCaptura ?? [])
      .slice()
      .sort((a, b) => marcaTiempo(b.fecha) - marcaTiempo(a.fecha));
    if (pruebas.length === 0) {
      mostrarToast('No hay pruebas de captura guardadas que exportar.', { tipo: 'destructivo' });
      return;
    }
    const filas = pruebas.map((prueba) => {
      const r = prueba.resultados ?? {};
      const cuenta = numAtipicas(r);
      return [
        prueba.fecha ?? '',
        nombreEquipoPrueba(prueba),
        nombreBoquillaPrueba(prueba),
        numeroCSV(prueba.presionBar),
        numeroCSV(prueba.tiempoS),
        (prueba.volumenesMl ?? []).map((v) => numeroCSV(v)).join(' | '),
        numeroCSV(r.mediaLmin),
        numeroCSV(r.cvPoblacionalPct, 2),
        cuenta === null ? '' : String(cuenta),
      ];
    });
    const csv = aCSV(
      [
        'Fecha',
        'Equipo',
        'Boquilla',
        'Presión bar',
        'Tiempo s',
        'Volúmenes mL',
        'Media L/min',
        'CV %',
        'Atípicas',
      ],
      filas
    );
    const resultado = await descargarOCompartir('pruebas-captura.csv', csv, 'text/csv');
    if (resultado !== 'cancelado') mostrarToast('Pruebas de captura exportadas.');
  });

  // ---------------- Montaje ----------------
  panel.append(
    tarjeta(
      {
        titulo: 'Bitácora',
        descripcion: 'Aplicaciones guardadas y pruebas de captura, de la más reciente a la más vieja.',
      },
      el(
        'div',
        { clase: 'alerta', role: 'status' },
        el('p', { clase: 'alerta__titulo' }, 'Los datos viven solo en este navegador'),
        el(
          'p',
          { clase: 'alerta__descripcion' },
          'No hay servidor ni respaldo automático: si se borra el almacenamiento del navegador, la bitácora se pierde. Exporta el CSV con regularidad.'
        )
      ),
      selectTipo.elemento,
      campoBusqueda,
      zonaContador,
      zonaLista
    ),
    tarjeta(
      {
        titulo: 'Exportar',
        descripcion: 'CSV en UTF-8 con BOM, listo para Excel en español.',
      },
      el(
        'div',
        { estilo: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
        botonCsvAplicaciones,
        botonCsvPruebas
      ),
      el(
        'p',
        { clase: 'ayuda' },
        'Las columnas numéricas del CSV van en unidades métricas de base (bar, s, mL, L/min) con punto decimal, tal como se guardaron.'
      )
    )
  );

  pintarLista();
}
