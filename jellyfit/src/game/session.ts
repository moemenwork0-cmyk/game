/** One game of Classic: deals, placements, scoring, game over. Pure logic (no DOM). */
import { TRAY_SLOTS } from '../config/config';
import type { WordKey } from '../config/strings';
import { Rng } from '../core/rng';
import { Board, type ClearedCell } from './board';
import { generateDeal, type DealInfo, type GenState } from './generator';
import { PIECES, anyFit, canPlace } from './rules';
import { feedbackWord, scorePlacement, stepCombo } from './scoring';

const JELLY_COLORS = 7;

/** Slot index for the piece Jello is holding. */
export const HOLD = 3;

export interface TrayItem {
  piece: number;
  color: number;
  /** Cell index within the piece that holds a special jelly, or -1. */
  specialCell: number;
  special: number;
}

export interface PlaceResult {
  slot: number;
  piece: number;
  color: number;
  r: number;
  c: number;
  placed: number[];
  rows: number;
  cols: number;
  lines: number;
  cleared: ClearedCell[];
  comboBefore: number;
  combo: number;
  comboBroken: boolean;
  perfect: boolean;
  cellPoints: number;
  lineScore: number;
  perfectBonus: number;
  gained: number;
  score: number;
  word: WordKey | null;
  newDeal: boolean;
  gameOver: boolean;
}

export interface SessionStats {
  placements: number;
  linesTotal: number;
  maxCombo: number;
  maxLinesAtOnce: number;
  perfects: number;
}

export interface SessionSnapshot {
  v: 1;
  seed: number;
  rng: number;
  board: { lo: number; hi: number; color: number[]; special: number[] };
  tray: (TrayItem | null)[];
  held?: TrayItem | null;
  score: number;
  combo: number;
  sinceClear: number;
  gen: GenState;
  dealCleared: boolean;
  stats: SessionStats;
  gameOver: boolean;
}

export interface SessionOptions {
  seed: number;
  mercyGuarantee?: boolean;
}

export class Session {
  readonly seed: number;
  readonly rng: Rng;
  readonly board = new Board();
  tray: (TrayItem | null)[] = [null, null, null];
  /** Piece Jello is holding for later (one at a time). */
  held: TrayItem | null = null;
  heldFits = false;
  score = 0;
  combo = 0;
  sinceClear = 0;
  gen: GenState;
  dealCleared = false;
  stats: SessionStats = { placements: 0, linesTotal: 0, maxCombo: 0, maxLinesAtOnce: 0, perfects: 0 };
  gameOver = false;
  lastDeal: DealInfo | null = null;
  /** Fit state per slot, refreshed after every change. */
  fits: boolean[] = [true, true, true];

  constructor(opts: SessionOptions, deal = true) {
    this.seed = opts.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.gen = { dealIndex: 0, dealsWithoutClear: 0, lastHopeDeal: -1000, mercyGuarantee: !!opts.mercyGuarantee };
    if (deal) this.deal();
  }

  /** Deals a new set of 3 pieces from the smart generator. */
  deal(): void {
    const { pieces, info } = generateDeal(this.board.lo, this.board.hi, this.score, this.gen, this.rng);
    this.lastDeal = info;
    if (info.hope) this.gen.lastHopeDeal = this.gen.dealIndex;
    const colors = this.rng.shuffle([0, 1, 2, 3, 4, 5, 6].slice(0, JELLY_COLORS));
    for (let s = 0; s < TRAY_SLOTS; s++) {
      this.tray[s] = { piece: pieces[s], color: colors[s], specialCell: -1, special: 0 };
    }
    this.gen.dealIndex++;
    this.dealCleared = false;
    this.refresh();
  }

  /** Replaces the tray with specific pieces (debug, scripted scenes). */
  setTray(pieces: (number | null)[], colors?: number[]): void {
    for (let s = 0; s < TRAY_SLOTS; s++) {
      const p = pieces[s];
      this.tray[s] = p == null ? null : { piece: p, color: colors?.[s] ?? s, specialCell: -1, special: 0 };
    }
    this.refresh();
  }

  refresh(): void {
    const { lo, hi } = this.board;
    for (let s = 0; s < TRAY_SLOTS; s++) {
      const t = this.tray[s];
      this.fits[s] = t ? anyFit(lo, hi, t.piece) : false;
    }
    this.heldFits = this.held ? anyFit(lo, hi, this.held.piece) : false;
    const any = this.tray.some((t) => t) || !!this.held;
    this.gameOver = any && !this.fits.some((f) => f) && !this.heldFits;
  }

  /** Tray piece or (slot HOLD) the held piece. */
  item(slot: number): TrayItem | null {
    return slot === HOLD ? this.held : (this.tray[slot] ?? null);
  }

  canPlace(slot: number, r: number, c: number): boolean {
    const t = this.item(slot);
    return !!t && !this.gameOver && canPlace(this.board.lo, this.board.hi, t.piece, r, c);
  }

