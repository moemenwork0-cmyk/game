/**
 * 8×8 bitboard as two 32-bit masks: `lo` holds rows 0–3, `hi` rows 4–7.
 * Cell index i = row * 8 + col; bit (i & 31) of lo (i < 32) or hi (i >= 32).
 * Masks are kept as signed int32 values (`| 0`) so `===` comparisons are always exact.
 */

export const FULL = -1 | 0;
export const COL0 = 0x01010101 | 0;
export const COL7 = 0x80808080 | 0;
export const ROW_IN_HALF: readonly number[] = [0xff, 0xff00, 0xff0000, 0xff000000 | 0];
export const COL_IN_HALF: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => (COL0 << c) | 0);

export function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24;
}

export function cellBit(i: number): number {
  return (1 << (i & 31)) | 0;
}

export function isSet(lo: number, hi: number, i: number): boolean {
  return ((i < 32 ? lo : hi) & cellBit(i)) !== 0;
}

export function filledCount(lo: number, hi: number): number {
  return popcount(lo) + popcount(hi);
}

/** Result scratch for clearFullLines (avoids allocations in hot loops). */
export const CL = { lo: 0, hi: 0, rows: 0, cols: 0, lines: 0 };

/**
 * Finds every full row and column of (lo, hi) and clears them simultaneously.
 * Writes the cleared board into CL.lo/CL.hi, row/col bitmasks into CL.rows/CL.cols.
 * Returns the number of lines cleared.
 */
export function clearFullLines(lo: number, hi: number): number {
  let clrLo = 0;
  let clrHi = 0;
  let rows = 0;
  let cols = 0;
  let n = 0;
  for (let r = 0; r < 4; r++) {
    const m = ROW_IN_HALF[r];
    if ((lo & m) === m) {
      clrLo |= m;
      rows |= 1 << r;
      n++;
    }
    if ((hi & m) === m) {
      clrHi |= m;
      rows |= 1 << (r + 4);
      n++;
    }
  }
  // A column can only be full if every row has that bit, i.e. the AND of all 8 row bytes.
  const colAnd = lo & (lo >>> 8) & (lo >>> 16) & (lo >>> 24) & hi & (hi >>> 8) & (hi >>> 16) & (hi >>> 24) & 0xff;
  if (colAnd !== 0) {
    for (let c = 0; c < 8; c++) {
      if (colAnd & (1 << c)) {
        const m = COL_IN_HALF[c];
        clrLo |= m;
        clrHi |= m;
        cols |= 1 << c;
        n++;
      }
    }
  }
  CL.lo = lo & ~clrLo;
  CL.hi = hi & ~clrHi;
  CL.rows = rows;
  CL.cols = cols;
  CL.lines = n;
  return n;
}

/** Number of lines that a board state has full (without clearing). */
export function countFullLines(lo: number, hi: number): number {
  return clearFullLines(lo, hi);
}

// ---- Neighbour shifts (walls count as occupied) ----

export const SH = { lo: 0, hi: 0 };

/** Each cell gets the occupancy of the cell above it (row 0 sees the wall). */
export function shiftFromAbove(lo: number, hi: number): void {
  SH.lo = (lo << 8) | 0xff;
  SH.hi = (hi << 8) | (lo >>> 24);
}

/** Each cell gets the occupancy of the cell below it (row 7 sees the wall). */
export function shiftFromBelow(lo: number, hi: number): void {
  SH.lo = (lo >>> 8) | (hi << 24);
  SH.hi = (hi >>> 8) | ROW_IN_HALF[3];
}

/** Each cell gets the occupancy of its left neighbour (col 0 sees the wall). */
export function fromLeft(x: number): number {
  return ((x << 1) & ~COL0) | COL0;
}

/** Each cell gets the occupancy of its right neighbour (col 7 sees the wall). */
export function fromRight(x: number): number {
  return ((x >>> 1) & ~COL7) | COL7;
}
