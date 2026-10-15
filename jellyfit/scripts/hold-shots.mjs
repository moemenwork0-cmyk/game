/** Screenshots of the "give a piece to Jello" feature: npm run build && node scripts/hold-shots.mjs */
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const server = await preview({ preview: { port: 4178 }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
mkdirSync('screenshots', { recursive: true });
await page.goto(`${url}?test=1`);
await page.waitForFunction(() => !!window.__jf);
await page.evaluate(() => window.__jf.manual(true));
const step = (ms) => page.evaluate((m) => window.__jf.step(m), ms);
const shot = (n) => page.screenshot({ path: `screenshots/phone-${n}.png` });
await page.click('.btn-play', { force: true });
await page.waitForTimeout(300);
await page.evaluate(() => {
  window.__jf.setBoard(['1.....04', '11...004', '6....334', '66....3.', '5...2...', '55..22..', '0...2...', '00......']);
  window.__jf.setTray(['L1', 'sq2', 'h3'], [4, 1, 5]);
});
await step(800);

// 1) Tutorial (forced on for the shot).
await page.evaluate(() => {
  const a = window.__jf.app;
  a.tutorial.begin(0, a.loop.now, a.director.holdTip());
});
await step(1450);
await shot('hold-tip');
await step(800);
await shot('hold-tip2');
await page.evaluate(() => window.__jf.app.tutorial.stop(window.__jf.app.loop.now));
await step(400);

// 2) Drag the sq2 to Jello with the mouse.
const from = await page.evaluate(() => window.__jf.slotCenter(1));
const to = await page.evaluate(() => { const j = window.__jf.app.jello; return { x: j.x, y: j.ground - j.H * 0.5 }; });
await page.mouse.move(from.x, from.y);
await page.mouse.down();
await step(120);
for (let k = 1; k <= 10; k++) {
  await page.mouse.move(from.x + ((to.x - from.x) * k) / 10, from.y + ((to.y - from.y) * k) / 10);
  await step(30);
}
await step(200);
await shot('hold-reach');
await page.mouse.up();
await step(140);
await shot('hold-catch');
await step(1200);
await shot('hold-held');
const st = await page.evaluate(() => ({ held: window.__jf.app.session.held, tray: window.__jf.state().tray }));
console.log('after give:', JSON.stringify(st));

// 3) Take it back to the board.
const hp = await page.evaluate(() => { const a = window.__jf.app; const h = a.renderer.holdPose(a.session.held.piece); return { x: h.cx, y: h.cy }; });
const cell = await page.evaluate(() => window.__jf.cellCenter(3, 3));
await page.mouse.move(hp.x, hp.y);
await page.mouse.down();
await step(120);
for (let k = 1; k <= 10; k++) {
  await page.mouse.move(hp.x + ((cell.x - hp.x) * k) / 10, hp.y + ((cell.y - hp.y) * k) / 10);
  await step(30);
}
await step(250);
await shot('hold-take');
await page.mouse.up();
await step(600);
const after = await page.evaluate(() => ({ held: window.__jf.app.session.held, placements: window.__jf.app.session.stats.placements }));
console.log('after take:', JSON.stringify(after));
await browser.close();
await server.close();
console.log(errors.length ? 'errors: ' + errors.join('; ') : 'no errors');
