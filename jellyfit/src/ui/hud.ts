/** HTML HUD: pause (right), score with count-up (centre), best score (left). */
import { STR, fmtNum } from '../config/strings';
import { clamp01, easeOutCubic } from '../core/tween';
import type { Layout } from '../render/layout';
import { ICON } from './icons';

export class Hud {
  readonly root: HTMLElement;
  private scoreEl: HTMLElement;
  private bestEl: HTMLElement;
  private from = 0;
  private to = 0;
  private t0 = 0;
  private shown = -1;

  constructor(parent: HTMLElement, onPause: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="pill best-pill hud-best" aria-label="${STR.best}">${ICON.crown}<span class="hud-best-v">0</span></div>
      <button class="icon-btn hud-pause" type="button" aria-label="${STR.pause}">${ICON.pause}</button>
      <div class="hud-score"><span class="hud-score-v">0</span></div>`;
    parent.appendChild(this.root);
    this.scoreEl = this.root.querySelector('.hud-score-v')!;
    this.bestEl = this.root.querySelector('.hud-best-v')!;
    this.root.querySelector('.hud-pause')!.addEventListener('click', onPause);
  }

  layout(L: Layout): void {
    const s = this.root.style;
    s.left = `${L.boardX}px`;
    s.width = `${L.boardSize}px`;
    s.top = `${L.hudY}px`;
    s.height = `${L.hudH}px`;
    s.setProperty('--score-size', `${Math.round(Math.min(58, Math.max(40, L.boardSize * 0.125)))}px`);
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('show', v);
  }

  setScore(v: number, now: number, instant = false): void {
    if (instant) {
      this.from = this.to = v;
      this.t0 = now - 1000;
      return;
    }
    this.from = this.current(now);
    this.to = v;
    this.t0 = now;
  }

  setBest(v: number): void {
    this.bestEl.textContent = fmtNum(v);
  }

  private current(now: number): number {
    const t = clamp01((now - this.t0) / 300);
    return this.from + (this.to - this.from) * easeOutCubic(t);
  }

  update(now: number): void {
    const v = Math.round(this.current(now));
    if (v !== this.shown) {
      this.shown = v;
      this.scoreEl.textContent = fmtNum(v);
    }
  }
}
