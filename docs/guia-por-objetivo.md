# Guía por objetivo: por qué no es un wizard

Fecha: agosto de 2026. Rama: `claude/wizard-steps-adjustable-results-dnkmx1`.

Este documento explica una decisión de producto: la aplicación **no** se convierte en un asistente
de pasos (*wizard*), pero sí gana la pieza que le faltaba —decir por dónde empezar y en qué orden—
y una hoja de resultado que se puede mover en el momento.

---

## 1. Qué se pidió y qué se hizo

La pregunta fue: *¿no debería la app ser una especie de wizard de pasos que vaya guiando al
usuario según lo que quiera obtener, y al final entregar resultados que se puedan manipular en
tiempo de ejecución?*

Lo que se hizo:

| Se pidió | Qué se entregó |
| --- | --- |
| Guiar según lo que se quiere obtener | Pantalla **Guía**: cuatro objetivos de campo, cada uno con sus pasos ordenados y el estado de cada paso |
| Pasos que lleven de la mano | **Tira de avance** en el encabezado de cada pantalla que es paso de la receta activa: «Paso 2 de 4», con anterior y siguiente |
| Resultados manipulables al final | **Hoja de resultado**: las cifras de la receta juntas y dos perillas —presión y velocidad— que recalculan el volumen en vivo |
| Un carril cerrado de principio a fin | **No.** Ningún paso es obligatorio, ninguno bloquea al siguiente y se puede entrar directo a cualquier pestaña, como siempre |

---

## 2. Por qué no un wizard

Un asistente clásico —pantallas encadenadas, «siguiente» obligatorio, estado propio de la
sesión— habría empeorado esta aplicación por cuatro motivos concretos.

**No hay una sola tarea.** Calibrar el gasto de agua, elegir boquilla, preparar la mezcla y
dosificar etileno son trabajos distintos que comparten números. Un carril único obliga a pasar
por pasos que hoy no aplican.

**El uso real es repetido y parcial.** Se cambia una boquilla y hay que rehacer una pantalla, no
siete. Un wizard es excelente la primera vez y hostil la décima; en campo, todas son la décima.

**Pelea con la arquitectura y con una decisión ya tomada.** Hoy cada pestaña se re-monta al
entrar y los derivados se recalculan solos; la regla escrita en
`docs/conexiones-entre-pestanas.md` §9 es **derivar, no copiar**. Un asistente con un estado
grande de sesión reintroduce exactamente el problema que ese trabajo resolvió: una copia del
número que se queda vieja sin que nadie lo note.

**El riesgo no está en la interfaz, está en los números.** Rehacer la navegación y los borradores
toca código de cálculo ya verificado. Ordenar las pantallas se puede hacer **sin tocar ni una
fórmula**, y eso fue lo que se hizo.

### Lo que sí faltaba

Buena parte de lo que un wizard promete, la aplicación ya lo tenía:

- **Recálculo en vivo.** Cada campo dispara el recálculo al teclear; no hay botón «calcular».
- **Cálculo inverso.** Gasto de agua ya resuelve del objetivo hacia el ajuste (variable libre:
  presión, velocidad o boquilla).
- **Encadenado entre pantallas.** `ui/heredado.js` precarga el dato de la pantalla anterior, dice
  de dónde salió con un chip y deja que la captura manual mande.

Lo que faltaba era **el orden**: diez pestañas sin jerarquía visible sobre una cadena de
dependencias real —Avance manda sobre Gasto de agua, y ese manda sobre Mezcla y sobre
Forzamiento— que en pantalla no se veía por ningún lado. Quien abría la aplicación por primera
vez no tenía forma de saberlo.

---

## 3. Las cuatro recetas

Viven en `assets/js/domain/recetas.js` como datos puros, y se prueban en `tests/recetas.test.js`.
Son cuatro **por trabajo real**, no una por pantalla: una receta por pestaña sería la misma lista
de tabs con otro nombre.

| Receta | Pasos | Perillas |
| --- | --- | --- |
| Ajustar el gasto de agua | Avance → Gasto de agua → *(opcional)* Prueba de captura | presión, velocidad |
| Elegir la boquilla | Avance → Boquillas → Gasto de agua | presión, velocidad |
| Preparar la mezcla | Gasto de agua → Mezcla | — |
| Forzar con etileno | Avance → Gasto de agua → Forzamiento → Gas etileno | — |

