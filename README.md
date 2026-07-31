# sprayboom-calibrate

Calibración de aplicaciones agrícolas en cultivo de piña MD2. Aplicación web estática, en español de México, diseñada exclusivamente para uso en teléfono celular en campo, con conectividad intermitente.

Cubre tres dominios de cálculo encadenados, todos resolubles en ambos sentidos (ajuste a resultado y objetivo a ajuste):

1. **Velocidad y avance**: marchas y régimen del motor, o reporte de campo en segundos por tramo, a velocidad real y tiempo por tabla.
2. **Gasto de agua**: calibración de volumen de aplicación en L/ha a partir de boquillas, presión, ancho de barra y velocidad, con selección de boquillas por catálogo y verificación por aforo.
3. **Gas etileno**: dosificación por rotámetro para forzamiento por percolación, encadenada con los otros dos dominios.

## Publicación en GitHub Pages

El sitio no tiene paso de compilación: el repositorio ES el sitio. El despliegue está
automatizado con GitHub Actions (`.github/workflows/pages.yml`): cada push a `main` corre las
131 pruebas de dominio y, solo si pasan, publica la raíz del repositorio en Pages. Si las
pruebas fallan, no se publica: una calibración rota no llega al campo.

- **Primera vez**: el flujo intenta activar Pages por sí solo. Si ese paso falla por permisos,
  se activa una vez a mano en Settings, Pages, Source: **GitHub Actions**, y se relanza el
  flujo desde la pestaña Actions.
- El sitio queda en `https://<usuario>.github.io/sprayboom-calibrate/`.
- No hay nada que compilar; el flujo solo prueba, empaqueta y publica.

**Requisito de plan**: GitHub Pages en un repositorio privado requiere plan de pago (Pro, Team o Enterprise). Si el repositorio es privado y la cuenta es gratuita, hay que hacer el repositorio público antes de activar Pages.

### Limitaciones de GitHub Pages consideradas en el diseño

| Limitación | Cómo la maneja este sitio |
|---|---|
| Solo archivos estáticos, sin servidor ni base de datos | Los datos viven en `localStorage` del navegador; la exportación JSON/CSV es el único respaldo |
| El sitio se sirve bajo el subdirectorio `/sprayboom-calibrate/` | Todas las rutas son relativas; el manifest y el service worker usan `scope: "./"` |
| No hay rewrites de servidor: una ruta de path da 404 al recargar | La navegación usa el fragmento hash (`#/calibrar/avance`), nunca paths |
| Jekyll procesa el sitio por defecto | Archivo `.nojekyll` en la raíz |
| Caché CDN de unos 10 minutos al publicar cambios | El service worker versiona su caché y avisa cuando hay versión nueva |
| Recargar sin señal no es confiable con solo caché HTTP | La PWA precachea el sitio completo: tras la primera carga funciona sin conexión |

## Aplicación instalable (PWA) y funciones de campo

- **Sin conexión**: tras la primera carga, el service worker precachea el sitio completo; la
  aplicación abre y calcula sin señal. Al publicar cambios hay que subir la versión en
  `version.js`; la aplicación avisa "hay una versión nueva" con botón de actualizar.
- **Instalable**: desde el navegador del teléfono, "Agregar a pantalla de inicio". El manifiesto
  usa rutas relativas y funciona bajo el subdirectorio de Pages.
- **Compartir por URL**: el botón de compartir del encabezado codifica los valores capturados de
  la pantalla activa y el contexto (tractor, equipo, unidades) en el fragmento hash; al abrir el
  enlace, la aplicación pregunta antes de aplicar. El fragmento nunca llega al servidor.
- **Cronómetro integrado**: en Avance mide los segundos por tramo; en Prueba de captura es
  cuenta regresiva con el tiempo de aforo configurado.

## Uso y prueba local

Los módulos ES no cargan desde `file://`. Para probar en local se necesita un servidor HTTP simple:

```bash
python3 -m http.server 8080
# o: npm run serve
```

y abrir `http://localhost:8080/`.

Para verificar el comportamiento bajo subdirectorio (como en Pages):

```bash
mkdir -p /tmp/pages && ln -s "$(pwd)" /tmp/pages/sprayboom-calibrate
python3 -m http.server 8080 -d /tmp/pages
# abrir http://localhost:8080/sprayboom-calibrate/
```

## Pruebas

