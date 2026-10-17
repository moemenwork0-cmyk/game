/** Home screen: best score (top start), settings (top end), the logo with Jello on it, one big play button. */
import { STR, fmtNum } from '../../config/strings';
import { ICON } from '../icons';
import { button, setStroked, stroked } from '../dom';

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
      <div class="topbar">
        <div class="chip chip-best" aria-label="${STR.best}"><span class="chip-ico">${ICON.crown}</span>${stroked('0', 'best-v')}</div>
        ${button('btn-glass btn-icon b-gear', '', ICON.gear).replace('<button ', `<button aria-label="${STR.settings}" `)}
      </div>
      <div class="logo-wrap">
        <h1 class="logo" aria-label="${STR.title}">
          <span class="logo-word w1"><span class="lw-stroke">${w1}</span><span class="lw-fill">${w1}</span></span>
          ${w2 ? `<span class="logo-word w2"><span class="lw-stroke">${w2}</span><span class="lw-fill">${w2}</span></span>` : ''}
        </h1>
        <div class="tagline">${STR.tagline}</div>
      </div>
      <div class="menu-bottom">
        ${button('btn-primary btn-lg btn-block btn-play', `<span class="play-label">${STR.playNow}</span>`, ICON.play)}
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
