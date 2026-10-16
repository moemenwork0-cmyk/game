import './ui/ui.css';
import ar600 from '@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-arabic-600-normal.woff2?url';
import ar800 from '@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-arabic-800-normal.woff2?url';
import la600 from '@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-latin-600-normal.woff2?url';
import la800 from '@fontsource/baloo-bhaijaan-2/files/baloo-bhaijaan-2-latin-800-normal.woff2?url';
import { STR, setLang } from './config/strings';
import { pickLang, savedLang } from './meta/lang';
import { App } from './app';
import { createPlatform } from './platform/platform';

function fatal(): void {
  if (document.querySelector('.fatal')) return;
  const el = document.createElement('div');
  el.className = 'fatal';
  el.textContent = STR.fatal;
  document.body.appendChild(el);
}

async function loadFonts(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts) return;
  // Arabic letters + Latin (digits, ×, punctuation) from the same family.
  const AR = 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC';
  const LA = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
  const fam = 'Baloo Bhaijaan 2';
  const faces = [
    new FontFace(fam, `url(${ar600}) format('woff2')`, { weight: '600', display: 'swap', unicodeRange: AR }),
    new FontFace(fam, `url(${ar800}) format('woff2')`, { weight: '800', display: 'swap', unicodeRange: AR }),
    new FontFace(fam, `url(${la600}) format('woff2')`, { weight: '600', display: 'swap', unicodeRange: LA }),
    new FontFace(fam, `url(${la800}) format('woff2')`, { weight: '800', display: 'swap', unicodeRange: LA }),
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
  const params = new URLSearchParams(location.search);
  const platform = createPlatform();
  // Fonts and the portal SDK load side by side; neither can hold the game for more than ~3 s.
  await Promise.all([loadFonts(), platform.init()]);
  platform.loadingStart();
  // CrazyGames needs English as the default; the app and other builds default to Arabic.
  setLang(pickLang(params.get('lang') ?? savedLang(), platform.locale(), platform.name === 'crazygames' ? 'en' : 'ar'));
  const app = new App({
    debug: params.get('debug') === '1',
    test: params.get('test') === '1',
    platform,
    storage: platform.storage() ?? undefined,
  });
  app.start();
  requestAnimationFrame(() => platform.loadingStop());
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
