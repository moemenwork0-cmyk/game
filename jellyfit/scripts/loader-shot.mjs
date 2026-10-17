/** The loading screen a moment after launch (phone size): node scripts/loader-shot.mjs <out.png> (after build). */
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const server = await preview({ preview: { port: 4191 }, logLevel: 'silent' });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
// Keep the game script from loading so the loader stays up for the picture.
await p.route(/\.js(\?|$)/, (r) => r.abort());
await p.goto(server.resolvedUrls.local[0]);
await p.waitForTimeout(900);
await p.screenshot({ path: process.argv[2] });
await b.close();
await server.close();
