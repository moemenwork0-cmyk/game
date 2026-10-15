/**
 * First-time tip for giving a piece to Jello: the screen dims except the tray piece and Jello, a
 * glowing ring pulses at his hand, and a cartoon finger carries a ghost copy of the piece to him in a
 * loop until the player tries it.
 */
import { clamp01, easeInOutSine, easeOutBack, easeOutCubic, lerp } from '../core/tween';
import { PIECES } from '../game/rules';
import { roundRectPath } from './blockSprites';

const PERIOD = 2700;
const INK = '#0F1A44';

export interface TutorialScene {
  /** Tray piece centre + cell size. */
  from: { cx: number; cy: number; cs: number };
  /** Hold spot centre + cell size. */
  to: { cx: number; cy: number; cs: number };
  /** Jello centre and half-width (for the spotlight). */
  jello: { x: number; y: number; R: number };
  w: number;
  h: number;
  board: { x: number; y: number; size: number };
}

export class HoldTutorial {
  active = false;
  slot = 0;
  text = '';
  private start = 0;
  private stopAt = -1;

  begin(slot: number, now: number, text = ''): void {
    this.active = true;
    this.slot = slot;
    this.text = text;
    this.start = now;
    this.stopAt = -1;
  }

  stop(now = 0): void {
    if (this.active && this.stopAt < 0) this.stopAt = now;
  }

  /** Fully hidden? */
  done(now: number): boolean {
    return !this.active || (this.stopAt >= 0 && now - this.stopAt > 250);
  }

  private fade(now: number): number {
    const a = clamp01((now - this.start) / 350);
    const b = this.stopAt >= 0 ? 1 - clamp01((now - this.stopAt) / 250) : 1;
    return a * b;
  }

  private phase(now: number): number {
    return (((now - this.start) % PERIOD) + PERIOD) % PERIOD / PERIOD;
  }

  /** Where the ghost piece is (for Jello to reach for), or null when not carried. */
  reachPoint(scene: TutorialScene, now: number): { x: number; y: number } | null {
    if (this.done(now)) return null;
    const t = this.phase(now);
    if (t < 0.36 || t > 0.8) return null;
    const g = this.ghost(scene, t);
    return { x: g.x, y: g.y + g.cs };
  }

  /** True during the instant the ghost lands in Jello's hand. */
  landed(prevNow: number, now: number): boolean {
    if (this.done(now)) return false;
    const a = this.phase(prevNow);
    const b = this.phase(now);
    return a < 0.7 && b >= 0.7;
  }

  private ghost(scene: TutorialScene, t: number): { x: number; y: number; cs: number; s: number } {
    const { from, to } = scene;
    const u = clamp01((t - 0.2) / 0.5);
    const e = easeInOutSine(u);
    // Arc up and over towards Jello.
    const cx = (from.cx + to.cx) / 2;
    const cy = Math.min(from.cy, to.cy) - scene.h * 0.12;
    const x = (1 - e) * (1 - e) * from.cx + 2 * (1 - e) * e * cx + e * e * to.cx;
    const y = (1 - e) * (1 - e) * from.cy + 2 * (1 - e) * e * cy + e * e * to.cy;
    const lift = easeOutBack(clamp01((t - 0.12) / 0.1), 2);
    const cs = lerp(from.cs, to.cs, e) * (1 + 0.12 * lift * (1 - e));
    const land = t > 0.7 ? 1 - easeOutCubic(clamp01((t - 0.7) / 0.1)) : 1;
    return { x, y, cs, s: land };
  }

