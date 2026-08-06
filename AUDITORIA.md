# Auditoría exhaustiva de código — sprayboom-calibrate

Fecha: 2026-08-06 · Commit auditado: `6b94338` · Rama: `claude/code-security-audit-43yowe`
Alcance: repositorio completo (112 archivos, 31 537 líneas contando código, CSS, HTML y documentación técnica).

> ## Estado de las correcciones
>
> Los **26 hallazgos están corregidos**, salvo una parte de F-016 que no se puede
> cerrar sin acceso de red a repositorios de terceros; queda declarada abajo.
> La auditoría en sí fue de solo lectura: las correcciones son un segundo paso,
> pedido después de entregar el reporte, y cada hallazgo lleva su marca al
> principio de su ficha en la Sección C.
>
> **Compuertas tras las correcciones** (las seis, ejecutadas y vistas):
>
> | Compuerta | Resultado |
> | --- | --- |
> | `npm test` | **252/252** (238 previas + 14 nuevas de contrato UI↔dominio) |
> | `node tools/verificar-contraste.mjs` | AA en ambos temas y los 19 colores ISO |
> | `node tools/verificar-diseno.mjs` (nueva) | 103 de 103 cifras con ayuda, 0 colores sueltos, 0 layouts en línea, hook revisado |
> | `node tools/generar-precache.mjs` | al día (75 rutas) |
> | `node tools/acentuar.mjs` | sin cambios |
> | `node tools/humo.mjs` y `node tools/interaccion.mjs` | **verde** — 11 rutas × 2 viewports sin errores ni scroll horizontal; interacción completa incluidos service worker, recarga sin conexión y reinstalación |
>
> **Lo que quedó pendiente, y por qué:** el anclaje por SHA de las seis acciones
> de GitHub (parte de F-016). Resolver un SHA exige leer `actions/checkout` y
> compañía, y el acceso a GitHub de esta sesión está limitado a este
> repositorio. El pin de Playwright sí se cerró —y se verificó contra el
> registro: `1.62.1`, la versión `latest`— junto con `--ignore-scripts`.
> Anclar las acciones es un cambio de seis líneas que necesita una persona con
> acceso; el detalle está en F-016.

---

## A) Resumen ejecutivo

| Severidad | Verificados | Sospechas | Total |
| --- | --- | --- | --- |
| CRITICO | 0 | 0 | 0 |
| ALTO | 1 | 0 | 1 |
| MEDIO | 8 | 0 | 8 |
| BAJO | 11 | 2 | 13 |
| SUGERENCIA | 4 | 0 | 4 |
| **Total** | **24** | **2** | **26** |

Mapeo aplicado: `Confianza: alta` cuenta como Verificado; `media` y `baja` cuentan como Sospecha.

### Top 5 riesgos reales (impacto × probabilidad × exposición)

1. **F-001 — «Usar en Gasto de agua» no precarga nada y avisa que sí.** El botón de la pestaña Boquillas escribe la boquilla y la presión en `borradores.gasto`, un sitio que Gasto de agua dejó de leer cuando esos datos se movieron a `estado.jornada`. El toast afirma «precargada en Gasto de agua» y se navega a una pantalla que sigue con la presión anterior. Es un botón del flujo principal y falla en silencio, en la dirección peligrosa: quien calibra cree que aplicó la presión que eligió.

2. **F-004 — `aNumero` lee «1,000» como 1.** El intérprete de captura sustituye solo la PRIMERA coma por punto, así que un número escrito con el separador de miles que la propia aplicación imprime (`Intl.NumberFormat('es-MX')`) entra dividido por mil. Afecta a todos los campos numéricos de la aplicación.

3. **F-002 — Un enlace compartido con `tab: "__proto__"` siembra borradores en TODAS las pantallas.** `carga.tab` no se valida contra las rutas conocidas antes de usarse como clave de escritura, y contamina el prototipo de `estado.borradores`. El comentario del código afirma justo lo contrario («un enlace manipulado no puede sembrar campos que la aplicación no conoce») y el diálogo promete cargar «una pantalla».

4. **F-007 — La hoja del asistente calcula el agua por carga distinto que la pestaña Mezcla.** `cifrasDeCierre` llama a `mezclaTanque` sin `dosis.unidad`, así que un producto sólido (kg) se trata como líquido: se le resta al agua del tanque y se pierde el aviso `producto-solido`. Dos implementaciones del mismo número que divergen es exactamente lo que las reglas del proyecto prohíben.

5. **F-003 — La importación de respaldos salta la validación en cuatro colecciones.** `factoresDesviacion`, `bitacora`, `pruebasCaptura` y `preferencias` entran solo con `Array.isArray` / truthiness, contra lo que declara el encabezado de `storage.js`. Un factor de desviación fuera de cotas cambia la velocidad —y con ella el volumen por hectárea— de toda la aplicación, sin rechazo ni aviso.

---

## B) Cobertura cerrada

### B.1 Inventario auditado (agrupado: 112 archivos > 100)

| Grupo | Archivos | Cómo se auditó |
| --- | --- | --- |
| `./` (raíz) | 13 | Leídos completos: `index.html`, `404.html`, `sw.js`, `version.js`, `precache.js`, `manifest.webmanifest`, `package.json`, `.gitattributes`, `.gitignore`, `CLAUDE.md`, `README.md`. Recorridos por barrido: `componentes.html` (galería), `.nojekyll` (vacío). |
| `./assets/js/domain` | 18 | Leídos completos los 18 (incluye `index.js`, `constants.js`, `validate.js`, `verify.js`, `defaults.js`, `datos.js`, `recetas.js`, `units.js`, `speed.js`, `water.js`, `nozzles.js`, `pump.js`, `capture.js`, `mix.js`, `gas.js`, `flowmeter.js`, `forcing.js`, `atmosphere.js`). |
| `./assets/js/ui` | 18 | Leídos completos los 18 módulos (`dom.js`, `render.js`, `campos.js`, `dato.js`, `heredado.js`, `trio-barra.js`, `combobox.js`, `alterna.js`, `formato.js`, `color.js`, `svg.js`, `dialog.js`, `toast.js`, `tabs.js`, `cronometro.js`, `marchas.js`, `actualizar.js`, `compartir.js`). |
| `./assets/js/ui/tabs` | 11 | Leídos completos los 11 (`guia.js`, `avance.js`, `gasto.js`, `boquillas.js`, `gas.js`, `forzamiento.js`, `mezcla.js`, `captura.js`, `bitacora.js`, `configuracion.js`, `metodologia.js`; de `metodologia.js` se leyó el encabezado completo y se barrió el resto por patrón). |
| `./assets/js/ui/tabs/gas` | 3 | Leídos completos (`tubo.js`, `manometro.js`, `escala.js`). |
| `./assets/js/ui/tabs/guia` | 1 | Leído completo (`pasos.js`). |
| `./assets/js/ui` (raíz de app) | 2 | Leídos completos (`main.js`, `storage.js`). |
| `./assets/js/data` | 3 | Leídos completos `iso-colors.js` y `droplet-classes.js`; `nozzle-catalog.js` (779 líneas de datos con fuentes citadas) leído en encabezado y cierre, y barrido por patrón. |
| `./assets/css` | 3 | Barridos dirigidos sobre `tokens.css`, `base.css` y `components.css` (tamaños de texto sueltos, colores fuera de token, piso táctil, pares de contraste). |
| `./tools` | 7 | Leídos completos `acentuar.mjs`, `generar-precache.mjs`, `sellar-version.mjs`, `verificar-contraste.mjs`, `generar-iconos.mjs`; `humo.mjs` e `interaccion.mjs` leídos en sus partes de servidor, aserciones y cierre. |
| `./tests` | 18 | Leídos completos `auditoria.test.js` y `helpers.js`; los 16 restantes barridos por patrón para medir cobertura (238 pruebas, todas de `domain/` y `storage`). |
| `./.github/workflows` | 2 | Leídos completos (`ci.yml`, `pages.yml`). |
| `./.claude` + `./.claude/rules` | 3 | Leídos completos (`settings.json`, `design-system.md`, `entrega.md`). |
| `./docs` | 2 | Barridos (`conexiones-entre-pestanas.md`, `guia-por-objetivo.md`). |
| `./assets/icons` | 4 | Excluidos del análisis de código: 2 SVG y 2 PNG generados por `tools/generar-iconos.mjs`. Sin relevancia de seguridad. |
| `./assets/fonts` | 4 | Excluidos: 3 `.woff2` autohospedados y `OFL.txt` (licencia SIL OFL 1.1, compatible con uso comercial). |

Exclusiones por defecto aplicadas: `.git/`, `node_modules/` (ausente), `*.min.*`, `*.map`, binarios.

### B.2 No cubierto por límite de contexto

No aplicó límite de contexto: se leyó el 100 % del código fuente ejecutable. Lo único no leído línea por línea son los 8 binarios (fuentes e iconos) y los tramos de tabla de datos de `nozzle-catalog.js` y `metodologia.js`, declarados arriba.

### B.3 Patrones barridos (Fase 3)

| Patrón | Resultado |
| --- | --- |
| Secretos en asignaciones literales (`password\|passwd\|secret\|api[_-]?key\|token\|Bearer `) | `[OK]` — solo coincidencias en la palabra «token» del sistema de diseño (`tokens.css`, comentarios). Ningún literal de credencial. |
| Secretos en historial git (`git log -p` filtrado con los mismos patrones) | `[OK]` — sin coincidencias en asignaciones; las únicas apariciones son «tokens» de diseño. |
| Concatenación / interpolación SQL | `[N/A]` — no hay base de datos ni capa SQL. La persistencia es `localStorage` con `JSON.stringify`. |
| Deserialización insegura (`eval(`, `new Function(`, `Function(`, `setTimeout('…')`, `pickle`, `yaml.load`) | `[OK]` — cero coincidencias. Toda deserialización es `JSON.parse` en `try/catch`. |
| Path traversal (revisión dirigida) | `[OK]` — revisado `tools/humo.mjs:39` (`normalize(join(RAIZ, ruta))` + `startsWith(normalize(RAIZ))`, con `RAIZ` terminada en `/`) y `tools/interaccion.mjs`. El servidor es de desarrollo, escucha en 127.0.0.1 y puerto efímero. |
| TLS deshabilitado (`rejectUnauthorized`, `InsecureSkipVerify`, `verify=False`, `NODE_TLS_REJECT`) | `[OK]` — cero coincidencias. |
| Aleatoriedad no criptográfica en contexto de seguridad (`Math.random`) | `[HIT]` en `mezcla.js:478`, `gas.js:722`, `gasto.js:602`, `forzamiento.js:738`, `captura.js:40`, `configuracion.js:163` — todos para IDs de registro local, ninguno para token, sesión ni credencial. Sin riesgo de seguridad; queda como F-026 (calidad). |
| Comandos de shell con input externo (`child_process`, `execSync`, `shell: true`, `os.system`) | `[HIT]` en `tools/generar-precache.mjs:18` — `execSync` con una cadena `find` FIJA y `cwd` pasado como opción (no interpolado en el shell). Sin input externo. Ver F-021 por otra razón (percent-encoding de la ruta). |
| CORS permisivo (`Access-Control-Allow-Origin: *` con credenciales) | `[N/A]` — sitio estático en GitHub Pages, sin servidor propio y sin cabeceras configurables (declarado en `sw.js:3`). |
| Redirects abiertos (revisión dirigida) | `[OK]` — `404.html:25` hace `location.replace(base + location.hash)` con `base` derivado del PRIMER SEGMENTO del propio `pathname` (nunca de un parámetro), con guarda anti-bucle en `sessionStorage`. `main.js:88` solo escribe `location.hash`. |
| XSS / `innerHTML` | `[OK]` — cero usos de `innerHTML`, `outerHTML`, `insertAdjacentHTML` o `document.write` en código; la compuerta de CI lo bloquea y `dom.js`/`svg.js` construyen todo con `createTextNode` y `setAttribute`. Verificado también en las rutas de datos no confiables (bitácora, catálogo importado, enlace compartido). |
| Peticiones de red salientes (`fetch`, `XMLHttpRequest`, `WebSocket`, URLs `http(s)://`) | `[OK]` — el único `fetch` está en `sw.js`, acotado a `url.origin === self.location.origin` (línea 67). Las URLs `https://` del código son citas de fuentes en comentarios. Todo (fuentes, iconos, CSS) es autohospedado. |
| Inyección en plantilla generada (`sellar-version.mjs` escribe JS) | `[OK]` — el sello se valida con `/^[A-Za-z0-9._-]+$/` antes de interpolarse (línea 35). |
| Mass assignment / fusión de objetos sin allowlist | `[HIT]` — `main.js:496` (F-002) y `storage.js:605-608` (F-003). La jornada SÍ va filtrada por `soloClavesDeJornada`; los borradores y cuatro colecciones no. |
| `catch` vacíos o que tragan el error | `[HIT]` — 19 `catch {}` sin parámetro. 17 tienen comentario y ruta de degradación documentada; 2 colapsan causas distintas en un mensaje engañoso (`actualizar.js:157`, F-011) o dejan la promesa sin capturar (`compartir.js`, F-009). |
| **SQL / PL-pgSQL: `EXECUTE` con concatenación** | `[N/A]` en bloque — el inventario **no incluye** migraciones, funciones, esquema ni archivos `.sql`. Aplican por igual a `SECURITY DEFINER` sin `search_path`, RLS ausente o `USING (true)`, `GRANT` excesivos, migraciones sin `CONCURRENTLY`/`lock_timeout`, triggers sin manejo de excepción y credenciales en seeds. |
| Dependencias con CVE conocido | `[OK] parcial` — **no hay dependencias de producción** (`package.json` sin `dependencies` ni `devDependencies`, sin lockfile) y cero librerías de terceros en el navegador. La única dependencia es `playwright`, instalada ad-hoc en CI. Sin acceso a avisos (npm audit / OSV) no se contrastó CVE por versión; ver F-016. |
| Licencias | `[OK]` — `package.json` declara `UNLICENSED` y `private: true`; las fuentes autohospedadas llevan SIL OFL 1.1 (`assets/fonts/OFL.txt`), compatible con uso comercial. |

Pregunta de cierre de fase, «¿qué errores podrían existir aquí y aún no he listado?»: generó cinco candidatos que se verificaron leyendo el código y entraron como F-005, F-006, F-012, F-013 y F-020; ninguno quedó como sospecha sin confirmar.

### B.4 Asunciones aplicadas

- `[Asuncion: el sitio se publica en un dominio de proyecto de GitHub Pages del tipo usuario.github.io/sprayboom-calibrate, que es lo que simulan tools/humo.mjs y tools/interaccion.mjs. Por eso F-010 (borrado de cachés y service workers de TODO el origen) se evalúa como riesgo real de convivencia con otras aplicaciones del mismo usuario.]`
- `[Asuncion: el repositorio es público —GitHub Pages con Actions—, así que F-017 (publicación de archivos de desarrollo) no expone nada que no estuviera ya visible; en un repositorio privado con Pages público la severidad subiría.]`
- `[Asuncion: un enlace compartido es contenido NO CONFIABLE. Lo genera el botón de compartir, pero viaja por WhatsApp y cualquiera puede alterarlo antes de reenviarlo. F-002 se evalúa con ese modelo, que es el más expuesto.]`
- `[Asuncion: un archivo importado por «Importar configuración» es contenido NO CONFIABLE, aunque el caso normal sea un respaldo propio: la interfaz no distingue uno de otro. F-003 se evalúa con ese modelo.]`
- `[Asuncion: el usuario tipo captura en español de México, donde el separador de miles es la coma y el decimal el punto —lo que la propia aplicación imprime con Intl.NumberFormat('es-MX')—. F-004 se evalúa con esa expectativa de captura.]`
- `[Asuncion: el estado guardado en localStorage puede llegar corrupto o editado a mano (herramientas de desarrollador, restauración parcial). F-013 se evalúa con colecciones vacías como entrada posible, no como estado alcanzable desde la interfaz.]`

### B.5 Compuertas del proyecto, ejecutadas

