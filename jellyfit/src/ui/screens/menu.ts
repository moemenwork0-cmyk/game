/** Home screen: logo, best score (top left), settings gear (top right), one big play button. */
import { STR, fmtNum } from '../../config/strings';
import { ICON } from '../icons';

export class MenuScreen {
  readonly root: HTMLElement;
  private bestEl: HTMLElement;
  private playLabel: HTMLElement;
  visible = false;

  constructor(parent: HTMLElement, onPlay: () => void, onSettings: () => void) {
    const [w1, w2] = STR.title.split(' ');
    this.root = document.createElement('div');
    this.root.className = 'screen menu';
    this.root.innerHTML = `
      <div class="corner corner-left pill best-pill" aria-label="${STR.best}">${ICON.crown}<span class="best-v">0</span></div>
      <button class="corner corner-right icon-btn" type="button" aria-label="${STR.settings}">${ICON.gear}</button>
      <div class="logo-wrap">
        <h1 class="logo" aria-label="${STR.title}">
          <span class="logo-word w1"><span class="lw-stroke">${w1}</span><span class="lw-fill">${w1}</span></span>
          ${w2 ? `<span class="logo-word w2"><span class="lw-stroke">${w2}</span><span class="lw-fill">${w2}</span></span>` : ''}
        </h1>
        <div class="tagline">${STR.tagline}</div>
      </div>
      <div class="menu-bottom">
        <button class="btn btn-primary btn-play" type="button">${ICON.play}<span class="play-label">${STR.playNow}</span></button>
      </div>`;
    parent.appendChild(this.root);
    this.bestEl = this.root.querySelector('.best-v')!;
    this.playLabel = this.root.querySelector('.play-label')!;
    this.root.querySelector('.btn-play')!.addEventListener('click', () => this.visible && onPlay());
    this.root.querySelector('.icon-btn')!.addEventListener('click', () => this.visible && onSettings());
  }

  show(best: number, resume: boolean): void {
    this.bestEl.textContent = fmtNum(best);
    this.playLabel.textContent = resume ? STR.continueGame : STR.playNow;
    this.visible = true;
    this.root.classList.add('show');
  }

  hide(): void {
    this.visible = false;
    this.root.classList.remove('show');
  }
}
