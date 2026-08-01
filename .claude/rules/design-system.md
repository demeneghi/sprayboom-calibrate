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

## Botón de unidades de un campo (métrico → imperial)

- **Un campo con magnitud no imprime su unidad en la etiqueta: la unidad ES el botón**, y va
  pegado al número. Se lee junto a la cifra que califica y se toca donde se lee. La etiqueta queda
  con el nombre del dato y nada más.
- **El botón dice el SENTIDO de la conversión, no solo que ahí se convierte.** Lleva dos rótulos:
  la unidad en la que está escrito el número —que manda, y por eso conserva el peso y el color del
  botón—, la flecha, y la unidad a la que va al pulsarlo (`bar → psi`). El destino va atenuado y un
  escalón más chico (`--text-meta`) para que la pareja se lea «de aquí a allá» y no como dos
  unidades compitiendo. **Prohibido** rotularlo solo con la unidad actual o con una doble flecha:
  no había forma de saber si al pulsarlo el número pasaba a psi o si el botón avisaba que ya venía
  en psi, y equivocarse de sentido es exactamente el error de factor que este botón vino a quitar.
- **Para qué existe.** Quien calibra lee el dato en la unidad del fierro que tiene enfrente —el
  manómetro de la barra marca psi, la ficha de la boquilla americana viene en GPM, el tanque está
  rotulado en galones— y la aplicación trabaja en la otra. Ese número se convertía a mano, de pie
  en el lote, con la calculadora del mismo teléfono: es justo donde se cuela un error de factor
  que después nadie encuentra.
- **No cambia el sistema de la aplicación.** Ese sigue siendo uno solo y vive en Sistema,
  Configuración. El botón solo cambia en qué unidad se **escribe** ese campo; hacia afuera el
  valor sigue saliendo en el sistema que declaró la pantalla, así que ninguna pantalla cambia por
  esto. **Prohibido** usarlo como segundo selector global de unidades.
- **Lo produce `campos.js`, no la pantalla.** El consumidor declara `magnitud` (clave de
  `domain/units.js`) y `sistema` (el de entrada y salida del campo) y ya no pasa `unidad`.
  `crearCampoHeredado` los reenvía igual. **Prohibido** armar a mano una fila con el input y un
  botón de unidad.
- **La vuelta devuelve el texto original, no el reconvertido.** Con seis dígitos significativos,
  2.7579 bar → 40.0001 psi → 2.75791 bar: ver cambiar el número al regresar se lee como un error
  de la aplicación. El campo recuerda de dónde venía.
- **Mientras está en la otra unidad, el botón se pinta con el acento del módulo**
  (`data-convertido='true'`), igual que la opción elegida de un grupo y la ayuda abierta: es lo
  que dice de un vistazo que ese campo no está en las unidades de la aplicación. Se pinta por
  «convertido», **no** por «imperial»: con la aplicación en imperial, imperial es lo normal y no
  hay nada que señalar.
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
- Repetir la unidad en la etiqueta de un campo que ya tiene botón de unidades, o armar a mano la
  fila del input con su botón: la produce `campos.js` a partir de `magnitud` y `sistema`.
- Convertir el campo y **no** decir que quedó en la otra unidad: sin el acento, un 43.5 en un
  campo que se lee como bar es una calibración mal hecha.
- Rotular el botón de unidades sin el sentido de la conversión (`bar` a secas, o una doble flecha):
  no se sabe si convierte a psi o avisa que el número ya viene en psi.
- Devolver el globo de ayuda al flujo (o anclarlo con `position: absolute` dentro del campo): abrir
  una ayuda volvería a empujar los campos de abajo, y dentro de una tarjeta el globo se recorta.
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