| Compuerta | Resultado |
| --- | --- |
| `npm test` | **238 pruebas, 238 pasan, 0 fallan** (1.03 s). |
| `node tools/verificar-contraste.mjs` | **Todos los pares cumplen AA (4.5:1)**, en ambos temas y sobre los 19 colores ISO sembrados. |
| `node tools/generar-precache.mjs` + `git diff` | `precache.js` **al día** (74 rutas, sin diferencia). |
| `node tools/acentuar.mjs $(find assets/js -name '*.js' \| sort)` + `git diff` | **Sin cambios**: los textos visibles están acentuados. |
| `node tools/humo.mjs` y `node tools/interaccion.mjs` | **No ejecutadas en local.** Requieren `npm install --no-save playwright`, es decir tráfico de red saliente, que esta auditoría no realiza (Chromium sí está disponible en `/opt/pw-browsers`). **Verde en CI**: el job `humo` del flujo de validaciones las corrió sobre este mismo commit y pasó. |

---

## C) Hallazgos detallados

### Tabla índice

| ID | Título corto | Severidad | Confianza | Categoría |
| --- | --- | --- | --- | --- |
| F-001 | «Usar en Gasto de agua» escribe donde nadie lee | ALTO | alta | bugs y lógica |
| F-002 | Enlace compartido siembra borradores por `__proto__` | MEDIO | alta | seguridad |
| F-003 | Importación sin validar cuatro colecciones | MEDIO | alta | seguridad / bugs |
| F-004 | `aNumero` lee «1,000» como 1 | MEDIO | alta | bugs / edge cases |
| F-005 | `iso.iso` inexistente y `estiloBadgeIso(null)` sin guarda | MEDIO | alta | bugs / edge cases |
| F-006 | `cvPct` inexistente: el CV del asistente sale vacío | MEDIO | alta | bugs |
| F-007 | La hoja del asistente calcula el agua por carga distinto | MEDIO | alta | bugs |
| F-008 | «Restaurar TODO» borra la jornada sin decirlo | MEDIO | alta | bugs / calidad |
| F-009 | El botón de compartir se queda mudo si falla el portapapeles | MEDIO | alta | manejo de errores |
| F-010 | «Reinstalar» borra cachés y service workers de todo el origen | BAJO | alta | bugs / infraestructura |
| F-011 | Cualquier fallo de actualización se reporta como «sin conexión» | BAJO | alta | manejo de errores |
| F-012 | Cotas cruzadas ausentes (escala del rotámetro, régimen del tractor) | BAJO | alta | edge cases |
| F-013 | Sin tractor, dos pestañas mueren con TypeError | BAJO | alta | edge cases |
| F-014 | El asistente pinta hectáreas, gramos y mL sin convertir | BAJO | alta | bugs / calidad |
| F-015 | 17 cifras del asistente sin su `ayuda` (regla dura) | BAJO | alta | calidad |
| F-016 | CI instala Playwright sin pin y usa acciones sin SHA | BAJO | alta | dependencias / CI |
| F-017 | El despliegue publica archivos de desarrollo | BAJO | alta | configuración |
| F-018 | El hook `SessionStart` es un vector de instrucción al agente | BAJO | media | seguridad / CI |
| F-019 | Color escrito a mano en el cronómetro | BAJO | alta | calidad |
| F-020 | Fallbacks de `--touch-floor` inalcanzables y en `rem` | BAJO | alta | calidad |
| F-021 | `import.meta.url.pathname` rompe con rutas con espacios | BAJO | media | configuración |
| F-022 | Mensajes internos de error mostrados al usuario | BAJO | alta | manejo de errores |
| F-023 | Layout en línea en ~60 sitios contra la regla del sistema | SUGERENCIA | alta | calidad |
| F-024 | Código muerto verificado | SUGERENCIA | alta | calidad |
| F-025 | Cero pruebas de `assets/js/ui` | SUGERENCIA | alta | calidad / tests |
| F-026 | IDs de bitácora con `Math.random` | SUGERENCIA | alta | calidad |

---

### F-001 — «Usar en Gasto de agua» escribe la boquilla y la presión donde ya nadie las lee

> **CORREGIDO.** `assets/js/ui/tabs/boquillas.js` usa `fijarDato` para la boquilla y la presión, que es el escritor del dato compartido. Cubierto por la prueba «ninguna pantalla escribe un dato de la JORNADA en el borrador de una pestaña», que barre las catorce superficies.

1. **Severidad:** ALTO
2. **Confianza:** alta (confirmado en código y con reproductor ejecutado)
3. **Categoría:** Bugs y lógica incorrecta (contrato roto entre módulos)
4. **Ubicación:** `assets/js/ui/tabs/boquillas.js:154-163`; contraparte que ya no lee: `assets/js/ui/tabs/gasto.js:64` y `assets/js/ui/tabs/gasto.js:183-186`; registro que lo decide: `assets/js/domain/datos.js:52-61` y `assets/js/domain/datos.js:132-138`
5. **Evidencia:**

```js
// assets/js/ui/tabs/boquillas.js:154
function usarEnGasto(candidata) {
  ctx.guardarBorrador('gasto', {
    boquillaId: candidata.boquilla.id,
    presionBar: candidata.presionRequeridaBar,
  });
  mostrarToast(
    `${candidata.boquilla.modelo} a ${presionTextoDe(candidata.presionRequeridaBar)} precargada en Gasto de agua.`
  );
  ctx.navegarA('calibrar', 'gasto');
}
```

```js
// assets/js/ui/tabs/gasto.js:64  — Gasto de agua lee la JORNADA, no su borrador
let boquillaId = valorDeDato(ctx, 'boquillaId').valor;
// assets/js/ui/tabs/gasto.js:183
const campoPresion = crearCampoDato(ctx, 'presionBar', { sistema, alCambiar: () => recalcular() });
```

6. **Problema:** `boquillaId` y `presionBar` son datos compartidos: en `domain/datos.js` NO declaran `guarda`, y por eso `ui/dato.js::almacenDeDato` los resuelve contra `estado.jornada`. `ctx.guardarBorrador('gasto', …)` escribe en `estado.borradores.gasto`, que es precisamente el sitio del que la migración `migrarJornada` (`storage.js:267-287`) los sacó: una vez que `jornada` tiene una sola clave, los borradores viejos «ya no se leen» —lo dice el comentario de `storage.js:260`—. Resultado: el botón navega a Gasto de agua y esa pantalla sigue mostrando la boquilla y la presión anteriores, mientras el toast afirma que quedaron precargadas.
7. **Impacto:** Técnico: la transferencia Boquillas → Gasto de agua está muerta; es el único camino que la pestaña Boquillas ofrece para aplicar su resultado. De negocio: quien calibra elige del catálogo la boquilla que llega a su objetivo, lee «precargada», entra a Gasto de agua y calibra con la presión vieja creyendo que es la nueva. La aplicación existe para evitar exactamente ese error de factor. Además contradice el propio comentario de `boquillas.js:7` («Al elegir una candidata se precarga en Gasto de agua»).
8. **Solución concreta:** usar el escritor de datos compartidos, que es el que conoce el sitio único de cada dato:

```js
// assets/js/ui/tabs/boquillas.js
import { crearCampoDato, fijarDato } from '../dato.js';   // fijarDato ya se importa en otras pestañas

function usarEnGasto(candidata) {
  fijarDato(ctx, 'boquillaId', candidata.boquilla.id);
  fijarDato(ctx, 'presionBar', candidata.presionRequeridaBar);
  mostrarToast(/* … sin cambios … */);
  ctx.navegarA('calibrar', 'gasto');
}
```

Es la misma llamada que ya hace el paso equivalente del asistente (`ui/tabs/guia/pasos.js:381-387`), que sí funciona. Conviene además una prueba de interacción que pulse el botón y compruebe el valor del campo de presión en Gasto de agua (ver F-025).

9. **Reproductor:** **ejecutado** (estático, sin red ni escrituras).

```
$ node --input-type=module -e "
import { DATOS } from './assets/js/domain/datos.js';
console.log('DATOS.boquillaId.guarda =', DATOS.boquillaId.guarda);
console.log('DATOS.presionBar.guarda =', DATOS.presionBar.guarda);
"
DATOS.boquillaId.guarda = undefined
DATOS.presionBar.guarda = undefined
```

Sin `guarda`, `ui/dato.js::almacenDeDato` los resuelve contra `estado.jornada`, no contra `borradores.gasto`.

Reproductor en navegador (**no ejecutado**: exige `npm install --no-save playwright`, es decir tráfico de red saliente): abrir `#/calibrar/boquillas`, capturar objetivo 575 L/ha y velocidad 2.59 km/h, pulsar «Usar en Gasto de agua» en la primera candidata y comprobar que el campo «Presión en la boquilla» de `#/calibrar/gasto` NO vale la presión requerida que anunció el toast.

---

### F-002 — Un enlace compartido con `tab: "__proto__"` siembra borradores en todas las pantallas

> **CORREGIDO.** `decodificarEstadoCompartido` recibe un validador de ruta desde `main.js` (`rutaConocida`, contra `SECCIONES`) y exige que `borrador`, `jornada` y `contexto` sean objetos llanos. Con `tab: "__proto__"` el enlace ya no decodifica.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código y con reproductor ejecutado)
3. **Categoría:** Seguridad (mass assignment / contaminación de prototipo desde entrada no confiable)
4. **Ubicación:** `assets/js/main.js:494-497`; validación insuficiente en `assets/js/ui/compartir.js:37-45`; propagación a la URL en `assets/js/main.js:515`
5. **Evidencia:**

```js
// assets/js/ui/compartir.js:40  — solo comprueba que sean truthy
if (!carga || carga.v !== VERSION_COMPARTIR || !carga.seccion || !carga.tab) return null;
```

```js
// assets/js/main.js:494
if (ok) {
  almacen.actualizar((estado) => {
    estado.borradores[carga.tab] = carga.borrador ?? {};
    // Solo se aceptan las claves que el registro declara: un enlace
    // manipulado no puede sembrar campos que la aplicacion no conoce.
    if (carga.jornada) {
      estado.jornada = { ...(estado.jornada ?? {}), ...soloClavesDeJornada(carga.jornada) };
    }
```

6. **Problema:** `carga.tab` viene del hash de la URL y no se valida contra `SECCIONES`. Con `tab: "__proto__"`, `estado.borradores['__proto__'] = carga.borrador` no crea una propiedad: **cambia el prototipo** de `estado.borradores`. Desde ahí `ctx.borrador(tabId)` (`main.js:225-227`) resuelve por herencia el borrador de CUALQUIER pestaña que el atacante haya puesto en el objeto. El filtro `soloClavesDeJornada` protege `jornada` pero no los borradores, así que la garantía que el comentario declara no se cumple. El contexto (`tractorActivoId`, `equipoActivoId`, `unidades`) sí está validado correctamente (líneas 502-511). Además `carga.seccion` y `carga.tab` llegan sin validar a `history.replaceState(null, '', '#/${carga.seccion}/${carga.tab}')`, así que el atacante controla el texto del fragmento que queda en la barra de direcciones.
7. **Impacto:** Técnico: el estado inyectado NO aparece en `Object.keys(estado.borradores)`, NO se persiste en `localStorage` (`JSON.stringify` ignora el prototipo) y sobrevive a `reiniciarCalibracion`, así que es invisible para el usuario y para la exportación. De negocio: un borrador `avance` inyectado (`{ rpm, segundosPorTramo, marcha }`) redefine `ctx.velocidadDeAvance()`, y con ella el volumen por hectárea, el tiempo por tabla y el ajuste del rotámetro de todas las pantallas. No hay ejecución de código ni exfiltración: el daño es una calibración silenciosamente equivocada, que es el daño que este proyecto declara como grave. Requiere que la víctima abra el enlace y pulse «Cargar».
8. **Solución concreta:** validar la ruta en el decodificador, donde ya está la versión del formato, y usar una escritura segura de la clave:

```js
// assets/js/ui/compartir.js — la lista de rutas se pasa desde main.js para no importar el enrutador
export function decodificarEstadoCompartido(cadena, rutaValida = () => true) {
  try {
    const carga = JSON.parse(decodificarBase64Url(cadena));
    if (!carga || carga.v !== VERSION_COMPARTIR) return null;
    if (typeof carga.seccion !== 'string' || typeof carga.tab !== 'string') return null;
    if (!rutaValida(carga.seccion, carga.tab)) return null;
    if (carga.borrador !== undefined && (typeof carga.borrador !== 'object' || carga.borrador === null || Array.isArray(carga.borrador))) return null;
    return carga;
  } catch {
    return null;
  }
}
```

```js
// assets/js/main.js — al llamar
const carga = decodificarEstadoCompartido(codigo, (s, t) =>
  SECCIONES.some((sec) => sec.id === s && sec.tabs.some((tab) => tab.id === t))
);
```

Y, como cinturón y tirantes, sembrar `estado.borradores` con `Object.create(null)` en `sembrarEstado()` para que la clave `__proto__` no tenga significado especial.

9. **Reproductor:** **ejecutado** (en memoria, sin red ni escrituras).

```
$ node -e "…exactamente la línea main.js:496…"
borrador("avance") = {"rpm":9999,"segundosPorTramo":1}
borrador("gasto")  = {"variableLibre":"velocidad"}
Object.keys(borradores) = []
persiste en JSON.stringify: {"borradores":{}}
Object.prototype contaminado: false
```

El enlace se arma con `codificarEstadoCompartido({ seccion: 'calibrar', tab: '__proto__', borrador: { avance: { rpm: 9999, segundosPorTramo: 1 } }, contexto: {} })` y se pega tras `#/calibrar/gasto?e=`.

---

### F-003 — La importación de respaldos salta la validación en cuatro colecciones

> **CORREGIDO.** Las cuatro colecciones pasan por `validarColeccion`: `factoresDesviacion` con `COTAS_FACTOR_IMPORTADO`, `bitacora` y `pruebasCaptura` con `validarRegistroHistorico`, y `preferencias` contra `TEMAS` y `SISTEMAS`. Además se añadió la cota que faltaba de raíz: `COTAS_FACTOR_DESVIACION.factor` (0.5 a 1.5), que es el único campo de esa ficha que entra al cálculo y no tenía ninguna. El formulario de Configuración la valida con la misma función y el mismo mensaje.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Seguridad (validación de entrada ausente) / Bugs
4. **Ubicación:** `assets/js/storage.js:605-608`; contrato que se incumple declarado en `assets/js/storage.js:461-469`; consumidor afectado en `assets/js/domain/speed.js:584-637` vía `assets/js/main.js:186-188`
5. **Evidencia:**

```js
// assets/js/storage.js:605
if (Array.isArray(importado.factoresDesviacion)) nuevo.factoresDesviacion = importado.factoresDesviacion;
if (Array.isArray(importado.bitacora)) nuevo.bitacora = importado.bitacora;
if (Array.isArray(importado.pruebasCaptura)) nuevo.pruebasCaptura = importado.pruebasCaptura;
if (importado.preferencias) nuevo.preferencias = { ...nuevo.preferencias, ...importado.preferencias };
```

```js
// assets/js/storage.js:463  — lo que el módulo promete
// La validacion usa validarValor (la MISMA funcion de los formularios),
// asi el mensaje de un valor fuera de cotas es identico en ambos
// caminos. Los campos invalidos se RECHAZAN individualmente…
```