  /** Dim layer with spotlights, the hand ring and the ghost piece (draw before Jello's bubble). */
  drawUnder(
    ctx: CanvasRenderingContext2D,
    scene: TutorialScene,
    piece: number,
    drawPiece: (x: number, y: number, cs: number) => void,
    now: number,
  ): void {
    const a = this.fade(now);
    if (a <= 0) return;
    const p = PIECES[piece];
    const { from, to, jello } = scene;
    ctx.save();
    // Dim everything except the tray piece and Jello + his hand.
    ctx.globalAlpha = 0.55 * a;
    ctx.fillStyle = '#060B26';
    ctx.beginPath();
    ctx.rect(0, 0, scene.w, scene.h);
    const pw = p.w * from.cs + 34;
    const ph = p.h * from.cs + 34;
    roundRectPath(ctx, from.cx - pw / 2, from.cy - ph / 2, pw, ph, 22);
    // roundRectPath begins a new path; rebuild the outer rect + both holes for even-odd filling.
    ctx.beginPath();
    ctx.rect(0, 0, scene.w, scene.h);
    holeRoundRect(ctx, from.cx - pw / 2, from.cy - ph / 2, pw, ph, 22);
    const sx = (jello.x + to.cx) / 2;
    const sy = (jello.y + to.cy) / 2;
    const rx = Math.abs(jello.x - to.cx) / 2 + jello.R * 1.9;
    const ry = jello.R * 1.9;
    ctx.moveTo(sx + rx, sy);
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.globalAlpha = a;

    // Pulsing target ring at Jello's hand.
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    ctx.strokeStyle = `rgba(255,236,140,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -now / 30;
    ctx.beginPath();
    ctx.arc(to.cx, to.cy, jello.R * (1.05 + 0.08 * pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ghost piece being carried.
    const t = this.phase(now);
    if (t >= 0.12 && t <= 0.8) {
      const g = this.ghost(scene, t);
      ctx.globalAlpha = a * 0.85 * g.s;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.scale(g.s, g.s);
      ctx.rotate(Math.sin(t * 20) * 0.04);
      drawPiece((-p.w * g.cs) / 2, (-p.h * g.cs) / 2, g.cs);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Big caption card over the dimmed board, its tail pointing at Jello. */
  drawCaption(ctx: CanvasRenderingContext2D, scene: TutorialScene, font: string, now: number): void {
    const a = this.fade(now);
    if (a <= 0 || !this.text) return;
    const { board, jello } = scene;
    const pop = easeOutBack(clamp01((now - this.start) / 380), 2.2);
    const fs = Math.max(18, Math.min(23, board.size * 0.058));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `800 ${fs}px ${font}`;
    ctx.direction = 'rtl';
    const maxW = Math.min(board.size - 28, 340);
    const lines = wrap(ctx, this.text, maxW - fs * 1.6);
    const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + fs * 1.6);
    const lh = fs * 1.35;
    const h = lines.length * lh + fs * 1.1;
    const cx = board.x + board.size / 2;
    const cy = board.y + board.size * 0.3;
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    const x = -w / 2;
    const y = -h / 2;
    const bob = Math.sin(now / 300) * 2;
    ctx.translate(0, bob);
    // Tail towards Jello.
    const tx = Math.min(w / 2 - 26, jello.x - cx);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(tx - 16, y + 2);
    ctx.lineTo(tx + 10, y - 22);
    ctx.lineTo(tx + 10, y + 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(6,11,38,0.35)';
    roundRectPath(ctx, x, y + 6, w, h, 20);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    roundRectPath(ctx, x, y, w, h, 20);
    ctx.stroke();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - 16, y + 3);
    ctx.lineTo(tx + 10, y - 22);
    ctx.lineTo(tx + 10, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1C2350';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, k) => ctx.fillText(l, 0, y + fs * 0.55 + lh * (k + 0.5)));
    ctx.restore();
  }

  /** The cartoon finger (draw last, on top of everything). */
  drawOver(ctx: CanvasRenderingContext2D, scene: TutorialScene, now: number): void {
    const a = this.fade(now);
    if (a <= 0) return;
    const t = this.phase(now);
    const { from } = scene;
    let x: number;
    let y: number;
    let press = 0;
    let alpha = 1;
    if (t < 0.12) {
      const u = easeOutCubic(t / 0.12);
      x = from.cx + 40 * (1 - u);
      y = from.cy + 70 * (1 - u);
      alpha = u;
    } else if (t < 0.2) {
      x = from.cx;
      y = from.cy;
      press = Math.sin(((t - 0.12) / 0.08) * Math.PI * 0.5);
    } else if (t <= 0.7) {
      const g = this.ghost(scene, t);
      x = g.x;
      y = g.y;
      press = 1;
    } else {
      const g = this.ghost(scene, 0.7);
      const u = clamp01((t - 0.7) / 0.2);
      x = g.x + 20 * u;
      y = g.y + 30 * u;
      press = 1 - u;
      alpha = 1 - clamp01((t - 0.82) / 0.12);
    }
    ctx.save();
    ctx.globalAlpha = a * alpha;
    drawFinger(ctx, x, y + 6, 46, press);
    ctx.restore();
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function holeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  // Counter-clockwise rounded rect (a hole for even-odd fill).
  ctx.moveTo(x + r, y);
  ctx.arcTo(x, y, x, y + h, r);
  ctx.arcTo(x, y + h, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x + w, y, r);
  ctx.arcTo(x + w, y, x, y, r);
  ctx.closePath();
}

/** White cartoon glove pointing up; (x, y) is the fingertip. */
function drawFinger(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, press: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.28);
  const k = 1 - 0.12 * press;
  ctx.scale(k, k);
  // Touch ripple.
  if (press > 0.5) {
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * press})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  const shape = (): void => {
    // Index finger.
    roundRectPath(ctx, -s * 0.12, -s * 0.02, s * 0.24, s * 0.62, s * 0.12);
    ctx.fill();
    ctx.stroke();
    // Palm.
    roundRectPath(ctx, -s * 0.18, s * 0.42, s * 0.66, s * 0.56, s * 0.22);
    ctx.fill();
    ctx.stroke();
    // Folded fingers.
    for (let k2 = 0; k2 < 3; k2++) {
      ctx.beginPath();
      ctx.arc(s * (0.18 + k2 * 0.15), s * 0.47, s * 0.09, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
    }
    // Thumb.
    ctx.beginPath();
    ctx.ellipse(-s * 0.22, s * 0.62, s * 0.1, s * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  ctx.save();
  ctx.translate(3, 5);
  ctx.globalAlpha *= 0.3;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = 'rgba(0,0,0,0)';
  shape();
  ctx.restore();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = INK;
  shape();
  // Cuff.
  ctx.fillStyle = '#FFD84A';
  roundRectPath(ctx, -s * 0.2, s * 0.92, s * 0.7, s * 0.16, s * 0.06);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
