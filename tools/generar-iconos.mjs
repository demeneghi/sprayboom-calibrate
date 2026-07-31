// Herramienta SOLO de desarrollo: rasteriza assets/icons/icon.svg a los
// PNG del manifest (192 y 512) usando el Chromium preinstalado.
// Uso: CHROMIUM_PATH=/opt/pw-browsers/chromium node tools/generar-iconos.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../assets/icons/icon.svg', import.meta.url), 'utf8');
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

for (const tamano of [192, 512]) {
  const pagina = await navegador.newPage({
    viewport: { width: tamano, height: tamano },
    deviceScaleFactor: 1,
  });
  await pagina.setContent(
    `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0}svg{display:block;width:${tamano}px;height:${tamano}px}</style></head><body>${svg}</body></html>`
  );
  await pagina.screenshot({
    path: new URL(`../assets/icons/icon-${tamano}.png`, import.meta.url).pathname,
    omitBackground: false,
  });
  await pagina.close();
  console.log(`icon-${tamano}.png generado`);
}
await navegador.close();
