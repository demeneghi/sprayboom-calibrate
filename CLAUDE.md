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
npm test                                   # 131 pruebas de dominio (node:test)
node tools/verificar-contraste.mjs         # contraste AA de tokens y colores ISO
node tools/generar-precache.mjs            # lista de precache de sw.js al día
node tools/acentuar.mjs $(find assets/js -name '*.js' | sort)
node tools/humo.mjs && node tools/interaccion.mjs   # navegador real, viewport de teléfono
```

Los dos últimos necesitan Chromium: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save
playwright` y `export CHROMIUM_PATH="$(command -v google-chrome || command -v chromium)"`.

## Versión del service worker — REGLA DURA

**Todo cambio en archivos del sitio** (`index.html`, `componentes.html`, `404.html`,
`manifest.webmanifest`, `sw.js`, `assets/`) **obliga a subir `self.SPRAYBOOM_VERSION` en
`version.js`**. Sin eso, el service worker de los teléfonos en campo conserva la caché vieja y la
gente nunca recibe el cambio. CI lo bloquea en cada pull request.

## Sin `innerHTML` — REGLA DURA

Ningún dato pasa por `innerHTML`: los nodos se construyen con `el()` de `assets/js/ui/dom.js`,
el texto entra por `textContent` y los atributos por `setAttribute`. CI lo bloquea.

## Reglas siempre activas

@.claude/rules/design-system.md
