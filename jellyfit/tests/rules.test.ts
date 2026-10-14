import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { clearFullLines, CL, popcount, isSet, cellBit } from '../src/core/bitboard';
import { PIECES, anyFit, canPlace, place, pieceIndex, isGameOver } from '../src/game/rules';
import { Board } from '../src/game/board';

/** Naive 2D reference implementation. */
type Grid = boolean[][];
const emptyGrid = (): Grid => Array.from({ length: 8 }, () => Array(8).fill(false));
const toGrid = (lo: number, hi: number): Grid => {
  const g = emptyGrid();
  for (let i = 0; i < 64; i++) g[i >> 3][i & 7] = isSet(lo, hi, i);
  return g;
};
const fromGrid = (g: Grid): [number, number] => {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 64; i++) {
    if (!g[i >> 3][i & 7]) continue;
    if (i < 32) lo |= cellBit(i);
    else hi |= cellBit(i);
  }
  return [lo | 0, hi | 0];
};
function naiveCanPlace(g: Grid, piece: number, r: number, c: number): boolean {
  for (const [dr, dc] of PIECES[piece].cells) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr < 0 || cc < 0 || rr > 7 || cc > 7 || g[rr][cc]) return false;
  }
  return true;
}
function naivePlace(g: Grid, piece: number, r: number, c: number): { g: Grid; lines: number } {
  const n = g.map((row) => row.slice());
  for (const [dr, dc] of PIECES[piece].cells) n[r + dr][c + dc] = true;
  const fullRows = [0, 1, 2, 3, 4, 5, 6, 7].filter((rr) => n[rr].every(Boolean));
  const fullCols = [0, 1, 2, 3, 4, 5, 6, 7].filter((cc) => n.every((row) => row[cc]));
  for (const rr of fullRows) for (let cc = 0; cc < 8; cc++) n[rr][cc] = false;
  for (const cc of fullCols) for (let rr = 0; rr < 8; rr++) n[rr][cc] = false;
  return { g: n, lines: fullRows.length + fullCols.length };
}
function randomGrid(rng: Rng, density: number): Grid {
  const g = emptyGrid();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g[r][c] = rng.next() < density;
  return g;
}

describe('bitboard', () => {
  it('popcount matches naive count', () => {
    const rng = new Rng(3);
    for (let k = 0; k < 1000; k++) {
      const x = (rng.next() * 4294967296) | 0;
      let n = 0;
      for (let b = 0; b < 32; b++) if (x & (1 << b)) n++;
      expect(popcount(x)).toBe(n);
    }
  });

  it('clears simultaneous row and column, counting the cross cell once', () => {
    const b = new Board();
    b.fromRows(['1111111.', '.......1', '.......1', '.......1', '.......1', '.......1', '.......1', '.......1']);
    const res = b.place(pieceIndex('1x1'), 0, 7, 2);
    expect(res.lines).toBe(2);
    expect(res.cleared.length).toBe(15);
    expect(b.filled()).toBe(0);
  });
});

describe('rules', () => {
  it('rejects placements at edges and overlaps', () => {
    const h5 = pieceIndex('h5');
    expect(canPlace(0, 0, h5, 0, 3)).toBe(true);
    expect(canPlace(0, 0, h5, 0, 4)).toBe(false);
    expect(canPlace(0, 0, h5, 7, 0)).toBe(true);
    expect(canPlace(0, 0, h5, 8, 0)).toBe(false);
    expect(canPlace(0, 0, h5, -1, 0)).toBe(false);
    const v5 = pieceIndex('v5');
    expect(canPlace(0, 0, v5, 3, 0)).toBe(true);
    expect(canPlace(0, 0, v5, 4, 0)).toBe(false);
    const b = new Board();
    b.set(10, 0);
    expect(canPlace(b.lo, b.hi, pieceIndex('sq2'), 0, 1)).toBe(false);
    expect(canPlace(b.lo, b.hi, pieceIndex('sq2'), 0, 3)).toBe(true);
  });

  it('detects game over', () => {
    const b = new Board();
    // Checkerboard: no 2-cell piece fits, singles do.
    for (let i = 0; i < 64; i++) if (((i >> 3) + (i & 7)) % 2 === 0) b.set(i, 0);
    expect(isGameOver(b.lo, b.hi, [pieceIndex('h2'), pieceIndex('v2'), pieceIndex('sq2')])).toBe(true);
    expect(isGameOver(b.lo, b.hi, [pieceIndex('h2'), pieceIndex('1x1')])).toBe(false);
  });

  it('every piece has the expected placement count on an empty board', () => {
    for (const p of PIECES) expect(p.plLo.length).toBe((9 - p.w) * (9 - p.h));
  });

  it('matches the naive reference on 10,000 random cases', () => {
    const rng = new Rng(12345);
    for (let k = 0; k < 10000; k++) {
      const g = randomGrid(rng, rng.range(0.1, 0.9));
      const [lo, hi] = fromGrid(g);
      const piece = rng.int(PIECES.length);
      const r = rng.int(10) - 1;
      const c = rng.int(10) - 1;
      const ok = naiveCanPlace(g, piece, r, c);
      expect(canPlace(lo, hi, piece, r, c)).toBe(ok);
      const naiveAny = [...Array(64).keys()].some((i) => naiveCanPlace(g, piece, i >> 3, i & 7));
      expect(anyFit(lo, hi, piece)).toBe(naiveAny);
      if (ok) {
        const ref = naivePlace(g, piece, r, c);
        const out = place(lo, hi, piece, r, c);
        expect(out.lines).toBe(ref.lines);
        expect(toGrid(out.lo, out.hi)).toEqual(ref.g);
      }
      // clearFullLines on the raw grid too
      const ref2 = naivePlace(g, pieceIndex('1x1'), 0, 0);
      if (!g[0][0]) {
        const n = clearFullLines(lo | 1, hi);
        expect(n).toBe(ref2.lines);
        expect(toGrid(CL.lo, CL.hi)).toEqual(ref2.g);
      }
    }
  });
});
