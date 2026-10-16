/**
 * CrazyGames preview videos, recorded from the real game frame by frame (deterministic, 30 fps):
 *   landscape 1920×1080 (16:9) and portrait 1080×1620 (2:3), 10 s, no sound, opening on the cover.
 * A scripted run: 2-line clear → combo → a piece handed to Jello → 3-line clear + new record →
 * perfect clear with the piece from Jello's hand. A cartoon hand carries the pieces (CrazyGames
 * doesn't allow the default mouse cursor in videos).
 *   npm run build && node scripts/trailer.mjs [landscape|portrait]  →  videos/
 */
import { preview } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { COVERS, renderCover } from './cover-lib.mjs';

const FPS = 30;
const TOTAL_S = 10;
const COVER_S = 0.9; // cover alone, then a crossfade into the game
const FADE_S = 0.4;
const GAME_FRAMES = Math.round((TOTAL_S - COVER_S + FADE_S) * FPS);

const FORMATS = {
  // CSS viewport × 2 = video size. 960×540 uses the wide layout (tray beside the board).
  landscape: { vw: 960, vh: 540, cover: 'cover-landscape-1920x1080.png', coverScale: 1, out: 'jellyfit-landscape-1920x1080.mp4', w: 1920, h: 1080 },
  portrait: { vw: 540, vh: 810, cover: 'cover-portrait-800x1200.png', coverScale: 1.35, out: 'jellyfit-portrait-1080x1620.mp4', w: 1080, h: 1620 },
};

// Board at the start: every clear in the run is a column, and column 4 stays empty, so no row ever
// completes by accident. Digits are jelly colours.
const START = ['0114....', '0124.335', '062..355', '662..445', '6....400', '.331.220', '.531.621', '.551.661'];

