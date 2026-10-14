/**
 * Greedy bot (spec 18.3). For each deal it searches orders and placements and scores the outcome by
 * (lines × 10) − (holes × 3) − (bumpiness × 1) + (largest empty rectangle × 0.5).
 * To stay fast enough for thousands of games the search is a beam search (see DECISIONS.md).
 */
import { CL, clearFullLines, popcount, shiftFromAbove, shiftFromBelow, SH, fromLeft, fromRight, isSet } from '../src/core/bitboard';
import { PIECES } from '../src/game/rules';
import type { Session } from '../src/game/session';

export const BOT_WEIGHTS = { lines: 10, holes: 3, bumpiness: 1, rect: 0.5 };
const BEAM = 6;

/** Empty cells whose four neighbours are all occupied (or walls). */
export function holes(lo: number, hi: number): number {
  shiftFromAbove(lo, hi);
  const aLo = SH.lo;
  const aHi = SH.hi;
  shiftFromBelow(lo, hi);
  const hLo = ~lo & aLo & SH.lo & fromLeft(lo) & fromRight(lo);
  const hHi = ~hi & aHi & SH.hi & fromLeft(hi) & fromRight(hi);
  return popcount(hLo) + popcount(hHi);
}

/**
 * Surface roughness: number of filled/empty transitions between orthogonal neighbours inside the
 * board, divided by 4 so it stays on the same scale as the other terms.
 */
export function bumpiness(lo: number, hi: number): number {
  // Horizontal: compare each cell with its left neighbour (excluding column 0).
  const hLo = (lo ^ (lo << 1)) & ~0x01010101;
  const hHi = (hi ^ (hi << 1)) & ~0x01010101;
  // Vertical: compare each cell with the one above (excluding row 0).
  const vLo = (lo ^ (lo << 8)) & ~0xff;
  const vHi = hi ^ ((hi << 8) | (lo >>> 24));
  return (popcount(hLo) + popcount(hHi) + popcount(vLo) + popcount(vHi)) / 4;
}

const heights = new Int32Array(8);
/** Area of the largest all-empty axis-aligned rectangle (histogram method). */
export function largestEmptyRect(lo: number, hi: number): number {
  heights.fill(0);
  let best = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) heights[c] = isSet(lo, hi, r * 8 + c) ? 0 : heights[c] + 1;
    for (let c = 0; c < 8; c++) {
      let h = heights[c];
      if (h === 0) continue;
      for (let e = c; e < 8 && heights[e] > 0; e++) {
        if (heights[e] < h) h = heights[e];
        const a = h * (e - c + 1);
        if (a > best) best = a;
      }
    }
  }
  return best;
}

export function evaluate(lo: number, hi: number, lines: number): number {
  return (
    lines * BOT_WEIGHTS.lines -
    holes(lo, hi) * BOT_WEIGHTS.holes -
    bumpiness(lo, hi) * BOT_WEIGHTS.bumpiness +
    largestEmptyRect(lo, hi) * BOT_WEIGHTS.rect
  );
}

interface Node {
  lo: number;
  hi: number;
  lines: number;
  used: number;
  first: { slot: number; r: number; c: number } | null;
  score: number;
}

/** Picks the next move (slot, r, c) for the session's current tray, or null if nothing fits. */
export function chooseMove(s: Session): { slot: number; r: number; c: number } | null {
  const slots: number[] = [];
  for (let k = 0; k < 3; k++) if (s.tray[k]) slots.push(k);
  let frontier: Node[] = [{ lo: s.board.lo, hi: s.board.hi, lines: 0, used: 0, first: null, score: 0 }];
  let bestComplete: Node | null = null;
  let bestPartial: Node | null = null;
  for (let depth = 0; depth < slots.length; depth++) {
    const next: Node[] = [];
    const seen = new Set<string>();
    for (const n of frontier) {
      for (const slot of slots) {
        if (n.used & (1 << slot)) continue;
        const p = PIECES[s.tray[slot]!.piece];
        for (let k = 0; k < p.plLo.length; k++) {
          if ((n.lo & p.plLo[k]) !== 0 || (n.hi & p.plHi[k]) !== 0) continue;
          const l = clearFullLines(n.lo | p.plLo[k], n.hi | p.plHi[k]);
          const lo = CL.lo;
          const hi = CL.hi;
          const used = n.used | (1 << slot);
          const key = `${lo},${hi},${used}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const pos = p.plPos[k];
          const lines = n.lines + l;
          next.push({
            lo,
            hi,
            lines,
            used,
            first: n.first ?? { slot, r: pos >> 3, c: pos & 7 },
            score: evaluate(lo, hi, lines),
          });
        }
      }
    }
    if (next.length === 0) break;
    next.sort((a, b) => b.score - a.score);
    if (!bestPartial || next[0].score > bestPartial.score) bestPartial = next[0];
    if (depth === slots.length - 1) bestComplete = next[0];
    frontier = next.slice(0, BEAM);
  }
  // Prefer any sequence that places every remaining piece; if the beam lost them all, search exhaustively.
  if (!bestComplete && slots.length > 1) {
    const rescue = solveExhaustive(s.board.lo, s.board.hi, slots.map((k) => s.tray[k]!.piece));
    if (rescue) return { slot: slots[rescue.idx], r: rescue.r, c: rescue.c };
  }
  const pick = bestComplete ?? bestPartial;
  return pick?.first ?? null;
}

let exNodes = 0;
/** First move of any sequence that places all pieces (depth-first, node-capped). */
function solveExhaustive(lo: number, hi: number, pieces: number[]): { idx: number; r: number; c: number } | null {
  exNodes = 0;
  const all = (1 << pieces.length) - 1;
  const rec = (lo: number, hi: number, used: number): boolean => {
    if (used === all) return true;
    for (let i = 0; i < pieces.length; i++) {
      if (used & (1 << i)) continue;
      const p = PIECES[pieces[i]];
      for (let k = 0; k < p.plLo.length; k++) {
        if ((lo & p.plLo[k]) !== 0 || (hi & p.plHi[k]) !== 0) continue;
        if (++exNodes > 50000) return false;
        clearFullLines(lo | p.plLo[k], hi | p.plHi[k]);
        if (rec(CL.lo, CL.hi, used | (1 << i))) return true;
      }
    }
    return false;
  };
  for (let i = 0; i < pieces.length; i++) {
    const p = PIECES[pieces[i]];
    for (let k = 0; k < p.plLo.length; k++) {
      if ((lo & p.plLo[k]) !== 0 || (hi & p.plHi[k]) !== 0) continue;
      clearFullLines(lo | p.plLo[k], hi | p.plHi[k]);
      if (rec(CL.lo, CL.hi, 1 << i)) return { idx: i, r: p.plPos[k] >> 3, c: p.plPos[k] & 7 };
      if (exNodes > 50000) return null;
    }
  }
  return null;
}
