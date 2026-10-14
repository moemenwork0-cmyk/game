/** Gradient background with slow-drifting soft bokeh (spec 9.1). */
import { THEME } from '../config/theme';
import type { Rng } from '../core/rng';
import { makeCanvas } from './blockSprites';
import type { Layout } from './layout';

interface Bokeh {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
}

export class Background {
  private grad: HTMLCanvasElement | null = null;
  private dot: HTMLCanvasElement;
  private bokeh: Bokeh[] = [];
  private w = 0;
  private h = 0;
  /** 0..1 warm pulse (Jelly Rush, M2). */
  warm = 0;

  constructor(rng: Rng) {
    const B = THEME.bokeh;
    this.dot = makeCanvas(128, 128);
    const ctx = this.dot.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < B.count; i++) {
      const ang = rng.next() * Math.PI * 2;
      const sp = rng.range(B.minSpeed, B.maxSpeed);
      this.bokeh.push({
        x: rng.next(),
        y: rng.next(),
        r: rng.range(0.08, 0.2),
        a: rng.range(B.minAlpha, B.maxAlpha),
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
      });
    }
  }

  resize(lay: Layout): void {
    this.w = lay.w;
    this.h = lay.h;
    // The gradient is smooth, so half resolution is plenty.
    const c = makeCanvas(Math.max(2, lay.w / 2), Math.max(2, lay.h / 2));
    const ctx = c.getContext('2d')!;
    const P = THEME.palette;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, P.bgTop);
    g.addColorStop(0.55, P.bgMid);
    g.addColorStop(1, P.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    // Gentle vignette for depth.
    const v = ctx.createRadialGradient(c.width / 2, c.height * 0.45, c.height * 0.2, c.width / 2, c.height * 0.45, c.height * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(10,0,30,0.28)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, c.width, c.height);
    this.grad = c;
  }

  update(dt: number, drift: boolean): void {
    if (!drift) return;
    const s = Math.max(this.w, this.h) || 1;
    for (const b of this.bokeh) {
      b.x += (b.vx * dt) / s;
      b.y += (b.vy * dt) / s;
      if (b.x < -0.25) b.x += 1.5;
      if (b.x > 1.25) b.x -= 1.5;
      if (b.y < -0.25) b.y += 1.5;
      if (b.y > 1.25) b.y -= 1.5;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.grad) ctx.drawImage(this.grad, 0, 0, this.w, this.h);
    const s = Math.max(this.w, this.h);
    for (const b of this.bokeh) {
      const r = b.r * s;
      ctx.globalAlpha = b.a;
      ctx.drawImage(this.dot, b.x * this.w - r, b.y * this.h - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
}