6. **Problema:** `parametros`, `tractores`, `equipos`, `gases`, `rotametros` y `catalogo` sí pasan por `validarValor` con sus cotas. Las otras cuatro entran crudas. `COTAS_FACTOR_DESVIACION` existe en `defaults.js:398-402` y la usa el formulario de Configuración (`configuracion.js:1133-1143`), pero la importación no la aplica: un elemento `{ tractorId, rpm: 1800, factor: 3.5 }` supera el único filtro del consumidor (`Number.isFinite`, `speed.js:588`) y multiplica por 3.5 la velocidad corregida de ese tractor. `preferencias` tampoco se valida: `tema: "cualquier-cosa"` deja `data-theme` sin coincidir con ningún selector de `tokens.css` y la aplicación cae al tema claro sin explicación; `unidades: "cualquier-cosa"` se trata como métrico (`units.js:143`).
7. **Impacto:** Técnico: rompe la invariante que el propio módulo declara y la simetría formulario/importación que fija `tests/auditoria.test.js:86`. De negocio: un respaldo corrupto —o alterado por alguien— cambia en silencio la velocidad de trabajo, que es la entrada de la que dependen el volumen por hectárea, la dosis del tanque y el tiempo de inyección del gas. No hay rechazo, no hay aviso y el chip de procedencia sigue diciendo «factor medido en campo».
8. **Solución concreta:** reutilizar `validarColeccion`, que ya existe y ya produce el mensaje correcto:

```js
// assets/js/storage.js
const factores = validarColeccion(
  importado.factoresDesviacion, COTAS_FACTOR_DESVIACION, 'factoresDesviacion', rechazos
);
if (factores) nuevo.factoresDesviacion = factores;

if (importado.preferencias) {
  const p = importado.preferencias;
  if (['claro', 'oscuro', 'auto'].includes(p.tema)) nuevo.preferencias.tema = p.tema;
  else if (p.tema !== undefined) rechazos.push({ ruta: 'preferencias.tema', mensaje: `Tema desconocido (${p.tema}).` });
  if (SISTEMAS.includes(p.unidades)) nuevo.preferencias.unidades = p.unidades;
  else if (p.unidades !== undefined) rechazos.push({ ruta: 'preferencias.unidades', mensaje: `Sistema desconocido (${p.unidades}).` });
}
```

Requiere importar `COTAS_FACTOR_DESVIACION` (ya exportada) y `SISTEMAS` de `domain/units.js`. Para `bitacora` y `pruebasCaptura`, que son historial y no entran a ningún cálculo, basta con exigir `id` y `fecha` por elemento y rechazar el resto.

9. **Reproductor:** construible y **no ejecutado** (exige DOM para completar el ciclo por interfaz; el camino de datos está confirmado por lectura). Exportar la configuración, editar el JSON para dejar `exportado.factoresDesviacion = [{ id: "x", tractorId: "jd5715", rpm: 1800, factor: 3.5, fecha: "2026-01-01T00:00:00.000Z" }]`, importarlo y abrir `#/calibrar/avance` con la marcha A1 a 1800 rpm: la velocidad corregida sale 3.5 veces la teórica y el reporte de importación no lista ningún rechazo. Con el arreglo, la fila se rechaza con «Factor: debe estar entre …».

---

### F-004 — `aNumero` sustituye solo la primera coma: «1,000» se lee como 1

> **CORREGIDO.** `aNumero` quita el separador de miles cuando la coma no puede ser decimal, y devuelve `null` en la forma ambigua («2,000») en vez de adivinar. `crearCampoNumerico` añade el mensaje que dice cómo escribirlo. Cubierto por dos pruebas.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Bugs y lógica incorrecta / Edge cases (encoding y localización numérica)
4. **Ubicación:** `assets/js/ui/formato.js:67-73`; consumidores: todos los campos numéricos vía `assets/js/ui/campos.js:274`, `assets/js/ui/campos.js:289` y `assets/js/ui/campos.js:398`
5. **Evidencia:**

```js
// assets/js/ui/formato.js:67
export function aNumero(texto) {
  if (texto === null || texto === undefined) return null;
  const limpio = String(texto).trim().replace(/\s/g, '').replace(',', '.');
  if (limpio === '') return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}
```

6. **Problema:** `String.prototype.replace` con una cadena literal reemplaza **una sola** ocurrencia. La intención (documentada: «acepta coma decimal») es correcta para `2,5` → `2.5`, pero para el separador de MILES da un resultado válido y equivocado: `'1,000'` → `'1.000'` → `1`. No es un `NaN` que el llamador pueda rechazar: es un número plausible tres órdenes de magnitud abajo. Y el separador de miles con coma es justo lo que la aplicación imprime en pantalla: `formatear(1000)` con `Intl.NumberFormat('es-MX')` devuelve `«1,000»`, así que quien copie una cifra de la pantalla a un campo cae en esto. Con dos comas (`'1,234,5'`) sí sale `NaN` y se rechaza; con una sola, no.
7. **Impacto:** Técnico: entrada silenciosamente mal interpretada en cualquier campo con magnitud de cuatro cifras: volumen del tanque (`min 1, max 50000`), largo de tabla, dosis de etileno (`max 20000 g/ha`), volumen de agua objetivo (`max 30000 L/ha`). Todos los valores afectados quedan dentro de sus cotas, así que `validarValor` no los detecta. De negocio: un tanque de «2,000» L capturado como 2 L da 0.0035 ha por carga en vez de 3.5, y una dosis de etileno de «2,090» g/ha capturada como 2.09 g/ha deja el forzamiento en la milésima parte. Es el error de factor que la aplicación entera está diseñada para impedir.
8. **Solución concreta:** eliminar los separadores de miles antes de normalizar el decimal, y no aceptar entradas ambiguas:

```js
// assets/js/ui/formato.js
export function aNumero(texto) {
  if (texto === null || texto === undefined) return null;
  let limpio = String(texto).trim().replace(/\s/g, '');
  if (limpio === '') return null;
  // Coma de miles (grupos de tres) SOLO si hay punto decimal despues, o si
  // hay mas de una coma: en ambos casos la coma no es el separador decimal.
  if (limpio.includes('.') || (limpio.match(/,/g) ?? []).length > 1) {
    limpio = limpio.replace(/,/g, '');
  } else {
    limpio = limpio.replace(',', '.');
  }
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}
```

Queda un caso irreducible —«1,000» a secas puede ser mil o uno— que conviene resolver en la interfaz: el campo ya declara `inputmode="decimal"`, así que basta filtrar la coma de grupo al teclear, o rechazar el patrón `^\d{1,3}(,\d{3})+$` con el mensaje «escribe el número sin separador de miles». Ambas opciones son mejores que devolver 1.

9. **Reproductor:** **ejecutado**.

```
$ node --input-type=module -e "
import { aNumero } from './assets/js/ui/formato.js';
for (const t of ['2,5', '1,000', '2,000', '1,234.56', '1,234,5'])
  console.log(JSON.stringify(t), '->', aNumero(t));
"
"2,5" -> 2.5
"1,000" -> 1
"2,000" -> 2
"1,234.56" -> null
"1,234,5" -> null
```

Las dos líneas del medio son el defecto: un número plausible tres órdenes de magnitud abajo, dentro de cotas y sin aviso. Las dos últimas se rechazan con `null`, que es el comportamiento correcto aunque incómodo (una cifra copiada de pantalla con coma de miles y punto decimal no se acepta); con el arreglo propuesto, `"1,234.56"` pasa a valer 1234.56.

---

### F-005 — `iso.iso` no existe y `estiloBadgeIso(iso.hex)` va sin guarda: el paso de candidatas del asistente rompe

> **CORREGIDO.** `pasos.js` usa `iso.tamano` y elige chip de contorno cuando el color está pendiente. `estiloBadgeIso` devuelve `{}` con hex nulo, así que ninguna superficie futura puede tumbar una pantalla por un color de la Tabla 2 de la norma. Dos pruebas.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código y con reproductor ejecutado)
3. **Categoría:** Bugs y lógica incorrecta / Edge cases (dato ausente en la tabla)
4. **Ubicación:** `assets/js/ui/tabs/guia/pasos.js:396-399`; forma real del dato en `assets/js/data/iso-colors.js:32-89`; la función que lanza, en `assets/js/ui/color.js:9-16` y `assets/js/ui/color.js:43-48`
5. **Evidencia:**

```js
// assets/js/ui/tabs/guia/pasos.js:396
`${b.fabricante} ${b.modelo}`,
iso
  ? el('span', { clase: 'badge badge--iso', estilo: estiloBadgeIso(iso.hex) }, iso.iso)
  : null,
```

```js
// assets/js/data/iso-colors.js:73  — la fila del tamaño 20 no tiene color
{ tamano: '20', caudalLmin: 8.0, colorEs: null, colorEn: null, ral: null, hex: null, verificado: 'parcial', … }
// assets/js/ui/color.js:10
const limpio = hex.replace('#', '');
```

6. **Problema:** dos defectos en la misma expresión. (a) El campo de la tabla se llama `tamano`, no `iso`: `iso.iso` es `undefined`, y `el()` descarta los hijos `undefined` (`dom.js:30`), así que el chip se pinta con el color ISO y **sin texto**. (b) La fila del tamaño ISO `'20'` tiene `hex: null` a propósito y documentado —la Tabla 2 de la norma no está en la vista previa disponible—, pero aquí no se comprueba: `estiloBadgeIso(null)` lanza `TypeError: Cannot read properties of null (reading 'replace')`. El `try/catch` que envuelve `refrescar()` (`pasos.js:354-423`) lo atrapa y pinta «Faltan la velocidad, el espaciamiento o el objetivo para filtrar el catálogo», que es falso: los tres están capturados. Las otras cuatro superficies que pintan el mismo chip sí guardan (`boquillas.js:131`, `gasto.js:158`, `configuracion.js:1382`, `metodologia.js:576`), y esta última además usa `fila.tamano` correctamente.
7. **Impacto:** Técnico: en el paso «Elegir del catálogo» del asistente, el chip ISO sale en blanco siempre; y si alguna candidata declara tamaño ISO `'20'` —opción que el formulario de Configuración ofrece en su selector (`configuracion.js:1216`)—, el paso entero deja de listar candidatas y muestra un diagnóstico equivocado. De negocio: el código ISO es la marca física de la boquilla, el dato con el que se identifica la pieza en la barra. Un chip de color sin número obliga a adivinar; y un paso que dice «faltan datos» cuando no faltan manda a recapturar lo que ya está.
8. **Solución concreta:**

```js
// assets/js/ui/tabs/guia/pasos.js
iso?.hex
  ? el('span', { clase: 'badge badge--iso', estilo: estiloBadgeIso(iso.hex) }, iso.tamano)
  : iso
    ? el('span', { clase: 'badge badge--contorno' }, iso.tamano)
    : null,
```

Conviene además blindar el origen: hacer que `estiloBadgeIso` devuelva `{}` cuando el hex es nulo, para que ninguna superficie futura pueda tumbar una pantalla por un color pendiente.

```js
// assets/js/ui/color.js
export function estiloBadgeIso(hexFondo) {
  if (!hexFondo) return {};
  return { backgroundColor: hexFondo, color: textoSobreColor(hexFondo) };
}
```

9. **Reproductor:** **ejecutado**.

```
$ node --input-type=module -e "
import { filaIso } from './assets/js/data/iso-colors.js';
import { estiloBadgeIso } from './assets/js/ui/color.js';
console.log('filaIso(\"04\").iso   =', filaIso('04').iso, '| .tamano =', filaIso('04').tamano);
console.log('filaIso(\"20\").hex   =', filaIso('20').hex);
try { estiloBadgeIso(filaIso('20').hex); } catch (e) { console.log('estiloBadgeIso(null) LANZA:', e.constructor.name + ':', e.message); }
"
filaIso("04").iso   = undefined | .tamano = 04
filaIso("20").hex   = null
estiloBadgeIso(null) LANZA: TypeError: Cannot read properties of null (reading 'replace')
```

---

### F-006 — `cvPct` no existe: el coeficiente de variación del asistente sale siempre vacío

> **CORREGIDO.** `pasos.js` lee `cvPoblacionalPct`, y la cifra lleva la ayuda que la regla exige. La prueba de contrato fija las once claves de `estadisticaCaptura` y que `cvPct` no exista.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código y con reproductor ejecutado)
3. **Categoría:** Bugs y lógica incorrecta (contrato roto entre módulos)
4. **Ubicación:** `assets/js/ui/tabs/guia/pasos.js:540-547`; contrato del dominio en `assets/js/domain/capture.js:182-199`
5. **Evidencia:**

```js
// assets/js/ui/tabs/guia/pasos.js:540
nodos.push(
  pintarResultado({
    etiqueta: 'CV de la barra',
    valor: resultado.valores.cvPct,
    unidad: '%',
    decimales: 1,
  })
);
```

```js
// assets/js/domain/capture.js:186  — los nombres reales
cvPoblacionalPct,
cvMuestralPct,
```

6. **Problema:** `estadisticaCaptura` nunca devolvió `cvPct`. `formatear(undefined)` regresa el guion largo del estado neutro (`formato.js:23`), así que la cifra se pinta como `«— %»` sin que nada indique que es un error de nombre. La pestaña Prueba de captura y la Bitácora usan `cvPoblacionalPct` correctamente; solo el asistente falla.
7. **Impacto:** Técnico: la única cifra de dispersión del paso de aforo del asistente es inalcanzable. De negocio: el CV **es** el criterio de aceptación de un aforo —la propia ayuda de la pestaña Prueba de captura lo dice: «por norma se busca 5 % o menos, y arriba de 10 % hay boquillas que reponer»—. En el asistente, que es la puerta de entrada de la aplicación, la persona afora, ve la media y el volumen real, y el número que decide si la barra aplica pareja aparece en blanco. Se lee como «no se pudo medir», que es peor que no mostrarlo.
8. **Solución concreta:**

```js
// assets/js/ui/tabs/guia/pasos.js:543
valor: resultado.valores.cvPoblacionalPct,
```

Y añadir la `ayuda` que la regla dura del sistema de diseño exige (ver F-015), reusando el texto de `captura.js:422-425`.

9. **Reproductor:** **ejecutado**.

```
$ node --input-type=module -e "
import { estadisticaCaptura } from './assets/js/domain/capture.js';
const r = estadisticaCaptura({ volumenesMl: [500, 520, 495], tiempoS: 60, umbralAtipicasPct: 10 });
console.log('cvPct         =', r.valores.cvPct);
console.log('cvPoblacional =', r.valores.cvPoblacionalPct.toFixed(3));
console.log('claves reales:', Object.keys(r.valores).join(', '));
"
cvPct         = undefined
cvPoblacional = 2.139
claves reales: n, mediaLmin, dePoblacional, deMuestral, cvPoblacionalPct, cvMuestralPct, porBoquilla, atipicas, desgastePct, lhaRealMedido, comparacionObjetivoPct
```

---

### F-007 — La hoja del asistente calcula el agua por carga distinto que la pestaña Mezcla

> **CORREGIDO.** `guia.js` pasa `unidad: unidadProducto` a `mezclaTanque`. La prueba comprueba que omitirla NO es inocuo, para que la omisión no vuelva sin que nada la vea.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código y con reproductor ejecutado)
3. **Categoría:** Bugs y lógica incorrecta (dos rutas del mismo número que divergen)
4. **Ubicación:** `assets/js/ui/tabs/guia.js:578-585`; contraparte correcta en `assets/js/ui/tabs/mezcla.js:350-359`; comportamiento del dominio en `assets/js/domain/mix.js:107-130`
5. **Evidencia:**

```js
// assets/js/ui/tabs/guia.js:578  — sin `unidad` en la dosis
const resultado = mezclaTanque({
  volumenTanqueL: datos.volumenTanqueL,
  lhaAplicacion: datos.volumenAplicacionLha,
  dosis: Number.isFinite(datos.dosisCantidad)
    ? { modo: datos.modoDosis ?? 'por-ha', cantidad: datos.dosisCantidad }
    : null,
```

```js
// assets/js/domain/mix.js:107  — el default decide por el consumidor
const unidadLiquida = (dosis.unidad ?? 'L') === 'L';
aguaPorCarga = unidadLiquida ? volumenTanqueL - productoPorCarga : volumenTanqueL;
```

