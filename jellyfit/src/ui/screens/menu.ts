/** Home screen: logo, best score (top left), settings gear (top right), one big play button. */
import { STR, fmtNum } from '../../config/strings';
import { ICON } from '../icons';
import { setStroked, stroked } from '../dom';

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
      <div class="corner corner-left pill" aria-label="${STR.best}"><span class="crown-badge">${ICON.crown}</span>${stroked('0', 'best-v')}</div>
      <button class="corner corner-right btn3d btn-blue icon-btn b-gear" type="button" aria-label="${STR.settings}"><span class="btn-label">${ICON.gear}</span></button>
      <div class="logo-wrap">
        <h1 class="logo" aria-label="${STR.title}">
          <span class="logo-word w1"><span class="lw-stroke">${w1}</span><span class="lw-fill">${w1}</span></span>
          ${w2 ? `<span class="logo-word w2"><span class="lw-stroke">${w2}</span><span class="lw-fill">${w2}</span></span>` : ''}
        </h1>
        <div class="tagline">${STR.tagline}</div>
      </div>
      <div class="menu-bottom">
        <button class="btn3d btn-gold btn-play" type="button"><span class="shine"></span><span class="btn-label">${ICON.play}<span class="play-label">${STR.playNow}</span></span></button>
      </div>`;
    parent.appendChild(this.root);
    this.bestEl = this.root.querySelector('.best-v')!;
    this.playLabel = this.root.querySelector('.play-label')!;
    this.root.querySelector('.btn-play')!.addEventListener('click', () => this.visible && onPlay());
    this.root.querySelector('.b-gear')!.addEventListener('click', () => this.visible && onSettings());
  }

  show(best: number, resume: boolean): void {
    setStroked(this.bestEl, fmtNum(best));
    this.playLabel.textContent = resume ? STR.continueGame : STR.playNow;
    this.visible = true;
    this.root.classList.add('show');
  }

  hide(): void {
    this.visible = false;
    this.root.classList.remove('show');
  }
}