Reglas que siguen los pasos:

- **Un paso listo dice de dónde salió su número**, nunca solo «listo». Un chip verde sin
  procedencia se lee como un dato propio, y entonces nadie sospecha cuando está viejo. Es la misma
  regla del chip de `ui/heredado.js`.
- **Un dato de otro día se marca, no se invalida.** Un aforo de la semana pasada puede seguir
  siendo el bueno; decidir eso es de quien calibra. Lo que no puede pasar es que no se note.
- **Un paso opcional no cuenta para el total.** El aforo verifica, no habilita: la receta está
  completa sin él, y aun así se sigue ofreciendo.

---

## 4. La hoja de resultado

Es la parte que se manipula en el momento, y tiene tres decisiones que conviene dejar escritas.

**Perillas, no deslizadores.** Un deslizador da precisión falsa —2.73 bar cuando el manómetro
marca 2.8— y con guantes, de pie, sobre un tractor que vibra, es incontrolable. Son dos botones
grandes con el paso del fierro real: 0.1 bar en métrico, 1 psi en imperial, 0.1 en la velocidad.

**Las perillas escriben en la pantalla que manda sobre ese dato**, no en un estado propio de la
guía. Mover la presión es capturarla en Gasto de agua. Si la hoja guardara su copia, en dos toques
la guía y la pantalla estarían diciendo números distintos. Mover la velocidad la vuelve captura
manual —igual que teclearla en Gasto de agua—, y un botón la devuelve a la de Avance.

**El número se recalcula por la misma ruta verificada.** `volumenConBoquilla` (en
`domain/water.js`) es la cadena de Gasto de agua sin desglose: caudal a la presión de trabajo,
corrección por densidad del caldo y los dos métodos, con su verificación redundante. Una prueba
fija que el atajo y la cadena larga dan **el mismo** L/ha; si la verificación falla, no se pinta el
número, igual que en el resto de la aplicación.

**Solo dos recetas traen perillas**, y es a propósito: son aquellas cuyo resultado *es* el volumen
por hectárea. En Mezcla y en Forzamiento el volumen es una **entrada**; moverlo desde la hoja
cambiaría la dosis del tanque o la masa de etileno sin que se vea la cuenta, y esa cuenta —con su
desglose y sus advertencias— se ve completa en su propia pantalla.

---

## 5. Qué cambió en la navegación

- **Guía es la primera pestaña de Calibrar y la ruta por defecto** (`#/calibrar/guia`). No captura
  nada, así que entrar por ahí no le cuesta un paso a quien ya sabe a qué pestaña va; y a quien no,
  le da lo único que la aplicación no decía.
- **Sigue habiendo tres secciones y tres acentos.** La guía no inventa un color: es una pestaña de
  Calibrar, no un cuarto módulo. La regla de que el color identifica al módulo se conserva.
- **La tira de avance la pinta `main.js`**, no cada pantalla. Las diez pestañas no saben nada de
  las recetas y no tienen por qué saberlo: la guía las ordena, no las modifica. La tira solo
  aparece si hay receta activa **y** la pantalla actual es uno de sus pasos; en una pantalla ajena
  diría «paso 2 de 4» y estaría mintiendo sobre dónde estás.
- **Se sale de la guía con el mismo botón con el que se entró.** No hay estado del que haya que
  escapar.

---

## 6. Lo que quedó fuera, y por qué

- **La hoja no recalcula la dosis del tanque ni la masa de etileno.** Ver arriba: son cuentas con
  advertencias propias (solubilidad del etileno, equivalencia de dosis) que no se pueden mostrar
  a medias detrás de una perilla.
- **No hay «receta sugerida» automática.** Adivinar el objetivo a partir de lo capturado sería
  acertar a veces y estorbar el resto; elegirlo es un toque.
- **La marcha no es una perilla.** Subir o bajar de marcha no es un ajuste continuo: cambia el
  régimen y la velocidad a saltos, y esa elección se hace en Avance, con las marchas del tractor
  a la vista.
