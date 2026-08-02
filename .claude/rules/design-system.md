# Marco de diseño (adaptado de Sherman)

El sistema visual de esta aplicación **no se inventa**: se copia del marco de diseño de
**Sherman** (`.claude/rules/design-system.md` de ese repositorio y su `src/app.css`) y se
reproduce en **CSS nativo**, sin Tailwind, sin librerías y sin paso de build.

Este documento dice qué se copió tal cual, qué se adaptó y por qué. Cuando una regla de Sherman
y una decisión de este proyecto choquen, gana lo escrito aquí — y el motivo queda anotado.

## Fuente de verdad

| Capa | Archivo |
| --- | --- |
| Tokens (color, tipografía, geometría) | `assets/css/tokens.css` |
| Reset, tipografía base, layout y utilidades | `assets/css/base.css` |
| Componentes | `assets/css/components.css` |
| Muestra viva de todo el sistema | `componentes.html` |
| Compuerta de contraste AA (CI) | `tools/verificar-contraste.mjs` |

Ningún componente declara colores, radios ni tamaños sueltos: todo entra por token.

## Para quién es esta interfaz

Se usa **de pie, en el lote**, con guantes puestos, el teléfono a la distancia del brazo, el sol
de frente y la pantalla sucia. Quien calibra suele pasar de los cuarenta y **trae lentes de
lectura**, o los trae en la camioneta y no se los pone. Eso manda sobre la densidad: entre meter
un dato más en la pantalla y que el dato se lea, **gana que se lea**.

De ahí salen tres decisiones que atraviesan todo el sistema:

- El **cuerpo mide 16px** y el piso absoluto de cualquier texto son **12px**.
- El **piso táctil son 48px**, no los 44px clásicos de Sherman.
- Los tamaños de texto viven en una **escala con nombre** (`--text-*`), para que subirlos otra vez
  sea cambiar nueve números y no recorrer ochenta reglas.

## Diferencias declaradas respecto a Sherman

Son cinco, y ninguna es cosmética.

1. **El color va en HSL de tres números, no en OKLCH.** Sherman declara
   `--color-primary: oklch(...)`. Aquí el formato es el triplete `H S% L%` sin la función,
   porque 124 puntos del CSS y del JS componen opacidad con `hsl(var(--x) / a)` y porque la
   compuerta de contraste de CI lee esos tripletes. **Los valores sí son los de Sherman**,
   convertidos desde OKLCH.

2. **La geometría y los tamaños de texto van en píxeles, no en `rem`.** Este proyecto fija
   `html { font-size: 14px }` y Sherman usa la base de 16px del navegador. Un `rem` no mide lo
   mismo en los dos: el piso táctil de Sherman (`2.75rem` = 44px) valdría **38.5px** aquí, por
   debajo del objetivo. Lo que representa una medida física —piso táctil, alto de control, alto
   de chip, radio, **tamaño de letra**— se declara en px.

   La raíz sigue en 14px porque es la referencia de los `rem` de **espaciado** ya repartidos por
   el sistema; **no** es el tamaño del texto: eso lo fija `body` con `--text-base` (16px).

3. **Tres valores conservan el ajuste AA propio del proyecto** y no toman el de Sherman, porque
   el de Sherman no pasa la compuerta con los pares que esta aplicación usa:
   `--muted-foreground` (42% en vez de 45.2%), `--destructive` y `--warning`. Cada uno lleva su
   comentario en `tokens.css`.

4. **El tema por defecto es oscuro**, no claro. Es una decisión de producto anterior
   (`index.html` lo estampa en `<html>` antes del primer pintado) y se conserva; el usuario puede
   elegir claro, oscuro o automático.

5. **El escalón táctil no está tras un breakpoint de escritorio.** Sherman lo enciende en
   `@media (width < 640px)` porque es una aplicación de escritorio con adaptación a teléfono.
   Esta es **solo de teléfono**, así que el escalón aplica con `(pointer: coarse), (width < 640px)`.

## Color

- **Superficies y texto:** neutros de Sherman (tono 0). En oscuro el fondo (10.4%) y la tarjeta
  (14.1%) son **distintos**: con los dos en el mismo valor —como estaban— las tarjetas eran
  invisibles y la pantalla se leía como un solo bloque.
- **Verde de marca** (`#006045` claro / `#5cd4a4` oscuro) en `--primary` y `--ring`: acción
  principal, pestaña activa, interruptor, casilla, marcha seleccionada y anillo de foco.
- **Jerarquía de bordes:** `--border` (secciones, tarjetas, marco) pesa más que `--border-sutil`
  (filas de tabla). Si se ajusta uno, **mantener la relación sección > tabla**.
- **Estados semánticos:** cada uno es un trío borde + fondo + texto (`--exito*`, `--info*`,
  `--warning*`, `--destructive*`, `--neutro*`), igual que los badges de dominio de Sherman. El
  texto cumple AA sobre **su** fondo, y la compuerta lo verifica par por par.
