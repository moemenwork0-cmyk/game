// Headless screenshot: node tools/shot.mjs "<query>" out.png [width height waitMs]
const { chromium } = require('playwright');
(async () => {
const [query = '', out = 'shot.png', w = '1280', h = '720', wait = '4000'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const mobile = !!process.env.MOBILE;
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
const logs = [];
await page.addInitScript(() => { Error.stackTraceLimit = 40; });
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5173/'}?still&${query}`);
try { await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }); } catch (e) { logs.push('TIMEOUT waiting for __ready'); }
await page.waitForTimeout(+wait);
if (process.env.EVAL) console.log('EVAL:', await page.evaluate(process.env.EVAL));
await page.screenshot({ path: out, timeout: 120000 });
console.log(logs.slice(-30).join('\n'));
await browser.close();
})();
