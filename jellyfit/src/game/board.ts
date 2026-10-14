/** Board state: occupancy as two 32-bit masks plus per-cell colour and special arrays. */
import { cellBit, isSet, filledCount } from '../core/bitboard';
import { PIECES, placementAt, place as placeMasks, cellsOfLines, type PlaceOutcome } from './rules';

export const EMPTY = 255;
export const SPECIAL_NONE = 0;

export interface ClearedCell {
  i: number;
  color: number;
  special: number;
}

export interface BoardPlaceResult extends PlaceOutcome {
  /** Cell indices covered by the placed piece. */
  placed: number[];
  cleared: ClearedCell[];
}

export class Board {
  lo = 0;
  hi = 0;
  readonly color = new Uint8Array(64).fill(EMPTY);
  readonly special = new Uint8Array(64);

  has(i: number): boolean {
    return isSet(this.lo, this.hi, i);
  }

  filled(): number {
    return filledCount(this.lo, this.hi);
  }

  fill(): number {
    return this.filled() / 64;
  }

  set(i: number, color: number, special = SPECIAL_NONE): void {
    if (i < 32) this.lo |= cellBit(i);
    else this.hi |= cellBit(i);
    this.color[i] = color;
    this.special[i] = special;
  }

  unset(i: number): void {
    if (i < 32) this.lo &= ~cellBit(i);
    else this.hi &= ~cellBit(i);
    this.color[i] = EMPTY;
    this.special[i] = SPECIAL_NONE;
  }

  reset(): void {
    this.lo = 0;
    this.hi = 0;
    this.color.fill(EMPTY);
    this.special.fill(SPECIAL_NONE);
  }

  /** Places a piece (caller checked validity) and clears full lines. */
  place(piece: number, r: number, c: number, color: number, specialCell = -1, special = SPECIAL_NONE): BoardPlaceResult {
    const p = PIECES[piece];
    if (placementAt(piece, r, c) < 0) throw new Error('placement outside board');
    const placed: number[] = [];
    p.cells.forEach(([dr, dc], k) => {
      const i = (r + dr) * 8 + (c + dc);
      placed.push(i);
      this.set(i, color, k === specialCell ? special : SPECIAL_NONE);
    });
    const out = placeMasks(this.lo & ~maskLo(placed), this.hi & ~maskHi(placed), piece, r, c);
    const cleared: ClearedCell[] = [];
    if (out.lines > 0) {
      for (const i of cellsOfLines(out.rows, out.cols)) {
        cleared.push({ i, color: this.color[i], special: this.special[i] });
        this.unset(i);
      }
    }
    return { ...out, placed, cleared };
  }

  toRows(): string[] {
    const rows: string[] = [];
    for (let r = 0; r < 8; r++) {
      let s = '';
      for (let c = 0; c < 8; c++) {
        const i = r * 8 + c;
        s += this.has(i) ? String(this.color[i]) : '.';
      }
      rows.push(s);
    }
    return rows;
  }

  /** Loads from 8 strings: '.' empty, digit = colour index. */
  fromRows(rows: readonly string[]): void {
    this.reset();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const ch = rows[r]?.[c] ?? '.';
        if (ch !== '.' && ch !== ' ') this.set(r * 8 + c, ch === '#' ? 0 : Number(ch) % 7);
      }
    }
  }
}

function maskLo(cells: number[]): number {
  let m = 0;
  for (const i of cells) if (i < 32) m |= cellBit(i);
  return m;
}

function maskHi(cells: number[]): number {
  let m = 0;
  for (const i of cells) if (i >= 32) m |= cellBit(i);
  return m;
}