6. **Problema:** el asistente ya lee `unidadProducto` (`guia.js:586`) y lo usa para rotular la cifra, pero no lo pasa al dominio. Con un producto sólido en kg, `mix.js` toma el default `'L'`, resta la MASA del producto al volumen de agua y omite el aviso informativo `producto-solido` que explica por qué el agua es el tanque completo. La pestaña Mezcla sí pasa `unidad: unidadProducto` (`mezcla.js:353`) y da otro número para la misma captura.
7. **Impacto:** Técnico: dos implementaciones del mismo resultado que divergen —el patrón que las reglas del proyecto prohíben explícitamente y que el propio comentario de `domain/water.js:348` invoca («dos implementaciones del mismo número terminan divergiendo, y en esta aplicación divergir significa aplicar mal»)—. De negocio: el error numérico es pequeño (2.5 kg sobre 2000 L, unos 8.7 L, un 0.4 %), pero el asistente presenta esa cifra como el número de cierre con el que se sale al lote, y quien vaya después a la pestaña Mezcla verá otro. Perder la confianza en cuál de las dos manda cuesta más que los 8.7 L.
8. **Solución concreta:**

```js
// assets/js/ui/tabs/guia.js:581
dosis: Number.isFinite(datos.dosisCantidad)
  ? { modo: datos.modoDosis ?? 'por-ha', cantidad: datos.dosisCantidad, unidad: datos.unidadProducto ?? 'L' }
  : null,
```

Y una prueba de dominio que fije que `mezclaTanque` con `unidad: 'kg'` y sin `unidad` dan resultados distintos, para que la omisión no vuelva a pasar sin que nada la vea.

9. **Reproductor:** **ejecutado**.

```
$ node --input-type=module -e "
import { mezclaTanque } from './assets/js/domain/mix.js';
const base = { volumenTanqueL: 2000, lhaAplicacion: 575 };
const guia   = mezclaTanque({ ...base, dosis: { modo: 'por-ha', cantidad: 2.5 } });
const mezcla = mezclaTanque({ ...base, dosis: { modo: 'por-ha', cantidad: 2.5, unidad: 'kg' } });
console.log('guia  (sin unidad): aguaPorCarga =', guia.valores.aguaPorCarga.toFixed(3), 'L');
console.log('mezcla(unidad kg) : aguaPorCarga =', mezcla.valores.aguaPorCarga.toFixed(3), 'L');
console.log('aviso producto-solido en la guia:', guia.avisos.some((a) => a.codigo === 'producto-solido'));
"
guia  (sin unidad): aguaPorCarga = 1991.304 L
mezcla(unidad kg) : aguaPorCarga = 2000.000 L
aviso producto-solido en la guia: false
```

(Entradas: tanque 2000 L, 575 L/ha, dosis 2.5 por hectárea, unidad kg.)

---

### F-008 — «Restaurar TODO a defaults» borra la jornada, los borradores y los resultados sin decirlo

> **CORREGIDO.** El diálogo enumera lo que se pierde, incluidas las mediciones de desviación y la captura de la jornada, y dice que no se puede deshacer.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Bugs y lógica incorrecta / Calidad (documentación que contradice el código)
4. **Ubicación:** `assets/js/ui/tabs/configuracion.js:1475-1491`; lo que `sembrarEstado` devuelve en `assets/js/storage.js:50-85`
5. **Evidencia:**

```js
// assets/js/ui/tabs/configuracion.js:1477
const ok = await confirmar({
  titulo: 'Restaurar toda la aplicación',
  descripcion: 'Parámetros, tractores, barras, gases, rotámetros y catálogo vuelven a la siembra. La bitácora y las pruebas de captura NO se tocan. Exporta antes si tienes dudas.',
  …
});
if (!ok) return;
const actual = ctx.estado();
const semilla = sembrarEstado();
semilla.bitacora = actual.bitacora;
semilla.pruebasCaptura = actual.pruebasCaptura;
semilla.preferencias = actual.preferencias;
almacen.reemplazarEstado(semilla, 'contexto');
```

6. **Problema:** se conservan tres cosas (`bitacora`, `pruebasCaptura`, `preferencias`) y se descarta todo lo demás del estado, incluidas `jornada`, `borradores` y `resultados`: la calibración de hoy. El diálogo enumera lo que vuelve a la siembra y lo que no se toca, y la captura del día no aparece en ninguna de las dos listas. También se pierden `factoresDesviacion` (las mediciones de patinaje del rancho) sin mención, aunque ahí sí es coherente con «vuelven a la siembra» si se lee «tractores» en sentido amplio.
7. **Impacto:** Técnico: pérdida de datos sin consentimiento informado. De negocio: quien quiere devolver un umbral a su valor de fábrica pierde la velocidad, la presión, la boquilla, los volúmenes aforados y el objetivo de la jornada en curso, de pie en el lote, sin que el diálogo lo advirtiera y sin poder deshacer.
8. **Solución concreta:** decirlo en el diálogo y ofrecer conservar lo capturado, que es un cambio de dos líneas:

```js
descripcion:
  'Parámetros, tractores, barras, gases, rotámetros y catálogo vuelven a la siembra. ' +
  'Se borra también lo capturado en la calibración de hoy (velocidad, presión, boquilla, ' +
  'volúmenes y lo aforado) y las mediciones de desviación. La bitácora y las pruebas de ' +
  'captura guardadas NO se tocan. Exporta antes si tienes dudas.',
```

Y, si se prefiere conservarla, añadir `semilla.jornada = actual.jornada; semilla.borradores = actual.borradores; semilla.resultados = actual.resultados;` — la decisión es de producto, pero el diálogo tiene que corresponder al código en cualquiera de los dos casos.

9. **Reproductor:** construible y **no ejecutado** (exige DOM). Capturar una presión en `#/calibrar/gasto`, ir a `#/sistema/configuracion`, pulsar «Restaurar TODO a defaults», confirmar y volver a Gasto de agua: el campo de presión queda vacío pese a que el diálogo no lo anunció. Verificable sin navegador comparando `Object.keys(sembrarEstado())` contra las tres claves que el botón preserva.

---

### F-009 — El botón de compartir se queda mudo si el portapapeles rechaza

> **CORREGIDO.** `try/catch` alrededor de `clipboard.writeText`, devolviendo `sin-soporte` para que la rama de rescate —mostrar el enlace— se alcance de verdad; y el llamador de `main.js` va envuelto con su toast.

1. **Severidad:** MEDIO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Manejo de errores y excepciones / Edge cases
4. **Ubicación:** `assets/js/ui/compartir.js:53-67`; consumidor sin captura en `assets/js/main.js:451-475`
5. **Evidencia:**

```js
// assets/js/ui/compartir.js:53
export async function compartirUrl(url, titulo) {
  if (navigator.share) {
    try {
      await navigator.share({ url, title: titulo });
      return 'compartido';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelado';
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);   // <-- sin try/catch
    return 'copiado';
  }
  return 'sin-soporte';
}
```

```js
// assets/js/main.js:469  — el llamador tampoco captura
const resultado = await compartirUrl(url, 'Calibracion agricola MD2');
if (resultado === 'copiado') { … } else if (resultado === 'sin-soporte') { … }
```

6. **Problema:** `navigator.clipboard.writeText` rechaza en escenarios habituales: permiso denegado, documento sin foco, contexto no seguro, o Safari cuando el gesto de usuario ya se consumió en el `navigator.share` que acaba de fallar. Ese rechazo sube por `compartirUrl` y por el manejador `async` de `main.js` sin capturarse: queda una promesa rechazada sin manejar y el usuario no recibe nada —ni toast de éxito, ni toast de error, ni el enlace en pantalla—. La rama de rescate `'sin-soporte'`, que sí muestra el enlace en un toast de 12 s para copiarlo a mano, nunca se alcanza, porque `navigator.clipboard?.writeText` **existe**: lo que falla es la llamada, no la capacidad.
7. **Impacto:** Técnico: función de compartir sin ninguna señal de fallo, y la ruta de degradación que el código previó queda inalcanzable. De negocio: en el lote, con el teléfono en la mano, el botón de compartir «no hace nada» y no hay forma de saber si el enlace se copió; la calibración no se comparte y nadie se enteró.
8. **Solución concreta:**

```js
// assets/js/ui/compartir.js
if (navigator.clipboard?.writeText) {
  try {
    await navigator.clipboard.writeText(url);
    return 'copiado';
  } catch {
    // El portapapeles existe pero rechazo (permiso, foco, gesto consumido):
    // se cae a mostrar el enlace, que es lo que ya hacia 'sin-soporte'.
    return 'sin-soporte';
  }
}
return 'sin-soporte';
```

Y, como cinturón, envolver la llamada de `main.js:469` en `try/catch` con un toast destructivo, para que ningún fallo futuro de `compartirUrl` deje al botón sin respuesta.

9. **Reproductor:** construible y **no ejecutado** (exige navegador). En la consola de DevTools con la aplicación abierta: `navigator.clipboard.writeText = () => Promise.reject(new DOMException('denied','NotAllowedError'))` y, si existe, `delete navigator.share`; después pulsar el botón de compartir. Resultado observado esperado: `Uncaught (in promise) NotAllowedError` en consola y cero toasts. Con el arreglo, aparece el toast de 12 s con el enlace.

---

### F-010 — «Reinstalar desde cero» borra las cachés y los service workers de TODO el origen

> **CORREGIDO.** `reinstalar()` filtra las cachés por el prefijo `sprayboom-` y los registros por `scope`, el mismo alcance que ya usaba `sw.js` en su `activate`.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Bugs y lógica incorrecta / Configuración e infraestructura
4. **Ubicación:** `assets/js/ui/actualizar.js:200-213`; el criterio correcto, en el mismo repositorio, está en `sw.js:46-51`
5. **Evidencia:**

```js
// assets/js/ui/actualizar.js:201
if (conServiceWorker) {
  const registros = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registros.map((uno) => uno.unregister()));
  registro = null;
}
if ('caches' in self) {
  const nombres = await caches.keys();
  await Promise.all(nombres.map((nombre) => caches.delete(nombre)));
}
```

```js
// sw.js:46  — el mismo problema, resuelto con prefijo
nombres
  .filter((nombre) => nombre.startsWith('sprayboom-') && nombre !== NOMBRE_CACHE)
  .map((nombre) => caches.delete(nombre))
```

6. **Problema:** `caches.keys()` y `getRegistrations()` son de ORIGEN, no de aplicación. `sw.js` lo sabe y filtra por el prefijo `sprayboom-`; `reinstalar()` no filtra nada. En un sitio de proyecto de GitHub Pages (`usuario.github.io/sprayboom-calibrate`) el origen es `usuario.github.io`, compartido con todos los demás proyectos de esa cuenta que estén publicados en Pages.
7. **Impacto:** Técnico: el botón desregistra el service worker y borra el precache de cualquier otra aplicación instalada desde el mismo origen. De negocio: otra herramienta del mismo rancho publicada en el mismo `usuario.github.io` deja de funcionar sin conexión sin que nadie la haya tocado. Probabilidad baja (exige más de una PWA en el mismo origen) y reversible en cuanto esa otra aplicación se abra con señal, de ahí la severidad BAJO; pero el arreglo es de dos líneas y el criterio correcto ya está escrito a diez archivos de distancia.
8. **Solución concreta:**

```js
// assets/js/ui/actualizar.js — mismo alcance que sw.js
const PREFIJO_CACHE = 'sprayboom-';
const ALCANCE_SW = new URL('./', location.href).href;

if (conServiceWorker) {
  const registros = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registros.filter((r) => r.scope === ALCANCE_SW).map((r) => r.unregister()));
  registro = null;
}
if ('caches' in self) {
  const nombres = await caches.keys();
  await Promise.all(nombres.filter((n) => n.startsWith(PREFIJO_CACHE)).map((n) => caches.delete(n)));
}
```

9. **Reproductor:** construible y **no ejecutado** (exige navegador y dos PWA en el mismo origen). Con la aplicación abierta, en DevTools: `await caches.open('otra-app-v1')`, después pulsar «Reinstalar desde cero» y confirmar, y por último `await caches.keys()`: `otra-app-v1` ya no está. Con el arreglo, sobrevive.

---

### F-011 — Cualquier fallo al buscar actualización se reporta como «sin conexión»

> **CORREGIDO.** `buscarActualizacion` distingue con `navigator.onLine`: sin red devuelve `sin-conexion`, y cualquier otro fallo devuelve `error`, cuyo mensaje ya aconsejaba «Reinstalar desde cero».

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Manejo de errores y excepciones
4. **Ubicación:** `assets/js/ui/actualizar.js:154-160`; el mensaje que se muestra, en `assets/js/ui/tabs/configuracion.js:117`
5. **Evidencia:**

```js
// assets/js/ui/actualizar.js:154
buscandoAMano = true;
try {
  await registro.update();
} catch {
  buscandoAMano = false;
  return { estado: 'sin-conexion' };
}
```

```js
// assets/js/ui/tabs/configuracion.js:117
'sin-conexion': 'Sin conexión con el servidor. Conéctate a datos o wifi y vuelve a intentar.',
```

6. **Problema:** `ServiceWorkerRegistration.update()` rechaza por varias causas distintas: sin red, pero también si el servidor devuelve 404 o 5xx para `sw.js`, si el script nuevo no parsea, o si el navegador bloquea el registro. Todas se colapsan en el único diagnóstico «sin conexión», que además prescribe una acción («conéctate a datos o wifi») que no arregla ninguna de las otras.
7. **Impacto:** Técnico: se pierde la información de diagnóstico justo en el módulo que existe para ser la única salida cuando un teléfono se queda con la versión vieja. De negocio: con buena señal y un despliegue roto, la pantalla dice «conéctate a wifi»; quien está en el lote busca señal en vez de usar «Reinstalar desde cero», que es lo que sí resolvería. El propio módulo distingue bien los otros estados (`descargando`, `error`, `al-dia`, `sin-soporte`), así que la mezcla es la excepción, no el patrón.
8. **Solución concreta:** separar la ausencia de red del resto, que ya tiene un mensaje adecuado (`MENSAJES_ACTUALIZACION.error`):

```js
// assets/js/ui/actualizar.js
try {
  await registro.update();
} catch (error) {
  buscandoAMano = false;
  return navigator.onLine === false
    ? { estado: 'sin-conexion' }
    : { estado: 'error', detalle: String(error?.message ?? error) };
}
```

`configuracion.js` ya pinta `MENSAJES_ACTUALIZACION.error`, que dice «La descarga se interrumpió. Vuelve a intentar; si sigue igual, usa "Reinstalar desde cero"» — exactamente el consejo correcto.

9. **Reproductor:** construible y **no ejecutado** (exige navegador). Con la aplicación abierta y red activa, en DevTools: `const r = await navigator.serviceWorker.getRegistration(); r.update = () => Promise.reject(new TypeError('parse error'));` y pulsar «Buscar actualización». Resultado observado esperado: «Sin conexión con el servidor…» pese a estar en línea.

---

### F-012 — Cotas cruzadas ausentes: escala del rotámetro y régimen del tractor

> **CORREGIDO.** Dos validadores cruzados nuevos, aplicados en los DOS caminos: `validarRotametro` (escala mínima menor que la máxima) y el rango del motor dentro de `validarTractor`, más la comprobación en vivo en los formularios de Configuración.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Edge cases / Bugs
4. **Ubicación:** `assets/js/domain/defaults.js:392-396` y `assets/js/domain/defaults.js:253-260`; validación por campo sin cruce en `assets/js/ui/tabs/configuracion.js:1059-1080` y `assets/js/ui/tabs/configuracion.js:504-578`; importación sin `validadorExtra` en `assets/js/storage.js:596-600`
5. **Evidencia:**

```js
// assets/js/domain/defaults.js:392  — nada exige escalaMin < escalaMax
export const COTAS_ROTAMETRO = {
  escalaMin: { min: 0, max: 100, unidad: 'SCFM', magnitud: null, etiqueta: 'Escala mínima' },
  escalaMax: { min: 0, max: 100, unidad: 'SCFM', magnitud: null, etiqueta: 'Escala máxima' },
  resolucion: { min: 0.01, max: 5, unidad: 'SCFM', magnitud: null, etiqueta: 'Resolución legible' },
};
```

```js
// assets/js/storage.js:596  — sin validadorExtra, a diferencia de tractores, equipos y catalogo
const rotametros = validarColeccion(importado.rotametros, COTAS_ROTAMETRO, 'rotametros', rechazos);
```

