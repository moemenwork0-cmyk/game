/**
 * CrazyGames build check: npm run build:crazygames && node scripts/cg-smoke.mjs
 * 1. A fake SDK (environment "crazygames") records every call: init, loading, gameplay start/stop on
 *    play/pause/resume/menu/game over, happy time, the mute setting, and saves through the Data module.
 * 2. The SDK script fails to load: the game must still boot quickly and play.
 * 3. The real SDK on localhost (environment "local"), if the network allows it.
 */
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const SDK = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const fail = (m) => {
  console.error('FAIL: ' + m);
  process.exitCode = 1;
};

const FAKE = `(() => {
  const log = (window.__cg = []);
  const store = {};
  const listeners = [];
  const settings = { muteAudio: false, disableChat: false };
  window.__cgSetMute = (m) => { settings.muteAudio = m; listeners.forEach((l) => l({ ...settings })); };
  window.__cgStore = store;
  const g = (n) => () => log.push(n);
  window.CrazyGames = { SDK: {
    environment: 'crazygames',
    init: () => { log.push('init'); return new Promise((r) => setTimeout(r, 120)); },
    game: { loadingStart: g('loadingStart'), loadingStop: g('loadingStop'), gameplayStart: g('gameplayStart'),
      gameplayStop: g('gameplayStop'), happytime: g('happytime'), settings,
      addSettingsChangeListener: (l) => listeners.push(l) },
    data: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear: () => {} },
  } };
})();`;

