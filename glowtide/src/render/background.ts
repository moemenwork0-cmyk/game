import { PALETTE } from '../config/palette';
import { TAU } from '../core/math';

const PLANKTON_COUNT = 90;
const LAYERS = [
  { speed: 4, size: 1.1, alpha: 0.25, parallax: 0.3 },
  { speed: 7, size: 1.6, alpha: 0.35, parallax: 0.6 },
  { speed: 11, size: 2.2, alpha: 0.45, parallax: 1 },
];

interface Mote {
  x: number;
  y: number;
  layer: number;
  phase: number;
}

/** Pre-rendered gradient + vignette, and a few layers of drifting plankton (screen space). */
export class Background {
  private canvas: HTMLCanvasElement = document.createElement('canvas');
  private readonly motes: Mote[] = [];
  private w = 1;
  private h = 1;

  constructor() {
    for (let i = 0; i < PLANKTON_COUNT; i++) {
      this.motes.push({
        x: Math.random(),
        y: Math.random(),
        layer: i % LAYERS.length,
        phase: Math.random() * TAU,
      });
    }
  }

  /** Rebuild for a backing store of w × h device pixels; `pearlR` is the pearl radius in pixels. */
  resize(w: number, h: number, pearlR: number): void {
    this.w = w;
    this.h = h;
    const c = this.canvas;
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const cx = w / 2;
    const cy = h / 2;
    const far = Math.sqrt(cx * cx + cy * cy);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, far);
    g.addColorStop(0, PALETTE.bgCenter);
    g.addColorStop(1, PALETTE.bgEdge);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Halo above the pearl.
    const halo = ctx.createRadialGradient(cx, cy, pearlR, cx, cy, pearlR * 6);
    halo.addColorStop(0, PALETTE.pearlHalo);
    halo.addColorStop(1, 'rgba(16,71,94,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    // Darker vignette where critters emerge.
    const v = ctx.createRadialGradient(cx, cy, far * 0.55, cx, cy, far);
    v.addColorStop(0, 'rgba(2,8,14,0)');
    v.addColorStop(1, 'rgba(2,8,14,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  draw(ctx: CanvasRenderingContext2D, time: number, dpr: number): void {
    ctx.drawImage(this.canvas, 0, 0);
    const w = this.w;
    const h = this.h;
    ctx.fillStyle = '#BDEBFF';
    for (const m of this.motes) {
      const L = LAYERS[m.layer];
      const y = (((m.y * h - time * L.speed * dpr) % h) + h) % h;
      const x = m.x * w + Math.sin(time * 0.4 + m.phase) * 10 * dpr * L.parallax;
      ctx.globalAlpha = L.alpha * (0.6 + 0.4 * Math.sin(time * 1.3 + m.phase));
      const s = L.size * dpr;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }
}
