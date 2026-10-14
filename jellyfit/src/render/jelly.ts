/** Per-cell jelly springs (spec 9.3): scaleX, scaleY, offsetY with idle breathing. */
import { THEME } from '../config/theme';
import type { Rng } from '../core/rng';

const J = THEME.jellyPhys;

interface Pending {
  at: number;
  i: number;
  amp: number;
}

export class JellyField {
  readonly sx = new Float32Array(64).fill(1);
  readonly sy = new Float32Array(64).fill(1);
  readonly oy = new Float32Array(64);
  private readonly vx = new Float32Array(64);
  private readonly vy = new Float32Array(64);
  private readonly vo = new Float32Array(64);
  private readonly phase = new Float32Array(64);
  private readonly period = new Float32Array(64);
  private pending: Pending[] = [];
  breathe = true;

  constructor(rng: Rng) {
    for (let i = 0; i < 64; i++) {
      this.phase[i] = rng.next() * Math.PI * 2;
      this.period[i] = rng.range(J.breatheMinS, J.breatheMaxS);
    }
  }

  reset(): void {
    this.sx.fill(1);
    this.sy.fill(1);
    this.oy.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.vo.fill(0);
    this.pending.length = 0;
  }

  /** Squash a cell: amp 1 = full placement squash. */
  squash(i: number, amp = 1): void {
    this.sy[i] = 1 - (1 - J.squashY) * amp;
    this.sx[i] = 1 + (J.squashX - 1) * amp;
    this.vy[i] = 0;
    this.vx[i] = 0;
  }

  /** Vertical kick (positive = push down), e.g. from nearby explosions. */
  kick(i: number, v: number): void {
    this.vo[i] += v;
  }

  /** Squash the placed cells and send a smaller, delayed jiggle to neighbours within 1 cell. */
  placeImpulse(cells: readonly number[], now: number, occupied: (i: number) => boolean): void {
    const set = new Set(cells);
    for (const i of cells) this.squash(i, 1);
    const seen = new Set<number>();
    for (const i of cells) {
      const r = i >> 3;
      const c = i & 7;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr > 7 || cc > 7) continue;
          const j = rr * 8 + cc;
          if (set.has(j) || seen.has(j) || !occupied(j)) continue;
          seen.add(j);
          this.pending.push({ at: now + J.neighborDelayMs, i: j, amp: J.neighborAmp });
        }
      }
    }
  }

  update(dt: number, now: number): void {
    if (this.pending.length) {
      this.pending = this.pending.filter((p) => {
        if (p.at > now) return true;
        this.squash(p.i, p.amp);
        return false;
      });
    }
    const k = J.stiffness;
    const d = J.damping;
    const n = Math.max(1, Math.ceil(dt * 120));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < 64; i++) {
        this.vx[i] += (-k * (this.sx[i] - 1) - d * this.vx[i]) * h;
        this.sx[i] += this.vx[i] * h;
        this.vy[i] += (-k * (this.sy[i] - 1) - d * this.vy[i]) * h;
        this.sy[i] += this.vy[i] * h;
        this.vo[i] += (-k * this.oy[i] - d * this.vo[i]) * h;
        this.oy[i] += this.vo[i] * h;
      }
    }
  }

  /** Breathing scale multiplier for a cell at time t (ms). */
  breath(i: number, t: number): number {
    if (!this.breathe) return 1;
    return 1 + J.breatheAmp * Math.sin((t / 1000) * ((Math.PI * 2) / this.period[i]) + this.phase[i]);
  }
}
