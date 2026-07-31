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
- **`.ayuda` a secas sigue siendo válida** para la nota de una sección —pie de tabla, aclaración de
  un bloque—, es decir, donde no hay etiqueta de la que colgar un botón.
- **Solo un globo abierto a la vez** en toda la pantalla: dos o tres consultados a la vez devuelven
  el muro que este patrón vino a quitar. El estado lo lleva `campos.js`.
- **El globo va en el flujo, no flotando.** Una tarjeta recorta lo que se sale de ella y, en un
  teléfono, un globo absoluto acaba tapando el campo que explica. Empujar el contenido hacia abajo
  es lo único que se pinta sin recortes en cualquier superficie, incluido el cuerpo de un diálogo.
- **El globo va debajo del control, no entre la etiqueta y el control.** En medio, el rótulo se
  separa de su campo y deja de leerse a cuál pertenece el control que queda abajo.
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
