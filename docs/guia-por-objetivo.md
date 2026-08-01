# Asistente por objetivo: la unidad de captura es el dato, no la pantalla

Fecha: agosto de 2026. Rama: `claude/wizard-steps-adjustable-results-dnkmx1`.

Este documento explica una decisión de producto y su **corrección**. La primera versión de esta
pantalla ordenaba las pestañas; no bastó, y el motivo por el que no bastó es lo más útil que hay
aquí escrito.

---

## 1. Qué se intentó primero, y por qué falló

La primera entrega puso una **guía**: cuatro objetivos de campo, cada uno con la lista ordenada de
las pantallas que hay que tocar, con el estado de cada paso y una tira de avance en el encabezado.
No cambiaba ninguna pantalla; solo decía en qué orden abrirlas.

Al recorrerla se vio el defecto: **la calibración pedía los mismos datos varias veces**.

| Objetivo | Dato pedido más de una vez |
| --- | --- |
| Ajustar el gasto de agua | presión, velocidad, espaciamiento, volumen objetivo, régimen — **5**, entre Gasto de agua y Prueba de captura |
| Elegir la boquilla | volumen objetivo, velocidad, espaciamiento — **3**, entre Boquillas y Gasto de agua |

Y no era un defecto de la guía. Cada pantalla declaraba sus campos por su cuenta —**y tiene que
hacerlo**, porque cada pantalla debe poder usarse sola— y además guardaba su propia copia del
valor, con la misma clave, en su propio borrador: `borradores.gasto.presionBar` y
`borradores.captura.presionBar` eran dos presiones distintas con el mismo nombre.

La conclusión: ordenar pantallas no arregla nada, porque **la unidad de captura era la PANTALLA y
tenía que ser el DATO**.

---

## 2. Qué hay ahora

Dos piezas, y la segunda es la que importa.

### El registro de datos (`assets/js/domain/datos.js`)

Un **dato** es algo que se pregunta una vez: la presión de trabajo, la velocidad, la boquilla, el
volumen objetivo. Cada uno se declara **una sola vez**: etiqueta, magnitud, ayuda, de dónde sale su
valor por defecto y —sobre todo— **dónde vive**.

- Los datos que usan **varias** pantallas viven en `estado.jornada`, uno solo para toda la
  aplicación.
- Los de **una sola** pantalla viven en el borrador de esa pantalla, que ya era un sitio único; el
  registro solo dice cuál es, para que el asistente escriba exactamente ahí.

De ese registro construyen **las dos** superficies: el asistente y las pestañas
(`ui/dato.js::crearCampoDato`). Capturar la presión en la Prueba de captura la cambia en Gasto de
agua y en el asistente, porque es el mismo número.

Un teléfono que ya venía usando la aplicación no pierde nada: `storage.js::migrarJornada` sube los
datos repartidos por los borradores a la jornada la primera vez que abre.

### El asistente (`assets/js/ui/tabs/guia.js`)

Un paso = un dato (o el puñado que no se entiende por separado, como la boquilla y su presión). Se
elige el objetivo y el asistente pide lo que falta, en orden de dependencia, hasta la hoja de
resultado.

| Objetivo | Pasos | Perillas |
| --- | --- | --- |
| Ajustar el gasto de agua | velocidad → barra → boquilla y presión → objetivo → *(opcional)* aforo | presión, velocidad |
| Elegir la boquilla | velocidad → barra → objetivo → candidatas del catálogo | presión, velocidad |
| Preparar la mezcla | volumen de aplicación → tanque y dosis | — |
| Forzar con etileno | velocidad → volumen de aplicación → dosis de etileno → rotámetro | — |

Reglas que sigue:

- **Elegir un objetivo empieza de cero.** Arranca en el paso uno y borra lo capturado en la
  calibración anterior: los datos de la jornada, lo que el asistente escribió en los borradores de
  las pantallas y los resultados compartidos que esa captura produjo. Cambiar de tipo de
  calibración es empezar otro trabajo, y arrastrar la velocidad o la boquilla del anterior es
  exactamente cómo se cuela un número que ya no es el de hoy.

  Antes se entraba por el primer dato que faltaba, conservando lo capturado. Se probó en campo y
  no servía: al cambiar de objetivo, el asistente aparecía a media lista con datos de otra
  calibración.

  Como el borrado **no se puede deshacer** y alcanza a lo que capturaste en las pestañas —es el
  mismo dato—, se pregunta antes, y solo cuando hay algo que perder: en un teléfono recién
  estrenado se entra directo. El inventario de qué se borra sale de `rastroDeCalibracion()`, en el
  registro, así que un dato nuevo queda cubierto sin tocar el asistente.

  **Lo que no se borra:** la configuración del rancho, las barras, los tractores, el catálogo y la
  bitácora. Ahí entra la *marcha de trabajo* del tractor, que es configuración del fierro y ya
  tiene su propio aviso: si tras el reinicio aparece una velocidad, la pantalla dice que sale de
  la marcha guardada del tractor y pide confirmarla.