- **Prohibido** el color suelto en un componente. Excepción declarada: los **colores ISO 10625**,
  que son **datos** (`assets/js/data/iso-colors.js`) y se aplican en línea, iguales en ambos
  temas, con el texto elegido por luminancia.

### Acento por sección (equivale a `accentModulo`)

- **El color identifica al MÓDULO, no a la pantalla.** Tres acentos declarados en `tokens.css`,
  uno por sección de la navegación inferior: **Calibrar** (verde de marca), **Registrar**
  (violeta) y **Sistema** (neutro). **Prohibido** inventar un color por pestaña: diez tonos
  convierten la señal en adorno.
- `main.js` estampa `data-seccion` en `<html>`, igual que hace con el tema. Va en la raíz y no en
  el panel porque la subnavegación vive en el encabezado y los diálogos cuelgan de `<body>`: son
  justo las piezas que dicen dónde estás. El selector es de atributo (`[data-seccion='…']`) para
  que un bloque anidado pueda declarar su propio módulo — así la galería muestra los tres
  acentos en la misma página.
- **Son dos variables, no una.** `--acento` es cromado (banda, borde, tinte); `--acento-texto` es
  **identidad** (título de la tarjeta, cifra del resultado). Con el acento neutro, `--acento-texto`
  vale `--foreground` y **no** se atenúa: con un solo token, el dato principal de la pantalla
  quedaba en gris claro en la sección Sistema. Es la misma regla que en Sherman prohíbe usar
  `labelClass` para la identidad del registro.
- La acción principal **sigue siendo `--primary`** aunque la sección tenga otro acento: el acento
  es identidad, el primario es acción.

## Tipografía

- **Inter** para el cuerpo, **IBM Plex Mono** para cifras. Las mismas de Sherman, autohospedadas
  con subconjunto latino (`assets/fonts/`, licencia SIL OFL 1.1). De Plex Mono solo se traen los
  dos pesos que la interfaz usa: 400 y 600.
- Las familias se declaran **una vez**, en `--font-body` y `--font-mono`; no se repiten en el
  componente.
- **Toda cantidad va monoespaciada, con `tabular-nums` y alineada a la derecha** — también cuando
  se captura. La marca de un campo numérico es `inputmode="decimal"`, que es lo que emite
  `crearCampoNumerico`.
### Escala tipográfica — REGLA DURA

**Ningún tamaño de texto se escribe suelto.** Ni en CSS, ni en un `style` en línea, ni en el
`estilo` de un `el()`. Se elige un escalón de la escala de `tokens.css`:

| Token | Medida | Para qué |
| --- | --- | --- |
| `--text-micro` | 12px | piso absoluto; nada baja de aquí |
| `--text-meta` | 13px | metadato, fórmula, unidad al margen, fecha |
| `--text-sm` | 15px | apoyo: ayuda, error, etiqueta, tabla, alerta |
| `--text-base` | 16px | cuerpo, botón, campo de captura, pestaña |
| `--text-lg` | 18px | título de tarjeta y de diálogo |
| `--text-xl` | 21px | dato corto que se toca (marcha) |
| `--text-cifra` | 26px | resultado secundario |
| `--text-cifra-lg` | 34px | resultado principal de la pantalla |
| `--text-cifra-xl` | 40px | lectura a distancia de brazo (cronómetro) |

- Las utilidades `.texto-micro`, `.texto-meta`, `.texto-chico` (15px) y `.texto-grande` (18px)
  son la vía desde el HTML y desde `el()`.
- **Los campos de captura nunca bajan de 16px**, en ninguna superficie: por debajo, iOS Safari
  hace zoom al enfocar y deja la pantalla descuadrada a media calibración. Esto incluye los
  selectores del encabezado, que antes iban a 12.6px.
- El interlineado del cuerpo es `--leading-cuerpo` (1.55), más suelto que el 1.5 de Sherman: con
  lentes de lectura el renglón largo se pierde más fácil.
- Si hace falta otro escalón se **declara aquí como token**, no como número mágico en la
  pantalla. Subir la letra de toda la aplicación tiene que ser tocar esta tabla y nada más.

## Piso táctil y botón de icono

- El piso vive en el token heredable **`--touch-floor`** y se aplica en **dos reglas y solo ahí**:
  `.boton { min-height: var(--touch-floor, 0px) }` y
  `.boton--icono { min-width: var(--touch-floor, 0px) }`.
- **La segunda es obligatoria.** Un botón que solo lleva un icono es cuadrado siempre; si el piso
  empuja solo el alto, un botón de 44px de ancho nominal queda aplastado en el eje X.
- Encender el piso en una superficie nueva es **declarar el token**, nunca repetir `min-height`
  en el consumidor.
- **El piso son 48px, no 44.** Aquí se toca de pie, con guantes, sobre un tractor que vibra y
  mirando por la parte baja de unos lentes de lectura: los 4px extra son la diferencia entre
  acertar y volver a intentar. Los 44px clásicos de Sherman quedan como **alto nominal del
  control** (`--control-h`), que es otra cosa.
