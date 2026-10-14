/**
 * PURE board rules on bitboards (spec 4). No DOM, no randomness.
 */
import { PIECE_SPECS, type PieceSpec } from '../config/pieces';
import { BOARD_SIZE } from '../config/config';
import { cellBit, clearFullLines, CL } from '../core/bitboard';

export interface Piece {
  index: number;
  id: string;
  group: PieceSpec['group'];
  weight: number;
  w: number;
  h: number;
  /** Cell offsets as [row, col] pairs. */
  cells: ReadonlyArray<readonly [number, number]>;
  n: number;
  /** All placements on an empty board: parallel arrays. */
  plLo: Int32Array;
  plHi: Int32Array;
  /** Top-left cell index (row * 8 + col) for each placement. */
  plPos: Uint8Array;
  /** Placement lookup by top-left index; -1 if the piece does not fit inside the board there. */
  plByPos: Int16Array;
}

function buildPiece(spec: PieceSpec, index: number): Piece {
  const cells: [number, number][] = [];
  spec.shape.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') cells.push([r, c]);
  });
  const h = spec.shape.length;
  const w = Math.max(...spec.shape.map((s) => s.length));
  const los: number[] = [];
  const his: number[] = [];
  const pos: number[] = [];
  const byPos = new Int16Array(64).fill(-1);
  for (let r = 0; r + h <= BOARD_SIZE; r++) {
    for (let c = 0; c + w <= BOARD_SIZE; c++) {
      let lo = 0;
      let hi = 0;
      for (const [dr, dc] of cells) {
        const i = (r + dr) * 8 + (c + dc);
        if (i < 32) lo |= cellBit(i);
        else hi |= cellBit(i);
      }
      byPos[r * 8 + c] = los.length;
      los.push(lo | 0);
      his.push(hi | 0);
      pos.push(r * 8 + c);
    }
  }
  return {
    index,
    id: spec.id,
    group: spec.group,
    weight: spec.weight,
    w,
    h,
    cells,
    n: cells.length,
    plLo: Int32Array.from(los),
    plHi: Int32Array.from(his),
    plPos: Uint8Array.from(pos),
    plByPos: byPos,
  };
}

export const PIECES: readonly Piece[] = PIECE_SPECS.map(buildPiece);
export const PIECE_BY_ID: ReadonlyMap<string, Piece> = new Map(PIECES.map((p) => [p.id, p]));

export function pieceIndex(id: string): number {
  const p = PIECE_BY_ID.get(id);
  if (!p) throw new Error(`Unknown piece ${id}`);
  return p.index;
}

/** Placement index of piece at top-left (r, c), or -1 if it would leave the board. */
export function placementAt(piece: number, r: number, c: number): number {
  if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return -1;
  return PIECES[piece].plByPos[r * 8 + c];
}

export function canPlace(lo: number, hi: number, piece: number, r: number, c: number): boolean {
  const k = placementAt(piece, r, c);
  if (k < 0) return false;
  const p = PIECES[piece];
  return (lo & p.plLo[k]) === 0 && (hi & p.plHi[k]) === 0;
}

export function anyFit(lo: number, hi: number, piece: number): boolean {
  const p = PIECES[piece];
  const L = p.plLo;
  const H = p.plHi;
  for (let k = 0; k < L.length; k++) if ((lo & L[k]) === 0 && (hi & H[k]) === 0) return true;
  return false;
}

export function countFits(lo: number, hi: number, piece: number): number {
  const p = PIECES[piece];
  let n = 0;
  for (let k = 0; k < p.plLo.length; k++) if ((lo & p.plLo[k]) === 0 && (hi & p.plHi[k]) === 0) n++;
  return n;
}

export interface PlaceOutcome {
  lo: number;
  hi: number;
  /** Bitmask of full rows (bit r) and columns (bit c) that were cleared. */
  rows: number;
  cols: number;
  lines: number;
}

/** Places piece at (r, c) and clears full lines. Caller must ensure canPlace. */
export function place(lo: number, hi: number, piece: number, r: number, c: number): PlaceOutcome {
  const k = placementAt(piece, r, c);
  const p = PIECES[piece];
  const lines = clearFullLines(lo | p.plLo[k], hi | p.plHi[k]);
  return { lo: CL.lo, hi: CL.hi, rows: CL.rows, cols: CL.cols, lines };
}

/** Lines that placing the piece at (r, c) would complete (rows bitmask, cols bitmask). */
export function linesCompletedBy(lo: number, hi: number, piece: number, r: number, c: number): PlaceOutcome {
  return place(lo, hi, piece, r, c);
}

/** Cell indices covered by a full-line set, each counted once. */
export function cellsOfLines(rows: number, cols: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) {
    const r = i >> 3;
    const c = i & 7;
    if (rows & (1 << r) || cols & (1 << c)) out.push(i);
  }
  return out;
}

/** True if none of the given pieces can be placed anywhere. */
export function isGameOver(lo: number, hi: number, pieces: readonly number[]): boolean {
  for (const p of pieces) if (anyFit(lo, hi, p)) return false;
  return true;
}
