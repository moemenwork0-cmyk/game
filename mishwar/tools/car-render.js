// يرسم العربيات: شغّل سيرفر في فولدر فيه car-render.html و node_modules/three@0.160.0، وبعدين:
//   node car-render.js '[{"c":"#f3f3f4","v":"iso","w":960,"h":544,"out":"car_white.png"}]'
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  p.on('console', m => console.log('LOG', m.text()));
  await p.goto(process.env.RENDER_URL || 'http://127.0.0.1:8765/car-render.html');
  await p.waitForFunction(() => window.ready, null, { timeout: 30000 });
  const jobs = JSON.parse(process.argv[2]);
  for (const j of jobs) {
    const url = await p.evaluate(([c, v, w, h, r]) => window.renderCar(c, v, w, h, r), [j.c, j.v, j.w, j.h, j.r]);
    fs.writeFileSync(j.out, Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close();
})();