La lógica de cálculo (directorio `assets/js/domain/`) es JavaScript puro sin DOM ni almacenamiento, ejecutable igual en el navegador y en Node. Las pruebas usan `node:test`, sin dependencias:

```bash
npm test
# equivale a: node --test tests/
```

npm solo se usa para herramientas de desarrollo; el sitio publicado no depende de npm ni de ningún paquete.

Herramientas de desarrollo (ninguna es requisito del sitio publicado):

```bash
node tools/verificar-contraste.mjs      # contraste AA de tokens y colores ISO
node tools/generar-precache.mjs         # regenera la lista de precache de sw.js
CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/generar-iconos.mjs   # PNG del manifest
CHROMIUM_PATH=... node tools/humo.mjs               # humo: 10 rutas x 2 viewports de teléfono
CHROMIUM_PATH=... node tools/interaccion.mjs        # interacción completa + recarga sin conexión
node tools/acentuar.mjs <archivos>      # ortografía de textos visibles
```

## Importante: dónde viven los datos

**Los datos viven en este navegador y en este dispositivo.** Si se borran los datos del sitio o se cambia de teléfono, se pierden. La exportación a JSON (configuración y catálogo) y a CSV (bitácora) es el único respaldo real y la única forma de pasar datos entre dispositivos. Exporta con regularidad. La aplicación muestra este aviso de forma visible.

## Estructura

```
.github/workflows/    despliegue a Pages: prueba y publica en cada push a main
index.html            aplicación (una sola página, navegación por hash)
componentes.html      muestra del sistema de diseño en ambos temas
404.html              redirige a ./ conservando el hash
.nojekyll             desactiva Jekyll en Pages
manifest.webmanifest  PWA
sw.js                 service worker (precache versionado)
version.js            versión de la caché del service worker
assets/
  css/                tokens (temas claro y oscuro), base, componentes
  fonts/              Inter autohospedada + licencia OFL
  icons/              iconos PWA y favicon
  js/
    domain/           cálculo puro: constantes, unidades, defaults, velocidad,
                      bomba, boquillas, agua, captura, gas, rotámetro, mezcla,
                      forzamiento, validación y verificación redundante
    data/             tabla ISO 10625, clases de gota ANSI/ASABE S572,
                      catálogo de boquillas de siembra (con fuentes citadas)
    ui/               un módulo por pestaña + componentes compartidos
    storage.js        persistencia local, exportación e importación
    main.js           arranque y estado
tests/                pruebas con node:test
tools/                scripts solo de desarrollo (iconos, contraste)
```

## Limitaciones conocidas y pendientes declarados

- El régimen nominal del JD 5715 (2,400 rpm) está **pendiente de confirmar** contra el manual;
  la interfaz lo marca. El del 6603 (2,100 rpm) proviene de la prueba de Nebraska.
- El **volumen de agua objetivo propio** del forzamiento está vacío a propósito: lo captura el
  usuario; la aplicación no lo inventa ni lo rellena con la referencia de la literatura.
- Del tamaño ISO **20** solo el caudal (8.0 L/min) está verificado (prólogo de ISO 10625:2018);
  su color vive en la Tabla 2 del estándar, no disponible en la vista previa consultada.
- El catálogo sembrado cubre TeeJet (7 series) y Albuz ATR 80 con fuentes citadas; **Lechler,
  Hypro y ARAG** quedaron pendientes por falta de ficha descargable verificable. Se capturan en
  el editor citando la fuente.
- El detalle de bitácora compara el snapshot contra los parámetros numéricos vigentes y los
  datos de tractor/equipo guardados; los campos categóricos del equipo y la configuración de
  gas/rotámetro no entran al diff todavía.
- `componentes.html` es una galería estática del sistema de diseño: sus números son texto de
  muestra, no cálculos.

## Mecanismo de cálculo redundante

Una calibración mal calculada tiene consecuencias graves en el cultivo, así que ningún resultado crítico se muestra respaldado por un solo camino de cálculo:

- Los resultados críticos se calculan por dos rutas independientes (fórmula canónica y análisis dimensional en unidades SI). Si no coinciden, la interfaz no muestra el número.
- Todo despeje inverso se verifica en ida y vuelta contra la fórmula directa, y la verificación se muestra al pie del desglose.
- Los dos métodos de L/ha (por boquilla y por barra) se calculan siempre juntos y la discrepancia se señala.
- El aforo, los factores de desviación medidos en campo y el pesaje del cilindro tienen prioridad declarada sobre cualquier cálculo teórico.