6. **Problema:** el catálogo de boquillas sí valida el cruce (`validarBoquilla`, `storage.js:545-550`, y su gemelo en el formulario, `configuracion.js:1311`), pero el rotámetro y el tractor no. Se puede guardar `escalaMin: 4.5, escalaMax: 0.5` y `regimenMinimo: 2400, regimenMaximo: 1400`, tanto desde el formulario como por importación. Consecuencias: `tubo.js:166-179` sí detecta la escala inválida y pinta una alerta clara —bien—, pero `despejeScfm` (`flowmeter.js:239`) sigue comparando contra ella y emite un aviso «fuera de escala» que no significa nada; y con el régimen invertido, `validarRegimen` (`speed.js:562`) y `marchasParaVelocidad` (`speed.js:553`) marcan **todas** las marchas como fuera de rango, así que `nodosAvanceParaTiempo` y la tabla de marchas de Avance se quedan vacías con el mensaje «Ninguna marcha da esa velocidad», que atribuye a la transmisión un problema de captura.
7. **Impacto:** Técnico: estado guardado internamente inconsistente que produce avisos y listas engañosas en tres pantallas. De negocio: quien invirtió dos campos por error de dedo recibe «ninguna marcha sirve» en vez de «el régimen mínimo no puede ser mayor que el máximo», y busca el problema en el tractor.
8. **Solución concreta:** añadir los dos validadores cruzados y usarlos en los dos caminos, como ya se hace con la boquilla:

```js
// assets/js/storage.js
function validarRotametro(r) {
  if (!(r.escalaMin < r.escalaMax)) return 'La escala mínima debe ser menor que la máxima.';
  return null;
}
// y dentro de validarTractor, junto a la tabla de velocidades:
if (!(tractor.regimenMinimo <= tractor.regimenMaximo)) {
  return 'El régimen mínimo no puede ser mayor que el máximo.';
}
```

`validarColeccion(importado.rotametros, COTAS_ROTAMETRO, 'rotametros', rechazos, validarRotametro)`, y el mismo cruce al confirmar el campo en `configuracion.js`.

9. **Reproductor:** **ejecutado** (parte de dominio, sin DOM).

```
$ node --input-type=module -e "
import { validarValor } from './assets/js/domain/validate.js';
import { COTAS_ROTAMETRO, COTAS_TRACTOR } from './assets/js/domain/defaults.js';
console.log('escalaMin 4.5 ->', validarValor(COTAS_ROTAMETRO.escalaMin, 4.5).ok);
console.log('escalaMax 0.5 ->', validarValor(COTAS_ROTAMETRO.escalaMax, 0.5).ok);
console.log('regimenMinimo 2400 ->', validarValor(COTAS_TRACTOR.regimenMinimo, 2400).ok);
console.log('regimenMaximo 1400 ->', validarValor(COTAS_TRACTOR.regimenMaximo, 1400).ok);
"
escalaMin 4.5 -> true
escalaMax 0.5 -> true
regimenMinimo 2400 -> true
regimenMaximo 1400 -> true
```

Los cuatro se aceptan individualmente; nada comprueba la relación entre ellos.

---

### F-013 — Sin tractor en el estado, Avance y Gasto de agua mueren con TypeError

> **CORREGIDO.** `tarjetaSinContexto` en `render.js`, usada por Avance; Gasto de agua añade el tractor a su guarda. Es la mitigación estructural de E.4 en su forma mínima: un solo ayudante en vez de tres criterios.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Edge cases (primera ejecución sin estado / estado degradado)
4. **Ubicación:** `assets/js/ui/tabs/avance.js:60`, `assets/js/ui/tabs/avance.js:69` y `assets/js/ui/tabs/avance.js:117`; `assets/js/ui/tabs/gasto.js:858` y `assets/js/ui/tabs/gasto.js:912-917`; el patrón correcto está en `assets/js/ui/tabs/forzamiento.js:56-78`
5. **Evidencia:**

```js
// assets/js/ui/tabs/avance.js:60
const tractor = ctx.tractorActivo();
…
borrador.marcha.tractorId === tractor.id           // línea 69
estilo: { '--marchas-por-rango': String(tractor.marchasPorRango) },   // línea 117
```

```js
// assets/js/ui/tabs/gasto.js:858  — solo se guarda contra la falta de BARRA
if (!equipo) {
  nodos.push(el('p', { clase: 'texto-suave' }, 'Sin barra de aplicación configurada.'));
} else {
  …
  kmhNominalMarcha: calibrarMarcha({ …, regimenNominal: tractor.regimenNominal }),   // línea 915
```

```js
// assets/js/ui/tabs/forzamiento.js:56  — la cortesía que falta en las otras dos
if (!gas || !rotametro) { … alerta clara … return; }
```

6. **Problema:** `ctx.tractorActivo()` devuelve `undefined` si `estado.tractores` está vacío (`main.js:118-121`). La interfaz impide llegar ahí —«Debe quedar al menos un tractor», `configuracion.js:700`— y la importación no reemplaza la colección si queda vacía tras validar (`storage.js:581`), pero el estado guardado puede llegar vacío por edición manual del `localStorage`, por una restauración parcial o por un respaldo de una versión futura. `pasos.js:113-118` sí usa `tractor?.marchasPorRango ?? 3` y `tractor ? marchasDeTractor(tractor) : []`; `avance.js` y `gasto.js` no. En Avance el `TypeError` se lanza durante el `render`, así que lo atrapa `main.js:390` y la pestaña completa se sustituye por «Esta pantalla no pudo pintarse: Cannot read properties of undefined (reading 'id')». En Gasto de agua lo atrapa el `try/catch` de `recalcularBomba` y se pinta el mismo texto interno dentro de una alerta.
7. **Impacto:** Técnico: dos pestañas inutilizables con un mensaje de motor JavaScript en vez de una instrucción. De negocio: probabilidad baja, pero el mensaje no dice qué hacer y quien lo vea no tiene forma de recuperarse desde la propia aplicación (la salida está en Configuración, que sí sigue funcionando). El coste del arreglo es una guarda.
8. **Solución concreta:** copiar el patrón de `forzamiento.js` al principio de `render` en las dos pestañas:

```js
// assets/js/ui/tabs/avance.js, tras `const tractor = ctx.tractorActivo();`
if (!tractor) {
  panel.append(
    tarjeta(
      { titulo: 'Avance', descripcion: 'El cálculo necesita un tractor activo.' },
      el('div', { clase: 'alerta alerta--destructiva', role: 'alert' },
        el('p', { clase: 'alerta__descripcion' },
          'No hay ningún tractor configurado. Agrégalo en Sistema, Configuración para calcular la velocidad.'))
    )
  );
  return;
}
```

Y en `gasto.js::recalcularBomba`, sumar `|| !tractor` a la guarda de la línea 858 con el texto correspondiente.

9. **Reproductor:** construible y **no ejecutado** (exige navegador). En DevTools, con la aplicación abierta: `const e = JSON.parse(localStorage.getItem('sprayboom.v1')); e.tractores = []; localStorage.setItem('sprayboom.v1', JSON.stringify(e));` y recargar en `#/calibrar/avance`. Resultado observado esperado: la alerta «Esta pantalla no pudo pintarse» con el texto del `TypeError`. (No se ejecuta también porque escribe datos del usuario.)

---

### F-014 — El asistente pinta hectáreas, gramos y mililitros sin convertir al sistema activo

> **CORREGIDO.** La hoja y el paso de aforo del asistente convierten con `aSistema` y `unidad(...)`, y el campo de volúmenes declara `magnitud: volumenChico` y `sistema`, como la pestaña Prueba de captura.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Bugs y lógica incorrecta / Calidad (inconsistencia entre superficies)
4. **Ubicación:** `assets/js/ui/tabs/guia.js:603-607`, `assets/js/ui/tabs/guia.js:590-596`, `assets/js/ui/tabs/guia.js:662-668`; `assets/js/ui/tabs/guia/pasos.js:466-476`; contrapartes correctas en `assets/js/ui/tabs/mezcla.js:366`, `assets/js/ui/tabs/forzamiento.js:430-437` y `assets/js/ui/tabs/captura.js:222-235`
5. **Evidencia:**

```js
// assets/js/ui/tabs/guia.js:603  — valor y unidad en metrico, fijos
pintarResultado({
  etiqueta: 'Hectáreas por carga',
  valor: resultado.valores.hectareasPorCarga,
  unidad: 'ha',
  decimales: 2,
}),
```

```js
// assets/js/ui/tabs/mezcla.js:366  — la misma cifra, convertida
pintarResultado({
  etiqueta: 'Superficie por carga',
  valor: aSistema('superficie', resultado.valores.hectareasPorCarga, sistema),
  unidad: unidadSuperficie,
  …
```

```js
// assets/js/ui/tabs/guia/pasos.js:467  — el aforo del asistente pide mL siempre
crearCampoNumerico({ etiqueta: `Boquilla ${i + 1}`, unidad: 'mL', valorInicial: valor, … })
```

6. **Problema:** con el sistema imperial activo, la hoja de resultado del asistente muestra hectáreas y gramos mientras el resto de la aplicación muestra acres y onzas, y el paso de aforo pide mililitros mientras la pestaña Prueba de captura pide onzas fluidas (`captura.js:227-231`, que declara `magnitud: 'volumenChico'` y `sistema`). No hay corrupción de datos: el asistente rotula honestamente `mL` y el valor se guarda en base métrica, que es lo que el dominio espera; y la equivalencia de `.alterna` bajo cada cifra amortigua la lectura. Pero el sistema de unidades es «uno solo y vive en Sistema, Configuración» por regla del proyecto, y aquí no se respeta.
7. **Impacto:** Técnico: cuatro cifras y un campo de captura fuera del contrato de unidades del proyecto. De negocio: un rancho que trabaja en imperial recibe del asistente —la puerta de entrada— números en unidades que no eligió, y en el aforo tiene que convertir de onzas a mililitros a mano: el trabajo que la aplicación existe para eliminar.
8. **Solución concreta:** aplicar el patrón que ya usan las pestañas equivalentes:

```js
// assets/js/ui/tabs/guia.js
pintarResultado({
  etiqueta: 'Superficie por carga',
  valor: aSistema('superficie', resultado.valores.hectareasPorCarga, sistema),
  unidad: unidad('superficie', sistema),
  decimales: 2,
}),
// y para la masa de etileno:
valor: aSistema('masa', resultado.valores.masaPorTablaG, sistema),
unidad: unidad('masa', sistema),
```

```js
// assets/js/ui/tabs/guia/pasos.js — el campo del aforo declara su magnitud
crearCampoNumerico({
  etiqueta: `Boquilla ${i + 1}`,
  magnitud: 'volumenChico',
  sistema,
  valorInicial: aCampo('volumenChico', valor),
  alCambiar: (nuevo) => { volumenes[i] = deSistema('volumenChico', nuevo, sistema); … },
})
```

9. **Reproductor:** construible y **no ejecutado** (exige navegador). Poner el sistema en imperial en `#/sistema/configuracion`, elegir el objetivo «Preparar la mezcla», llegar a la hoja de resultado y comparar «Hectáreas por carga (ha)» con «Superficie por carga (acre)» de `#/calibrar/mezcla`: misma cantidad, dos unidades.

---

### F-015 — Diecisiete cifras se pintan sin su `ayuda`, contra una regla dura del sistema de diseño

> **CORREGIDO.** Las 17 ayudas escritas, y la compuerta `tools/verificar-diseno.mjs` en el job `estatico`: 103 de 103 cifras. Reutilizan los textos que ya existían para la misma cifra en su pestaña.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código, conteo automatizado)
3. **Categoría:** Calidad (regla declarada del proyecto sin cumplir y sin compuerta)
4. **Ubicación:** `assets/js/ui/marchas.js:53` y `:60`; `assets/js/ui/tabs/guia/pasos.js:214`, `:224`, `:358`, `:529`, `:541`, `:577`; `assets/js/ui/tabs/guia.js:500`, `:515`, `:521`, `:535`, `:590`, `:603`, `:610`, `:662`, `:673`. Regla en `.claude/rules/design-system.md`, sección «Ayuda de un resultado (el `?` de la cifra)» y lista «Qué evitar»
5. **Evidencia:**

```
$ node -e "…recuento con conteo de llaves balanceadas sobre cada pintarResultado({…})…"
pintarResultado con ayuda: 86  sin ayuda: 18
assets/js/ui/marchas.js:53  'Velocidad de avance'
assets/js/ui/tabs/guia/pasos.js:541  'CV de la barra'
assets/js/ui/tabs/guia.js:521  'Diferencia contra el objetivo'
…
```

(De los 18, uno es la definición de la propia función en `render.js:123`; los 17 restantes son llamadas reales.)

```
# .claude/rules/design-system.md, «Qué evitar»
- Pintar una cifra sin decir qué es: todo `pintarResultado` lleva su «ayuda», y una etiqueta
  como «CV de la barra» o «factor requerido» no se explica sola.
```

6. **Problema:** la regla es dura y el propio documento usa «CV de la barra» como el ejemplo de etiqueta que no se explica sola. Las 17 omisiones están concentradas en el asistente (`guia.js` y `guia/pasos.js`, 15 de 17) y en `marchas.js` (2), es decir en las superficies más nuevas; las once pestañas maduras cumplen (86 de 86 en el resto del código). Ninguna compuerta de CI verifica esta regla, a diferencia de `innerHTML`, el contraste, el precache y la ortografía.
7. **Impacto:** Técnico: deriva del sistema de diseño en las superficies nuevas, sin nada que la frene. De negocio: en el asistente —el camino por defecto y el que usa quien no conoce la aplicación— las cifras salen sin decir qué son ni con qué compararlas, que es exactamente el problema que el patrón del `?` vino a resolver.
8. **Solución concreta:** completar las 17 `ayuda` reutilizando los textos que ya existen para la misma cifra en su pestaña (por ejemplo `captura.js:422-425` para «CV de la barra», `mezcla.js:370-372` para «Superficie por carga»), y añadir la compuerta que falta al job `estatico` de `ci.yml`, con el mismo recuento de llaves balanceadas del reproductor:

```yaml
- name: Toda cifra pintada lleva su ayuda (regla del sistema de diseno)
  run: node tools/verificar-ayudas.mjs
```

9. **Reproductor:** **ejecutado** — el recuento de la sección Evidencia, sobre los 12 archivos que llaman a `pintarResultado`.

---

### F-016 — CI instala Playwright sin pin ni lockfile, y usa acciones ancladas a tag mayor

> **CORREGIDO PARCIALMENTE.** **Parcial.** Playwright pinneado a `1.62.1` —verificado contra el registro— con `--ignore-scripts`. El anclaje por SHA de las seis acciones NO se hizo: resolver un SHA exige leer repositorios de terceros y el acceso a GitHub de esta sesión está limitado a este repositorio. Inventar un SHA pondría CI en rojo. Es un cambio de seis líneas (`- uses: actions/checkout@<sha40>  # v4.2.2`) que necesita una persona con acceso.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Dependencias y supply chain / Configuración e infraestructura
4. **Ubicación:** `.github/workflows/ci.yml:90-91`; acciones en `.github/workflows/ci.yml:25-26`, `:38-39`, `:86-87` y `.github/workflows/pages.yml:35-43`, `:56`, `:61`; ausencia de lockfile confirmada en `package.json`
5. **Evidencia:**

```yaml
# .github/workflows/ci.yml:90
- name: Instalar la libreria de playwright (sin descargar navegadores)
  run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save playwright
```

```yaml
# .github/workflows/ci.yml:25
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
```

