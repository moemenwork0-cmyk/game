/** Settings sheet: sound, Jello's chatter, music, vibration, reduced motion, language. Changes apply at once. */
import { LANG, LANG_NAMES, STR, type Lang } from '../../config/strings';
import type { Settings } from '../../meta/save';
import { ICON } from '../icons';
import { button } from '../dom';

const rows = (): { key: keyof Settings; label: string; icon: string }[] => [
  { key: 'sfx', label: STR.sound, icon: ICON.sound },
  { key: 'music', label: STR.music, icon: ICON.music },
  { key: 'jello', label: STR.jelloTalk, icon: ICON.jello },
  { key: 'haptics', label: STR.haptics, icon: ICON.vibrate },
  { key: 'reducedMotion', label: STR.reducedMotion, icon: ICON.motion },
];

export class SettingsScreen {
  readonly root: HTMLElement;
  visible = false;
  private onClose: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly get: () => Settings,
    private readonly set: (k: keyof Settings, v: boolean) => void,
    onLang?: (l: Lang) => void,
  ) {
    const other: Lang = LANG === 'ar' ? 'en' : 'ar';
    // Labelled in both languages so anyone can find it.
    const langLabel = `${STR.language} · ${other === 'en' ? 'Language' : 'اللغة'}`;
    this.root = document.createElement('div');
    this.root.className = 'overlay dialog settings';
    this.root.innerHTML = `
      <div class="panel" role="dialog" aria-label="${STR.settings}">
        <div class="panel-head">
          <h2 class="panel-title">${STR.settings}</h2>
          ${button('btn-glass btn-icon btn-sm b-close', '', ICON.close).replace('<button ', `<button aria-label="${STR.done}" `)}
        </div>
        <div class="group">
          ${rows()
            .map(
              (r) => `
            <button class="row" type="button" data-k="${r.key}" role="switch">
              <span class="row-ico">${r.icon}</span>
              <span class="row-label">${r.label}</span>
              <span class="switch"><span class="knob"></span></span>
            </button>`,
            )
            .join('')}
        </div>
        ${
          onLang
            ? `<div class="group"><button class="row row-lang" type="button">
              <span class="row-ico">${ICON.globe}</span>
              <span class="row-label">${langLabel}</span>
              <span class="lang-chip" lang="${other}">${LANG_NAMES[other]}</span>
            </button></div>`
            : ''
        }
        ${button('btn-primary btn-block btn-done', STR.done)}
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelector('.row-lang')?.addEventListener('click', () => onLang?.(other));
    this.root.querySelectorAll<HTMLButtonElement>('.row[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k as keyof Settings;
        this.set(k, !this.get()[k]);
        this.refresh();
      }),
    );
    this.root.querySelector('.btn-done')!.addEventListener('click', () => this.hide());
    this.root.querySelector('.b-close')!.addEventListener('click', () => this.hide());
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.hide();
    });
  }

  private refresh(): void {
    const s = this.get();
    this.root.querySelectorAll<HTMLButtonElement>('.row[data-k]').forEach((b) => {
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
