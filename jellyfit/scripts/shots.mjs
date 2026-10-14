/**
 * Visual self-review (spec rule 8): builds nothing, serves dist/ with `vite preview` and takes
 * screenshots of key scenes at phone, tablet and desktop sizes into /screenshots.
 *   npm run build && npm run shots [-- --only phone,desktop]
 */
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, existsSync } from 'node:fs';

const SIZES = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3 },
  tablet: { width: 820, height: 1180, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',') : Object.keys(SIZES);

const MID = ['1.....04', '11...004', '6....334', '66....3.', '5...2...', '55..22..', '0...2...', '00......'];
const PREVIEW = ['3333333.', '4444444.', '2.......', '1.......', '.....5..', '0...55..', '0..666..', '06666...'];
const CLEAR3 = ['1111.111', '2222.222', '3333.333', '6.......', '6..5....', '...55...', '0..44...', '0.......'];

async function main() {
  if (!existsSync('dist/index.html')) throw new Error('Run npm run build first');
  mkdirSync('screenshots', { recursive: true });
  const server = await preview({ preview: { port: 4173, strictPort: false }, logLevel: 'silent' });
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const errors = [];

  for (const name of only) {
    const vp = SIZES[name];
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf);
    await page.evaluate(() => window.__jf.manual(true));
    const step = (ms) => page.evaluate((m) => window.__jf.step(m), ms);
    const shot = (scene) => page.screenshot({ path: `screenshots/${name}-${scene}.png` });

    // 0. Home screen and settings.
    await step(600);
    await page.waitForTimeout(1000);
    await step(16);
    await shot('menu');
    await page.click('.menu .icon-btn');
    await page.waitForTimeout(450);
    await step(16);
    await shot('settings');
    await page.click('.settings .btn-done');
    await page.waitForTimeout(300);

    // 1. Start of a game.
    await page.click('.btn-play', { force: true });
    await page.waitForTimeout(300);
    await step(600);
    await shot('start');
    await page.click('.hud-pause');
    await page.waitForTimeout(450);
    await step(16);
    await shot('pause');
    await page.click('.pause .b-resume');
    await page.waitForTimeout(300);

    // 2. Board mid-game.
    await page.evaluate((rows) => {
      window.__jf.setBoard(rows);
      window.__jf.setTray(['L1', 'sq2', 'h3'], [4, 1, 5]);
      window.__jf.setScore(4280);
    }, MID);
    await step(900);
    await shot('midgame');
    // Jello reacting to a poke.
    const jp = await page.evaluate(() => {
      const j = window.__jf.app.jello;
      return { x: j.x + j.R * 0.3, y: j.ground - j.H * 0.6 };
    });
    await page.mouse.click(jp.x, jp.y);
    await step(260);
    await shot('jello-tap');
    await step(2600);

    // 3. Drag with clear preview (real pointer).
    await page.evaluate((rows) => {
      window.__jf.setBoard(rows);
      window.__jf.setTray(['v2', 'T1', 'sl1'], [5, 2, 3]);
      window.__jf.setScore(9120);
    }, PREVIEW);
    await step(600);
    const from = await page.evaluate(() => window.__jf.slotCenter(0));
    const to = await page.evaluate(() => window.__jf.cellCenter(0.5, 7));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await step(150);
    // Mouse: piece centre sits 0.25 cells above the cursor.
    const cs = await page.evaluate(() => window.__jf.layout().cs);
    for (let k = 1; k <= 8; k++) {
      await page.mouse.move(from.x + ((to.x - cs * 0.3 - from.x) * k) / 8, from.y + ((to.y + cs * 0.55 - from.y) * k) / 8);
      await step(30);
    }
    await step(300);
    await shot('drag-preview');
    await page.mouse.up();
    await step(140);
    await shot('drop-clear2');
    await step(900);

    // 4. Three-line clear moment.
    await page.evaluate((rows) => {
      window.__jf.setBoard(rows);
      window.__jf.setTray(['v3', 'sq2', '1x1'], [0, 4, 6]);
      window.__jf.setScore(12040, 3);
    }, CLEAR3);
    await step(500);
    await page.evaluate(() => window.__jf.place(0, 0, 4));
    await step(95);
    await shot('clear3');
    await step(140);
    await shot('clear3-burst');

    // 5. Combo banner + word.
    await step(160);
    await shot('combo');
    await step(1500);

    // 5b. Danger: Jello gets worried.
    await page.evaluate(() => {
      window.__jf.setBoard(['11.11111', '1111.111', '111111.1', '.1111111', '11.1111.', '.111.11.', '1.11.1..', '........']);
      window.__jf.setTray(['h3', '1x1', 'sl1'], [4, 1, 5]);
    });
    await step(300);
    await page.evaluate(() => window.__jf.place(0, 7, 0));
    await step(700);
    await shot('jello-worried');
    await step(2500);

    // 6. Game over.
    await page.evaluate(() => {
      window.__jf.setBoard(['.12.4560', '1.34.601', '23.56.12', '345.01.3', '4560.23.', '.6012.45', '6.1234.6', '01.3456.']);
      window.__jf.setTray(['1x1', 'sq3', 'h5'], [2, 3, 4]);
      window.__jf.setScore(18350);
    });
    await step(400);
    await page.evaluate(() => window.__jf.place(0, 0, 0));
    await step(1000);
    await shot('gameover-moment');
    await step(1800);
    await page.waitForTimeout(800);
    await step(100);
    await shot('gameover');
    await ctx.close();
  }
  await browser.close();
  await server.close();
  if (errors.length) {
    console.log('Console errors:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Screenshots written to screenshots/ (no console errors).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