- **Adaptación:** aquí el piso alcanza también a los elementos que se pulsan una vez y no son
  botón —pestaña, opción de lista, fila con control, resumen desplegable, botón de la navegación
  inferior—, porque la aplicación es solo de teléfono. **No** alcanza a los campos de captura
  (`input`, `select`), que se quedan en `--control-h` (44px): un campo no es un objetivo de un
  solo toque, y subirlo al piso deja el encabezado fijo y los formularios densos comiéndose la
  pantalla. Ese 44 ya subió desde 36 al crecer la letra: con el cuerpo en 16px, en 36px el texto
  rozaba el borde del control.
- El botón compacto (`.boton--sm`, `--control-h-sm` = 36px) es para la acción de fila dentro de
  una tabla o de un editor largo. En teléfono el piso lo sube igual: lo compacto es el trazo, no
  el área que se toca.

## Ayuda contextual de un campo

- **El texto de ayuda de un campo no se imprime siempre.** Vive en un globo que abre el botón
  **`?`** de la etiqueta. Con las ayudas siempre visibles, una pantalla de cinco campos se leía
  como un muro de párrafos grises con los campos perdidos entre ellos.
- **Lo produce `campos.js`, no la pantalla.** `crearCampoNumerico`, `crearCampoSelect` y
  `crearInterruptor` reciben `ayuda` y arman solos el botón y el globo. Un campo montado a mano
  usa **`crearEtiquetaConAyuda`** (etiqueta + botón) o `crearAyuda` (botón + globo sueltos).
  **Prohibido** volver a escribir un `<p class="ayuda">` bajo un campo.

## Ayuda de una sección (el `?` del encabezado de la tarjeta)

- **La explicación estable de una tarjeta tampoco se imprime.** `tarjeta()` recibe `ayuda` y monta
  el mismo botón `?` en su encabezado, a la derecha del título. Quitar la ayuda de los campos no
  bastó: medido en un teléfono de 390px, la prosa que quedaba —notas de sección bajo las cifras—
  era **entre un tercio y la mitad** de todo lo que había en las pantallas de campo. Forzamiento
  tenía 2,127 caracteres en pantalla, de los cuales 994 eran párrafos explicativos.
- **La frontera es qué tan seguido cambia el texto, no dónde está.**

  | Va al `?` | Se sigue imprimiendo |
  | --- | --- |
  | El porqué del cálculo, que se lee una vez | El resultado de ESTE cálculo |
  | La advertencia que aplica siempre | Lo que hay que hacer ahora («captura la velocidad para…») |
  | La procedencia de un valor de configuración | El estado de lo capturado hoy («2 de 5 renglones») |
  | El rastro de auditoría de qué parámetros se usaron | El aviso accionable del dominio |

  Un ejemplo de la frontera: la advertencia de solubilidad del etileno. **Lo accionable se queda
  a la vista** —«manda el pesaje del cilindro, no este cálculo»— y **el mecanismo se va al `?`**
  —difusor, temperatura del agua, tiempo entre carga y aplicación—. Esconder una advertencia de
  seguridad tras un botón sería un error; imprimir cuatro renglones de física para llegar a ella,
  también, porque nadie los lee dos veces.
- **`.ayuda` a secas sigue siendo válida** para lo que cambia con el cálculo: pie de una tabla de
  resultados, aclaración de un bloque que solo aparece en cierto estado, feedback de lo capturado.
- **Lo que se manda al `?` se calcula al montar la tarjeta**, así que solo puede depender de la
  configuración —no de un borrador ni de un resultado—. Cambiar la configuración remonta la
  pestaña, así que el texto nunca queda viejo. Si un texto depende de lo que el usuario está
  capturando, **no es ayuda de sección**: es resultado, y se imprime.
- **Solo un globo abierto a la vez** en toda la pantalla: dos o tres consultados a la vez devuelven
  el muro que este patrón vino a quitar. El estado lo lleva `campos.js`.
- **El globo flota: no ocupa lugar en el flujo.** Es el tooltip de Sherman
  (`form-label-with-help.svelte`) llevado a CSS nativo. Antes se empujaba el contenido hacia abajo
  para no pelear con el recorte de la tarjeta, y el precio era que abrir una ayuda descolocaba la
  pantalla: los campos de abajo saltaban y había que volver a buscar dónde se iba.
- **Se pinta en la capa superior del navegador**, con el atributo `popover` que `campos.js` pone
  cuando existe. Es lo único que **no** recorta una tarjeta y lo único que queda **por encima de un
  diálogo modal** (los diálogos son `<dialog>` con `showModal`, así que también viven en esa capa).
  Donde no haya soporte, el globo cae a `position: fixed` con `z-index`: sigue flotando, y solo
  dentro de un diálogo quedaría por debajo.
- **La posición la calcula `campos.js`, no el CSS.** `colocar()` escribe `--globo-x`, `--globo-y`,
  `--globo-flecha` y `data-lado`; el CSS solo los consume. **Prohibido** anclar el globo con
  `position: absolute` respecto al campo: vuelve el recorte de la tarjeta.
