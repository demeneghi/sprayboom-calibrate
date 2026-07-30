# sprayboom-calibrate

Calibración de aplicaciones agrícolas en cultivo de piña MD2. Aplicación web estática, en español de México, diseñada exclusivamente para uso en teléfono celular en campo, con conectividad intermitente.

Cubre tres dominios de cálculo encadenados, todos resolubles en ambos sentidos (ajuste a resultado y objetivo a ajuste):

1. **Velocidad y avance**: marchas y régimen del motor, o reporte de campo en segundos por tramo, a velocidad real y tiempo por tabla.
2. **Gasto de agua**: calibración de volumen de aplicación en L/ha a partir de boquillas, presión, ancho de barra y velocidad, con selección de boquillas por catálogo y verificación por aforo.
3. **Gas etileno**: dosificación por rotámetro para forzamiento por percolación, encadenada con los otros dos dominios.

## Publicación en GitHub Pages

El sitio no tiene paso de compilación: el repositorio ES el sitio. Método de despliegue recomendado:

1. Hacer merge de la rama de trabajo a `main`.
2. En GitHub: Settings, Pages, Source: **Deploy from a branch**, Branch: `main`, carpeta `/ (root)`.
3. El sitio queda en `https://<usuario>.github.io/sprayboom-calibrate/`.

No se necesita GitHub Actions porque no hay nada que compilar.

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

## Importante: dónde viven los datos

**Los datos viven en este navegador y en este dispositivo.** Si se borran los datos del sitio o se cambia de teléfono, se pierden. La exportación a JSON (configuración y catálogo) y a CSV (bitácora) es el único respaldo real y la única forma de pasar datos entre dispositivos. Exporta con regularidad. La aplicación muestra este aviso de forma visible.

## Estructura

```
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

## Mecanismo de cálculo redundante

Una calibración mal calculada tiene consecuencias graves en el cultivo, así que ningún resultado crítico se muestra respaldado por un solo camino de cálculo:

- Los resultados críticos se calculan por dos rutas independientes (fórmula canónica y análisis dimensional en unidades SI). Si no coinciden, la interfaz no muestra el número.
- Todo despeje inverso se verifica en ida y vuelta contra la fórmula directa, y la verificación se muestra al pie del desglose.
- Los dos métodos de L/ha (por boquilla y por barra) se calculan siempre juntos y la discrepancia se señala.
- El aforo, los factores de desviación medidos en campo y el pesaje del cilindro tienen prioridad declarada sobre cualquier cálculo teórico.
