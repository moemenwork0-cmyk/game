/**
 * Builds one self-contained HTML file (JS, CSS and fonts inlined) that plays offline by just
 * opening it in a browser.   npm run build && npm run single   →  jellyfit.html
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist';
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const assets = readdirSync(join(dir, 'assets'));
const dataUri = (file) => `data:font/woff2;base64,${readFileSync(join(dir, 'assets', file)).toString('base64')}`;

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)"[^>]*>/, (_, f) => {
  return `<style>${readFileSync(join(dir, 'assets', f), 'utf8')}</style>`;
});
html = html.replace(/<script type="module"[^>]*src="\.\/assets\/([^"]+)"[^>]*><\/script>/, (_, f) => {
  let js = readFileSync(join(dir, 'assets', f), 'utf8');
  for (const font of assets.filter((a) => a.endsWith('.woff2'))) {
    js = js.split(`new URL("${font}",import.meta.url).href`).join(JSON.stringify(dataUri(font)));
  }
  if (js.includes('import.meta.url')) throw new Error('unresolved asset URL left in bundle');
  return `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`;
});
// Scripts go to the end of <body> so the DOM exists when the inlined module runs.
const scriptStart = html.indexOf('<script type="module">');
const scriptEnd = html.indexOf('</script>', scriptStart) + '</script>'.length;
const script = html.slice(scriptStart, scriptEnd);
html = html.slice(0, scriptStart) + html.slice(scriptEnd);
html = html.replace('</body>', `${script}\n</body>`);
writeFileSync('jellyfit.html', html);
console.log(`jellyfit.html: ${(html.length / 1024).toFixed(1)} KB`);
