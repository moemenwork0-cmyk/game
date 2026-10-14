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
  const sx = L.trayX + L.slotW * (slot + 0.5);
  const sy = L.trayY + L.trayH / 2;
  // Target centre of the piece's top-left cell, adjusted for the input offset.
  const info = await page.evaluate(({ slot, r, c }) => {
    const app = window.__jf.app;
    const L = app.renderer.lay;
    const t = app.session.tray[slot];
    const P = window.__jf.pieceDims(t.piece);
    return { x: L.gridX + (c + P.w / 2) * L.cs, y: L.gridY + (r + P.h / 2) * L.cs, cs: L.cs, h: P.h };
  }, plan);
  // Touch: the piece floats 1.4 cells above the finger and moves faster than it (theme.ts drag gains).
  const lift = 1.4 * info.cs + (info.h * info.cs) / 2;
  const tx = touch ? sx + (info.x - sx) / 1.2 : info.x;
  const ty = touch ? sy + Math.min(0, info.y - (sy - lift)) / 1.6 + Math.max(0, info.y - (sy - lift)) : info.y + 0.25 * info.cs;
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
  if (touch && forceRow === 0) console.log(`touch: reached the top row with ${Math.round(sy - ty)} px of finger travel (board is ${Math.round(L.boardSize)} px)`);
  else await page.mouse.up();
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
