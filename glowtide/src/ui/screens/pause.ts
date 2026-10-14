import { button, el } from '../dom';

export interface PauseScreenOpts {
  onResume: () => void;
  onRestart: () => void;
}

export function pauseScreen(opts: PauseScreenOpts): HTMLElement {
  const overlay = el('div', 'overlay');
  const panel = el('div', 'panel');
  const title = el('h2', '', 'Paused');
  const buttons = el('div', 'buttons');
  const resume = button('Resume', 'btn primary', opts.onResume);

  const showMain = (): void => {
    title.textContent = 'Paused';
    buttons.replaceChildren(resume, button('Restart run', 'btn', showConfirm));
    resume.focus({ preventScroll: true });
  };
  const showConfirm = (): void => {
    title.textContent = 'Restart this run?';
    const yes = button('Restart run', 'btn danger', opts.onRestart);
    buttons.replaceChildren(yes, button('Keep playing', 'btn', showMain));
    yes.focus({ preventScroll: true });
  };

  panel.append(title, buttons);
  overlay.append(panel);
  showMain();
  requestAnimationFrame(() => resume.focus({ preventScroll: true }));
  return overlay;
}
