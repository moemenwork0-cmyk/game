import { describe, expect, it } from 'vitest';
import { Rng, hashString } from '../src/core/rng';

describe('hashString', () => {
  it('is stable and distinguishes nearby strings', () => {
    expect(hashString('2026-10-14')).toBe(hashString('2026-10-14'));
    expect(hashString('2026-10-14')).not.toBe(hashString('2026-10-15'));
    expect(hashString('')).toBeGreaterThanOrEqual(0);
  });
});

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs across seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('stays in [0, 1) and range bounds', () => {
    const r = Rng.fromString('bounds');
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const k = r.int(3, 7);
      expect(k).toBeGreaterThanOrEqual(3);
      expect(k).toBeLessThanOrEqual(7);
      expect(Number.isInteger(k)).toBe(true);
    }
  });

  it('int covers its whole inclusive range', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(r.int(0, 4));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('weighted never picks zero-weight entries', () => {
    const r = new Rng(9);
    for (let i = 0; i < 1000; i++) expect(r.weighted([0, 5, 0, 1])).not.toBe(0);
    expect(r.weighted([0, 0])).toBe(-1);
  });
});
