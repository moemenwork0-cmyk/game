/**
 * Live smoke test on the built game (real frame loop): mouse drag, touch drag, resume after reload,
 * blocked localStorage, no console errors.   npm run build && node scripts/smoke.mjs
 */
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const fail = (m) => {
  console.error('FAIL: ' + m);
  process.exitCode = 1;
};

async function dragPiece(page, slot, touch, forceRow = -1) {
  // Find a slot piece and a cell where it fits, then drive the real pointer there.
  const plan = await page.evaluate(({ slot, forceRow }) => {
    const app = window.__jf.app;
    const s = app.session;
    const t = s.tray[slot];
    if (!t) return null;
    const L = app.renderer.lay;
    for (let i = 0; i < 64; i++) {
      const r = i >> 3;
      const c = i & 7;
      if (forceRow >= 0 && r !== forceRow) continue;
      if (s.canPlace(slot, r, c)) return { r, c, L, slot };
    }
    return null;
  }, { slot, forceRow });
  if (!plan) return false;
  const { L } = plan;
  const start = await page.evaluate((slot) => window.__jf.slotCenter(slot), slot);
  const sx = start.x;
  const sy = start.y;
  // The piece runs ahead of the pointer (theme.ts drag gains): ask the game where the pointer must go.
  const t = await page.evaluate(({ slot, r, c, touch }) => window.__jf.pointerFor(slot, r, c, touch), { ...plan, touch });
  const tx = t.x;
  const ty = t.y;
  const target = await page.evaluate(({ r, c }) => window.__jf.cellCenter(r, c), plan);
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  const tp = async (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  if (touch) await tp('touchStart', sx, sy);
  else {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
  }
  for (let k = 1; k <= 12; k++) {
    const x = sx + ((tx - sx) * k) / 12;
    const y = sy + ((ty - sy) * k) / 12;
    if (touch) await tp('touchMove', x, y);
    else await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  if (touch) await tp('touchEnd', tx, ty);
  else await page.mouse.up();
  if (forceRow === 0) {
    const vp = page.viewportSize();
    const travel = Math.hypot(tx - sx, ty - sy);
    const piece = Math.hypot(target.x - sx, target.y - sy);
    console.log(`${touch ? 'touch' : 'mouse'} ${vp.width}×${vp.height}${L.wide ? ' (wide)' : ''}: top row needs ${Math.round(travel)} px of ${touch ? 'finger' : 'mouse'} travel (the piece covers ~${Math.round(piece)} px)`);
  }
  await page.waitForTimeout(250);
  return true;
}

async function main() {
  const server = await preview({ preview: { port: 4174 }, logLevel: 'silent' });
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  const errors = [];

  for (const touch of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    const t0 = Date.now();
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf);
    console.log(`${touch ? 'touch' : 'mouse'}: interactive in ${Date.now() - t0} ms`);
    // Tap Jello on the home screen: he must react (poke dent) and the menu must stay usable.
    await page.waitForTimeout(700);
    const jp = await page.evaluate(() => {
      const j = window.__jf.app.jello;
      return { x: j.x, y: j.ground - j.H * 0.5 };
    });
    if (touch) await page.touchscreen.tap(jp.x, jp.y);
    else await page.mouse.click(jp.x, jp.y);
    await page.waitForTimeout(60);
    const poked = await page.evaluate(() => window.__jf.app.jello.poke.x !== 0);
    if (!poked) fail('tapping Jello did nothing');
    else console.log(`${touch ? 'touch' : 'mouse'}: Jello reacts to taps`);
    await page.click('.btn-play', { force: true });
    await page.waitForTimeout(300);
    if (touch) {
      await page.evaluate(() => window.__jf.setBoard(['........', '........', '........', '........', '........', '........', '........', '........']));
      await page.evaluate(() => window.__jf.setTray(['h3', 'v3', 'sq2']));
      await page.waitForTimeout(400);
      const before = await page.evaluate(() => window.__jf.app.session.board.toRows()[0]);
      await dragPiece(page, 0, true, 0);
      const row0 = await page.evaluate(() => window.__jf.app.session.board.toRows()[0]);
      if (row0 === before) fail('touch drag could not reach the top row');
    }
    let placed = 0;
    for (let k = 0; k < 6; k++) {
      const before = await page.evaluate(() => window.__jf.app.session.stats.placements);
      const slot = await page.evaluate(() => window.__jf.app.session.tray.findIndex((t, i) => t && window.__jf.app.session.fits[i]));
      if (slot < 0) break;
      await dragPiece(page, slot, touch);
      const after = await page.evaluate(() => window.__jf.app.session.stats.placements);
      if (after > before) placed++;
    }
    if (placed < 5) fail(`${touch ? 'touch' : 'mouse'} drags placed only ${placed}/6`);
    else console.log(`${touch ? 'touch' : 'mouse'}: ${placed} drags placed`);
    const snap = await page.evaluate(() => window.__jf.state());
    await page.reload();
    await page.waitForFunction(() => !!window.__jf);
    const again = await page.evaluate(() => window.__jf.state());
    if (JSON.stringify(snap.board) !== JSON.stringify(again.board) || snap.score !== again.score) fail('resume after reload');
    else console.log('resume after reload: ok');
    await ctx.close();
  }

  // Mouse on laptop/desktop screens: the top row must be reachable with a short movement,
  // from every tray slot, and the far columns too.
  for (const [w, h] of [[1366, 768], [1280, 720], [1440, 900], [1920, 1080], [907, 510], [821, 462], [1216, 684]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${w}×${h}: ` + e.message));
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf);
    await page.click('.btn-play', { force: true });
    await page.waitForTimeout(300);
    for (const [slot, ids] of [[0, ['sq2', 'h3', 'v3']], [1, ['h3', 'sq2', 'v3']], [2, ['h3', 'v3', 'sq2']]]) {
      await page.evaluate(() => window.__jf.setBoard(['........', '........', '........', '........', '........', '........', '........', '........']));
      await page.evaluate((ids) => window.__jf.setTray(ids), ids);
      await page.waitForTimeout(350);
      await dragPiece(page, slot, false, 0);
      const row0 = await page.evaluate(() => window.__jf.app.session.board.toRows()[0]);
      if (row0 === '........') fail(`mouse ${w}×${h}: slot ${slot} could not reach the top row`);
    }
    await ctx.close();
  }

  // Language switch: Arabic by default, Settings → Language reloads in English and remembers it.
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('lang: ' + e.message));
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf);
    const before = await page.evaluate(() => document.documentElement.lang);
    await page.click('.b-gear', { force: true });
    await page.waitForTimeout(300);
    await Promise.all([page.waitForEvent('load'), page.click('.row-lang', { force: true })]);
    await page.waitForFunction(() => !!window.__jf);
    const after = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, play: document.querySelector('.play-label')?.textContent }));
    await page.reload();
    await page.waitForFunction(() => !!window.__jf);
    const kept = await page.evaluate(() => document.documentElement.lang);
    if (before !== 'ar' || after.lang !== 'en' || after.dir !== 'ltr' || kept !== 'en') fail(`language switch: ${before} → ${JSON.stringify(after)} → ${kept}`);
    else console.log(`language switch: ar → en («${after.play}»), remembered after reload`);
    await ctx.close();
  }

  // localStorage blocked.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('blocked storage: ' + e.message));
  await page.goto(`${url}?test=1`);
  await page.waitForFunction(() => !!window.__jf);
  const ok = await page.evaluate(() => window.__jf.app.session.tray.filter(Boolean).length === 3);
  if (!ok) fail('game with blocked storage');
  else console.log('blocked localStorage: ok');
  await ctx.close();

  await browser.close();
  await server.close();
  if (errors.length) fail('console errors:\n' + errors.join('\n'));
  else console.log('no console errors');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
