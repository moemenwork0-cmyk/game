/**
 * Pre-rendered board: a glass panel (soft shadow and glow, light edge, top sheen) holding a dark
 * well with softly recessed cell sockets.
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

  // Shadow + coloured glow, drawn once.
  ctx.save();
  ctx.shadowColor = 'rgba(3,1,20,0.6)';
  ctx.shadowBlur = 34 * dpr;
  ctx.shadowOffsetY = 16 * dpr;
  roundRectPath(ctx, x, y, b, b, R);
  ctx.fillStyle = P.frameBottom;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(150,110,255,0.35)';
  ctx.shadowBlur = 28 * dpr;
  roundRectPath(ctx, x, y, b, b, R);
  ctx.fillStyle = P.frameBottom;
  ctx.fill();
  ctx.restore();

  // Glass frame.
  roundRectPath(ctx, x, y, b, b, R);
  const fg = ctx.createLinearGradient(0, y, 0, y + b);
  fg.addColorStop(0, P.frameTop);
  fg.addColorStop(1, P.frameBottom);
  ctx.fillStyle = fg;
  ctx.fill();
  // Light edge and a sheen along the top.
  ctx.save();
  roundRectPath(ctx, x, y, b, b, R);
  ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + b * 0.12);
  gl.addColorStop(0, 'rgba(255,255,255,0.22)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, b, b * 0.12);
  ctx.restore();
  roundRectPath(ctx, x + 0.75, y + 0.75, b - 1.5, b - 1.5, R - 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Recessed well.
  const pad = (b - 8 * lay.cs) / 2;
  const wi = Math.max(3, pad * 0.62);
  const wx = x + wi;
  const wy = y + wi;
  const ww = b - wi * 2;
  const wr = Math.max(10, R - wi * 0.7);
  roundRectPath(ctx, wx, wy, ww, ww, wr);
  const wg = ctx.createLinearGradient(0, wy, 0, wy + ww);
  wg.addColorStop(0, '#0A0726');
  wg.addColorStop(0.1, P.boardFill);
  wg.addColorStop(1, '#151045');
  ctx.fillStyle = wg;
  ctx.fill();
  // Inner shadow at the top, a faint light edge at the bottom.
  ctx.save();
  roundRectPath(ctx, wx, wy, ww, ww, wr);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 6;
  roundRectPath(ctx, wx - 2, wy - 1, ww + 4, ww + 6, wr + 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(170,150,255,0.16)';
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
      // Faint light lip below, the socket, then a darker top edge (reads as recessed).
      roundRectPath(ctx, sx, sy + 1, sw, sw, sr);
      ctx.fillStyle = P.socketHighlight;
      ctx.fill();
      roundRectPath(ctx, sx, sy, sw, sw, sr);
      ctx.fillStyle = P.socketShadow;
      ctx.fill();
      roundRectPath(ctx, sx, sy + 1.4, sw, sw - 1.4, sr);
      const sg = ctx.createLinearGradient(0, sy, 0, sy + sw);
      sg.addColorStop(0, '#191449');
      sg.addColorStop(1, P.socket);
      ctx.fillStyle = sg;
      ctx.fill();
    }
  }
  return { canvas, off };
}
