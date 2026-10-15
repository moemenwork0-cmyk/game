/** Results panel (spec 11.3, 11.5): score count-up, best, play again, home. */
import { STR, fmtNum } from '../../config/strings';
import { clamp01, easeOutCubic } from '../../core/tween';
import { ICON } from '../icons';
import { button, setStroked, stroked } from '../dom';

export interface ResultsData {
  score: number;
  best: number;
  newBest: boolean;
  lines: number;
  maxCombo: number;
  placements: number;
}

export class ResultsScreen {
  readonly root: HTMLElement;
  private scoreEl: HTMLElement;
  private bestEl: HTMLElement;
  private statsEl: HTMLElement;
  private btn: HTMLButtonElement;
  private data: ResultsData | null = null;
  private t0 = 0;
  visible = false;

  constructor(parent: HTMLElement, onAgain: () => void, onHome: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'overlay results';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.innerHTML = `
      <div class="panel">
        <div class="ribbon">${stroked(STR.gameOverTitle)}</div>
        <div class="best-burst"><div class="rays"></div><div class="burst-core">${stroked(STR.newBestShort)}</div></div>
        <div class="panel-label">${STR.score}</div>
        ${stroked('0', 'panel-score')}
        <div><div class="panel-best"><span class="crown-badge">${ICON.crown}</span><span>${STR.best}</span><b>0</b></div></div>
        <div class="panel-stats"></div>
        <div class="btn-col">
          ${button('btn-gold btn-wide b-again', STR.playAgain, ICON.replay, '<span class="shine"></span>')}
          ${button('btn-blue btn-mid b-home', STR.home, ICON.home)}
        </div>
      </div>`;
    parent.appendChild(this.root);
    this.scoreEl = this.root.querySelector('.panel-score')!;
    this.bestEl = this.root.querySelector('.panel-best b')!;
    this.statsEl = this.root.querySelector('.panel-stats')!;
    this.btn = this.root.querySelector('.b-again')!;
    this.btn.addEventListener('click', () => this.visible && onAgain());
    this.root.querySelector('.b-home')!.addEventListener('click', () => this.visible && onHome());
  }

  show(d: ResultsData, now: number): void {
    this.data = d;
    this.t0 = now;
    this.visible = true;
    this.bestEl.textContent = fmtNum(d.best);
    this.statsEl.innerHTML =
      `<div class="stat"><b>${fmtNum(d.lines)}</b><span>${STR.lines}</span></div>` +
      `<div class="stat"><b>${d.maxCombo > 1 ? '×' + d.maxCombo : '–'}</b><span>${STR.bestCombo}</span></div>`;
    this.root.classList.toggle('newbest', d.newBest);
    setStroked(this.scoreEl, '0');
    this.root.classList.add('show');
    this.root.setAttribute('aria-hidden', 'false');
    setTimeout(() => this.btn.focus({ preventScroll: true }), 50);
  }

  hide(): void {
    this.visible = false;
    this.data = null;
    this.root.classList.remove('show');
    this.root.setAttribute('aria-hidden', 'true');
  }

  update(now: number): void {
    if (!this.data) return;
    const t = clamp01((now - this.t0 - 250) / 700);
    setStroked(this.scoreEl, fmtNum(this.data.score * easeOutCubic(t)));
  }
}
