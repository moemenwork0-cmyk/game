/** Home screen at phone, iframe and laptop sizes: node scripts/menu-shots.mjs <outDir> (after build). */
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const out = process.argv[2];
const server = await preview({ preview: { port: 4190 }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
for (const [w, h, d, lang] of [[390, 844, 2, 'ar'], [360, 740, 2, 'en'], [821, 462, 1, 'en'], [1366, 768, 1, 'ar']]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: d });
  await p.goto(`${url}?lang=${lang}`);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${out}/menu-${w}x${h}.png` });
  await p.close();
}
await b.close();
await server.close();