- **Ningún paso es obligatorio.** Se puede seguir sin capturar; el resultado sale incompleto y lo
  dice.
- **Ningún paso guarda un estado propio ni calcula nada.** Escribe en el sitio único del dato y
  llama al dominio ya probado, igual que la pestaña equivalente.
- Un paso de **confirmación** —la barra, que ya viene llena de la configuración— no se da por
  resuelto hasta haberlo mirado; si no, el asistente lo saltaría sin que nadie lo revisara.

### Y las pestañas se quedan

Siguen siendo la vía para calcular a mano, recalibrar una sola cosa, ver el desglose paso a paso y
guardar en bitácora. Como escriben en los mismos datos, **se puede saltar del asistente a una
pestaña y volver a media calibración** sin recapturar nada.

---

## 3. La hoja de resultado

Tres decisiones que conviene dejar escritas.

**Perillas, no deslizadores.** Un deslizador da precisión falsa —2.73 bar cuando el manómetro marca
2.8— y con guantes, de pie, sobre un tractor que vibra, es incontrolable. Son dos botones grandes
con el paso del fierro real: 0.1 bar en métrico, 1 psi en imperial, 0.1 en la velocidad.

**Las perillas escriben en el dato compartido**, no en un estado propio del asistente. Mover la
presión ahí es lo mismo que capturarla en Gasto de agua. Mover la velocidad la vuelve captura
manual —igual que teclearla— y un botón la devuelve a la de Avance.

**El número se recalcula por la misma ruta verificada.** `volumenConBoquilla` (en
`domain/water.js`) es la cadena de Gasto de agua sin desglose: caudal a la presión de trabajo,
corrección por densidad del caldo y los dos métodos, con su verificación redundante. Una prueba
fija que el atajo y la cadena larga dan **el mismo** L/ha; si la verificación falla, no se pinta el
número, igual que en el resto de la aplicación.

**Solo dos objetivos traen perillas**, y es a propósito: son aquellos cuyo resultado *es* el
volumen por hectárea. En la mezcla y en el forzamiento el volumen es una **entrada**; moverlo desde
la hoja cambiaría la dosis del tanque o la masa de etileno sin que se vea la cuenta, y esa cuenta
—con su desglose y sus advertencias— se ve completa en su propia pantalla.

---

## 4. Qué se retiró

- **La lista de pasos por pantalla y la tira de avance del encabezado.** Existían para secuenciar
  pestañas; con el asistente sobran, y la tira además obligaba a `main.js` a saber de recetas.
- **`ui/velocidad.js` y las funciones `fuenteVelocidad` / `fuenteEspaciamiento` /
  `fuenteVolumenAplicacion` de `ui/heredado.js`.** Eran tres versiones del mismo patrón —«de dónde
  sale este valor por defecto»— repartidas por la interfaz. Ahora es una línea del registro
  (`respaldo`) y una sola resolución en `ui/dato.js`.

## 5. Qué quedó fuera, y por qué

- **Las pestañas no se reescribieron enteras sobre el registro.** Solo los datos que se repetían.
  Un campo que vive en una sola pantalla y no lo pide el asistente no gana nada con mudarse, y
  tocar código de cálculo verificado sin motivo es el riesgo que este proyecto no corre.
- **La hoja no recalcula la dosis del tanque ni la masa de etileno con perillas.** Ver arriba.
- **No hay «objetivo sugerido» automático.** Adivinarlo a partir de lo capturado sería acertar a
  veces y estorbar el resto; elegirlo es un toque.
- **La marcha no es una perilla.** Subir o bajar de marcha no es un ajuste continuo: cambia el
  régimen y la velocidad a saltos, y esa elección se hace con las marchas del tractor a la vista.
