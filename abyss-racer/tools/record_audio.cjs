// Records N seconds of the game's master audio bus while a race runs (headless) -> webm file.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [query = 'audio=1&race=1&auto=1', out = 'game_audio.webm', secs = '8'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(`${process.env.BASE || 'http://127.0.0.1:5173/'}?${query}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  const b64 = await page.evaluate(async (secs) => {
    const a = window.__abyss.audio;
    const dest = a.ctx.createMediaStreamDestination();
    a.master.connect(dest);
    const rec = new MediaRecorder(dest.stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    await new Promise((r) => setTimeout(r, secs * 1000));
    rec.stop();
    await new Promise((r) => (rec.onstop = r));
    const buf = await new Blob(chunks).arrayBuffer();
    let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s);
  }, Number(secs));
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
  await browser.close();
})();
