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
  /** Wide layout: score column on the left, tray as a column of 3 slots on the right of the board. */
  wide: boolean;
  /** Left edge and width of the HUD (wide: the score column; else the board width). */
  hudX: number;
  hudW: number;
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
  slotH: number;
  /** Base cell size for tray pieces before per-piece fitting. */
  trayCs: number;
}

export function computeLayout(w: number, h: number, dprRaw: number, safe: Insets): Layout {
  const dpr = Math.min(dprRaw || 1, L.maxDpr);
  const landscape = w / h > L.landscapeAspect;
  const availH = h - safe.top - safe.bottom;
  const hudH = landscape ? L.topBarLandscape : L.topBarPortrait;
  const topPad = 12;
  const fixed = topPad + hudH + L.gapBoardTray + L.bottomPad;
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
  const extra = Math.max(0, availH - L.bottomPad - topPad - total);

  if (landscape && boardSize < L.wideBelowBoard) {
    const wide = wideLayout(w, h, dpr, safe);
    if (wide.boardSize > boardSize * 1.15) return wide;
  }

  const colX = (w - colW) / 2;
  const hudY = safe.top + topPad + extra * 0.32;
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
    wide: false,
    hudX: boardX,
    hudW: boardSize,
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
    slotH: trayH,
    trayCs: cs * (landscape ? L.trayScaleDesktop : L.trayScale),
  };
}

/** Score column | board | tray column, with room above the board for Jello. */
function wideLayout(w: number, h: number, dpr: number, safe: Insets): Layout {
  const m = 12;
  const gap = L.wideGap;
  const availH = h - safe.top - safe.bottom - 2 * m;
  const availW = w - safe.left - safe.right - 2 * m;
  const byH = availH / (1 + L.wideHeadroom);
  const byW = (availW - 2 * gap) / (1 + L.wideScoreOfBoard + L.wideTrayOfBoard);
  const boardSize = Math.max(160, Math.floor(Math.min(byH, byW, L.boardMax)));
  const pad = Math.max(5, Math.round(boardSize * L.framePad));
  const cs = Math.floor(((boardSize - 2 * pad) * dpr) / 8) / dpr;
  const scoreW = Math.max(120, Math.round(boardSize * L.wideScoreOfBoard));
  const trayW = Math.round(boardSize * L.wideTrayOfBoard);
  const groupW = scoreW + gap + boardSize + gap + trayW;
  const x0 = safe.left + m + Math.max(0, (availW - groupW) / 2);
  const headroom = Math.round(boardSize * L.wideHeadroom);
  const extra = Math.max(0, availH - headroom - boardSize);
  const boardX = Math.round(x0 + scoreW + gap);
  const boardY = Math.round(safe.top + m + headroom + extra * 0.5);
  const gridX = boardX + (boardSize - 8 * cs) / 2;
  const gridY = boardY + (boardSize - 8 * cs) / 2;
  const trayX = boardX + boardSize + gap;
  return {
    w,
    h,
    dpr,
    landscape: true,
    wide: true,
    hudX: Math.round(x0),
    hudW: scoreW,
    colX: x0,
    colW: groupW,
    hudY: boardY,
    hudH: boardSize,
    boardX,
    boardY,
    boardSize,
    gridX,
    gridY,
    cs,
    trayX,
    trayY: boardY,
    trayW,
    trayH: boardSize,
    slotW: trayW,
    slotH: boardSize / 3,
    trayCs: cs * L.trayScaleDesktop,
  };
}

/** Centre of a tray slot (slots side by side, or stacked in the wide layout). */
export function slotCenter(lay: Layout, slot: number): { x: number; y: number } {
  if (lay.wide) return { x: lay.trayX + lay.trayW / 2, y: lay.trayY + lay.slotH * (slot + 0.5) };
  return { x: lay.trayX + lay.slotW * (slot + 0.5), y: lay.trayY + lay.trayH / 2 };
}

/** Cell size for a piece of w×h cells in a tray slot (scaled to fit). */
export function trayCellSize(lay: Layout, pw: number, ph: number): number {
  return Math.min(lay.trayCs, (lay.slotW * 0.86) / pw, (lay.slotH * 0.82) / ph);
}

/** Top-left position of a piece drawn centred in its tray slot. */
export function trayPiecePos(lay: Layout, slot: number, pw: number, ph: number): { x: number; y: number; cs: number } {
  const tcs = trayCellSize(lay, pw, ph);
  const { x: cx, y: cy } = slotCenter(lay, slot);
  return { x: cx - (pw * tcs) / 2, y: cy - (ph * tcs) / 2, cs: tcs };
}
