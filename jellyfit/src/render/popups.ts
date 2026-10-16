/** Score popups, feedback words and the combo badge (spec 7, 9.4). */
import { THEME } from '../config/theme';
import { clamp01, easeOutBack, easeOutCubic, easeInCubic } from '../core/tween';
import { roundRectPath } from './blockSprites';
import { LANG, STR } from '../config/strings';

export const FONT = '"Baloo Bhaijaan 2", "Segoe UI", Tahoma, system-ui, sans-serif';

interface ScorePopup {
  x: number;
  y: number;
  text: string;
  start: number;
  size: number;
}

interface Word {
  text: string;
  color: string;
  start: number;
}

const ARABIC = /[\u0600-\u06FF]/;

export function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  outline: string,
  fill = '#fff',
  outlineRatio = 0.22,
): void {
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.direction = ARABIC.test(text) ? 'rtl' : 'ltr';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  // Soft drop shadow (two offset strokes, no shadowBlur).
  ctx.strokeStyle = 'rgba(4,8,28,0.4)';
  ctx.lineWidth = size * outlineRatio;
  ctx.strokeText(text, x, y + size * 0.08);
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export class Popups {
  private scores: ScorePopup[] = [];
  private word: Word | null = null;
  combo = 0;
  comboGrace = 0;
  private comboBump = -1e9;
  private comboShown = -1e9;
  private comboHidden = -1e9;
  private comboLabel = 2;

  reset(): void {
    this.scores.length = 0;
    this.word = null;
    this.combo = 0;
    this.comboShown = this.comboHidden = this.comboBump = -1e9;
  }

  score(x: number, y: number, value: number, now: number, size: number): void {
    if (this.scores.length > 12) this.scores.shift();
    this.scores.push({ x, y, text: '+' + value.toLocaleString('en-US'), start: now, size });
  }

  showWord(text: string, color: string, now: number): void {
    this.word = { text, color, start: now };
  }

  setCombo(n: number, grace: number, now: number): void {
    if (n >= 2 && this.combo < 2) this.comboShown = now;
    if (n < 2 && this.combo >= 2) this.comboHidden = now;
    if (n > this.combo && n >= 2) this.comboBump = now;
    if (n >= 2) this.comboLabel = n;
    this.combo = n;
    this.comboGrace = grace;
  }

  drawScores(ctx: CanvasRenderingContext2D, now: number): void {
    const C = THEME.clear;
    this.scores = this.scores.filter((p) => now - p.start < C.popupMs);
    for (const p of this.scores) {
      const t = (now - p.start) / C.popupMs;
      const pop = t < 0.2 ? easeOutBack(t / 0.2, 2.2) : 1;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      outlinedText(ctx, p.text, p.x, p.y - C.popupRise * easeOutCubic(t), p.size * (0.6 + 0.4 * pop), '#24346B', '#fff', 0.24);
    }
    ctx.globalAlpha = 1;
  }

  drawWord(ctx: CanvasRenderingContext2D, now: number, cx: number, cy: number, size: number): void {
    const w = this.word;
    if (!w) return;
    const W = THEME.words;
    const t = now - w.start;
    const total = W.inMs + W.holdMs + W.outMs;
    if (t >= total) {
      this.word = null;
      return;
    }
    let scale = 1;
    let alpha = 1;
    let dy = 0;
    if (t < W.inMs) scale = easeOutBack(t / W.inMs, 2.6);
    else if (t > W.inMs + W.holdMs) {
      const u = (t - W.inMs - W.holdMs) / W.outMs;
      alpha = 1 - u;
      dy = -size * 0.4 * easeInCubic(u);
      scale = 1 + 0.08 * u;
    } else {
      // Gentle wobble during hold.
      scale = 1 + 0.025 * Math.sin(((t - W.inMs) / 1000) * Math.PI * 4);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy + dy);
    ctx.scale(scale, scale);
    ctx.rotate(-0.04);
    outlinedText(ctx, w.text, 0, 0, size, w.color, '#fff', 0.26);
    ctx.restore();
  }

  /** "Combo ×N" pill straddling the top of the board, with a draining grace ring. */
  /** Draws the badge with its left edge at `left` (vertically centred on cy). */
  drawCombo(ctx: CanvasRenderingContext2D, now: number, left: number, cy: number, size: number): void {
    const showing = this.combo >= 2;
    const tIn = now - this.comboShown;
    const tOut = now - this.comboHidden;
    let scale: number;
    if (showing) scale = tIn < 300 ? easeOutBack(clamp01(tIn / 300), 2.2) : 1;
    else if (tOut < 200) scale = 1 - easeInCubic(tOut / 200);
    else return;
    const bump = now - this.comboBump;
    if (bump < 260) scale *= 1 + 0.18 * Math.sin((bump / 260) * Math.PI);
    if (scale <= 0.01) return;

    const word = STR.comboWord;
    const num = `×${this.comboLabel}`;
    ctx.save();
    ctx.font = `800 ${size}px ${FONT}`;
    const gap = size * 0.3;
    const ww = ctx.measureText(word).width;
    const nw = ctx.measureText(num).width;
    const tw = ww + gap + nw;
    const h = size * 1.5;
    const ring = h * 0.78;
    const w = tw + size * 1.2 + ring;
    ctx.translate(left + w / 2, cy);
    ctx.scale(scale, scale);
    const x = -w / 2;
    const y = -h / 2;
    const P = THEME.palette;
    ctx.fillStyle = 'rgba(20,6,50,0.35)';
    roundRectPath(ctx, x, y + size * 0.14, w, h, h / 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#FFE27A');
    g.addColorStop(1, P.gold);
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, size * 0.08);
    roundRectPath(ctx, x + size * 0.12, y + size * 0.12, w - size * 0.24, h * 0.42, h * 0.21);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.goldText;
    ctx.textBaseline = 'middle';
    // Word and number drawn separately so the number never flips around the Arabic word.
    // Reading order: Arabic «كومبو ×4» right to left with the grace ring at the left end,
    // English "Combo ×4" left to right with the ring at the right end.
    const rtl = LANG === 'ar';
    let rx: number;
    if (rtl) {
      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillText(word, x + w - size * 0.6, size * 0.06);
      ctx.direction = 'ltr';
      ctx.textAlign = 'right';
      ctx.fillText(num, x + w - size * 0.6 - ww - gap, size * 0.06);
      rx = x + size * 0.45 + ring / 2;
    } else {
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.fillText(word, x + size * 0.6, size * 0.06);
      ctx.fillText(num, x + size * 0.6 + ww + gap, size * 0.06);
      rx = x + w - size * 0.45 - ring / 2;
    }
    ctx.lineWidth = ring * 0.22;
    ctx.strokeStyle = 'rgba(74,42,0,0.22)';
    ctx.beginPath();
    ctx.arc(rx, 0, ring / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = this.comboGrace > 0.34 ? '#FF3D6E' : '#FF8C2B';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(rx, 0, ring / 2 - ctx.lineWidth / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, this.comboGrace));
    ctx.stroke();
    ctx.restore();
  }
}
