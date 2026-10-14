import { CRITTER_COLORS, PALETTE, type ShapeKind } from '../config/palette';
import { TAU } from '../core/math';

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Half the sprite's size in world units (draw centered at x - half, y - half). */
  half: number;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.max(1, Math.ceil(size));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [canvas, ctx];
}

/** Traces the outline of `shape` with nominal radius r, centered on the origin. */
export function traceShape(ctx: CanvasRenderingContext2D, shape: ShapeKind, r: number): void {
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(0, 0, r, 0, TAU);
      break;
    case 'triangle': {
      const R = r * 1.22;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R + r * 0.12;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
    case 'roundSquare': {
      const s = r * 0.9;
      const c = r * 0.38;
      ctx.moveTo(-s + c, -s);
      ctx.arcTo(s, -s, s, s, c);
      ctx.arcTo(s, s, -s, s, c);
      ctx.arcTo(-s, s, -s, -s, c);
      ctx.arcTo(-s, -s, s, -s, c);
      ctx.closePath();
      break;
    }
    case 'diamond': {
      const R = r * 1.2;
      ctx.moveTo(0, -R);
      ctx.lineTo(R * 0.92, 0);
      ctx.lineTo(0, R);
      ctx.lineTo(-R * 0.92, 0);
      ctx.closePath();
      break;
    }
    case 'star': {
      const outer = r * 1.22;
      const inner = r * 0.62;
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? outer : inner;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr + r * 0.06;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      break;
    }
  }
}

/** Eye placement per shape (fraction of radius), so eyes sit on the body's visual center. */
export const EYE_OFFSET_Y: Record<ShapeKind, number> = {
  circle: -0.05,
  triangle: 0.28,
  roundSquare: -0.05,
  diamond: 0,
  star: 0.12,
};

/**
 * Pre-rendered glowing bodies. Rebuilt whenever the pixel scale changes, so `shadowBlur`
 * is only ever used here, never per entity per frame.
 */
export class SpriteCache {
  private scale = 0;
  private readonly cache = new Map<string, Sprite>();

  setScale(pixelsPerUnit: number): void {
    if (Math.abs(pixelsPerUnit - this.scale) < 1e-6) return;
    this.scale = pixelsPerUnit;
    this.cache.clear();
  }

  critter(colorId: number, radius: number): Sprite {
    const key = `c${colorId}:${radius}`;
    let s = this.cache.get(key);
    if (!s) {
      s = this.buildCritter(colorId, radius);
      this.cache.set(key, s);
    }
    return s;
  }

  pearl(radius: number): Sprite {
    const key = `p:${radius}`;
    let s = this.cache.get(key);
    if (!s) {
      s = this.buildPearl(radius);
      this.cache.set(key, s);
    }
    return s;
  }

  private buildCritter(colorId: number, r: number): Sprite {
    const col = CRITTER_COLORS[colorId];
    const half = r * 2.1;
    const px = this.scale;
    const [canvas, ctx] = makeCanvas(half * 2 * px);
    ctx.scale(px, px);
    ctx.translate(half, half);
    const [cr, cg, cb] = col.rgb;

    // Soft halo.
    const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, half);
    halo.addColorStop(0, `rgba(${cr},${cg},${cb},0.45)`);
    halo.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.14)`);
    halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(-half, -half, half * 2, half * 2);

    // Body with inner light.
    ctx.save();
    ctx.shadowColor = col.hex;
    ctx.shadowBlur = r * 0.7 * px;
    traceShape(ctx, col.shape, r);
    const body = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r * 1.25);
    body.addColorStop(0, mix(col.rgb, [255, 255, 255], 0.55));
    body.addColorStop(0.55, col.hex);
    body.addColorStop(1, mix(col.rgb, [0, 20, 40], 0.3));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();

    // Rim and gloss.
    traceShape(ctx, col.shape, r);
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 0.09;
    ctx.strokeStyle = mix(col.rgb, [255, 255, 255], 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.42, r * 0.28, r * 0.15, -0.5, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    return { canvas, half };
  }

  private buildPearl(r: number): Sprite {
    const half = r * 2.2;
    const px = this.scale;
    const [canvas, ctx] = makeCanvas(half * 2 * px);
    ctx.scale(px, px);
    ctx.translate(half, half);

    const halo = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, half);
    halo.addColorStop(0, 'rgba(201,184,255,0.35)');
    halo.addColorStop(0.45, 'rgba(160,200,255,0.12)');
    halo.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-half, -half, half * 2, half * 2);

    ctx.save();
    ctx.shadowColor = PALETTE.pearlSheen;
    ctx.shadowBlur = r * 0.6 * px;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
    body.addColorStop(0, '#FFFFFF');
    body.addColorStop(0.45, PALETTE.pearlCore);
    body.addColorStop(0.8, '#D9CCFF');
    body.addColorStop(1, '#A99BE6');
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();

    // Iridescent sheen bands.
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    const sheen = ctx.createLinearGradient(-r, r, r, -r);
    sheen.addColorStop(0, 'rgba(76,201,240,0.0)');
    sheen.addColorStop(0.35, 'rgba(76,201,240,0.18)');
    sheen.addColorStop(0.55, 'rgba(255,209,102,0.10)');
    sheen.addColorStop(0.75, 'rgba(179,136,255,0.22)');
    sheen.addColorStop(1, 'rgba(179,136,255,0.0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.3, r * 0.17, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
    return { canvas, half };
  }
}

function mix(a: readonly number[], b: readonly number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
