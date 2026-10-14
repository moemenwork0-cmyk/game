import './ui/ui.css';
import font600 from '@fontsource/baloo-2/files/baloo-2-latin-600-normal.woff2?url';
import font800 from '@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2?url';
import { GAME_TITLE } from './config/config';
import { App } from './app';

function fatal(): void {
  if (document.querySelector('.fatal')) return;
  const el = document.createElement('div');
  el.className = 'fatal';
  el.textContent = 'Something went wrong. Reload the page.';
  document.body.appendChild(el);
}

async function loadFonts(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  const faces = [
    new FontFace('Baloo 2', `url(${font600}) format('woff2')`, { weight: '600', display: 'swap' }),
    new FontFace('Baloo 2', `url(${font800}) format('woff2')`, { weight: '800', display: 'swap' }),
  ];
  const load = Promise.all(
    faces.map((f) =>
      f.load().then(
        (ff) => document.fonts.add(ff),
        () => undefined,
      ),
    ),
  );
  // Never block the game for more than a moment on fonts.
  await Promise.race([load, new Promise((r) => setTimeout(r, 1200))]);
}

async function boot(): Promise<void> {
  document.title = GAME_TITLE;
  const params = new URLSearchParams(location.search);
  await loadFonts();
  const app = new App({ debug: params.get('debug') === '1', test: params.get('test') === '1' });
  app.start();
}

let booted = false;
window.addEventListener('error', () => {
  if (!booted) fatal();
});
window.addEventListener('unhandledrejection', () => {
  if (!booted) fatal();
});

boot().then(
  () => {
    booted = true;
  },
  (err) => {
    console.warn(err);
    fatal();
  },
);