/** Cartoon glove (port of the tutorial finger) on an overlay canvas above the game. */
function installHand() {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d');
  const INK = '#0F1A44';
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  window.__hand = (x, y, press, alpha, s) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (alpha <= 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(-0.28);
    const k = 1 - 0.12 * press;
    ctx.scale(k, k);
    if (press > 0.5) {
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * press})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    const shape = () => {
      rr(-s * 0.12, -s * 0.02, s * 0.24, s * 0.62, s * 0.12);
      ctx.fill();
      ctx.stroke();
      rr(-s * 0.18, s * 0.42, s * 0.66, s * 0.56, s * 0.22);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(s * (0.18 + i * 0.15), s * 0.47, s * 0.09, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(-s * 0.22, s * 0.62, s * 0.1, s * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    ctx.save();
    ctx.translate(3, 5);
    ctx.globalAlpha *= 0.3;
    ctx.fillStyle = '#000';
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    shape();
    ctx.restore();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = INK;
    shape();
    ctx.fillStyle = '#FFD84A';
    rr(-s * 0.2, s * 0.92, s * 0.7, s * 0.16, s * 0.06);
    ctx.fill();
    ctx.stroke();
  };
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

async function record(browser, url, fmt, dir) {
  const page = await browser.newPage({ viewport: { width: fmt.vw, height: fmt.vh }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?test=1&lang=en`);
  await page.waitForFunction(() => !!window.__jf);
  await page.evaluate(installHand);
  await page.evaluate(() => {
    const app = window.__jf.app;
    // The tip tutorial would cover the board; this run already knows the trick.
    app.store.data.tips.hold = true;
    window.__jf.manual(true);
  });
  const step = (ms) => page.evaluate((m) => window.__jf.step(m), ms);
  await page.click('.btn-play', { force: true });
  await step(400);
  await page.evaluate((rows) => {
    window.__jf.setBoard(rows);
    window.__jf.setTray(['h2', 'v3', 'v3'], [4, 5, 0]);
    window.__jf.setScore(3480);
  }, START);
  // Let the deal pop and Jello settle (his greeting bubble fades) before filming.
  for (let i = 0; i < 90; i++) await step(1000 / FPS);

  let frame = 0;
  const hand = { x: fmt.vw * 0.86, y: fmt.vh * 1.05, press: 0, alpha: 1 };
  const handSize = fmt.vw > fmt.vh ? 46 : 48;
  const shoot = async () => {
    if (frame >= GAME_FRAMES) return;
    await step(1000 / FPS);
    await page.evaluate(({ x, y, p, a, s }) => window.__hand(x, y, p, a, s), { x: hand.x, y: hand.y, p: hand.press, a: hand.alpha, s: handSize });
    await page.screenshot({ path: join(dir, `${String(frame).padStart(4, '0')}.png`) });
    frame++;
  };
  const glide = async (tx, ty, n) => {
    const fx = hand.x;
    const fy = hand.y;
    for (let i = 1; i <= n; i++) {
      const t = ease(i / n);
      hand.x = lerp(fx, tx, t);
      hand.y = lerp(fy, ty, t) - Math.sin(t * Math.PI) * 18;
      hand.press = Math.max(0, hand.press - 0.25);
      await shoot();
    }
  };
  const idle = async (n) => {
    for (let i = 0; i < n; i++) {
      hand.press = Math.max(0, hand.press - 0.2);
      await shoot();
    }
  };
  /** Fingertip on the bottom of the dragged piece, so the hand visibly carries it. */
  const followPiece = async () => {
    const d = await page.evaluate(() => {
      const app = window.__jf.app;
      const dr = app.drag.drag;
      if (!dr) return null;
      const P = window.__jf.pieceDims(dr.piece);
      return { x: dr.cx, y: dr.cy + (P.h * dr.cs) / 2 - dr.cs * 0.28 };
    });
    if (d) {
      hand.x = d.x;
      hand.y = d.y;
    }
  };

  /**
   * One drag with the real pointer. `to` = { r, c } (top-left cell) or 'jello'. Slot 3 = Jello's hand.
   */
  const drag = async (slot, to, moveFrames = 16) => {
    const plan = await page.evaluate(
      ({ slot, to }) => {
        const app = window.__jf.app;
        const L = app.renderer.lay;
        const item = app.session.item(slot);
        const P = window.__jf.pieceDims(item.piece);
        const p0 = slot === 3 ? (({ cx, cy }) => ({ x: cx, y: cy }))(app.renderer.holdPose(item.piece)) : window.__jf.slotCenter(slot);
        let r;
        let c;
        if (to === 'jello') {
          const j = app.jello;
          r = (j.ground - j.H * 0.5 - L.gridY) / L.cs - P.h / 2;
          c = (j.x - L.gridX) / L.cs - P.w / 2;
        } else {
          r = to.r;
          c = to.c;
        }
        const t = app.drag.pointerFor(slot, item.piece, p0.x, p0.y, r, c, false);
        const pose = app.renderer.trayPose(slot, item.piece, app.loop.now);
        return { p0, t, grip: { x: pose.cx, y: pose.cy + (P.h * pose.cs) / 2 - pose.cs * 0.2 } };
      },
      { slot, to },
    );
    await glide(plan.grip.x, plan.grip.y, 12);
    await page.mouse.move(plan.p0.x, plan.p0.y);
    await page.mouse.down();
    for (let i = 0; i < 3; i++) {
      hand.press = Math.min(1, hand.press + 0.4);
      await shoot();
    }
    for (let i = 1; i <= moveFrames; i++) {
      const t = ease(i / moveFrames);
      // A gentle arc: real hands never move in straight lines.
      const arc = Math.sin(t * Math.PI) * 14;
      await page.mouse.move(lerp(plan.p0.x, plan.t.x, t) + arc, lerp(plan.p0.y, plan.t.y, t));
      await followPiece();
      await shoot();
    }
    for (let i = 0; i < 4; i++) {
      await followPiece();
      await shoot();
    }
    await page.mouse.up();
    hand.press = 0;
  };
  const check = async (label, want) => {
    const st = await page.evaluate(() => window.__jf.state());
    const ok = want(st);
    console.log(`  ${ok ? 'ok ' : 'BAD'} ${label}  score ${st.score} combo ${st.combo}`);
    if (!ok) process.exitCode = 1;
    return st;
  };

  await idle(4);
  // 1. Two columns at once.
  await drag(0, { r: 4, c: 1 });
  await idle(8);
  await check('two-column clear', (s) => s.board.every((row) => row[1] === '.' && row[2] === '.'));
  // 2. One more column: combo.
  await drag(1, { r: 2, c: 3 });
  await idle(6);
  await check('combo clear', (s) => s.combo >= 2 && s.board.every((row) => row[3] === '.'));
  // 3. Hand the last piece to Jello; the next deal is set so the run continues.
  await drag(2, 'jello', 14);
  const held = await page.evaluate(() => !!window.__jf.app.session.held);
  if (!held) {
    console.log('  BAD Jello did not take the piece');
    process.exitCode = 1;
  }
  // The record falls on the next clear.
  await page.evaluate(() => {
    window.__jf.setTray(['h3', 'sq2', 'sl1'], [2, 6, 3]);
    const app = window.__jf.app;
    const best = app.session.score + 1;
    app.store.data.best = best;
    app.bestAtStart = best;
    app.director.bestAtStart = best;
    app.hud.setBest(best);
  });
  await idle(14);
  // 4. Three columns right under Jello: new record.
  await drag(0, { r: 0, c: 5 });
  await idle(14);
  await check('three-column clear', (s) => s.board.every((row) => row.slice(1) === '.......'));
  // 5. The piece from Jello's hand empties the board.
  await drag(3, { r: 5, c: 0 }, 15);
  await check('perfect clear', (s) => s.board.every((row) => row === '........'));
  // Celebration: hand slides away.
  await glide(fmt.vw * 1.1, fmt.vh * 1.1, 24);
  hand.alpha = 0;
  while (frame < GAME_FRAMES) await shoot();
  await page.close();
  if (errors.length) {
    console.log('  page errors: ' + errors.join(' | '));
    process.exitCode = 1;
  }
}

async function main() {
  if (!existsSync('dist/index.html')) throw new Error('Run npm run build first');
  const which = process.argv[2] ? [process.argv[2]] : Object.keys(FORMATS);
  mkdirSync('videos', { recursive: true });
  const server = await preview({ preview: { port: 4177 }, logLevel: 'silent' });
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  for (const name of which) {
    const fmt = FORMATS[name];
    const dir = join('videos', `.frames-${name}`);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    console.log(`${name}: recording ${GAME_FRAMES} frames…`);
    const coverPath = join(dir, 'cover.png');
    await renderCover(browser, COVERS.find((c) => c.name === fmt.cover), coverPath, fmt.coverScale);
    await record(browser, url, fmt, dir);
    const out = join('videos', fmt.out);
    // Cover first (CrazyGames: the video's first frame is the static cover), crossfade into play.
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-loop', '1', '-framerate', String(FPS), '-t', String(COVER_S), '-i', coverPath,
      '-framerate', String(FPS), '-i', join(dir, '%04d.png'),
      '-filter_complex',
      `[0:v]scale=${fmt.w}:${fmt.h},setsar=1,format=yuv420p[a];[1:v]scale=${fmt.w}:${fmt.h},setsar=1,format=yuv420p[b];[a][b]xfade=transition=fade:duration=${FADE_S}:offset=${COVER_S - FADE_S},format=yuv420p[v]`,
      '-map', '[v]', '-an', '-t', String(TOTAL_S),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', String(FPS), '-movflags', '+faststart',
      out,
    ]);
    rmSync(dir, { recursive: true, force: true });
    console.log(`  → ${out}`);
  }
  await browser.close();
  await server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
