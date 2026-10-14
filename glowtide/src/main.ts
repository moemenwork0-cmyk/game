import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/ui.css';
import { App } from './app';
import { GAME_TITLE } from './config/config';

function showFatal(): void {
  if (document.querySelector('.fatal')) return;
  const div = document.createElement('div');
  div.className = 'fatal';
  div.textContent = 'Something went wrong. Reload the page.';
  document.body.append(div);
}

window.addEventListener('error', (e) => console.error('Uncaught error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) =>
  console.error('Unhandled rejection', e.reason),
);

function boot(): void {
  document.title = GAME_TITLE;
  const container = document.getElementById('app');
  const canvas = document.getElementById('game');
  const ui = document.getElementById('ui');
  const bootScreen = document.getElementById('boot');
  if (!container || !(canvas instanceof HTMLCanvasElement) || !ui)
    throw new Error('Missing root elements');

  const app = new App(container, canvas, ui, () => {
    if (bootScreen) {
      bootScreen.classList.add('hidden');
      setTimeout(() => bootScreen.remove(), 400);
    }
  });
  app.start();
}

try {
  boot();
} catch (err) {
  console.error('Fatal boot error', err);
  showFatal();
}
