# CLAUDE.md

> Las reglas del proyecto viven en `.claude/rules/*.md`. Este archivo es el hub que Claude Code
> carga: desde aquí se importan las reglas siempre activas.

## Idioma — REGLA DURA (obligatoria, sin excepciones)

- **Responde SIEMPRE en español.** Todo el chat, sin importar en qué idioma escriba el usuario.
- Escribe de forma **clara y sencilla**: frases cortas, directas y fáciles de entender.
- **Nada de jerga innecesaria.** Si un término técnico es imprescindible (un comando, una API,
  una palabra clave del código), explícalo en una frase breve la primera vez que aparezca.
- Mantén en su idioma original solo lo que no se debe traducir: nombres de archivos, rutas,
  comandos, código, identificadores y nombres propios.
- Lo mismo aplica al **texto visible de la aplicación**: español de México con tildes, `ñ` y
  signos de apertura. La compuerta `tools/acentuar.mjs` lo verifica en CI.

## Verificación antes de cerrar — REGLA DURA

Esta aplicación calcula calibraciones agrícolas: un número mal calculado tiene consecuencias en
el cultivo. Nada se da por terminado sin pasar, como mínimo, lo que corre CI:

```bash
npm test                                   # pruebas de dominio (node:test)
node tools/verificar-contraste.mjs         # contraste AA de tokens y colores ISO
node tools/generar-precache.mjs            # regenera precache.js (lista del service worker)
node tools/acentuar.mjs $(find assets/js -name '*.js' | sort)
node tools/humo.mjs && node tools/interaccion.mjs   # navegador real, viewport de teléfono
```

Los dos últimos necesitan Chromium: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save
playwright` y `export CHROMIUM_PATH="$(command -v google-chrome || command -v chromium)"`.

## Versión del service worker — la estampa el despliegue

**No subas `version.js` a mano: ya no hace falta.** La versión de la caché la escribe
`tools/sellar-version.mjs` desde `pages.yml`, con la fecha y el commit que se publica. Cada
despliegue recibe una versión distinta por construcción, así que el teléfono en campo siempre
detecta el service worker nuevo.

Antes había una regla dura que obligaba a subir esa línea en todo pull request. Se quitó porque
era el conflicto de git más frecuente del repositorio —dos ramas en paralelo chocaban siempre en
el mismo renglón— y porque el sello de despliegue da una garantía **más fuerte**: no depende de
que nadie se acuerde.

En el repositorio `version.js` dice `'dev'`. Es lo que ven `humo.mjs`, `interaccion.mjs` y quien
abra el sitio desde el disco; la pantalla de Configuración mostrará "Versión instalada: dev", que
es lo correcto en local.

## Sin `innerHTML` — REGLA DURA

Ningún dato pasa por `innerHTML`: los nodos se construyen con `el()` de `assets/js/ui/dom.js`,
el texto entra por `textContent` y los atributos por `setAttribute`. CI lo bloquea.

## Entrega — REGLA DURA

**Siempre se abre un pull request. NUNCA se hace merge.** Todo cambio va en una rama y se
entrega abriendo el PR, sin esperar a que lo pidan; jamás se hace push a `main`. Integrar el
pull request —merge, squash, rebase o auto-merge— es decisión de una persona, nunca del agente.
El detalle está en `.claude/rules/entrega.md`.

## Reglas siempre activas

@.claude/rules/design-system.md
@.claude/rules/entrega.md
