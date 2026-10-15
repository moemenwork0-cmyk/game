/** Close-up screenshots of Jello's states for visual review: npm run build && node scripts/jello-shots.mjs */
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const server = await preview({ preview: { port: 4176 }, logLevel: 'silent' });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
mkdirSync('screenshots/jello', { recursive: true });
await page.goto(`${url}?test=1`);
await page.waitForFunction(() => !!window.__jf);
await page.evaluate(() => window.__jf.manual(true));
const step = (ms) => page.evaluate((m) => window.__jf.step(m), ms);
const clip = async (name) => {
  const b = await page.evaluate(() => {
    const j = window.__jf.app.jello;
    return { x: j.x, y: j.ground, R: j.R };
  });
  const w = b.R * 5.2;
  const h = b.R * 4.2;
  await page.screenshot({ path: `screenshots/jello/${name}.png`, clip: { x: Math.max(0, b.x - w / 2), y: Math.max(0, b.y - h + b.R * 0.6), width: w, height: h } });
};
await step(400);
await page.waitForTimeout(900);
await step(300);
await clip('01-menu-greet');
const states = [
  ['02-neutral', (a) => { a.jello.speech = null; a.jello.feel('neutral', 10); }],
  ['03-wink', (a) => { a.jello.winkAt(); a.jello.express({ mouth: 'grin' }, 600); }],
  ['04-cool', (a) => { a.jello.setGlasses(true); a.jello.setBaseMood('cool'); }],
  ['05-love', (a) => { a.jello.setGlasses(false); a.jello.feel('love', 3000); }],
  ['06-excited', (a) => a.jello.feel('excited', 3000)],
  ['07-worried', (a) => { a.jello.setBaseMood('worried'); a.jello.feel('worried', 3000); }],
  ['08-peek', (a) => a.jello.act('peek', 3000)],
  ['09-sad', (a) => { a.jello.action = 'none'; a.jello.setBaseMood('sad'); a.jello.feel('sad', 3000); a.jello.act('melt', 1e9); }],
  ['10-sleepy', (a) => { a.jello.reset(); a.jello.setBaseMood('sleepy'); }],
  ['11-dizzy', (a) => { a.jello.reset(); a.jello.feel('dizzy', 3000); a.jello.act('dizzy', 3000); }],
  ['12-hum', (a) => { a.jello.reset(); a.jello.act('hum', 3000); }],
  ['13-blow', (a) => { a.jello.reset(); a.jello.act('blow', 1500); }],
  ['14-absorb', (a) => { a.jello.reset(); a.jello.absorb([69, 214, 92], 3000); a.jello.feel('happy', 3000); }],
  ['15-crown', (a) => { a.jello.reset(); a.jello.crown(true); a.jello.feel('proud', 3000); }],
];
for (const [name, fn] of states) {
  await page.evaluate(`(${fn.toString()})(window.__jf.app)`);
  await step(name === '13-blow' ? 1100 : 700);
  await clip(name);
}
// Pull: real pointer drag upwards.
await page.evaluate(() => { const a = window.__jf.app; a.jello.reset(); a.jello.crown(false); });
await step(300);
const p = await page.evaluate(() => { const j = window.__jf.app.jello; return { x: j.x, y: j.ground - j.H * 0.5, R: j.R }; });
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let k = 1; k <= 8; k++) {
  await page.mouse.move(p.x + k * 2, p.y - k * p.R * 0.25);
  await step(30);
}
await step(200);
await clip('16-pull');
await page.mouse.up();
await step(90);
await clip('17-boing');
await browser.close();
await server.close();
console.log(errors.length ? 'errors: ' + errors.join('; ') : 'ok');
