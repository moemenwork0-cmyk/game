/** Pause dialog: resume, settings, home. */
import { STR } from '../../config/strings';
import { ICON } from '../icons';

export class PauseScreen {
  readonly root: HTMLElement;
  visible = false;

  constructor(parent: HTMLElement, onResume: () => void, onSettings: () => void, onHome: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay dialog pause';
    this.root.innerHTML = `
      <div class="panel" role="dialog" aria-label="${STR.paused}">
        <h2 class="panel-title">${STR.paused}</h2>
        <button class="btn btn-primary b-resume" type="button">${ICON.play}<span>${STR.resume}</span></button>
        <div class="btn-row">
          <button class="btn btn-secondary b-settings" type="button">${ICON.gear}<span>${STR.settings}</span></button>
          <button class="btn btn-secondary b-home" type="button">${ICON.home}<span>${STR.home}</span></button>
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
