/** Cover designs shared by covers.mjs (the 3 cover images) and trailer.mjs (the videos open on the cover). */
import { readFileSync } from 'node:fs';

const art = 'data:image/png;base64,' + readFileSync('assets/icon.png').toString('base64');
const font =
  'data:font/woff2;base64,' + readFileSync('node_modules/@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-latin-800-normal.woff2').toString('base64');

const css = (fs) => `
@font-face { font-family: 'Baloo'; font-weight: 800; src: url(${font}) format('woff2'); }
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
body { position: relative; background: #0b2bc4; font-family: 'Baloo'; font-weight: 800; }
.rays { position: absolute; inset: -50%; background: repeating-conic-gradient(from 0deg at var(--rx) var(--ry), #0a1d93 0deg 7deg, #0c52f0 7deg 15deg); }
.vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at var(--vx) var(--vy), rgba(80,170,255,0.35), rgba(4,10,70,0) 45%, rgba(4,10,60,0.55) 100%); }
.art { position: absolute; }
.title { position: absolute; display: flex; flex-direction: column; align-items: center; font-size: ${fs}px; line-height: 0.95; transform: rotate(-4deg); }
.word { position: relative; display: block; margin: -0.27em 0; }
.title.row { flex-direction: row; align-items: center; gap: 0.12em; }
.title.row .word { margin: 0; }
.title.row .w2 { font-size: 1em; margin: 0; }
.word span { display: block; padding: 0.24em 0.14em; line-height: 1; }
.stroke { color: #0f1a44; -webkit-text-stroke: 0.19em #0f1a44; text-shadow: 0 0.04em 0 #0f1a44, 0 0.08em 0 #0f1a44, 0 0.12em 0 #0f1a44, 0 0.22em 0.2em rgba(6,12,40,0.5); }
.fill { position: absolute; inset: 0; color: transparent; -webkit-background-clip: text; background-clip: text; }
.w1 .fill { background-image: linear-gradient(178deg, #ffe3ec 0%, #ffa3c0 26%, #ff6f99 50%, #f0457c 72%, #c92e62 100%); }
.w2 { font-size: 0.78em; margin-top: -0.06em; }
.w2 .fill { background-image: linear-gradient(178deg, #fffbe0 0%, #ffe680 28%, #ffc93a 55%, #ff9f1a 80%, #e07c00 100%); }
`;

const title = `<div class="title"><div class="word w1"><span class="stroke">Jelly</span><span class="fill">Jelly</span></div><div class="word w2"><span class="stroke">Fit</span><span class="fill">Fit</span></div></div>`;

export const COVERS = [
  {
    name: 'cover-landscape-1920x1080.png',
    w: 1920,
    h: 1080,
    fs: 270,
    vars: '--rx: 70%; --ry: 42%; --vx: 68%; --vy: 42%;',
    // Art full height on the right, flush with the top and bottom edges; side edges fade into the rays.
    art: 'left: 780px; top: 0; width: 1080px; height: 1080px; -webkit-mask-image: linear-gradient(to right, transparent 0, #000 16%, #000 88%, transparent 100%);',
    titlePos: 'left: 70px; top: 300px; width: 760px;',
  },
  {
    name: 'cover-portrait-800x1200.png',
    w: 800,
    h: 1200,
    fs: 190,
    vars: '--rx: 50%; --ry: 62%; --vx: 50%; --vy: 60%;',
    // Art fills the bottom two thirds edge to edge; its top edge fades into the rays.
    art: 'left: 0; top: 400px; width: 800px; height: 800px; -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 14%);',
    titlePos: 'left: 0; top: 30px; width: 800px;',
  },
  {
    name: 'cover-square-800x800.png',
    w: 800,
    h: 800,
    fs: 116,
    vars: '--rx: 50%; --ry: 60%; --vx: 50%; --vy: 58%;',
    row: true,
    // Art flush with the bottom edge; sides and top fade into the rays.
    art: 'left: 60px; top: 120px; width: 680px; height: 680px; -webkit-mask-image: linear-gradient(to right, transparent 0, #000 14%, #000 86%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 16%); -webkit-mask-composite: source-in; mask-composite: intersect;',
    titlePos: 'left: 0; top: 0; width: 800px; justify-content: center;',
  },
];

/** Full HTML page for a cover (rendered at c.w × c.h CSS px). */
export function coverHtml(c) {
  return `<!doctype html><html><head><style>${css(c.fs)} :root{${c.vars}}</style></head><body><div class="rays"></div><div class="vignette"></div><img class="art" style="${c.art}" src="${art}"><div class="title${c.row ? ' row' : ''}" style="${c.titlePos}">${title.slice(title.indexOf('>') + 1, -6)}</div></body></html>`;
}

/** Renders a cover to a PNG file; `scale` > 1 for a sharper, bigger image (e.g. 1080×1620 from 800×1200). */
export async function renderCover(browser, c, path, scale = 1) {
  const page = await browser.newPage({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: scale });
  await page.setContent(coverHtml(c));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path });
  await page.close();
}
