/** Pause sheet: resume, restart, settings, home. */
import { STR } from '../../config/strings';
import { ICON } from '../icons';
import { button } from '../dom';

export class PauseScreen {
  readonly root: HTMLElement;
  visible = false;

  constructor(parent: HTMLElement, onResume: () => void, onRestart: () => void, onSettings: () => void, onHome: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay dialog pause';
    this.root.innerHTML = `
      <div class="panel" role="dialog" aria-label="${STR.paused}">
        <div class="panel-head"><h2 class="panel-title">${STR.paused}</h2></div>
        ${button('btn-primary btn-lg btn-block b-resume', STR.resume, ICON.play)}
        <div class="tiles">
          <button class="tile b-restart" type="button"><span class="tile-ico">${ICON.replay}</span><span class="tile-text">${STR.restart}</span></button>
          <button class="tile b-settings" type="button"><span class="tile-ico">${ICON.gear}</span><span class="tile-text">${STR.settings}</span></button>
          <button class="tile b-home" type="button"><span class="tile-ico">${ICON.home}</span><span class="tile-text">${STR.home}</span></button>
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.root.querySelector('.b-resume')!.addEventListener('click', () => this.visible && onResume());
    this.root.querySelector('.b-restart')!.addEventListener('click', () => this.visible && onRestart());
    this.root.querySelector('.b-settings')!.addEventListener('click', () => this.visible && onSettings());
    this.root.querySelector('.b-home')!.addEventListener('click', () => this.visible && onHome());
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) onResume();
    });
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
