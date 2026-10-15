/** Pause dialog: resume, settings, home. */
import { STR } from '../../config/strings';
import { ICON } from '../icons';
import { button, stroked } from '../dom';

export class PauseScreen {
  readonly root: HTMLElement;
  visible = false;

  constructor(parent: HTMLElement, onResume: () => void, onSettings: () => void, onHome: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay dialog pause';
    this.root.innerHTML = `
      <div class="panel" role="dialog" aria-label="${STR.paused}">
        <div class="ribbon">${stroked(STR.paused)}</div>
        <div class="btn-col">
          ${button('btn-gold btn-wide b-resume', STR.resume, ICON.play)}
          <div class="btn-row">
            ${button('btn-blue btn-mid b-settings', STR.settings, ICON.gear)}
            ${button('btn-blue btn-mid b-home', STR.home, ICON.home)}
          </div>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelector('.b-resume')!.addEventListener('click', () => this.visible && onResume());
    this.root.querySelector('.b-settings')!.addEventListener('click', () => this.visible && onSettings());
    this.root.querySelector('.b-home')!.addEventListener('click', () => this.visible && onHome());
  }

  show(): void {
    this.visible = true;
    this.root.classList.add('show');
  }

  hide(): void {
    this.visible = false;
    this.root.classList.remove('show');
  }
}
