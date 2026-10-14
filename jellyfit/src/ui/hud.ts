/** HTML HUD: score with count-up and best score (spec 3.1, 9.5). */
import { clamp01, easeOutCubic } from '../core/tween';
import type { Layout } from '../render/layout';

const CROWN =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 7.5l4.6 3.6L12 4l4.4 7.1L21 7.5l-1.7 10H4.7L3 7.5zm2 11.5h14v1.8H5z"/></svg>';

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export class Hud {
  readonly root: HTMLElement;
  private scoreEl: HTMLElement;
  private bestEl: HTMLElement;
  private from = 0;
  private to = 0;
  private t0 = 0;
  private shown = -1;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-best" title="Best score">${CROWN}<span class="hud-best-v">0</span></div>
      <div class="hud-score"><span class="hud-score-v">0</span></div>`;
    parent.appendChild(this.root);
    this.scoreEl = this.root.querySelector('.hud-score-v')!;
    this.bestEl = this.root.querySelector('.hud-best-v')!;
  }

  layout(L: Layout): void {
    const s = this.root.style;
    s.left = `${L.boardX}px`;
    s.width = `${L.boardSize}px`;
    s.top = `${L.hudY}px`;
    s.height = `${L.hudH}px`;
    s.setProperty('--score-size', `${Math.round(Math.min(56, Math.max(38, L.boardSize * 0.12)))}px`);
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
    this.bestEl.textContent = fmt(v);
  }

  private current(now: number): number {
    const t = clamp01((now - this.t0) / 300);
    return this.from + (this.to - this.from) * easeOutCubic(t);
  }

  update(now: number): void {
    const v = Math.round(this.current(now));
    if (v !== this.shown) {
      this.shown = v;
      this.scoreEl.textContent = fmt(v);
    }
  }
}
