/**
 * Background: a deep indigo night with soft coloured glows (pink, violet, cyan), a light behind the
 * board, slow drifting bokeh and a few twinkling stars. Home screen: a warm halo behind Jello.
 */
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
  private stars: { x: number; y: number; r: number; a: number; speed: number; phase: number }[] = [];
  private dot: HTMLCanvasElement;
  private bokeh: Bokeh[] = [];
  private w = 0;
  private h = 0;
  private rays = 0;
  /** 0..1 warm pulse (Jelly Rush, M2). */
  warm = 0;

  constructor(rng: Rng) {
    const B = THEME.bokeh;
    this.dot = makeCanvas(128, 128);
    const ctx = this.dot.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.5)');
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
    for (let i = 0; i < 26; i++) {
      this.stars.push({ x: rng.next(), y: rng.next(), r: rng.range(1.2, 2.6), a: rng.range(0.25, 0.7), speed: rng.range(0.5, 1.5), phase: rng.next() * 6.3 });
    }
  }

  resize(lay: Layout): void {
    this.w = lay.w;
    this.h = lay.h;
    const c = makeCanvas(Math.max(2, lay.w / 2), Math.max(2, lay.h / 2));
    const ctx = c.getContext('2d')!;
    const P = THEME.palette;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, P.bgTop);
    g.addColorStop(0.55, P.bgMid);
    g.addColorStop(1, P.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    const W = c.width;
    const H = c.height;
    const blob = (x: number, y: number, r: number, rgb: string, a: number): void => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${rgb},${a})`);
      gr.addColorStop(0.6, `rgba(${rgb},${a * 0.35})`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    };
    const M = Math.max(W, H);
    // Colour washes in the corners, a soft light behind the play area.
    blob(W * 0.05, H * 0.08, M * 0.55, '255,90,160', 0.2);
    blob(W * 0.98, H * 0.9, M * 0.6, '40,200,230', 0.14);
    blob(W * 0.9, H * 0.15, M * 0.4, '150,110,255', 0.18);
    const cx = W / 2;
    const cy = (lay.boardY + lay.boardSize * 0.45) / 2;
    blob(cx, cy, M * 0.5, '140,120,255', 0.16);
    // Vignette.
    const v = ctx.createRadialGradient(cx, H * 0.45, H * 0.3, cx, H * 0.45, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(4,2,20,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    this.grad = c;
  }

  update(dt: number, drift: boolean): void {
    this.rays += dt * 0.12;
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
    // Twinkling stars.
    for (const st of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(this.rays * 9 * st.speed + st.phase);
      ctx.globalAlpha = st.a * (0.35 + 0.65 * tw);
      const r = st.r;
      ctx.drawImage(this.dot, st.x * this.w - r, st.y * this.h - r, r * 2, r * 2);
    }
    const s = Math.max(this.w, this.h);
    for (const b of this.bokeh) {
      const r = b.r * s;
      ctx.globalAlpha = b.a;
      ctx.drawImage(this.dot, b.x * this.w - r, b.y * this.h - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  /** Home screen: a slow, breathing warm halo centred at (cx, cy). */
  drawRays(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    const k = 1 + Math.sin(this.rays * 6) * 0.04;
    const r = radius * 0.62 * k;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,160,210,0.22)');
    g.addColorStop(0.4, 'rgba(170,130,255,0.1)');
    g.addColorStop(1, 'rgba(170,130,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}