6. **Problema:** `npm install --no-save playwright` resuelve a la última versión publicada en cada corrida, sin rango declarado, sin lockfile y sin verificación de integridad reproducible. Una versión comprometida de `playwright` o de cualquiera de sus dependencias transitivas ejecutaría código arbitrario en el runner. Las acciones están ancladas a tag mayor (`@v4`, `@v5`, `@v3`) y no a SHA, así que el contenido de esos tags puede cambiar sin que el repositorio lo advierta. Atenuante importante y verificado: `ci.yml` declara su propio `permissions: contents: read` a nivel de flujo, lo que **acota** los permisos incluso cuando `pages.yml` lo invoca con `pages: write` e `id-token: write`; el job `humo` no ve secretos ni el token de despliegue. Eso es lo que mantiene la severidad en BAJO y no más arriba.
7. **Impacto:** Técnico: el resultado de la compuerta de humo e interacción no es reproducible entre corridas (una versión nueva de Playwright puede romper o silenciar aserciones sin que nadie cambie el repositorio), y hay una superficie de ejecución de código en CI que no está pinneada. De negocio: una compuerta que se rompe sola cuesta confianza; una que se silencia sola cuesta más.
8. **Solución concreta:** pinnear la versión exacta y anclar las acciones por SHA:

```yaml
- name: Instalar la libreria de playwright (sin descargar navegadores)
  run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save --ignore-scripts playwright@1.56.1
```

(`--ignore-scripts` quita además los scripts de post-instalación, que aquí no hacen falta porque el navegador ya está en el runner.) Y `- uses: actions/checkout@<sha40>  # v4.2.2` para las seis acciones. Una alternativa más limpia a medio plazo: declarar `playwright` como `devDependency` con lockfile commiteado y usar `npm ci`.

9. **Reproductor:** no construible sin ejecutar CI ni red; el defecto es de configuración y se verifica leyendo los dos flujos. **No ejecutado.**

---

### F-017 — El despliegue publica los archivos de desarrollo del repositorio

> **CORREGIDO.** `tools/empaquetar-sitio.mjs` copia a `_sitio/` exactamente lo que declara `precache.js` —una sola fuente de verdad— y falla si una ruta listada no existe. Comprobado: 76 archivos, sin `tests/`, `tools/`, `docs/`, `.claude/` ni `package.json`.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código y contra el comportamiento documentado de la acción)
3. **Categoría:** Configuración e infraestructura
4. **Ubicación:** `.github/workflows/pages.yml:55-58`; `.nojekyll` en la raíz
5. **Evidencia:**

```yaml
# .github/workflows/pages.yml:55
- name: Empaquetar la raíz del repositorio
  uses: actions/upload-pages-artifact@v3
  with:
    path: .
```

6. **Problema:** `upload-pages-artifact` empaqueta el directorio completo excluyendo solo `.git` y `.github`. Todo lo demás queda servido en el sitio: `.claude/settings.json` y `.claude/rules/*.md`, `CLAUDE.md`, `docs/`, `tests/` (18 archivos), `tools/` (7 herramientas de desarrollo, incluida `acentuar.mjs`), `package.json` y `README.md`. Con `.nojekyll` presente, los directorios que empiezan por punto también se sirven. No hay secretos en ninguno de esos archivos —lo verifiqué en el barrido de la Sección B.3—, así que la exposición es de material de desarrollo, no de credenciales.
7. **Impacto:** Técnico: superficie publicada mayor que la necesaria y peso extra en cada despliegue. De negocio: bajo bajo la asunción declarada de repositorio público (nada nuevo queda visible). Si el repositorio pasara a privado conservando Pages público, publicaría las reglas internas del proyecto, la batería de pruebas y las herramientas sin que nadie lo hubiera decidido.
8. **Solución concreta:** empaquetar solo lo que el sitio necesita, que es exactamente lo que `precache.js` ya enumera. La vía más simple sin reorganizar el repositorio es preparar un directorio de publicación:

```yaml
- name: Preparar el sitio (solo lo que se sirve)
  run: |
    mkdir -p _sitio
    cp -r assets index.html 404.html componentes.html manifest.webmanifest \
          precache.js version.js sw.js .nojekyll _sitio/
- name: Empaquetar el sitio
  uses: actions/upload-pages-artifact@v3
  with:
    path: ./_sitio
```

El sellado de la versión debe correr antes de la copia, y conviene una comprobación de que la lista de `precache.js` y el contenido de `_sitio` coinciden, para que no se publique una ruta precacheada que no existe.

9. **Reproductor:** construible y **no ejecutado** (requiere red). Sobre el sitio publicado: `curl -sI https://<usuario>.github.io/sprayboom-calibrate/tools/acentuar.mjs` y `curl -sI …/.claude/rules/design-system.md` devuelven 200. Verificable en local sin red inspeccionando el tar que produce la acción.

---

### F-018 — El hook `SessionStart` es un vector de instrucción al agente que ejecuta el repositorio

> **CORREGIDO.** La compuerta de `verificar-diseno.mjs` comprueba que el `command` del hook `SessionStart` siga siendo un `echo` literal.

1. **Severidad:** BAJO
2. **Confianza:** media (mecanismo confirmado en código; que se considere defecto y no comportamiento aceptado de la herramienta es inferencia)
3. **Categoría:** Seguridad / Configuración e infraestructura
4. **Ubicación:** `.claude/settings.json:3-13`
5. **Evidencia:**

```json
"hooks": {
  "SessionStart": [
    { "hooks": [ { "type": "command",
      "command": "echo 'Si el límite de uso ya está agotado, revisa /usage para conocer la hora exacta de reinicio y programa un recordatorio único (no recurrente) para esa hora que continúe con el trabajo pendiente.'" } ] }
  ]
}
```

6. **Problema:** el hook está commiteado en el repositorio y su salida se inyecta como instrucción al agente al arrancar cada sesión. El contenido actual es inofensivo y de conveniencia. Pero el campo es un `command` de shell que corre en la máquina de quien abra el repositorio, y vive en un archivo que cualquier pull request puede modificar: un cambio de una línea convierte un `echo` en cualquier otra cosa, y el mismo canal permite dirigir al agente («ignora lo anterior y…»). No hay compuerta de CI que vigile `.claude/settings.json`, ni prueba que fije su contenido.
7. **Impacto:** Técnico: ejecución de comandos y control del contexto del agente desde un archivo del repositorio. De negocio: en un proyecto donde la entrega se hace por pull request revisado por una persona (regla dura de `entrega.md`), este archivo es el punto donde un cambio de una línea pasa desapercibido con más facilidad que un cambio en una fórmula de dominio, porque no lo cubre ninguna compuerta.
8. **Solución concreta:** dos medidas, ninguna cara. (a) Sacar el texto del `command` a un archivo versionado con contenido fijo (`echo` de un archivo, no de un literal) y añadir la ruta a `CODEOWNERS` para forzar revisión explícita de quien mantiene la configuración del agente. (b) Añadir al job `estatico` una compuerta que verifique que el `command` del hook coincide con un valor esperado:

```yaml
- name: El hook de sesion no cambio sin revision
  run: |
    node --input-type=module -e "
      import { readFileSync } from 'node:fs';
      const s = JSON.parse(readFileSync('.claude/settings.json','utf8'));
      const cmd = s.hooks.SessionStart[0].hooks[0].command;
      if (!/^echo '[^']*'$/.test(cmd)) { console.error('El hook SessionStart dejo de ser un echo literal.'); process.exit(1); }
    "
```

9. **Reproductor:** no se construye por diseño: exigiría alterar el hook, es decir escribir en el repositorio. **No ejecutado.** El mecanismo está confirmado por lectura de `.claude/settings.json` y por la propia salida del hook, visible al arrancar esta sesión.

---

### F-019 — Color escrito a mano en el cronómetro

> **CORREGIDO.** El estado vive en `components.css` (`.cronometro__pantalla[data-cumplido="true"]`) y `cronometro.js` solo marca el atributo. La compuerta impide que vuelva.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código; es la única ocurrencia del repositorio)
3. **Categoría:** Calidad (regla declarada del proyecto sin cumplir)
4. **Ubicación:** `assets/js/ui/cronometro.js:59` (y su limpieza en `:97`)
5. **Evidencia:**

```js
// assets/js/ui/cronometro.js:56
if (modo === 'regresivo' && duracionS !== null && v <= 0 && !termino) {
  termino = true;
  detener();
  pantalla.style.color = 'hsl(var(--warning))';
```

```
# .claude/rules/design-system.md, «Qué evitar»
- Colores, radios o tamaños escritos a mano en un componente en vez de tokens.
```

6. **Problema:** el color de un estado se escribe en línea desde el consumidor, en vez de declararse como estado en `components.css`. El token es el correcto (`--warning`), así que no hay problema de contraste ni de tema; el problema es de ubicación: el estado «tiempo cumplido» del cronómetro no existe en el CSS, así que no se puede cambiar, no aparece en `componentes.html` y la compuerta de contraste no lo ve como par. Es la ÚNICA ocurrencia en todo el repositorio (el barrido de colores literales en JS devuelve solo esta línea), lo que confirma que el proyecto cumple la regla en todo lo demás.
7. **Impacto:** Técnico: un estado visual fuera del sistema de diseño. De negocio: nulo hoy; la deuda es que el siguiente ajuste de la paleta se olvidará de este color.
8. **Solución concreta:** mover el estado al CSS y alternar un atributo, como hace el resto del sistema:

```js
// assets/js/ui/cronometro.js
pantalla.dataset.cumplido = 'true';     // en lugar de pantalla.style.color = …
// y en reiniciar():
delete pantalla.dataset.cumplido;       // en lugar de pantalla.style.color = ''
```

```css
/* assets/css/components.css */
.cronometro__pantalla[data-cumplido='true'] { color: hsl(var(--warning)); }
```

El par `['warning', 'card']` ya está en `PARES` de `verificar-contraste.mjs:70`, así que la compuerta lo cubre sin cambios.

9. **Reproductor:** **ejecutado** (barrido).

```
$ grep -rnE "(color|background|border) *[:=] *['\`](#|rgb|hsl)" --include='*.js' assets/js
assets/js/ui/cronometro.js:59:      pantalla.style.color = 'hsl(var(--warning))';
```

---

### F-020 — Los fallbacks de `--touch-floor` son inalcanzables y están en `rem`

> **CORREGIDO.** Los seis fallbacks en `rem` quitados; queda `var(--touch-floor)`, que dice la verdad (el token siempre está declarado).

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Calidad (código muerto + regla declarada del proyecto sin cumplir)
4. **Ubicación:** `assets/css/components.css:700`, `:965`, `:1100`, `:1133`, `:1279`, `:1426`, `:1877`; el token, declarado siempre, en `assets/css/tokens.css:204` y `assets/css/tokens.css:374`
5. **Evidencia:**

```css
/* assets/css/tokens.css:204 — el token SIEMPRE tiene valor */
  --touch-floor: 0px;
```

```css
/* assets/css/components.css:965 y 1426 — dos fallbacks distintos que nunca se usan */
  min-height: var(--touch-floor, 2.5rem);   /* .tabs__disparador */
  min-height: var(--touch-floor, 3.15rem);  /* .nav-inferior__boton */
```

6. **Problema:** el fallback de `var()` solo entra cuando la variable **no está declarada**. `:root` declara `--touch-floor: 0px` y el bloque táctil lo sube a `48px`, así que los siete fallbacks son inalcanzables. Además están en `rem` (2.5rem = 35px y 3.15rem = 44.1px con la raíz de 14px), contra la regla dura del proyecto: «Medidas físicas en `rem` (la raíz mide 14px, no 16px)» figura en la lista de «Qué evitar», y el propio `design-system.md` explica que un `rem` no mide aquí lo mismo que en Sherman. Dos valores distintos para el mismo concepto añaden ruido: quien lea `2.5rem` creerá que en escritorio esos controles miden 35px, cuando miden 0.
7. **Impacto:** Técnico: siete valores muertos que documentan mal el comportamiento real. De negocio: nulo en pantalla; el coste es de mantenimiento y de confianza en lo que el CSS dice.
8. **Solución concreta:** quitar los fallbacks, que es lo que hace ya el bloque canónico del sistema (`components.css:149` y `:156` usan `var(--touch-floor, 0px)`, coherente con el valor declarado):

```css
  min-height: var(--touch-floor);
```

Si se prefiere conservar un fallback defensivo, que sea `0px` en los siete sitios, para que diga la verdad.

9. **Reproductor:** **ejecutado** (barrido).

```
$ grep -nE "touch-floor" assets/css/tokens.css assets/css/components.css | grep -E "touch-floor:|touch-floor, [0-9]"
assets/css/tokens.css:204:  --touch-floor: 0px;
assets/css/tokens.css:374:    --touch-floor: 48px;
assets/css/components.css:700:  min-height: var(--touch-floor, 2.5rem);
assets/css/components.css:1426:  min-height: var(--touch-floor, 3.15rem);
…
```

---

### F-021 — `import.meta.url.pathname` rompe las herramientas si la ruta del repositorio lleva espacios

> **CORREGIDO.** `fileURLToPath` en las seis herramientas que usaban `.pathname`.

1. **Severidad:** BAJO
2. **Confianza:** media (mecanismo de percent-encoding de `URL.pathname` confirmado; no se probó sobre una ruta con espacios porque exigiría copiar el repositorio)
3. **Categoría:** Configuración e infraestructura
4. **Ubicación:** `tools/generar-precache.mjs:17` y `:55`; `tools/sellar-version.mjs:41` y `:57`; `tools/generar-iconos.mjs:19`; `tools/humo.mjs:13`
5. **Evidencia:**

```js
// tools/generar-precache.mjs:17
const raiz = new URL('..', import.meta.url).pathname;
…
writeFileSync(`${raiz}precache.js`, contenido);
```

6. **Problema:** `URL.pathname` devuelve la ruta **percent-encoded**: en `/home/mi rancho/sprayboom` sale `/home/mi%20rancho/sprayboom/`, y `writeFileSync` intenta crear un directorio literal `mi%20rancho`. La forma correcta es `fileURLToPath` de `node:url`, que las mismas herramientas ya evitan en otros sitios: `verificar-contraste.mjs:16` y `generar-iconos.mjs:7` pasan el objeto `URL` directamente a `readFileSync`, que sí lo decodifica. El único que además interpola en una plantilla de shell es `generar-precache.mjs`, pero ahí `raiz` va como opción `cwd` (no al shell), así que no hay inyección: solo un `cwd` inexistente.
7. **Impacto:** Técnico: `generar-precache.mjs`, `sellar-version.mjs` y `generar-iconos.mjs` fallan, y `humo.mjs` sirve 404 para todo, si el repositorio se clona en una ruta con espacios o con caracteres que se percent-encodean (acentos, `#`, `?`). En CI la ruta del runner es limpia, así que no se manifiesta ahí. De negocio: bajo, pero `sellar-version.mjs` es parte del despliegue y el modo de fallo es confuso —una ruta con `%20` en el mensaje de error—.
8. **Solución concreta:** usar `fileURLToPath` en los cuatro archivos:

```js
import { fileURLToPath } from 'node:url';
const raiz = fileURLToPath(new URL('..', import.meta.url));   // ya trae la barra final
```

Y en `generar-iconos.mjs:19`, `path: fileURLToPath(new URL(\`../assets/icons/icon-${tamano}.png\`, import.meta.url))`.

9. **Reproductor:** construible y **no ejecutado** (exige copiar el repositorio a otra ruta, es decir escribir archivos). El mecanismo se comprueba sin tocar nada:

```
$ node -e "console.log(new URL('..','file:///home/mi%20rancho/x/tools/t.mjs').pathname)"
/home/mi%20rancho/x/
```

---

### F-022 — Los mensajes internos de error se muestran verbatim al usuario

> **CORREGIDO.** `ErrorDeDominio` en `validate.js`, lanzado por las tres guardas y por los seis errores de dominio con mensaje redactado. `alertaDeError` en `render.js` distingue el dato que falta del defecto de la aplicación, y sustituye las nueve copias idénticas que había.

1. **Severidad:** BAJO
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Manejo de errores y excepciones
4. **Ubicación:** `assets/js/main.js:390-399`; y el mismo patrón en `assets/js/ui/tabs/gasto.js:104-110`, `mezcla.js:61-67`, `gas.js:71-77`, `forzamiento.js:93-99`, `captura.js:555-562`, `avance.js:497-504`, `boquillas.js:442-449`, `configuracion.js:264-267`, `configuracion.js:308-310`, `configuracion.js:999-1001`, `bitacora.js:682-692`
5. **Evidencia:**