- **El globo va arriba del botón `?` por defecto.** El control que la ayuda explica está justo
  debajo de la etiqueta: un globo hacia abajo tapa el campo que se acaba de consultar. Solo se va
  abajo cuando arriba no cabe, y horizontalmente se recorre para no salirse de la pantalla —la
  puntita sigue apuntando al botón porque su posición se calcula aparte.
- **Se cierra al tocar fuera, al pulsar otra vez el botón, con `Escape` o al abrir otra ayuda.** Un
  globo flotante tapa lo que tiene debajo, así que quitarlo de en medio no puede depender de
  acertarle al mismo botón de 22px.
- **El botón va al extremo derecho de la fila de la etiqueta**, no pegado al texto: así cae en el
  mismo eje vertical en toda la columna —se encuentra sin leer— y la puntita del globo apunta
  hacia él desde una posición fija.
- **El botón queda fuera del `<label>`.** Dentro, pulsarlo activaría el control (el interruptor se
  encendería solo) y su texto ensuciaría el nombre accesible de la etiqueta y las pruebas que leen
  `input.labels[0]`.
- **Estado y accesibilidad por atributo:** `aria-expanded` en el botón —que además es lo que
  `components.css` pinta con el acento del módulo, igual que la opción elegida de un grupo—,
  `aria-controls` hacia el globo y `aria-describedby` del control hacia el mismo globo. El nombre
  accesible es `Ayuda sobre <etiqueta>`, no el signo suelto. `Escape` cierra el globo y **no** se
  propaga: quien abrió una ayuda dentro de un diálogo espera cerrar la ayuda, no perder lo
  capturado.
- **Excepción declarada al piso táctil.** El botón `?` es el único control que **no** toma
  `--touch-floor`: a 44px rompe la línea de la etiqueta y separa el rótulo de su campo. Mide
  `--ayuda-boton-tam` (22px, por encima del mínimo AA de 24px contando su borde y holgura) y
  amplía el área real con un pseudo-elemento que **no ocupa lugar en el flujo**: ancho hasta
  `--touch-floor`, alto solo hasta `--ayuda-boton-tam + 10px`. El alto se queda corto **a
  propósito** — a los lados del botón no hay nada más que tocar, pero arriba y abajo están los
  controles de los campos vecinos y un área de 44px de alto les robaría el toque.

## Ayuda de un resultado (el `?` de la cifra)

- **Cada cifra que se pinta lleva su explicación detrás de un `?`.** `pintarResultado()` recibe
  `ayuda` y monta el mismo botón de los campos y las tarjetas, a la derecha de la etiqueta, dentro
  de `.resultado__cabecera`.
- **Para qué existe.** Una etiqueta no alcanza a decir qué es la cifra. «CV de la barra», «factor
  requerido», «método por barra» o «masa por pie cúbico estándar» son nombres correctos y opacos: quien
  calibra de pie en el lote no deduce de ahí qué significa el número, con qué compararlo ni qué
  hacer si sale alto. **El desglose paso a paso no lo resuelve**: contesta *cómo* se calculó —la
  fórmula con los números sustituidos—, que es otra pregunta.
- **La frontera es la de siempre**, la misma que separa el `?` de una tarjeta de su `.ayuda`:

  | Va al `?` del resultado | Se sigue imprimiendo |
  | --- | --- |
  | Qué ES esa cifra, en una frase | La cifra |
  | De dónde sale y de qué depende | El aviso accionable del dominio |
  | Con qué compararla («arriba de 10 % toca reponer») | El estado de lo capturado hoy |
  | Que es un modelo y no una medición | La nota que cambia con el cálculo |

- **Nunca se manda al `?` un aviso de seguridad ni un resultado.** La advertencia de solubilidad
  del etileno se queda a la vista; lo que va al globo del resultado es que la masa inyectada **no
  es** masa retenida.
- **El `?` no aparece si no se pasa `ayuda`:** sin ella el resultado se pinta como siempre, con la
  etiqueta pelada y sin fila envolvente.
- **Una superficie que no puede usar `pintarResultado` monta el botón con `crearAyuda`**, igual que
  hace `tarjeta()`. Es el caso de las cifras derivadas de Configuración, que van un escalón de
  texto más chicas porque comparten pantalla con decenas de campos. **Prohibido** copiar el
  `.resultado` a mano sin su ayuda.
- Vale todo lo dicho para el globo del campo: uno abierto a la vez en la pantalla, flotando en la
  capa superior, posición calculada por `campos.js`, y `Escape` o un toque fuera lo cierran.

## Botón de unidades de un campo (hacia las unidades de la aplicación)

- **Un campo con magnitud no imprime su unidad en la etiqueta: la unidad ES el botón**, y va
  pegado al número. Se lee junto a la cifra que califica y se toca donde se lee. La etiqueta queda
  con el nombre del dato y nada más.
