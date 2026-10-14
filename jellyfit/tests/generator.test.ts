import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { Board } from '../src/game/board';
import {
  analyseTriple,
  bestHopePiece,
  generateDeal,
  mercyProbability,
  pieceWeight,
  tierForScore,
  zoneFor,
  type GenState,
} from '../src/game/generator';
import { pieceIndex, PIECES } from '../src/game/rules';

const st = (o: Partial<GenState> = {}): GenState => ({
  dealIndex: 5,
  dealsWithoutClear: 0,
  lastHopeDeal: -100,
  mercyGuarantee: false,
  ...o,
});

describe('generator', () => {
  it('tiers, zones and mercy probability', () => {
    expect(tierForScore(0)).toBe(0);
    expect(tierForScore(1499)).toBe(0);
    expect(tierForScore(1500)).toBe(1);
    expect(tierForScore(30000)).toBe(5);
    expect(zoneFor(0.1)).toBe('open');
    expect(zoneFor(0.3)).toBe('normal');
    expect(zoneFor(0.55)).toBe('mercy');
    expect(mercyProbability(0)).toBeCloseTo(0.9);
    expect(mercyProbability(5)).toBeCloseTo(0.6);
    expect(mercyProbability(9)).toBeCloseTo(0.55);
  });

  it('tier shifts weights toward big pieces', () => {
    const sq3 = pieceIndex('sq3');
    const one = pieceIndex('1x1');
    expect(pieceWeight(sq3, 3)).toBeCloseTo(3 * 1.3);
    expect(pieceWeight(one, 3)).toBeCloseTo(3 * 0.85);
    expect(pieceWeight(pieceIndex('sq2'), 3)).toBe(6);
  });

  it('analyseTriple detects solvable and unsolvable triples', () => {
    const b = new Board();
    // Checkerboard: only single cells are free.
    for (let i = 0; i < 64; i++) if (((i >> 3) + (i & 7)) % 2 === 0) b.set(i, 0);
    const sq3 = pieceIndex('sq3');
    const a = analyseTriple(b.lo, b.hi, [sq3, pieceIndex('1x1'), pieceIndex('1x1')], false);
    expect(a.solvable).toBe(false);
    const one = pieceIndex('1x1');
    expect(analyseTriple(b.lo, b.hi, [one, one, one], false).solvable).toBe(true);
  });

  it('clear potential counts lines across the sequence', () => {
    const b = new Board();
    b.fromRows(['1111111.', '1111111.', '........', '........', '........', '........', '........', '........']);
    const one = pieceIndex('1x1');
    const a = analyseTriple(b.lo, b.hi, [one, one, pieceIndex('h2')], true);
    expect(a.solvable).toBe(true);
    expect(a.clearPotential).toBe(2);
  });

  it('hope piece finds a multi-line completion', () => {
    const b = new Board();
    b.fromRows(['1111111.', '1111111.', '1111111.', '........', '........', '........', '........', '........']);
    const h = bestHopePiece(b.lo, b.hi);
    expect(h.lines).toBe(3);
    expect(PIECES[h.piece].id).toBe('v3');
  });

  it('injects hope after two clear-less deals on a full board', () => {
    const b = new Board();
    b.fromRows(['1111111.', '1111111.', '11.11111', '11.11.11', '1.1.1.11', '11111.1.', '.1.1.111', '1.1.11.1']);
    const { pieces, info } = generateDeal(b.lo, b.hi, 0, st({ dealsWithoutClear: 2 }), new Rng(1));
    expect(info.hope).toBe(true);
    expect(pieces.some((p) => PIECES[p].id === 'v2' || PIECES[p].id === 'v3' || PIECES[p].id === 'v4')).toBe(true);
    // Not again within 4 deals.
    const again = generateDeal(b.lo, b.hi, 0, st({ dealsWithoutClear: 2, lastHopeDeal: 3 }), new Rng(1));
    expect(again.info.hope).toBe(false);
  });

  it('mercy guarantee never deals an unsolvable triple', () => {
    const rng = new Rng(7);
    for (let k = 0; k < 200; k++) {
      const b = new Board();
      for (let i = 0; i < 64; i++) if (rng.next() < 0.62) b.set(i, 0);
      const { pieces, info } = generateDeal(b.lo, b.hi, 30000, st({ mercyGuarantee: true }), rng);
      if (analyseTriple(b.lo, b.hi, [pieces[0], pieces[1], pieces[2]], false, 200000).solvable === false) {
        // Only acceptable if not even three singles fit.
        expect(b.filled()).toBeGreaterThan(61);
      }
      expect(info.fill).toBeGreaterThan(0);
    }
  });

  it('is deterministic for a seed', () => {
    const a = generateDeal(0, 0, 0, st(), new Rng(99));
    const b = generateDeal(0, 0, 0, st(), new Rng(99));
    expect(a.pieces).toEqual(b.pieces);
  });

  it('computes a deal fast (benchmark)', () => {
    const rng = new Rng(2024);
    const boards: Board[] = [];
    for (let k = 0; k < 60; k++) {
      const b = new Board();
      const d = 0.3 + 0.4 * rng.next();
      for (let i = 0; i < 64; i++) if (rng.next() < d) b.set(i, 0);
      boards.push(b);
    }
    const t0 = performance.now();
    let worst = 0;
    for (const b of boards) {
      const s = performance.now();
      generateDeal(b.lo, b.hi, 8000, st(), rng);
      worst = Math.max(worst, performance.now() - s);
    }
    const avg = (performance.now() - t0) / boards.length;
    // Desktop CI is ~3-4x faster than a mid-range phone; 8 ms phone budget ≈ 2.5 ms here on average.
    expect(avg).toBeLessThan(2.5);
    expect(worst).toBeLessThan(25);
  });
});
