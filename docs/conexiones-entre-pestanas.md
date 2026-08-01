# Conexiones entre pestañas: análisis e inventario

Este documento levanta el inventario de los datos que una pestaña **calcula** y otra
**necesita**, dice cuáles están conectados hoy, cuáles no, y cuáles están conectados pero
fallan. No cambia código: es el mapa para decidir qué conectar y en qué orden.

Fecha del análisis: agosto de 2026. Rama: `claude/calculated-fields-tabs-sync-0zbwcz`.

---

## 1. Resumen

La aplicación tiene **tres mecanismos distintos** para pasar un dato de una pantalla a otra,
y solo uno de ellos está bien resuelto. Los otros dos producen el síntoma reportado: cambiar
la velocidad en Avance —de reporte de campo a marcha con régimen— **no cambia lo que ven las
demás pantallas**.

Hallazgos, en orden de gravedad:

1. **Fallo confirmado y reproducido.** El régimen del motor que Avance precarga (1 800 rpm)
   **nunca se guarda** salvo que el usuario lo teclee. Como la herencia de velocidad exige ese
   número, el flujo normal (elegir marcha y aceptar el régimen precargado) deja a Gasto de agua,
   Boquillas y Prueba de captura **sin velocidad**, o peor, heredando el reporte de campo viejo.
2. **Cinco implementaciones divergentes** de "la velocidad que viene de Avance", tres de ellas
   copias literales entre sí, y **cuatro de las cinco ignoran el modo elegido en Avance**.
3. **El volumen de aplicación (L/ha) no viaja a ningún lado.** Es el número central de la
   aplicación: lo calcula Gasto de agua, lo mide la Prueba de captura, y las cinco pantallas
   que lo consumen lo piden a mano, con cuatro nombres distintos en el borrador.
4. **La masa de etileno por tabla no viaja de Forzamiento a Gas etileno**, siendo literalmente
   el mismo número (uno lo calcula, el otro lo pide como objetivo).

---

## 2. Cómo viaja hoy un dato entre pestañas

Hay tres mecanismos. Conviene nombrarlos porque el resto del documento los usa.

### Mecanismo A — derivado compartido en `ctx` (el bueno)

`main.js` expone funciones que **derivan** el dato del estado guardado, y las pantallas las
llaman. Nadie copia nada; no hay dos versiones del número.

| Función de `ctx` | Qué deriva | Quién la consume |
|---|---|---|
| `parametrosGeometria()` | ancho, boquillas y espaciamiento de la barra activa + largo de tabla | avance, gasto, boquillas, captura, forzamiento, configuración, metodología |
| `atmosferaSitio()` / `presionAtmosfericaLocal()` | presión del sitio, derivada de la altitud | gas, forzamiento, metodología, configuración |
| `tractorActivo()`, `equipoActivo()`, `gasActivo()`, `rotametroActivo()` | la unidad elegida en el encabezado | todas |

Los comentarios del propio `main.js` explican por qué se hizo así:

> Vive aquí y no repetido en cada pestaña porque siete pantallas lo pedían idéntico y bastaba
> olvidar una para que esa calculara con la barra equivocada.

**Este es el patrón que hay que extender.** Es el único que no se puede desincronizar.

### Mecanismo B — herencia con estado visible (`ui/velocidad.js`)

Un componente (`crearCampoVelocidad`) que precarga el valor heredado, marca en un chip de dónde
salió, permite capturar a mano y ofrece un botón para volver a heredar. Lo usan tres pantallas:
Gasto de agua, Boquillas y Prueba de captura.

El diseño es correcto: el chip dice `de Avance` / `capturada a mano` / `sin dato en Avance`, y
el número se guarda en el borrador de la pestaña para que sobreviva a la recarga y viaje en el
enlace compartido. **El problema no es el componente: es el dato que lee** (ver §3).

### Mecanismo C — botón que copia una vez (frágil)

Un botón que lee el borrador de otra pestaña, calcula y escribe el resultado en un campo. No
deja rastro de dónde salió el número ni se vuelve a sincronizar.

| Dónde | Botón | Qué copia |
|---|---|---|
| `gas.js` | «Usar el tiempo por tabla de Avance» | tiempo total por tabla |
| `forzamiento.js` | «Traer tiempo de Avance» | tiempo total por tabla |
| `boquillas.js` | «Usar en Gasto de agua» (por fila) | boquilla + presión requerida |

Y una variante todavía más silenciosa, sin botón ni chip: `gasto.js` línea 699 precarga el
régimen de trabajo con `ctx.borrador('avance').rpm`. Si el usuario lo toca una vez, ese campo
queda desconectado de Avance para siempre y nada lo dice.

---

