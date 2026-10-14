/** Pre-rendered board base: frame, inner border and recessed cell sockets (spec 9.1). */
import { THEME } from '../config/theme';
import { makeCanvas, roundRectPath } from './blockSprites';
import type { Layout } from './layout';

export interface BoardBase {
  canvas: HTMLCanvasElement;
  /** CSS-px offset of the canvas relative to the board's top-left. */
  off: number;
}

export function renderBoardBase(lay: Layout): BoardBase {
  const P = THEME.palette;
  const dpr = lay.dpr;
  const off = 40;
  const size = lay.boardSize + off * 2;
  const canvas = makeCanvas(size * dpr, size * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const x = off;
  const y = off;
  const b = lay.boardSize;
  const R = THEME.layout.frameRadius;

  // Outer soft shadow (0 10 30 rgba(0,0,0,.35)), drawn once.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 30 * dpr;
  ctx.shadowOffsetY = 10 * dpr;
  roundRectPath(ctx, x, y, b, b, R);
  ctx.fillStyle = P.boardFill;
  ctx.fill();
  ctx.restore();

  // Frame fill with a faint top sheen.
  roundRectPath(ctx, x, y, b, b, R);
  const g = ctx.createLinearGradient(0, y, 0, y + b);
  g.addColorStop(0, '#18234A');
  g.addColorStop(0.18, P.boardFill);
  g.addColorStop(1, '#10182F');
  ctx.fillStyle = g;
  ctx.fill();

  // 3 px inner border.
  ctx.lineWidth = 3;
  ctx.strokeStyle = P.boardBorder;
  roundRectPath(ctx, x + 1.5, y + 1.5, b - 3, b - 3, R - 1.5);
  ctx.stroke();
  // Thin outer highlight so the frame reads against the background.
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  roundRectPath(ctx, x + 0.5, y + 0.5, b - 1, b - 1, R);
  ctx.stroke();

  // Sockets.
  const cs = lay.cs;
  const gx = lay.gridX - lay.boardX + off;
  const gy = lay.gridY - lay.boardY + off;
  const inset = Math.max(1, cs * 0.05);
  const sw = cs - inset * 2;
  const sr = sw * 0.18;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sx = gx + c * cs + inset;
      const sy = gy + r * cs + inset;
      // Highlight at the bottom (1px lower), shadow at the top, then the socket fill.
      roundRectPath(ctx, sx, sy + 1, sw, sw, sr);
      ctx.fillStyle = P.socketHighlight;
      ctx.fill();
      roundRectPath(ctx, sx, sy, sw, sw, sr);
      ctx.fillStyle = P.socketShadow;
      ctx.fill();
      roundRectPath(ctx, sx, sy + 1, sw, sw - 1, sr);
      ctx.fillStyle = P.socket;
      ctx.fill();
    }
  }
  return { canvas, off };
}