- **El sentido es UNO SOLO y no se voltea: de la unidad ajena a la de la aplicación.** El campo se
  queda **siempre** escrito en las unidades del sistema activo. **Prohibido** convertir hacia
  afuera: un campo que se queda en la unidad ajena deja un número que no es el de la pantalla, y de
  ahí a guardar una calibración con el factor equivocado hay un paso.
- **El botón dice el SENTIDO, no solo que ahí se convierte.** Lleva dos rótulos: la unidad ajena
  —de dónde viene lo que se acaba de teclear—, la flecha, y la unidad de la aplicación (`psi →
  bar`). **El peso va en el destino**, que es la unidad del campo y la que hay que leer al mirar la
  cifra; el origen va atenuado y un escalón más chico (`--text-meta`). Con el énfasis del otro lado,
  una ojeada dejaba «psi» junto a un número que está en bar. **Prohibido** rotularlo solo con la
  unidad del campo o con una doble flecha: no había forma de saber si al pulsarlo el número pasaba a
  psi o si el botón avisaba que ya venía en psi, y equivocarse de sentido es exactamente el error de
  factor que este botón vino a quitar.
- **El segundo toque deshace; no es la conversión contraria.** Devuelve el texto tal como se
  escribió, sin aplicar ningún factor: es el botón de arrepentirse, porque con guantes se pulsa por
  error lo que está pegado al campo. Devuelve el texto **original** y no el reconvertido: con seis
  dígitos significativos, 40 psi → 2.7579 bar → 40.0001 psi, y ver cambiar el número al deshacer se
  lee como un error de la aplicación.
- **La equivalencia aplicada se imprime bajo el campo** (`40 psi = 2.7579 bar`): es resultado, no
  ayuda —cambia con lo capturado—, y es lo que permite revisar la cuenta sin rehacerla. Se apaga al
  deshacer o al teclear encima.
- **Sin número, el botón se apaga** (`disabled`): no hay nada que convertir, y un botón que no
  responde al toque se lee como aplicación rota.
- **Para qué existe.** Quien calibra lee el dato en la unidad del fierro que tiene enfrente —el
  manómetro de la barra marca psi, la ficha de la boquilla americana viene en GPM, el tanque está
  rotulado en galones— y la aplicación trabaja en la otra. Ese número se convertía a mano, de pie
  en el lote, con la calculadora del mismo teléfono: es justo donde se cuela un error de factor
  que después nadie encuentra.
- **No cambia el sistema de la aplicación.** Ese sigue siendo uno solo y vive en Sistema,
  Configuración. El botón solo convierte **el número de ese campo**, una vez; el campo sigue
  entregando su valor en el sistema que declaró la pantalla, así que ninguna pantalla cambia por
  esto. **Prohibido** usarlo como segundo selector global de unidades.
- **Lo produce `campos.js`, no la pantalla.** El consumidor declara `magnitud` (clave de
  `domain/units.js`) y `sistema` (el de entrada y salida del campo) y ya no pasa `unidad`.
  `crearCampoHeredado` los reenvía igual. **Prohibido** armar a mano una fila con el input y un
  botón de unidad.
- **Recién convertido, el botón se pinta con el acento del módulo** (`data-convertido='true'`),
  igual que la opción elegida de un grupo y la ayuda abierta: dice que ese número lo escribió el
  botón y no la persona, y que ese toque se puede deshacer. Se apaga solo en cuanto se teclea
  encima.
- **Convertir avisa a la pantalla.** El valor cambió de verdad —40 psi no son 40 bar—, así que el
  campo emite `input` y `change` igual que si se hubiera tecleado: borrador, recálculo y commit al
  salir del campo. **Prohibido** convertir en silencio.
- **Excepción declarada al piso táctil, la segunda.** El botón comparte alto con su input
  (`--control-h`, 44px) y no toma `--touch-floor`: son una sola pieza y un botón 4px más alto que
  el campo al que está pegado se lee como un desajuste. El objetivo táctil no se pierde: el ancho
  ya está en `min-width: var(--touch-floor)` y el alto lo recupera un pseudo-elemento que **no
  ocupa lugar en el flujo**. Por eso `.campo__unidad` es componente propio y no una variante de
  `.boton`: así nadie parchea la altura de un botón desde el consumidor.
- **La flecha va dibujada en SVG, no como carácter, y es UNA sola apuntando al destino.** El
  subconjunto latino de las fuentes autohospedadas no trae flechas: una flecha de texto caería en
  la fuente del sistema —o en un recuadro vacío— y cambiaría de tamaño entre teléfonos.
- **La fila del campo se parte, el rótulo nunca.** Donde el par de unidades no cabe al lado del
  número —los volúmenes por boquilla van en dos columnas—, el botón baja al renglón de abajo
  entero. La base del input son 96px y **no** `auto`: el renglón se parte comparando las bases,
  antes de encoger a nadie, y con `auto` el input pedía sus 20 caracteres por omisión y mandaba el
  botón abajo hasta en las tarjetas anchas. Recortar el botón dejaría un `gal/…` cortado contra el
  borde, que es peor que ambiguo.
