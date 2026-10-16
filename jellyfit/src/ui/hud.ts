/**
 * HTML HUD: pause (right), score with count-up (centre), best score (left).
 * Wide layout: best and score stacked in the column left of the board, pause in the screen corner.
 */
import { STR, fmtNum } from '../config/strings';
import { clamp01, easeOutCubic } from '../core/tween';
import type { Layout } from '../render/layout';
import { ICON } from './icons';
import { setStroked, stroked } from './dom';

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
      <div class="pill hud-best" aria-label="${STR.best}"><span class="crown-badge">${ICON.crown}</span>${stroked('0', 'hud-best-v')}</div>
      <button class="btn3d btn-blue icon-btn hud-pause" type="button" aria-label="${STR.pause}"><span class="btn-label">${ICON.pause}</span></button>
      <div class="hud-score">${stroked('0', 'hud-score-v')}</div>`;
    parent.appendChild(this.root);
    this.scoreEl = this.root.querySelector('.hud-score-v')!;
    this.bestEl = this.root.querySelector('.hud-best-v')!;
    this.root.querySelector('.hud-pause')!.addEventListener('click', onPause);
  }

  private wide = false;

  layout(L: Layout): void {
    const s = this.root.style;
    this.wide = L.wide;
    this.root.classList.toggle('wide', L.wide);
    s.left = `${L.hudX}px`;
    s.width = `${L.hudW}px`;
    // Wide: the pause button sits in the screen's top-right corner (relative to the HUD box).
    s.setProperty('--pause-x', `${L.w - 12 - 50 - L.hudX}px`);
    s.setProperty('--pause-y', `${12 - L.hudY}px`);
    s.top = `${L.hudY}px`;
    s.height = `${L.hudH}px`;
    s.setProperty('--score-size', `${Math.round(Math.min(52, Math.max(36, L.boardSize * 0.115)))}px`);
    this.fitScore();
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
    setStroked(this.bestEl, fmtNum(v));
    this.fitScore();
  }

  /** Shrinks the score so it never runs into the best pill or the pause button. */
  private fitScore(): void {
    const el = this.scoreEl;
    el.style.transform = '';
    const box = this.root.getBoundingClientRect();
    if (box.width === 0) return;
    const best = (this.root.querySelector('.hud-best') as HTMLElement).getBoundingClientRect();
    const pause = (this.root.querySelector('.hud-pause') as HTMLElement).getBoundingClientRect();
    const mid = box.left + box.width / 2;
    const half = this.wide ? box.width / 2 - 4 : Math.min(mid - best.right, pause.left - mid) - 8;
    const w = el.getBoundingClientRect().width;
    if (w > 0 && w / 2 > half) el.style.transform = `scale(${Math.max(0.55, (half * 2) / w)})`;
  }

  private current(now: number): number {
    const t = clamp01((now - this.t0) / 300);
    return this.from + (this.to - this.from) * easeOutCubic(t);
  }

  update(now: number): void {
    const v = Math.round(this.current(now));
    if (v !== this.shown) {
      this.shown = v;
      setStroked(this.scoreEl, fmtNum(v));
      this.fitScore();
    }
  }
}