```js
// assets/js/main.js:390
} catch (error) {
  panel.append(
    el('div', { clase: 'alerta alerta--destructiva', role: 'alert' },
      el('p', { clase: 'alerta__titulo' }, 'Esta pantalla no pudo pintarse'),
      el('p', { clase: 'alerta__descripcion' }, String(error?.message ?? error))
    )
  );
}
```

6. **Problema:** el patrón es deliberado y en su mayor parte correcto: las funciones de dominio lanzan con mensajes redactados para quien calibra («No se puede calcular: la velocidad debe ser mayor que cero», `validate.js:51-72`), y mostrarlos es lo adecuado. El problema es que el mismo canal muestra los errores que NO son de dominio: un `TypeError` llega a la pantalla como «Cannot read properties of null (reading 'replace')» (F-005) o «Cannot read properties of undefined (reading 'id')» (F-013). No hay riesgo de exposición de datos —no hay servidor, ni rutas, ni pilas de llamada—, pero se pierde la distinción entre «te falta un dato» y «la aplicación tiene un defecto», que son dos acciones distintas para el usuario.
7. **Impacto:** Técnico: los defectos internos se disfrazan de errores de captura y no se distinguen al reportarlos. De negocio: quien vea un mensaje en inglés sobre propiedades de `null` en medio de una pantalla en español no sabrá si el problema es suyo o de la aplicación, y probablemente recapture datos que ya estaban bien.
8. **Solución concreta:** marcar los errores de dominio y tratar distinto los demás. `validate.js` ya centraliza los tres lanzadores, así que basta una subclase:

```js
// assets/js/domain/validate.js
export class ErrorDeDominio extends Error {}
export function requiereFinito(nombre, valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorDeDominio(`No se puede calcular: ${nombre} debe ser un número.`);
  }
  return valor;
}
```

```js
// en cada alertaDestructiva y en main.js
const texto = error instanceof ErrorDeDominio
  ? String(error.message)
  : 'La aplicación falló al calcular esto. No es un dato que falte: repórtalo. ' +
    `Detalle técnico: ${String(error?.message ?? error)}`;
```

Así el mensaje de dominio se conserva íntegro y el defecto interno queda etiquetado como tal, con el detalle disponible para reportarlo.

9. **Reproductor:** **ejecutado** parcialmente — el reproductor de F-005 muestra el `TypeError` que llega a este canal:

```
estiloBadgeIso(null) LANZA: TypeError: Cannot read properties of null (reading 'replace')
```

El texto exacto en pantalla se comprueba con el reproductor en navegador de F-013 (**no ejecutado**: escribe datos del usuario).

---

### F-023 — Layout escrito en línea en unos sesenta sitios, contra la regla del sistema de diseño

> **CORREGIDO.** 78 sustituciones: `.pila`, `.pila--compacta`, `.rejilla-2` y `.fila-acciones` en `components.css`, y las cuatro constantes locales duplicadas eliminadas. La compuerta impide que vuelva el ritmo en línea.

1. **Severidad:** SUGERENCIA
2. **Confianza:** alta (confirmado en código, conteo automatizado)
3. **Categoría:** Calidad
4. **Ubicación:** 60 ocurrencias en 12 archivos. Conteo por archivo: `configuracion.js` 15, `gasto.js` 10, `bitacora.js` 9, `avance.js` 6, `boquillas.js` 4, `captura.js` 4, `metodologia.js` 4, `gas.js` 2, `mezcla.js` 2, `forzamiento.js` 2, `marchas.js` 1, `heredado.js` 1. Ejemplos representativos: `assets/js/ui/heredado.js:181-188`, `assets/js/ui/tabs/gasto.js:503`, `assets/js/ui/tabs/bitacora.js:385-396`
5. **Evidencia:**

```js
// assets/js/ui/heredado.js:181
const raiz = el(
  'div',
  { estilo: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
  campo.elemento, zonaAvisos, estado, boton
);
```

```js
// assets/js/ui/tabs/bitacora.js:388  — además borde y radio en línea
estilo: {
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  padding: '0.75rem',
  display: 'flex', flexDirection: 'column', gap: '0.4rem',
},
```

```
# .claude/rules/design-system.md, «Qué evitar»
- Señalar la opción elegida intercambiando variantes de botón, o maquetar el grupo con un
  `display: flex` en línea […] El consumidor solo declara la clase; no escribe
  `display: flex` ni `gap` en línea.
```

6. **Problema:** el ritmo vertical y las rejillas de dos columnas se repiten como objetos `estilo` en cada consumidor en vez de vivir en `components.css`. El proyecto ya tiene las clases para casi todos los casos (`.pila-campos`, `.rejilla-cifras`, `.pila-hoja`, `.card__contenido`, `.fila-control`) y varios archivos incluso definen constantes locales (`COLUMNA`, `GRID_2`, `CUADRICULA_2`, `rejilla`) que son cuatro copias del mismo par de reglas. Los valores usados son tokens correctos, así que no hay defecto visual; es deuda estructural.
7. **Impacto:** Cambiar la densidad de la aplicación exige tocar sesenta sitios en doce archivos en vez de dos clases. Es el mecanismo por el que las superficies nuevas se van separando del sistema, del que F-014, F-015 y F-019 son ya síntomas.
8. **Solución concreta:** declarar dos clases y sustituir mecánicamente:

```css
/* assets/css/components.css */
.pila-075 { display: flex; flex-direction: column; gap: 0.75rem; }
.rejilla-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
```

`{ estilo: COLUMNA }` pasa a `{ clase: 'pila-075' }` y `{ estilo: GRID_2 }` a `{ clase: 'rejilla-2' }`; las cuatro constantes locales desaparecen. Conviene hacerlo por archivo, no de una vez, y apoyarse en `tools/humo.mjs` (que ya falla si aparece scroll horizontal) para comprobar cada paso.

9. **Reproductor:** **ejecutado** (conteo de la sección Ubicación).

---

### F-024 — Código muerto verificado

> **CORREGIDO.** Las siete declaraciones borradas (y una octava que quedó muerta al quitar `precarga`: `redondeoLegible` en `gasto.js`).

1. **Severidad:** SUGERENCIA
2. **Confianza:** alta (confirmado con conteo de referencias por archivo)
3. **Categoría:** Calidad
4. **Ubicación:** `assets/js/domain/speed.js:10` (`requiereFinito` importado y nunca usado); `assets/js/ui/tabs/gasto.js:75-78` (`function precarga`, nunca llamada); `assets/js/ui/tabs/gas.js:292` y `assets/js/ui/tabs/gas.js:385` (`const p = ctx.estado().parametros`, nunca leída); `assets/js/ui/tabs/captura.js:52` y `assets/js/ui/tabs/boquillas.js:58` (`unidadEspaciamiento`); `assets/js/ui/tabs/forzamiento.js:80` (`unidadVolAplicacion`)
5. **Evidencia:**

```
$ for pair in …; do f="${pair%%:*}"; v="${pair##*:}"; echo "$f  $v -> $(grep -c "\b$v\b" "$f") apariciones"; done
assets/js/domain/speed.js           requiereFinito       -> 1 apariciones   (solo el import)
assets/js/ui/tabs/gasto.js          precarga             -> 1 declaracion + 2 menciones en comentarios
assets/js/ui/tabs/forzamiento.js    unidadVolAplicacion  -> 1 apariciones
assets/js/ui/tabs/boquillas.js      unidadEspaciamiento  -> 1 apariciones
assets/js/ui/tabs/captura.js        unidadEspaciamiento  -> 1 apariciones
$ grep -c "\bp\." assets/js/ui/tabs/gas.js
0
```

6. **Problema:** siete declaraciones sin consumidor. `gasto.js::precarga` es especialmente engañosa: son cuatro líneas que replican exactamente el patrón de precarga de `mezcla.js` (donde sí se usa), así que se lee como el mecanismo activo de la pestaña cuando la precarga real la hacen los campos de dato.
7. **Impacto:** Ruido de lectura en los archivos más largos del repositorio, y una función que sugiere un mecanismo que no está en uso. Sin impacto funcional.
8. **Solución concreta:** borrar las siete declaraciones. Y añadir la compuerta que las habría detectado, que en un proyecto sin dependencias cabe en el job `estatico`:

```yaml
- name: Sin variables ni importaciones sin usar
  run: npx --yes eslint@9 --no-eslintrc --env es2022,browser --parser-options ecmaVersion:2022,sourceType:module \
         --rule '{"no-unused-vars":["error",{"args":"none"}]}' assets/js tools tests
```

(Si se prefiere no meter una dependencia en CI, el mismo recuento por archivo del reproductor sirve como script propio en `tools/`.)

9. **Reproductor:** **ejecutado** (el conteo de la sección Evidencia).

---

### F-025 — Cero pruebas de `assets/js/ui`: los cuatro contratos roto UI↔dominio no los ve ninguna compuerta

> **CORREGIDO.** `tests/contratos-ui.test.js`: 14 pruebas que fijan las claves de la frontera, dónde vive cada dato, la tabla ISO, la conversión de captura y la regla de las ayudas.

1. **Severidad:** SUGERENCIA
2. **Confianza:** alta (confirmado por inventario de pruebas y por ejecución de la batería)
3. **Categoría:** Calidad (cobertura de pruebas)
4. **Ubicación:** `tests/` (18 archivos, 238 pruebas); ausencia total de cobertura de `assets/js/ui/**` (31 módulos); alcance de las pruebas de navegador en `tools/interaccion.mjs:413-425`
5. **Evidencia:**

```
$ npm test
# tests 238   # pass 238   # fail 0
```

Los 16 archivos de prueba importan de `assets/js/domain/**` y `assets/js/storage.js`. Ninguno importa de `assets/js/ui/**`.

```js
// tools/interaccion.mjs:413  — la seccion de Boquillas no pulsa el boton de F-001
// ---------- Boquillas: candidatas ----------
…
verificar(/XR11004|TT11004|candidata/i.test(texto), 'Boquillas: aparecen candidatas para 575 L/ha a 2.59 km/h');
```

6. **Problema:** la capa de dominio está fuertemente probada —238 pruebas, con ruta redundante SI, ida y vuelta, pruebas de propiedad, bordes y regresiones de auditoría—, y no encontré ningún defecto de cálculo en ella. Todos los defectos de este reporte que afectan a números están en la **frontera** entre la interfaz y el dominio: un nombre de campo equivocado (F-006), un campo de la tabla de datos equivocado (F-005), un argumento que no se pasa (F-007), un sitio de escritura equivocado (F-001). Esa frontera no tiene pruebas unitarias, y las pruebas de navegador, que sí podrían cubrirla, no llegan: la sección de Boquillas comprueba que aparecen candidatas pero no pulsa «Usar en Gasto de agua», que es justo el botón roto.
7. **Impacto:** El proyecto declara que «una calibración mal calculada tiene consecuencias graves en el cultivo» y ha invertido en verificación redundante de las fórmulas; el eslabón sin protección es el que traduce el resultado del dominio a la pantalla. Cuatro de los nueve hallazgos MEDIO o superiores viven ahí.
8. **Solución concreta:** dos frentes, ambos baratos. (a) Pruebas de contrato sin DOM: fijar que las claves que la interfaz lee existen en lo que el dominio devuelve, que es lo que habría atrapado F-005, F-006 y F-007.

```js
// tests/contratos-ui.test.js
test('las claves que la interfaz lee existen en el resultado del dominio', () => {
  const r = estadisticaCaptura({ volumenesMl: [500, 520], tiempoS: 60, umbralAtipicasPct: 10 });
  for (const clave of ['mediaLmin', 'cvPoblacionalPct', 'lhaRealMedido', 'porBoquilla']) {
    assert.ok(clave in r.valores, `capture.js dejo de exponer ${clave}`);
  }
});
test('cada dato del registro dice donde vive', () => {
  for (const [id, d] of Object.entries(DATOS)) {
    assert.ok(d.guarda === undefined || (d.guarda.tab && d.guarda.clave), id);
  }
});
test('cada tamano ISO sembrado en el catalogo tiene fila, y la fila expone .tamano', () => {
  for (const b of CATALOGO_SIEMBRA.filter((x) => x.tamanoIso)) {
    const fila = filaIso(b.tamanoIso);
    assert.ok(fila && fila.tamano === b.tamanoIso, b.id);
  }
});
```

(b) Ampliar `interaccion.mjs`: pulsar «Usar en Gasto de agua» y verificar el valor del campo de presión en la pestaña destino, y recorrer la hoja de cierre del asistente de mezcla con producto en kg comparándola con la pestaña Mezcla.

9. **Reproductor:** **ejecutado** — `npm test` en verde con los cuatro defectos presentes es la demostración.

---

### F-026 — IDs de bitácora con `Math.random` en vez de `crypto.randomUUID`

> **CORREGIDO.** `assets/js/ui/id.js` con `idRegistro`, usado por las seis superficies que guardan.

1. **Severidad:** SUGERENCIA
2. **Confianza:** alta (confirmado en código)
3. **Categoría:** Calidad
4. **Ubicación:** `assets/js/ui/tabs/gasto.js:602`, `gas.js:722`, `mezcla.js:478`, `forzamiento.js:738`, `configuracion.js:163`; el patrón correcto, en el mismo repositorio, en `assets/js/ui/tabs/captura.js:37-41`
5. **Evidencia:**

```js
// assets/js/ui/tabs/gasto.js:602
id: `gasto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
```

```js
// assets/js/ui/tabs/captura.js:37  — el mismo problema, ya resuelto
function idPrueba() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `captura-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
```

6. **Problema:** cinco generadores de ID conviven con uno que ya hace lo correcto. La entropía es de unos 30 bits sobre el mismo milisegundo, así que la colisión es improbable pero no imposible, y el ID es la clave con la que se elimina un registro (`bitacora.js:430-436`: `filter((r) => r.id !== entrada.id)`) y con la que se deduplican al importar. Dos registros con el mismo ID se borrarían juntos. No es un uso de seguridad: no hay token, sesión ni credencial de por medio.
7. **Impacto:** Riesgo real muy bajo; el valor del arreglo es la consistencia (un solo generador en vez de seis) y quitar la duda de si alguno de ellos importa para seguridad.
8. **Solución concreta:** extraer `idPrueba` de `captura.js` a un módulo compartido y usarlo en los seis sitios:

```js
// assets/js/ui/id.js
export function idRegistro(prefijo) {
  if (globalThis.crypto?.randomUUID) return `${prefijo}-${globalThis.crypto.randomUUID()}`;
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
```

9. **Reproductor:** **ejecutado** (barrido de la Sección B.3, patrón «Aleatoriedad no criptográfica»).

---

## D) Quick wins (máximo 10, menos de 30 min cada uno)

| ID | Cambio | Esfuerzo | Severidad mitigada |
| --- | --- | --- | --- |
| F-006 | `cvPct` → `cvPoblacionalPct` en `pasos.js:543` | 2 min | MEDIO |
| F-007 | Añadir `unidad: datos.unidadProducto ?? 'L'` a la dosis en `guia.js:581` | 5 min | MEDIO |
| F-001 | Sustituir `guardarBorrador('gasto', …)` por dos `fijarDato` en `boquillas.js:155` | 10 min | ALTO |
| F-005 | `iso.iso` → `iso.tamano` y guarda `iso?.hex` en `pasos.js:398`; `estiloBadgeIso` devuelve `{}` con hex nulo | 10 min | MEDIO |
| F-009 | `try/catch` alrededor de `clipboard.writeText` devolviendo `'sin-soporte'` | 10 min | MEDIO |
| F-004 | Quitar los separadores de miles en `aNumero` antes de normalizar el decimal | 15 min | MEDIO |
| F-008 | Completar la descripción del diálogo de «Restaurar TODO» | 5 min | MEDIO |
| F-010 | Filtrar por prefijo `sprayboom-` y por `scope` en `reinstalar()` | 15 min | BAJO |
| F-011 | Distinguir «sin conexión» de «error» según `navigator.onLine` | 10 min | BAJO |
| F-019 + F-024 | Mover el color del cronómetro a `components.css` y borrar las siete declaraciones muertas | 20 min | BAJO + SUGERENCIA |