- **`.campo` lleva `min-width: 0`.** Un campo dentro de una rejilla no puede empujar su columna:
  sin eso, la columna `1fr` se estira hasta el ancho mínimo del contenido, las dos columnas suman
  más que la tarjeta y la mitad derecha de la pantalla queda cortada contra el borde.
- **Accesibilidad por atributo:** el nombre accesible del botón contiene el texto visible y dice
  qué pasa al pulsarlo (`Presión de trabajo en bar. Convertir a psi.`), y el input apunta al botón
  con `aria-describedby` porque la unidad ya no está en su etiqueta.

## Equivalencia bajo la cifra (la unidad que NO se eligió)

- **Toda cifra que se pinta lleva debajo la misma cantidad en el otro sistema, en letra chica.**
  No se pide: `pintarResultado` la monta sola a partir del texto de la unidad. Quien calibra
  aprendió empíricamente y **mezcla unidades** —el manómetro de la barra lo piensa en bar, la
  ficha de la boquilla la lee en GPM y el tanque está rotulado en galones—, así que sin esto la
  conversión se hace a mano, de pie en el lote, con la calculadora del mismo teléfono. Es de donde
  salen los errores de factor que después nadie encuentra.
- **Es apoyo de lectura, no un segundo sistema.** El sistema activo sigue siendo uno solo y vive
  en Sistema, Configuración. La equivalencia no se captura, no se guarda y no entra a ningún
  cálculo. **Prohibido** leerla como dato o convertirla en un segundo selector de unidades.
- **La produce un solo componente**, `.alterna` (`assets/js/ui/alterna.js`), y lo usan todas las
  superficies: el resultado, la cifra derivada de Configuración, la perilla de la hoja de
  resultado, la fila de captura de un instrumento y la lectura del manómetro. **Prohibido**
  escribir a mano la conversión en una pantalla: el factor sale de la magnitud declarada en
  `domain/units.js`, que es el mismo de la ida y de la vuelta.
- **Va con el signo de igual delante** (`= 30.02 psi`): dice que es LA MISMA cifra escrita de otro
  modo, no un segundo dato del cálculo.
- **Lo que no tiene otro sistema no imprime nada** —segundos, rpm, por ciento, los SCFM del
  rotámetro, los g/SCF—. Una equivalencia vacía **no ocupa lugar** (`.alterna:empty`): en una
  cifra que se refresca en vivo, un renglón que aparece y desaparece movería todo lo de abajo.
- **Los decimales del dato son el piso, no el techo.** El otro sistema mueve la coma de sitio, así
  que se suben los que hagan falta para conservar **tres dígitos significativos** —el aumento se
  topa en cuatro decimales; el piso del dato se conserva siempre—. Sin eso, los 30 psi que la
  fila del gas cuenta de uno en uno saldrían como «2 bar» y 5 mL como «0.2 oz fl»: eso no es un
  dato, es un redondeo.
- **Se mueve con lo que califica.** En la perilla, en la fila de más y menos y en el manómetro, la
  equivalencia se refresca en el mismo paso que la cifra —también durante el arrastre de la
  aguja—: ver el número en una sola unidad mientras se ajusta es justo lo que obliga a convertir
  a mano.
- **En el manómetro va FUERA del dibujo**, bajo el SVG. Dentro de la pastilla de lectura no cabe
  un segundo renglón sin salirse de la carátula, y fuera toma un escalón de la escala tipográfica
  del sistema en vez de un tamaño en unidades del `viewBox`.
- **Cuando el texto de una unidad es ambiguo, la pantalla declara su magnitud.** Hoy solo pasa con
  `m`, que es metro de tramo (sale en `ft`) y de espaciamiento (sale en `in`): sin `magnitud`
  gana el tramo largo, y el espaciamiento derivado de Configuración pasa `distanciaCorta`.

## Selección dentro de un grupo de opciones

- **El estado lo dice el atributo, no una clase de variante que el consumidor intercambia.** Un
  botón elegido lleva `aria-pressed="true"` —que ya hace falta por accesibilidad— y
  `components.css` lo pinta una sola vez con el acento del módulo: borde pleno, tinte de fondo y
  texto en `--acento-texto`.
- **Prohibido señalar la selección alternando variantes** (`classList.toggle('boton--secundario')`
  sobre un `boton--contorno`). Aparte de repartir la decisión visual por diez pantallas, **no
  funciona**: la regla de contorno va después en el archivo y su fondo transparente gana, así que
  el botón elegido queda idéntico al resto y no hay forma de saber cuál está activo.
- **El layout del grupo también está centralizado:** `.grupo-modo` es una rejilla de columnas
  iguales (`auto-fit`, mínimo 9rem) donde el texto **sí** parte línea. Con una fila `flex` y el
  `white-space: nowrap` del botón, una etiqueta larga se sale de la tarjeta y queda cortada contra
  el borde de la pantalla. El consumidor solo declara la clase; no escribe `display: flex` en
  línea.