## 3. El fallo reportado: causa exacta

### 3.1 Qué pasa

`avance.js` guarda en el borrador solo lo que el usuario **toca**:

| Dato | Se guarda cuando… | Valor que la pantalla usa si no se toca |
|---|---|---|
| `modo` | se pulsa uno de los dos botones de modo | `'marcha'` |
| `marcha` | se toca una casilla de la cuadrícula | ninguno |
| `rpm` | **se teclea en el campo** | `tractor.regimenHabitual` (1 800 rpm) |
| `segundosPorTramo` | se teclea, o se usa el cronómetro | ninguno |

El régimen es el caso peligroso: el campo aparece **ya lleno** con 1 800 rpm
(`avance.js:189`), la pantalla calcula con ese valor, y el borrador se queda vacío. Como
`velocidadDeAvance` exige `rpm` finito para poder usar la marcha
(`speed.js:443`), la herencia se cae.

### 3.2 Reproducción verificada

Ejecuté las funciones de dominio con los datos exactos de los dos escenarios.

**Escenario 1 — flujo normal de estreno.** Usuario nuevo entra a Avance, toca la marcha B1 y
acepta el régimen precargado sin teclearlo:

```
Avance muestra en pantalla:            5.657 km/h
Gasto / Boquillas / Captura heredan:   null  («sin dato en Avance»)
```

**Escenario 2 — el que describes.** Usuario captura primero el reporte de campo (100 m en 60 s),
después cambia a «Desde marcha y rpm», elige B1 y acepta el régimen precargado:

```
Lo que heredan Gasto/Boquillas/Captura:
  velocidad: 6 km/h        origen: reporte / del reporte de campo
Lo que Avance muestra en pantalla:
  velocidad: 5.657 km/h    origen: marcha-teorica / de la marcha B1
```

**6 % de diferencia, en silencio, sobre el volumen por hectárea.** El chip de Gasto de agua
además afirma con toda tranquilidad `de Avance — 6,00 km/h del reporte de campo`, así que la
pantalla se ve conectada y correcta.

### 3.3 Por qué las pruebas no lo agarran

`tests/speed.test.js` cubre la herencia con seis casos, incluido `'el modo marcha manda aunque
haya un reporte viejo'` — pero **todos pasan `rpm` explícito**. El hueco es justo el caso real:
`rpm` ausente porque el usuario nunca tecleó el valor que ya venía puesto.

### 3.4 Un segundo desfase en el mismo campo

Al cambiar de tractor en el encabezado, `borrador.marcha` **no se limpia**: la selección se
transfiere por posición. Tener C3 seleccionada en el JD 5715 (29,8 km/h) y cambiar al JD 6603
deja seleccionada la C3 del 6603 (31,2 km/h) sin decir nada. Lo mismo con `rpm`, que conserva
el régimen tecleado para el tractor anterior.

---

## 4. Las cinco versiones de «lo que viene de Avance»

El mismo cálculo está escrito cinco veces, y **no coinciden entre sí**:

| # | Dónde | ¿Respeta el modo elegido en Avance? | Prioridad |
|---|---|---|---|
| 1 | `domain/speed.js::velocidadDeAvance` | **Sí** | el modo elegido, y el otro como respaldo |
| 2 | `ui/tabs/gas.js::traerTiempoDeAvance` | **No** | reporte siempre primero |
| 3 | `ui/tabs/forzamiento.js::traerTiempoDeAvance` | **No** | reporte siempre primero |
| 4 | `ui/tabs/metodologia.js::velocidadEjemplo` | **No** | reporte, marcha, y una tercera vía propia |
| 5 | `ui/tabs/gasto.js:699` (campo de régimen) | n/a | lee `borrador.rpm` crudo |

Las versiones 2 y 3 son **copias literales** una de otra: unas 55 líneas idénticas, incluido el
texto del mensaje de error. La versión 4 añade un tercer respaldo que las demás no tienen (la
primera marcha disponible al régimen habitual).

Consecuencia práctica, con el mismo estado guardado del escenario 2:

- Avance en pantalla: velocidad de la marcha B1.
- Gasto / Boquillas / Captura: velocidad del reporte (por el fallo de §3).
- Gas etileno y Forzamiento, al pulsar «traer tiempo»: tiempo del reporte, **por diseño de esa
  copia**, aunque el fallo de §3 se arregle.
- Metodología: ejemplo con el reporte.

Es decir: **arreglar §3 deja todavía dos pantallas discrepando**, porque su desacuerdo es
independiente.

---

## 5. Inventario de conexiones

Leyenda: **✅** conectado y correcto · **⚠️** conectado pero frágil o roto · **❌** sin conexión.

### 5.1 Velocidad de avance

