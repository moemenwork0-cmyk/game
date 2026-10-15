/** Settings dialog: sound, music, haptics, reduced motion. Changes apply and save immediately. */
import { STR } from '../../config/strings';
import type { Settings } from '../../meta/save';
import { button, stroked } from '../dom';

const ROWS: { key: keyof Settings; label: string }[] = [
  { key: 'sfx', label: STR.sound },
  { key: 'jello', label: STR.jelloTalk },
  { key: 'music', label: STR.music },
  { key: 'haptics', label: STR.haptics },
  { key: 'reducedMotion', label: STR.reducedMotion },
];

export class SettingsScreen {
  readonly root: HTMLElement;
  visible = false;
  private onClose: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly get: () => Settings,
    private readonly set: (k: keyof Settings, v: boolean) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'overlay dialog settings';
    this.root.innerHTML = `
      <div class="panel" role="dialog" aria-label="${STR.settings}">
        <div class="ribbon">${stroked(STR.settings)}</div>
        <div class="well rows">
          ${ROWS.map(
            (r) => `
            <button class="row" type="button" data-k="${r.key}" role="switch">
              <span class="row-label">${r.label}</span>
              <span class="switch"><span class="knob"></span></span>
            </button>`,
          ).join('')}
        </div>
        <div class="btn-col">${button('btn-gold btn-wide btn-done', STR.done)}</div>
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelectorAll<HTMLButtonElement>('.row').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k as keyof Settings;
        this.set(k, !this.get()[k]);
        this.refresh();
      }),
    );
    this.root.querySelector('.btn-done')!.addEventListener('click', () => this.hide());
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.hide();
    });
  }

  private refresh(): void {
    const s = this.get();
    this.root.querySelectorAll<HTMLButtonElement>('.row').forEach((b) => {
      const on = s[b.dataset.k as keyof Settings];
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  show(onClose?: () => void): void {
    this.onClose = onClose ?? null;
    this.refresh();
    this.visible = true;
    this.root.classList.add('show');
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.root.classList.remove('show');
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }
}