- El piso táctil sigue mandando el alto: `height: auto` deja crecer a dos renglones sin bajar de
  los 48px del piso.

## Instrumento que se captura: la parte móvil se arrastra

Los dos instrumentos dibujados —el tubo del rotámetro y la carátula del manómetro— no solo se
pican: **el flotador se arrastra y la aguja se gira**. Acertarle de un toque a una raya de la
escala es justo lo que no se puede hacer de pie en el lote, con guantes y el teléfono a la
distancia del brazo. El tap sigue vivo: es el mismo gesto con recorrido cero.

- **La zona de agarre es una figura transparente, último hijo del SVG** (`.instrumento__agarre`):
  la franja del tubo con su escala, la carátula completa del manómetro. Va encima de todo para ser
  siempre el destino del toque, así que el gesto **no depende de acertarle a la bola ni a la
  aguja**. Fuera de ella —chasis, bisel, márgenes— el toque sigue capturando de un tap y el dedo
  puede desplazar la pantalla.
- **`touch-action: none` va en el agarre, nunca en el SVG entero.** El arrastre del flotador y el
  desplazamiento de la página comparten eje: dentro de la zona gana el instrumento, fuera gana la
  página. Poner el bloqueo en todo el dibujo dejaría al dedo sin forma de bajar la pantalla.
- **Safari en iPhone ignora `touch-action` cuando cuelga de un hijo del SVG**, que es exactamente
  el teléfono con el que se calibra. Por eso el gesto lo respalda un `preventDefault` en
  `touchmove` **mientras dura**, con el listener declarado no pasivo. Sin ese respaldo el gesto se
  lo lleva el scroll y el flotador no se mueve: es el fallo que trajo este patrón.
- **La parte móvil vive en un grupo aparte** (`.instrumento__movil`) que se vuelve a pintar solo,
  decenas de veces por segundo. **Prohibido** recalcular la pestaña en cada paso del dedo:
  remontar destruiría el mismo SVG que está recibiendo el gesto.
- **El valor se entrega una sola vez, al soltar.** Durante el gesto la pastilla ya va mostrando a
  dónde va la lectura, así que el feedback no depende del recálculo.
- El puntero se **captura** (`setPointerCapture`): el gesto sobrevive aunque el dedo se salga del
  tubo o de la carátula. Nadie sigue una franja de 4 mm en línea recta parado sobre un tractor.
- **Donde el toque no dice nada, no se captura**: el eje del manómetro y el hueco de 90° sin
  escala. Ahí la aguja se queda donde iba en vez de saltar al tope.
- El teclado sigue siendo cosa de los **botones más y menos** de la fila de captura: el SVG es
  `role="img"`, y un control arrastrable dentro de él quedaría fuera del alcance de un lector de
  pantalla de todos modos.

## Anillo de foco y apilado de campos

- El anillo de foco se pinta **fuera** del control y **no ocupa lugar en el flujo**: nada lo
  empuja. Lo que sobresale está en `--foco-holgura` (`--foco-trazo` + `--foco-desplazamiento`), y
  es el **mínimo** que puede separar a un campo de lo que tiene arriba o abajo. Con menos, el
  anillo se pinta encima de la etiqueta vecina y la vuelve ilegible.
- **Una columna de campos siempre lleva su clase de apilado.** Dentro de una tarjeta lo resuelve
  `.card__contenido`; en el panel, `.panel`; en cualquier otra superficie —el cuerpo de un
  diálogo, sobre todo— va **`.pila-campos`**. **Prohibido** apilar campos en un `<div>` pelado:
  la separación queda en cero, la etiqueta de un campo nace pegada al control del campo de
  arriba y el anillo de foco cae sobre ella.
- El ritmo vive en `components.css`, igual que el del grupo de opciones: el consumidor **solo
  declara la clase**, no escribe `display: flex` ni `gap` en línea.

## Chip (badge)

- La geometría sale entera de **seis tokens** —`--badge-h`, `--badge-px`, `--badge-gap`,
  `--badge-text`, `--badge-leading`, `--badge-icon`— y **`.badge` es su único consumidor**.
- Dos juegos de valores: compacto (22px de alto / 13px de texto) y táctil (28px / 15px). Cambiar
  el escalón de una superficie es **declarar los tokens**, nunca repetir tamaños en el consumidor.
- El texto del chip sale de la **misma escala** que el resto (`--badge-text` apunta a
  `--text-meta` o a `--text-sm`): un chip no es un sitio para inventar un tamaño intermedio.
- Un chip de estado usa el trío semántico completo (borde + fondo + texto), no solo el color del
  texto.

## Tarjeta

- **El relleno interior lo pone la superficie, nunca el contenido.** `.card__contenido` aporta el
  relleno; el nodo raíz de lo que va dentro no lleva `padding`. Un relleno propio se **suma** al de
  la tarjeta y da el doble por lado.