---

## E) Riesgos sistémicos

### E.1 La frontera interfaz↔dominio no tiene ninguna compuerta

Es el patrón raíz de F-001, F-005, F-006, F-007 y F-014: cinco defectos, cuatro de ellos MEDIO o ALTO, todos del mismo tipo —la interfaz lee o escribe un nombre que el dominio no expone, o pasa un argumento de menos—. El dominio está protegido por ruta redundante, verificación de ida y vuelta y 238 pruebas; la interfaz no tiene ninguna. Los cuatro defectos son invisibles en ejecución porque `formatear(undefined)` devuelve el guion neutro, `el()` descarta hijos `undefined` y `dosis.unidad ?? 'L'` tiene un default plausible: la aplicación degrada elegantemente hacia el número equivocado.

**Mitigación estructural, no parche:** un archivo `tests/contratos-ui.test.js` que fije, por reflexión y sin DOM, las tres invariantes de la frontera: (1) toda clave que la interfaz lea de un `valores` del dominio existe en ese `valores`; (2) todo dato de `domain/datos.js` se escribe en el sitio que su `guarda` declara, verificable comparando cada `guardarBorrador(tab, {clave})` del código contra el registro; (3) todo `tamanoIso` sembrado tiene fila en `TABLA_ISO_10625`. Las tres son declarativas y corren en milisegundos. El punto (2) puede escribirse como una herramienta de `tools/` que barre el código y falla si un `guardarBorrador` usa una clave que el registro declara como dato de jornada — habría atrapado F-001 en la corrida en la que se introdujo.

### E.2 Entrada no confiable con dos niveles de rigor en el mismo módulo

`storage.js` valida seis colecciones con `validarValor` y cuatro con nada (F-003); `main.js` filtra la jornada con `soloClavesDeJornada`, valida el contexto campo por campo y escribe el borrador sin validar nada (F-002). En los dos casos la parte cuidada y la descuidada están a diez líneas de distancia, y en los dos casos hay un comentario que afirma la garantía que no se cumple.

**Mitigación estructural:** un único punto de entrada para todo dato externo. Declarar un validador por colección en `domain/defaults.js` (ya existen las cotas: `COTAS_FACTOR_DESVIACION` está escrita y sin usar) y hacer que `importarJSON` y `aplicarEstadoCompartido` recorran ese registro en vez de enumerar campos a mano. Regla derivada, verificable en revisión: **ninguna clave que venga de fuera se usa como índice de escritura sin haber pasado por una allowlist**, y `estado.borradores` se crea con `Object.create(null)` para que la allowlist no dependa de recordar `__proto__`.

### E.3 Las reglas duras del sistema de diseño se cumplen donde hay compuerta y se aflojan donde no

Cuatro reglas están automatizadas en CI (`innerHTML`, contraste AA, precache al día, ortografía) y el repositorio las cumple al 100 %: cero `innerHTML`, todos los pares AA, precache al día, textos acentuados. Las reglas equivalentes que **no** tienen compuerta se incumplen de forma proporcional a lo nueva que es la superficie: 17 cifras sin `ayuda` (F-015, 15 de ellas en el asistente), un color a mano (F-019), sesenta layouts en línea (F-023), fallbacks en `rem` contra la regla de medidas físicas (F-020). No es descuido: es que la compuerta es lo que sostiene la regla.

**Mitigación estructural:** convertir en compuerta lo que hoy es prosa, empezando por lo que se puede verificar con un recuento de llaves y una expresión regular: (1) todo `pintarResultado({…})` contiene `ayuda:`; (2) ningún archivo de `assets/js` contiene un color literal (`#`, `rgb(`, `hsl(` con número) fuera de `data/iso-colors.js`; (3) ningún `estilo:` de `el()` declara `display: 'flex'` ni `display: 'grid'`. Las tres caben en una herramienta de `tools/` de menos de cincuenta líneas, sin dependencias, en el job `estatico` que ya existe. La regla que no se puede verificar automáticamente conviene marcarla como tal en `design-system.md`, para que se sepa cuáles dependen de la revisión humana.

### E.4 Los estados degradados se manejan tres veces con tres criterios distintos

`forzamiento.js:56-78` comprueba las colecciones vacías y devuelve una alerta con instrucción; `pasos.js:113-118` usa encadenamiento opcional con defaults; `avance.js:60-117` y `gasto.js:912-917` no comprueban nada y dejan salir un `TypeError` (F-013). El mismo módulo del que sale la incoherencia —`ctx`, en `main.js:114-291`— es el que podría resolverla.

**Mitigación estructural:** que `ctx` exponga el estado de completitud del contexto, no solo los objetos: un `ctx.contextoCompleto()` que devuelva la lista de lo que falta (`['un tractor', 'un rotámetro']`), y un ayudante compartido `tarjetaSinContexto(faltantes)` en `ui/render.js` que cada pestaña llame en su primera línea. Once pestañas con una guarda de tres líneas idéntica, en vez de tres criterios y dos pantallas que mueren. De paso desaparece la variante de F-022 en la que un defecto interno se lee como un dato que falta.

---

## F) Inspeccionados y descartados

Lo que parecía defecto y no lo es, para que nadie vuelva a auditarlo:

| Ubicación | Por qué se descartó |
| --- | --- |
| `assets/js/domain/water.js:110` — `discrepanciaPct = Math.abs(a-b) / ((a+b)/2)` | No hay división por cero: `lhaPorBoquilla` y `lhaPorBarra` pasan por `requierePositivo`, así que `a+b > 0` siempre. |
| `assets/js/domain/verify.js:52` — `errorRelativo` con `Number.MIN_VALUE` como piso | Correcto: con `a === b === 0` la razón sale 0, no `NaN`. La guarda es deliberada y está probada en `tests/propiedades.test.js`. |
| `assets/js/domain/water.js:181` — `numBoquillas ? total / requierePositivo(…) : null` | El `0` falsy cae a `null` antes de llegar a `requierePositivo`, así que no hay división por cero ni excepción inesperada. |
| `assets/js/domain/pump.js:145` — `Math.abs(razonRegimen - 1) > Number.EPSILON` | Umbral aparentemente absurdo, pero intencional: el aviso debe salir con CUALQUIER diferencia de régimen. Con `rpmMotor === rpmCalibracion` el cociente es exactamente 1 y no se emite. |
| `assets/js/ui/cronometro.js:71` — `elemento.isConnected` usado en `arrancar()` antes de la declaración `const elemento` (línea 115) | No hay TDZ: `arrancar` solo corre desde un `click`, mucho después de la evaluación del módulo. `pintar()`, que sí se llama en la línea 113, no referencia `elemento`. |
| `assets/js/ui/tabs/gasto.js:314-327` — `lecturas()` usa `campoObjetivo` y `campoRpmTrabajo`, declarados 300 líneas más abajo | No hay TDZ: la primera llamada real es `recalcular()` en la línea 1139, después de las dos declaraciones. Los constructores de campo no disparan `alCambiar` al montarse. |
| `assets/js/ui/campos.js:133-137` — los listeners de `scroll`, `resize`, `pointerdown` y `keydown` del globo de ayuda | No es fuga: `alMover` y `alPulsarFuera` comprueban `boton.isConnected` y cierran solos, y `cerrarAyudaAbierta` garantiza un único globo abierto. La fuga se autolimpia en el siguiente evento. |
| `assets/js/ui/combobox.js:111` — `lista.querySelector(\`#${id}-opcion-${indiceActivo}\`)` | Los tres `id` que se pasan son literales seguros (`gasto-boquilla`, `captura-boquilla`, `guia-boquilla`): ninguno empieza por dígito ni lleva caracteres que necesiten escape en un selector. |
| `assets/js/ui/tabs/gas/tubo.js:166-179` | La escala inválida (`escalaMax <= escalaMin`) **sí** está manejada, con una alerta clara y salida temprana. El defecto de cotas cruzadas queda en F-012 por sus otros efectos, no por este. |
| `assets/js/ui/tabs/gas/escala.js:25-29` — `ajustar` con `paso <= 0` | Manejado: `paso > 0 ? … : valor` evita la división por cero, y los llamadores pasan un respaldo (`rotametro?.resolucion > 0 ? … : 0.1`). |
| `assets/js/ui/tabs/gasto.js:301-307` — `ctx.fijarJornada({ anchoBarraM: undefined, … })` | Correcto: `Object.assign` deja las claves con valor `undefined`, `Number.isFinite(undefined)` es `false` y el respaldo vuelve a mandar. `JSON.stringify` las omite al persistir. |
| `404.html:13-26` — redirección con `location.replace` | No es redirect abierto: `base` sale del primer segmento del propio `pathname`, nunca de un parámetro, y hay guarda anti-bucle en `sessionStorage`. |
| `sw.js:74-104` — servir `./index.html` para navegaciones desconocidas | Deliberado y correcto para una aplicación que enruta por hash. La clave de caché se elige por ruta, así que `componentes.html` y `404.html` no se sirven bajo la del shell. |
| `tools/humo.mjs:36-42` — servidor de archivos estáticos | La guarda de traversal es correcta: `join` normaliza los `..` y `RAIZ` termina en `/`, así que el `startsWith` no admite directorios hermanos. Es un servidor de desarrollo en 127.0.0.1 con puerto efímero. |
| `tools/generar-precache.mjs:18` — `execSync` | El comando es una cadena fija sin interpolación de entrada; `cwd` va como opción, no al shell. Sin inyección. Ver F-021 por el percent-encoding, que es otra cosa. |
| `tools/sellar-version.mjs:35` — interpolación del sello en un archivo `.js` generado | Manejado: `/^[A-Za-z0-9._-]+$/` antes de interpolar. Sin inyección de plantilla. |
| `assets/js/storage.js:493-519` — `validarColeccion` muta los elementos recibidos | Los elementos vienen de un `JSON.parse` recién hecho sobre el texto del archivo importado; no hay alias con el estado vigente, que se clona aparte (`clonar(estadoActual)`). |
| `assets/css/components.css:1688-1728` — `font-size` en 11px, 10px, 8px y 12px | Son unidades del `viewBox` del SVG de los instrumentos, no píxeles de pantalla; están declaradas como excepción con su comentario en la línea 1669 y con el tamaño resultante anotado. |
| `assets/css/components.css:1365` — `min-height: 64px` en `.marcha` | Permitido: la regla reserva el piso táctil a `components.css`, y este ES `components.css`. El comentario justifica los 64px (dos renglones por encima del piso) y la medida física va en px, como manda la regla. |
| `assets/css/components.css:963` — `background: rgb(0 0 0 / 0.6)` en `::backdrop` | La superposición de un diálogo modal no es un color del tema: es negro translúcido en ambos temas por diseño, igual que en Sherman. No hay token para ello ni haría falta. |
| `.gitattributes:7` — `precache.js merge=union` | Aparente riesgo de lista duplicada, pero está cubierto: el job `estatico` regenera y compara con `git diff --exit-code`, así que una unión mal ordenada no llega a `main`. Verificado ejecutando la compuerta. |
| `version.js:13` — `self.SPRAYBOOM_VERSION = 'dev'` commiteado | Correcto y documentado: la versión real la estampa el despliegue (`pages.yml:51-54`) y `dev` es lo que deben ver las herramientas que sirven el sitio desde el disco. |
| `assets/js/ui/campos.js:284-307` — el botón de unidades convierte y emite `input` y `change` | Conforme a la regla: convierte SOLO hacia las unidades de la aplicación, el segundo toque devuelve el texto original sin aplicar factor, y avisa a la pantalla en vez de convertir en silencio. Revisado contra la sección correspondiente de `design-system.md`. |
| `assets/js/domain/units.js:200-220` — `INDICE_DE_UNIDAD` con `PREFERENCIA_DE_UNIDAD` para desempatar `'m'` | Correcto: el único texto de unidad ambiguo es `m`, el desempate está declarado y las superficies que pintan espaciamiento pasan `magnitud: 'distanciaCorta'` explícitamente (`configuracion.js:260`, `dato.js` vía el registro). |

---

## Condición de parada

1. Inventario de la Sección B completo, sin elipsis: **sí** (112 archivos, agrupados por directorio con conteo por ser más de 100, y con rutas literales para todo archivo con hallazgo o descarte).
2. Cada categoría con al menos una declaración en la Sección B: **sí** (1 bugs, 2 errores, 3 edge cases, 4 seguridad, 5 hardcoding, 6 rendimiento, 7 calidad, 8 configuración, 9 base de datos `[N/A]` en bloque con razón, 10 dependencias `[OK] parcial` con la limitación declarada).
3. Cada patrón de la Fase 3 barrido y declarado: **sí** (14 patrones generales + los 7 de SQL/PLpgSQL declarados `[N/A]` en bloque).
4. Cada hallazgo con los 9 campos completos: **sí** (26 de 26).
5. Severidad asignada con la rúbrica; ningún CRITICO sin reproductor: **sí** (cero CRITICO; ninguno de los hallazgos alcanza ejecución remota, bypass de autenticación, pérdida de datos explotable ahora ni exposición de secretos).
6. Confianza declarada en todos los hallazgos: **sí** (24 alta, 2 media).
7. Asunciones listadas: **sí** (6, en B.4).
8. Conteos de la Sección A coherentes con la Sección C: **sí** (1 ALTO + 8 MEDIO + 13 BAJO + 4 SUGERENCIA = 26; verificados 24 + sospechas 2 = 26).
9. Sin emojis en toda la salida: **sí**.

### Sobre hardcoding y rendimiento

Las dos categorías merecen una nota porque el resultado es inusualmente limpio y no quiero que se lea como falta de barrido.

**Hardcoding (categoría 5):** el proyecto cumple su propia regla («todo es parámetro») de forma verificable. Cero URLs, credenciales, tokens o rutas absolutas en el código. Los números de dominio viven en `domain/constants.js` (conversiones), `domain/defaults.js` (siembra y cotas) y `data/` (catálogo, tabla ISO, clases de gota), todos con fuente citada, y llegan a las funciones por argumento. La única excepción es `PSI_REFERENCIA_NOMENCLATURA_US = 40` en `metodologia.js:82`, que está **declarada** como excepción en el encabezado del archivo con la justificación de por qué no vive en `constants.js` (es nomenclatura para una demostración, no entra a ningún cálculo operativo). Los tamaños en píxeles de `campos.js:22-25` y las geometrías de `tubo.js:23-57` y `manometro.js:22-37` son constantes nombradas de presentación con comentario, no valores mágicos. Declarado: `[OK]` con la excepción documentada.

**Rendimiento (categoría 6):** no hay servidor, ni base de datos, ni N+1 posible. Revisé los cuatro sitios donde podría doler en un teléfono y los cuatro están resueltos: (a) el arrastre del flotador y el giro de la aguja repintan solo el grupo `.instrumento__movil` y entregan el valor una sola vez al soltar, en vez de remontar la pestaña por cada paso del dedo (`tubo.js:265-388`, `manometro.js:158-299`); (b) `Intl.NumberFormat` está memoizado por `(decimales, fijos)` y `Intl.DateTimeFormat` se construye una sola vez a nivel de módulo (`formato.js:4-18`, `:50-53`); (c) la persistencia de borradores va con debounce de 250 ms (`storage.js:390-396`) y `guardarResultado` no reescribe si el valor no cambió, para que la fecha «medido hace un momento» siga significando algo (`main.js:279-290`); (d) `crearTabs` conserva viva la tablist mientras no cambie la sección, para no perder el foco ni el roving tabindex (`main.js:361-374`). El único coste apreciable es que cada tecleo dispara un recálculo completo de la pestaña (`recalcular()`), que en la pestaña más pesada (`gasto.js`, cuatro zonas) implica reconstruir unas decenas de nodos: medido contra el presupuesto de un teléfono de gama media es despreciable, y la alternativa (recálculo diferido) costaría la respuesta en vivo que la aplicación busca. Declarado: `[OK]`, sin hallazgos.
