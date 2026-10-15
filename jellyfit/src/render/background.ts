/**
 * Background: calm blue gradient with a slowly drifting jelly-shape pattern, a soft light behind the
 * board, faint bokeh, and (home screen) rotating light rays.
 */
import { THEME } from '../config/theme';
import type { Rng } from '../core/rng';
import { makeCanvas, roundRectPath } from './blockSprites';
import type { Layout } from './layout';

interface Bokeh {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
}

const TILE = 92;

export class Background {
  private grad: HTMLCanvasElement | null = null;
  private tile: HTMLCanvasElement | null = null;
  private dot: HTMLCanvasElement;
  private bokeh: Bokeh[] = [];
  private w = 0;
  private h = 0;
  private ox = 0;
  private oy = 0;
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
  }

  resize(lay: Layout): void {
    this.w = lay.w;
    this.h = lay.h;
    const c = makeCanvas(Math.max(2, lay.w / 2), Math.max(2, lay.h / 2));
    const ctx = c.getContext('2d')!;
    const P = THEME.palette;
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, P.bgTop);
    g.addColorStop(0.5, P.bgMid);
    g.addColorStop(1, P.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    // Soft light behind the play area.
    const cx = c.width / 2;
    const cy = (lay.boardY + lay.boardSize * 0.45) / 2;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(c.width, c.height) * 0.7);
    glow.addColorStop(0, 'rgba(140,180,255,0.30)');
    glow.addColorStop(0.5, 'rgba(140,180,255,0.08)');
    glow.addColorStop(1, 'rgba(140,180,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, c.width, c.height);
    // Gentle vignette.
    const v = ctx.createRadialGradient(cx, c.height * 0.45, c.height * 0.3, cx, c.height * 0.45, c.height * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(8,14,50,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, c.width, c.height);
    this.grad = c;
    this.tile = makeTile(lay.dpr);
  }

  update(dt: number, drift: boolean): void {
    this.rays += dt * 0.12;
    if (!drift) return;
    this.ox = (this.ox + dt * 9) % TILE;
    this.oy = (this.oy + dt * 6) % TILE;
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
    if (this.tile) {
      for (let y = -TILE + this.oy; y < this.h; y += TILE) {
        for (let x = -TILE + this.ox; x < this.w; x += TILE) ctx.drawImage(this.tile, x, y, TILE, TILE);
      }
    }
    const s = Math.max(this.w, this.h);
    for (const b of this.bokeh) {
      const r = b.r * s;
      ctx.globalAlpha = b.a;
      ctx.drawImage(this.dot, b.x * this.w - r, b.y * this.h - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  /** Rotating light rays (home screen) centred at (cx, cy). */
  drawRays(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
    const n = 16;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, 'rgba(255,255,255,0.20)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = this.rays + (i * Math.PI * 2) / n;
      const a1 = a0 + Math.PI / n;
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, a0, a1);
      ctx.closePath();
    }
    ctx.fill();
    // Warm glow core.
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.55);
    core.addColorStop(0, 'rgba(255,230,160,0.22)');
    core.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = core;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
}

/** One pattern tile: a tilted rounded square, a dot and a tiny plus, very faint. */
function makeTile(dpr: number): HTMLCanvasElement {
  const s = TILE * dpr;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 3;
  ctx.save();
  ctx.translate(TILE * 0.3, TILE * 0.32);
  ctx.rotate(0.26);
  roundRectPath(ctx, -TILE * 0.13, -TILE * 0.13, TILE * 0.26, TILE * 0.26, TILE * 0.07);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(TILE * 0.76, TILE * 0.74, TILE * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(TILE * 0.74, TILE * 0.22);
  ctx.rotate(0.3);
  ctx.fillRect(-TILE * 0.06, -1.5, TILE * 0.12, 3);
  ctx.fillRect(-1.5, -TILE * 0.06, 3, TILE * 0.12);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(TILE * 0.22, TILE * 0.8, TILE * 0.025, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