- **Banda de identidad:** `.card__encabezado` es una franja con el cromado del módulo (fondo
  tintado, borde inferior y el título en `--acento-texto`). Es lo que permite reconocer de un
  vistazo en qué sección estás cuando la pantalla es una columna de tarjetas casi idénticas.
- Cambiar la densidad de las tarjetas es tocar `.card__contenido` (afecta a todas por igual), no
  sumar relleno desde una pantalla.

## Idioma

Todo texto visible va en **español de México con ortografía correcta**: tildes, `ñ`, signos de
apertura `¿` `¡` y concordancia. La compuerta `tools/acentuar.mjs` lo verifica en CI.

## Contraste (compuerta de CI)

`tools/verificar-contraste.mjs` recorre, en **ambos temas**, los pares de tokens declarados en
`PARES` y falla por debajo de **4.5:1**. Al añadir un token de color que vaya a pintar texto hay
que **añadir su par ahí**: texto sobre su fondo propio, y sobre `background` y `card` si se usa
suelto. Lo mismo con cada color ISO sembrado.

## Qué evitar

- Colores, radios o tamaños escritos a mano en un componente en vez de tokens.
- Un color por pantalla o por pestaña (el color es del módulo).
- `--acento` donde toca la identidad: el título y la cifra usan `--acento-texto`, o quedan grises
  en la sección neutra.
- Parchear la altura de un botón desde el consumidor (`min-height` suelto): rompe el eje que no
  toque. El piso táctil es responsabilidad exclusiva de `components.css`.
- Fijar el tamaño de un chip en el consumidor: lo saca del escalón táctil.
- Señalar la opción elegida intercambiando variantes de botón, o maquetar el grupo con un
  `display: flex` en línea: la etiqueta larga se sale de la tarjeta.
- Imprimir la ayuda de un campo como párrafo fijo bajo el control: va en el globo del botón `?`.
- Imprimir la explicación estable de una tarjeta como párrafo bajo sus cifras: va en el `?` del
  encabezado (`tarjeta({ ayuda })`). Lo que se imprime es lo que cambia con el cálculo.
- Mandar al `?` un aviso accionable o un resultado: la ayuda se consulta, el resultado se ve.
- Pintar una cifra sin decir qué es: todo `pintarResultado` lleva su `ayuda`, y una etiqueta como
  «CV de la barra» o «factor requerido» no se explica sola.
- Armar a mano un `.resultado` en una pantalla en vez de llamar a `pintarResultado`: se queda sin
  el `?` y sin la fila de la etiqueta.
- Repetir la unidad en la etiqueta de un campo que ya tiene botón de unidades, o armar a mano la
  fila del input con su botón: la produce `campos.js` a partir de `magnitud` y `sistema`.
- Convertir un campo hacia la unidad ajena y dejarlo escrito así: el campo se queda **siempre** en
  las unidades de la aplicación, y el botón solo convierte hacia ellas.
- Rotular el botón de unidades sin el sentido de la conversión (`bar` a secas, o una doble flecha):
  no se sabe si convierte a psi o avisa que el número ya viene en psi.
- Poner el peso del rótulo en la unidad ajena: al ojear el campo, «psi» queda junto a un número que
  está en bar.
- Pintar una cifra sin su equivalencia en el otro sistema, o escribir esa conversión a mano en la
  pantalla en vez de dejarla en `.alterna`: cada factor suelto es un error de factor esperando.
- Leer la equivalencia como un dato: no se captura, no se guarda y no entra a ningún cálculo.
- Devolver el globo de ayuda al flujo (o anclarlo con `position: absolute` dentro del campo): abrir
  una ayuda volvería a empujar los campos de abajo, y dentro de una tarjeta el globo se recorta.
- Declarar `touch-action: none` sobre el SVG entero de un instrumento: deja al dedo sin forma de
  desplazar la pantalla desde ese pedazo grande de la pestaña.
- Confiar el gesto solo a `touch-action`: en el iPhone con el que se calibra hay que respaldarlo
  con `preventDefault` en `touchmove`.
- Recalcular la pestaña en cada paso de un arrastre: remonta el SVG que está recibiendo el gesto y
  lo deja muerto a media captura.
- Sumar relleno a una tarjeta desde su contenido.
- Apilar campos en un `<div>` sin clase: quedan sin separación y el anillo de foco pisa la
  etiqueta del campo de abajo.
- Medidas físicas en `rem` (la raíz mide 14px, no 16px).
- Añadir un token de color que pinte texto **sin** su par en la compuerta de contraste.
- **Cualquier tamaño de texto escrito como número suelto**, en CSS o en un `estilo` de `el()`:
  saca a esa pantalla de la escala y hace imposible volver a subir la letra de golpe.
- Un campo de captura por debajo de 16px: iOS Safari hace zoom al enfocarlo.
- Recortar letra para meter un dato más en la pantalla. Si no cabe, se parte en dos tarjetas o se
  manda al desglose; **nunca se encoge**.