| Origen | Destino | Estado | Detalle |
|---|---|---|---|
| Avance | Gasto de agua | ⚠️ | `crearCampoVelocidad`, roto por §3 |
| Avance | Boquillas | ⚠️ | igual |
| Avance | Prueba de captura | ⚠️ | igual |
| Avance | Metodología (ejemplo vivo) | ⚠️ | implementación #4, ignora el modo |
| Avance | Mezcla | — | no la necesita |

### 5.2 Tiempo por tabla y régimen del motor

| Origen | Destino | Estado | Detalle |
|---|---|---|---|
| Avance (tiempo total) | Gas etileno `tiempoS` | ⚠️ | botón manual, implementación #2 |
| Avance (tiempo total) | Forzamiento `tiempoPorTablaS` | ⚠️ | botón manual, implementación #3 |
| Avance `rpm` | Gasto de agua `rpmTrabajo` | ⚠️ | precarga muda; se desconecta al primer toque |
| Avance `rpm` | Prueba de captura | ❌ | el aforo no registra a qué régimen se hizo |

### 5.3 Volumen de aplicación (L/ha) — **el hueco más grande**

Cinco campos con el mismo concepto y cuatro nombres distintos en el borrador, sin un solo
puente entre ellos:

| Pestaña | Campo en el borrador | Precarga hoy | Debería poder venir de |
|---|---|---|---|
| Gasto de agua | `lhaObjetivoLha` | nada | objetivo agronómico, Boquillas |
| Boquillas | `lhaObjetivo` | nada | objetivo agronómico |
| Prueba de captura | `lhaObjetivo` | ✅ `agronomicos.volumenAguaObjetivo` | también Gasto de agua |
| Forzamiento | `volumenAguaLha` | ✅ `agronomicos.volumenAguaObjetivo` | también el L/ha real |
| Mezcla | `lhaAplicacionLha` | ❌ **nada** | Gasto de agua o Prueba de captura |

El caso de **Mezcla** merece renglón aparte. Su propia ayuda dice:

> «Usa el L/ha real de Gasto de agua o de la prueba de captura, no un valor supuesto: toda la
> mezcla depende de este número.»

…y no hay forma de traerlo. La pantalla pide a mano exactamente el número que otras dos
pantallas ya calcularon, sobre un dato del que depende la dosis de producto en el tanque.

Y en la otra dirección, tampoco viaja lo calculado:

| Origen (resultado) | Destino | Estado |
|---|---|---|
| Gasto de agua `lhaPorBoquilla` / `lhaPorBarra` | Mezcla, Forzamiento | ❌ |
| Prueba de captura `lhaRealMedido` | Mezcla, Gasto de agua (contraste) | ❌ |
| Prueba de captura `mediaLmin` (caudal real medido) | Gasto de agua | ❌ |

Ese último es de fondo agronómico: la Prueba de captura mide el caudal **real** de una barra
desgastada, y Gasto de agua sigue calculando con el caudal de **catálogo** (boquilla nueva). La
propia pestaña de captura reporta el «desgaste implícito» y ese número no llega a ningún cálculo.

### 5.4 Gas y forzamiento

| Origen | Destino | Estado | Detalle |
|---|---|---|---|
| Forzamiento `masaPorTablaG` | Gas etileno `masaObjetivoG` | ❌ | **es el mismo número**: uno lo calcula, el otro lo pide |
| Gas etileno `scfm`, `psiManometrica` | Forzamiento `scfmDado`, `psiDado` | ❌ | se capturan dos veces |
| Gas etileno `psiManometrica` | Metodología (factor vivo) | ✅ | lectura directa del borrador |
| Configuración (gas, rotámetro, altitud) | Gas, Forzamiento | ✅ | mecanismo A |

### 5.5 Boquilla, presión y espaciamiento

| Origen | Destino | Estado | Detalle |
|---|---|---|---|
| Barra activa `boquillaId` | Gasto de agua | ✅ | precarga |
| Barra activa `boquillaId` | Prueba de captura | ✅ | precarga |
| Boquillas (candidata elegida) | Gasto de agua | ✅ | «Usar en Gasto de agua» escribe boquilla + presión |
| Boquillas `lhaObjetivo` | Gasto de agua `lhaObjetivoLha` | ❌ | se elige la boquilla para un objetivo y el objetivo no viaja |
| Boquillas (candidata elegida) | Prueba de captura | ❌ | hay que volver a buscarla en el combo |
| Barra activa `presionCalibracion` | Prueba de captura | ✅ | precarga |
| Barra activa `presionCalibracion` | Gasto de agua | ❌ | el campo de presión arranca vacío |
| Geometría de la barra | espaciamiento en gasto/boquillas/captura | ⚠️ | los tres precargan de configuración, pero **no entre sí**, sin chip de origen, y una vez editado ya no se resincroniza |
| Barra activa `volumenTanque` | Mezcla | ✅ | precarga con ayuda que lo dice |