async function main() {
  const server = await preview({ build: { outDir: 'dist-crazygames' }, preview: { port: 4176 }, logLevel: 'silent' });
  const url = server.resolvedUrls.local[0];
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, tag) => {
    page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && !/crazygames|ERR_|net::/i.test(m.text()) && errors.push(`${tag}: ${m.text()}`));
  };

  // 1. Fake SDK.
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    await ctx.route(SDK, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
    const page = await ctx.newPage();
    watch(page, 'fake');
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf);
    await page.waitForTimeout(400);
    const log = () => page.evaluate(() => window.__cg.join(' '));
    if ((await log()) !== 'init loadingStart loadingStop') fail('boot events: ' + (await log()));
    await page.click('.btn-play', { force: true });
    await page.waitForTimeout(200);
    await page.click('.hud-pause', { force: true }).catch(() => fail('no pause button'));
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter'); // resume
    await page.waitForTimeout(200);
    // Beat the record and make a perfect clear: one happy time (throttled to 60 s).
    await page.evaluate(() => {
      const app = window.__jf.app;
      app.store.data.best = 50;
      window.__jf.setBoard(['........', '........', '........', '........', '........', '........', '........', 'XXXXXXX.'.replace(/X/g, '1')]);
      app.bestAtStart = 50;
      window.__jf.setScore(40);
      window.__jf.setTray(['1x1', '1x1', '1x1']);
    });
    await page.evaluate(() => window.__jf.place(0, 7, 7));
    await page.waitForTimeout(300);
    const happy = (await log()).split(' ').filter((e) => e === 'happytime').length;
    if (happy !== 1) fail(`happy time sent ${happy}× (want 1, throttled)`);
    // Game over → stop.
    await page.evaluate(() => {
      // Checkerboard: a single block fits, the long bars never do.
      window.__jf.setBoard(['1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1', '1.1.1.1.', '.1.1.1.1']);
      window.__jf.setTray(['1x1', 'h5', 'v5']);
    });
    await page.evaluate(() => window.__jf.place(0, 0, 1));
    await page.waitForTimeout(400);
    const seq = (await log()).split(' ').filter((e) => e.startsWith('gameplay'));
    // play, pause, resume, (setBoard keeps playing: de-duplicated), game over.
    const want = ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop'];
    if (seq.slice(0, 4).join() !== want.join()) fail('gameplay events: ' + seq.join(' '));
    for (let i = 1; i < seq.length; i++) if (seq[i] === seq[i - 1]) fail('gameplay event sent twice in a row: ' + seq.join(' '));
    // Mute from the portal wins; unmute restores.
    await page.evaluate(() => window.__cgSetMute(true));
    const muted = await page.evaluate(() => window.__jf.app.audio.ready() === false && window.__jf.app.audio.muted === true);
    await page.evaluate(() => window.__cgSetMute(false));
    const unmuted = await page.evaluate(() => window.__jf.app.audio.muted === false);
    if (!muted || !unmuted) fail(`portal mute (muted ${muted}, unmuted ${unmuted})`);
    // Saves go through the Data module.
    const saved = await page.evaluate(() => !!window.__cgStore['jellyfit.save.v1']);
    if (!saved) fail('no save in the Data module');
    console.log(`fake SDK: ${(await log()).split(' ').length} events ok (${seq.join(' → ')}), happy time throttled, mute ok, Data module save ok`);
    await ctx.close();
  }

  // 1b. Portal muted from the start: the game starts silent.
  {
    const ctx = await browser.newContext();
    await ctx.route(SDK, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE.replace('muteAudio: false', 'muteAudio: true') }));
    const page = await ctx.newPage();
    watch(page, 'muted');
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf);
    if (!(await page.evaluate(() => window.__jf.app.audio.muted))) fail('muteAudio at boot ignored');
    else console.log('muteAudio at boot: ok');
    // No SDK locale here and an English browser: English.
    if ((await page.evaluate(() => document.documentElement.lang)) !== 'en') fail('default language on CrazyGames is not English');
    await ctx.close();
  }

  // 1c. An Arabic player (SDK locale ar-EG) gets Arabic.
  {
    const ctx = await browser.newContext();
    await ctx.route(SDK, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE.replace("environment: 'crazygames',", "environment: 'crazygames', user: { systemInfo: { locale: 'ar-EG' } },") }));
    const page = await ctx.newPage();
    watch(page, 'arabic');
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf);
    const info = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, play: document.querySelector('.play-label')?.textContent }));
    if (info.lang !== 'ar' || info.dir !== 'rtl') fail('SDK locale ar-EG did not pick Arabic: ' + JSON.stringify(info));
    else console.log(`SDK locale: en → English, ar-EG → Arabic («${info.play}»)`);
    await ctx.close();
  }

  // 2. SDK blocked / offline.
  {
    const ctx = await browser.newContext();
    await ctx.route(SDK, (r) => r.abort());
    const page = await ctx.newPage();
    watch(page, 'blocked');
    const t0 = Date.now();
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf, null, { timeout: 8000 });
    const ms = Date.now() - t0;
    await page.click('.btn-play', { force: true });
    const ok = await page.evaluate(() => window.__jf.place(window.__jf.app.session.tray.findIndex(Boolean), 0, 0) || true);
    if (!ok || ms > 2500) fail(`blocked SDK: boot ${ms} ms`);
    else console.log(`SDK blocked: game boots in ${ms} ms and plays`);
    await ctx.close();
  }

  // 2b. SDK never answers (hangs): the 3 s cap holds.
  {
    const ctx = await browser.newContext();
    await ctx.route(SDK, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE.replace('setTimeout(r, 120)', 'void r') }));
    const page = await ctx.newPage();
    watch(page, 'hang');
    const t0 = Date.now();
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf, null, { timeout: 8000 });
    const ms = Date.now() - t0;
    if (ms > 4500) fail(`hanging SDK init held the game ${ms} ms`);
    else console.log(`SDK init hangs: game still boots in ${ms} ms`);
    await ctx.close();
  }

  // 3. Real SDK (local environment), when reachable.
  {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    page.on('pageerror', (e) => errors.push('real: ' + e.message));
    await page.goto(`${url}?test=1`);
    await page.waitForFunction(() => !!window.__jf, null, { timeout: 8000 });
    const env = await page.evaluate(() => window.CrazyGames?.SDK?.environment ?? null);
    if (!env) console.log('real SDK: not reachable from here (skipped)');
    else {
      await page.click('.btn-play', { force: true });
      await page.waitForTimeout(800);
      const hit = logs.filter((l) => /gameplay|loading/i.test(l)).map((l) => l.replace(/%c|[a-z-]+: [^;]+;/g, '').replace(/\s+/g, ' ').trim());
      console.log(`real SDK: environment "${env}", SDK console: ${hit.length ? hit.slice(0, 4).join(' | ') : '(no event logs)'}`);
    }
    await ctx.close();
  }

  await browser.close();
  await server.close();
  if (errors.length) fail('errors:\n' + errors.join('\n'));
  else console.log('no page errors');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