  /**
   * Gives a tray piece to Jello to hold. If he already holds one, they swap (the old one goes
   * back into that tray slot). Returns null if the move is not possible.
   */
  hold(slot: number): { swapped: TrayItem | null; newDeal: boolean } | null {
    if (this.gameOver || slot < 0 || slot >= TRAY_SLOTS) return null;
    const t = this.tray[slot];
    if (!t) return null;
    const old = this.held;
    this.held = t;
    this.tray[slot] = old;
    let newDeal = false;
    if (this.tray.every((x) => x === null)) {
      this.gen.dealsWithoutClear = this.dealCleared ? 0 : this.gen.dealsWithoutClear + 1;
      this.deal();
      newDeal = true;
    } else {
      this.refresh();
    }
    return { swapped: old, newDeal };
  }

  place(slot: number, r: number, c: number): PlaceResult | null {
    if (!this.canPlace(slot, r, c)) return null;
    const t = this.item(slot)!;
    const res = this.board.place(t.piece, r, c, t.color, t.specialCell, t.special);
    if (slot === HOLD) this.held = null;
    else this.tray[slot] = null;

    const comboBefore = this.combo;
    const cs = stepCombo({ combo: this.combo, sinceClear: this.sinceClear }, res.lines);
    this.combo = cs.combo;
    this.sinceClear = cs.sinceClear;
    const comboBroken = comboBefore > 0 && this.combo === 0;
    const perfect = res.lines > 0 && this.board.lo === 0 && this.board.hi === 0;
    const parts = scorePlacement(PIECES[t.piece].n, res.lines, this.combo, perfect);
    this.score += parts.total;

    const st = this.stats;
    st.placements++;
    st.linesTotal += res.lines;
    st.maxCombo = Math.max(st.maxCombo, this.combo);
    st.maxLinesAtOnce = Math.max(st.maxLinesAtOnce, res.lines);
    if (perfect) st.perfects++;
    if (res.lines > 0) this.dealCleared = true;

    let newDeal = false;
    if (this.tray.every((x) => x === null)) {
      this.gen.dealsWithoutClear = this.dealCleared ? 0 : this.gen.dealsWithoutClear + 1;
      this.deal();
      newDeal = true;
    } else {
      this.refresh();
    }

    return {
      slot,
      piece: t.piece,
      color: t.color,
      r,
      c,
      placed: res.placed,
      rows: res.rows,
      cols: res.cols,
      lines: res.lines,
      cleared: res.cleared,
      comboBefore,
      combo: this.combo,
      comboBroken,
      perfect,
      cellPoints: parts.cellPoints,
      lineScore: parts.lineScore,
      perfectBonus: parts.perfectBonus,
      gained: parts.total,
      score: this.score,
      word: feedbackWord(res.lines, this.combo, perfect),
      newDeal,
      gameOver: this.gameOver,
    };
  }

  snapshot(): SessionSnapshot {
    return {
      v: 1,
      seed: this.seed,
      rng: this.rng.state,
      board: {
        lo: this.board.lo >>> 0,
        hi: this.board.hi >>> 0,
        color: Array.from(this.board.color),
        special: Array.from(this.board.special),
      },
      tray: this.tray.map((t) => (t ? { ...t } : null)),
      held: this.held ? { ...this.held } : null,
      score: this.score,
      combo: this.combo,
      sinceClear: this.sinceClear,
      gen: { ...this.gen },
      dealCleared: this.dealCleared,
      stats: { ...this.stats },
      gameOver: this.gameOver,
    };
  }

  static restore(snap: SessionSnapshot): Session {
    const s = new Session({ seed: snap.seed, mercyGuarantee: snap.gen.mercyGuarantee }, false);
    s.rng.state = snap.rng >>> 0;
    s.board.lo = snap.board.lo | 0;
    s.board.hi = snap.board.hi | 0;
    s.board.color.set(snap.board.color);
    s.board.special.set(snap.board.special);
    s.tray = snap.tray.map((t) => (t && t.piece >= 0 && t.piece < PIECES.length ? { ...t } : null));
    const h = snap.held;
    s.held = h && h.piece >= 0 && h.piece < PIECES.length ? { ...h } : null;
    s.score = snap.score;
    s.combo = snap.combo;
    s.sinceClear = snap.sinceClear;
    s.gen = { ...snap.gen };
    s.dealCleared = snap.dealCleared;
    s.stats = { ...snap.stats };
    if (s.tray.every((t) => t === null)) s.deal();
    else s.refresh();
    return s;
  }
}

export function isValidSnapshot(x: unknown): x is SessionSnapshot {
  if (!x || typeof x !== 'object') return false;
  const s = x as Partial<SessionSnapshot>;
  return (
    s.v === 1 &&
    typeof s.seed === 'number' &&
    typeof s.rng === 'number' &&
    typeof s.score === 'number' &&
    !!s.board &&
    Array.isArray(s.board.color) &&
    s.board.color.length === 64 &&
    Array.isArray(s.tray) &&
    s.tray.length === TRAY_SLOTS &&
    !!s.gen &&
    !!s.stats
  );
}