### 5.6 Lo que sí está bien

Vale la pena dejarlo escrito para no romperlo al arreglar el resto:

- La geometría y la presión atmosférica (mecanismo A) son ejemplares.
- El chip de origen de `crearCampoVelocidad` es el patrón visual correcto: dice de dónde salió
  el número sin que haya que abrir la ayuda.
- La bitácora guarda **copia** de los parámetros del momento, no referencia, y señala las
  diferencias contra los vigentes en vez de recalcular en silencio.

---

## 6. Propuesta priorizada

### Prioridad 1 — cerrar el fallo (corrige un número incorrecto en campo)

**1.1 Que Avance persista lo que muestra.** Al montar la pantalla, guardar en el borrador el
`modo` y el `rpm` efectivos, no solo los que el usuario teclee. Es un cambio de tres líneas y
cierra los dos escenarios de §3.2.

Alternativa complementaria, más robusta: que `velocidadDeAvance` reciba el régimen habitual del
tractor como respaldo, para que un borrador viejo (guardado antes de este arreglo, ya en un
teléfono del rancho) también quede cubierto sin que nadie tenga que volver a entrar a Avance.

**1.2 Prueba que fije el comportamiento.** Un caso en `tests/speed.test.js` con `rpm` ausente,
que es el hueco que dejó pasar esto.

**1.3 Limpiar la selección al cambiar de tractor** (§3.4).

### Prioridad 2 — una sola verdad sobre lo que viene de Avance

Llevar `velocidadDeAvance` a `ctx` como derivado (mecanismo A), y añadir junto a ella un
`avanceDeAvance()` que devuelva también el tiempo por tabla. Después:

- Borrar las dos copias de `traerTiempoDeAvance` (gas.js y forzamiento.js) y dejarlas leyendo
  el derivado. Se van unas 110 líneas duplicadas.
- Cambiar `velocidadEjemplo` de metodología para que use el derivado y conserve solo su tercer
  respaldo propio.
- Sustituir el botón mudo por el patrón de `crearCampoVelocidad`: chip de origen + botón de
  volver a heredar. Conviene extraer ese patrón a un componente genérico
  (`crearCampoHeredado`), porque ya son cuatro campos que lo necesitan.

### Prioridad 3 — conectar el volumen de aplicación

Es el trabajo con más beneficio para el uso diario y el que más criterio pide, porque L/ha
significa tres cosas distintas según la pantalla: **objetivo** (Boquillas, modo inverso de
Gasto), **calculado** (Gasto) y **medido** (Prueba de captura). No se pueden fusionar en un
campo; sí se pueden conectar con origen declarado:

- Guardar el último L/ha calculado y el último medido en un lugar compartido del estado.
- En Mezcla y Forzamiento, ofrecer los dos con su etiqueta: «medido en la prueba de captura del
  3 de agosto» pesa más que «calculado en Gasto de agua», y quien calibra debe poder elegir.
- Unificar los nombres del borrador (`lhaObjetivo` en todas) para que el enlace compartido y la
  bitácora hablen el mismo idioma.

### Prioridad 4 — puentes puntuales

- Forzamiento `masaPorTablaG` → Gas etileno `masaObjetivoG`.
- Boquillas: llevar también el `lhaObjetivo` a Gasto de agua, y ofrecer «usar en Prueba de captura».
- Gasto de agua: precargar la presión de la última calibración de la barra, como ya hace captura.
- Prueba de captura: registrar el régimen del motor del aforo.
- Espaciamiento: chip de origen en las tres pantallas que lo precargan.

### Fuera de alcance por ahora

Llevar el caudal medido en la Prueba de captura a Gasto de agua (§5.3) es la conexión de mayor
valor agronómico, pero cambia qué número manda en el cálculo central de la aplicación. Merece
decisión aparte, no venir de arrastre en un trabajo de sincronización.

---

## 7. Nota sobre el modelo de propagación

Un detalle que conviene tener presente al implementar: hoy las pestañas se vuelven a pintar
**solo** al navegar o al cambiar el contexto (tractor, barra, unidades, tema). Los borradores
se guardan con tipo `'borrador'`, que a propósito **no** re-renderiza (`main.js:308`).

Eso es correcto y no hay que tocarlo: como cada pestaña se re-monta al entrar, un derivado en
`ctx` se recalcula solo. Lo que **no** se recalcula es un valor ya copiado a un borrador, y por
eso la solución de fondo es derivar, no copiar.
