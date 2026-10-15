/**
 * Pre-rendered board: a chunky candy tray (dark outline, raised glossy frame with a bottom lip),
 * a recessed well and soft recessed cell sockets.
 */
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
  const R = Math.max(18, b * 0.06);
  const lip = Math.max(5, b * 0.016);

  // Soft drop shadow, drawn once.
  ctx.save();
  ctx.shadowColor = 'rgba(6,12,40,0.45)';
  ctx.shadowBlur = 26 * dpr;
  ctx.shadowOffsetY = 12 * dpr;
  roundRectPath(ctx, x, y, b, b + lip, R);
  ctx.fillStyle = P.ink;
  ctx.fill();
  ctx.restore();

  // Dark outline + lip.
  roundRectPath(ctx, x - 2, y - 2, b + 4, b + lip + 4, R + 2);
  ctx.fillStyle = P.ink;
  ctx.fill();
  roundRectPath(ctx, x + 1, y + lip * 0.5, b - 2, b + lip * 0.5, R);
  ctx.fillStyle = '#1F3486';
  ctx.fill();

  // Raised frame.
  roundRectPath(ctx, x + 1, y + 1, b - 2, b - 2, R - 1);
  const fg = ctx.createLinearGradient(0, y, 0, y + b);
  fg.addColorStop(0, P.frameTop);
  fg.addColorStop(1, P.frameBottom);
  ctx.fillStyle = fg;
  ctx.fill();
  // Gloss along the top edge of the frame.
  ctx.save();
  roundRectPath(ctx, x + 1, y + 1, b - 2, b - 2, R - 1);
  ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + b * 0.08);
  gl.addColorStop(0, 'rgba(255,255,255,0.45)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, b, b * 0.08);
  ctx.restore();

  // Recessed well.
  const pad = (b - 8 * lay.cs) / 2;
  const wi = Math.max(3, pad * 0.62);
  const wx = x + wi;
  const wy = y + wi;
  const ww = b - wi * 2;
  const wr = Math.max(10, R - wi * 0.7);
  roundRectPath(ctx, wx - 1.5, wy - 1.5, ww + 3, ww + 3, wr + 1.5);
  ctx.fillStyle = P.ink;
  ctx.fill();
  roundRectPath(ctx, wx, wy, ww, ww, wr);
  const wg = ctx.createLinearGradient(0, wy, 0, wy + ww);
  wg.addColorStop(0, '#0D1536');
  wg.addColorStop(0.08, P.boardFill);
  wg.addColorStop(1, '#16214F');
  ctx.fillStyle = wg;
  ctx.fill();
  // Bottom rim light inside the well.
  ctx.save();
  roundRectPath(ctx, wx, wy, ww, ww, wr);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,150,255,0.18)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, wx + 1, wy - 2, ww - 2, ww + 1, wr);
  ctx.stroke();
  ctx.restore();

  // Sockets.
  const cs = lay.cs;
  const gx = lay.gridX - lay.boardX + off;
  const gy = lay.gridY - lay.boardY + off;
  const inset = Math.max(1.5, cs * 0.055);
  const sw = cs - inset * 2;
  const sr = sw * 0.22;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sx = gx + c * cs + inset;
      const sy = gy + r * cs + inset;
      roundRectPath(ctx, sx, sy + 1.2, sw, sw, sr);
      ctx.fillStyle = P.socketHighlight;
      ctx.fill();
      roundRectPath(ctx, sx, sy, sw, sw, sr);
      ctx.fillStyle = P.socketShadow;
      ctx.fill();
      roundRectPath(ctx, sx, sy + 1.6, sw, sw - 1.6, sr);
      const sg = ctx.createLinearGradient(0, sy, 0, sy + sw);
      sg.addColorStop(0, '#18244F');
      sg.addColorStop(1, P.socket);
      ctx.fillStyle = sg;
      ctx.fill();
    }
  }
  return { canvas, off };
}
