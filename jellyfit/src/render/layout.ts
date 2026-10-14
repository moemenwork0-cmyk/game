/** Responsive layout (spec 3). All values in CSS pixels. */
import { THEME } from '../config/theme';

const L = THEME.layout;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  w: number;
  h: number;
  dpr: number;
  landscape: boolean;
  colX: number;
  colW: number;
  /** Top of the HUD area. */
  hudY: number;
  hudH: number;
  boardX: number;
  boardY: number;
  boardSize: number;
  /** Top-left of the 8×8 cell grid. */
  gridX: number;
  gridY: number;
  /** Cell size (whole device pixels). */
  cs: number;
  trayX: number;
  trayY: number;
  trayW: number;
  trayH: number;
  slotW: number;
  /** Base cell size for tray pieces before per-piece fitting. */
  trayCs: number;
}

export function computeLayout(w: number, h: number, dprRaw: number, safe: Insets): Layout {
  const dpr = Math.min(dprRaw || 1, L.maxDpr);
  const landscape = w / h > L.landscapeAspect;
  const availH = h - safe.top - safe.bottom;
  const hudH = landscape ? L.topBarLandscape : L.topBarPortrait;
  const fixed = hudH + L.gapBoardTray + L.bottomPad;
  const byHeight = (availH - fixed) / (1 + L.trayOfBoard);

  let boardSize: number;
  let colW: number;
  if (landscape) {
    boardSize = Math.min(availH * L.landscapeBoardOfHeight, L.boardMax, byHeight);
    colW = Math.min(w, boardSize + 2 * L.sidePad);
  } else {
    colW = Math.min(w - safe.left - safe.right, L.columnMax);
    boardSize = Math.min(colW - 2 * L.sidePad, byHeight, L.boardMax);
  }
  boardSize = Math.max(160, Math.floor(boardSize));

  const pad = Math.max(5, Math.round(boardSize * L.framePad));
  const cs = Math.floor(((boardSize - 2 * pad) * dpr) / 8) / dpr;
  const trayH = Math.round(boardSize * L.trayOfBoard);
  const total = hudH + boardSize + L.gapBoardTray + trayH;
  const extra = Math.max(0, availH - L.bottomPad - total);

  const colX = (w - colW) / 2;
  const hudY = safe.top + extra * 0.32;
  const boardX = Math.round((w - boardSize) / 2);
  const boardY = Math.round(hudY + hudH + extra * 0.14);
  const gridX = boardX + (boardSize - 8 * cs) / 2;
  const gridY = boardY + (boardSize - 8 * cs) / 2;
  const trayY = boardY + boardSize + L.gapBoardTray + extra * 0.16;
  const trayW = boardSize;

  return {
    w,
    h,
    dpr,
    landscape,
    colX,
    colW,
    hudY,
    hudH,
    boardX,
    boardY,
    boardSize,
    gridX,
    gridY,
    cs,
    trayX: boardX,
    trayY,
    trayW,
    trayH,
    slotW: trayW / 3,
    trayCs: cs * (landscape ? L.trayScaleDesktop : L.trayScale),
  };
}

/** Cell size for a piece of w×h cells in a tray slot (scaled to fit). */
export function trayCellSize(lay: Layout, pw: number, ph: number): number {
  return Math.min(lay.trayCs, (lay.slotW * 0.86) / pw, (lay.trayH * 0.82) / ph);
}

/** Top-left position of a piece drawn centred in its tray slot. */
export function trayPiecePos(lay: Layout, slot: number, pw: number, ph: number): { x: number; y: number; cs: number } {
  const tcs = trayCellSize(lay, pw, ph);
  const cx = lay.trayX + lay.slotW * (slot + 0.5);
  const cy = lay.trayY + lay.trayH / 2;
  return { x: cx - (pw * tcs) / 2, y: cy - (ph * tcs) / 2, cs: tcs };
}
