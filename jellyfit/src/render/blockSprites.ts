/**
 * Pre-rendered jelly block sprites (spec 9.2). Each (colour × variant) is drawn once per cell size at
 * device resolution; frames only blit them with transforms. No per-frame shadowBlur.
 */
import { THEME } from '../config/theme';
import { darken, desaturate, hexToRgb, lighten, rgbToCss, type RGB } from './color';

export type Canvas2D = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Block size in device px (the cell). */
  s: number;
  /** Margin around the cell in device px. */
  m: number;
}

function drawJelly(ctx: Ctx, s: number, m: number, base: RGB, gloss = 1): void {
  const inset = 0.04 * s;
  const x = m + inset;
  const y = m + inset;
  const b = s - 2 * inset;
  const rad = 0.24 * s;

  // 1. Drop shadow, blurred once (shape drawn off-canvas, only its shadow lands here).
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.30)';
  ctx.shadowBlur = 0.09 * s;
  ctx.shadowOffsetX = 10000;
  ctx.shadowOffsetY = 0.07 * s;
  ctx.fillStyle = '#000';
  roundRectPath(ctx, x - 10000, y, b, b, rad);
  ctx.fill();
  ctx.restore();

  // 2. Body gradient.
  const body = ctx.createLinearGradient(0, y, 0, y + b);
  body.addColorStop(0, rgbToCss(lighten(base, 0.16)));
  body.addColorStop(0.55, rgbToCss(base));
  body.addColorStop(1, rgbToCss(darken(base, 0.14)));
  roundRectPath(ctx, x, y, b, b, rad);
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, x, y, b, b, rad);
  ctx.clip();

  // 3. Translucency core.
  const core = ctx.createRadialGradient(m + 0.5 * s, m + 0.62 * s, 0, m + 0.5 * s, m + 0.62 * s, 0.45 * s);
  core.addColorStop(0, rgbToCss(lighten(base, 0.28), 0.35));
  core.addColorStop(1, rgbToCss(lighten(base, 0.28), 0));
  ctx.fillStyle = core;
  ctx.fillRect(m, m, s, s);

  // 6. Subsurface glow: soft curved band near the bottom.
  ctx.save();
  ctx.translate(m + 0.5 * s, m + 0.9 * s);
  ctx.scale(1, 0.32);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.42 * s);
  glow.addColorStop(0, rgbToCss(lighten(base, 0.3), 0.3));
  glow.addColorStop(0.6, rgbToCss(lighten(base, 0.3), 0.18));
  glow.addColorStop(1, rgbToCss(lighten(base, 0.3), 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 0.42 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Bevel rim: inner stroke, light top-left, dark bottom-right.
  const rim = ctx.createLinearGradient(x, y, x + b, y + b);
  rim.addColorStop(0, rgbToCss(lighten(base, 0.35), 0.7));
  rim.addColorStop(0.42, rgbToCss(lighten(base, 0.35), 0));
  rim.addColorStop(0.58, rgbToCss(darken(base, 0.25), 0));
  rim.addColorStop(1, rgbToCss(darken(base, 0.25), 0.6));
  ctx.lineWidth = 2 * 0.05 * s;
  ctx.strokeStyle = rim;
  roundRectPath(ctx, x, y, b, b, rad);
  ctx.stroke();
  ctx.restore();

  // 5. Specular highlight + dot.
  ctx.save();
  ctx.translate(m + 0.32 * s, m + 0.27 * s);
  ctx.rotate((-22 * Math.PI) / 180);
  ctx.scale(1, 0.09 / 0.17);
  const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.17 * s);
  spec.addColorStop(0, `rgba(255,255,255,${0.8 * gloss})`);
  spec.addColorStop(0.7, `rgba(255,255,255,${0.72 * gloss})`);
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(0, 0, 0.17 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = `rgba(255,255,255,${0.9 * gloss})`;
  ctx.beginPath();
  ctx.arc(m + 0.55 * s, m + 0.2 * s, 0.035 * s, 0, Math.PI * 2);
  ctx.fill();
}

export function makeJellySprite(hex: string, sizeDev: number, variant: 'normal' | 'gray' = 'normal'): Sprite {
  const s = Math.max(4, Math.round(sizeDev));
  const m = Math.ceil(0.22 * s);
  const canvas = makeCanvas(s + 2 * m, s + 2 * m);
  const ctx = canvas.getContext('2d')!;
  const base = variant === 'gray' ? desaturate(hexToRgb(hex), 0.82, 0.3) : hexToRgb(hex);
  drawJelly(ctx, s, m, base, variant === 'gray' ? 0.45 : 1);
  return { canvas, s, m };
}

/** Soft dark rounded square used as the drop shadow of a dragged piece. */
export function makeShadowSprite(sizeDev: number): Sprite {
  const s = Math.max(4, Math.round(sizeDev));
  const m = Math.ceil(0.3 * s);
  const canvas = makeCanvas(s + 2 * m, s + 2 * m);
  const ctx = canvas.getContext('2d')!;
  ctx.shadowColor = 'rgba(0,0,0,1)';
  ctx.shadowBlur = 0.18 * s;
  ctx.shadowOffsetX = 10000;
  ctx.fillStyle = '#000';
  roundRectPath(ctx, m + 0.06 * s - 10000, m + 0.06 * s, 0.88 * s, 0.88 * s, 0.24 * s);
  ctx.fill();
  return { canvas, s, m };
}

/** Glossy droplet for clear bursts. */
export function makeDroplet(hex: string, sizeDev: number): HTMLCanvasElement {
  const d = Math.max(4, Math.round(sizeDev));
  const c = makeCanvas(d, d);
  const ctx = c.getContext('2d')!;
  const base = hexToRgb(hex);
  const g = ctx.createRadialGradient(d * 0.4, d * 0.35, 0, d * 0.5, d * 0.5, d * 0.5);
  g.addColorStop(0, rgbToCss(lighten(base, 0.45)));
  g.addColorStop(0.45, rgbToCss(base));
  g.addColorStop(1, rgbToCss(darken(base, 0.15)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(d / 2, d / 2, d / 2 - 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(d * 0.36, d * 0.32, d * 0.12, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

/** Sprite cache for the current cell size. */
export class SpriteBank {
  jelly: Sprite[] = [];
  gray: Sprite[] = [];
  shadow!: Sprite;
  droplets: HTMLCanvasElement[] = [];
  sizeDev = 0;

  build(cellDev: number, colors: readonly string[] = THEME.jelly): void {
    const s = Math.round(cellDev);
    if (s === this.sizeDev && this.jelly.length === colors.length) return;
    this.sizeDev = s;
    this.jelly = colors.map((c) => makeJellySprite(c, s));
    this.gray = colors.map((c) => makeJellySprite(c, s, 'gray'));
    this.shadow = makeShadowSprite(s);
    this.droplets = colors.map((c) => makeDroplet(c, Math.max(8, s * 0.3)));
  }
}
