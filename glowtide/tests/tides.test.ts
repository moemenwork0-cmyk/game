import { describe, expect, it } from 'vitest';
import { maxGroupSize, spawnInterval, speedMult, tideCount } from '../src/game/tides';

describe('tide formulas', () => {
  it('count = round(8 + 3.2n)', () => {
    expect(tideCount(1)).toBe(11);
    expect(tideCount(5)).toBe(24);
    expect(tideCount(20)).toBe(72);
  });

  it('spawn interval decays to a floor of 0.32 s', () => {
    expect(spawnInterval(1)).toBeCloseTo(1.5);
    expect(spawnInterval(2)).toBeCloseTo(1.41);
    expect(spawnInterval(40)).toBe(0.32);
  });

  it('group size grows 1 → 2 → 3', () => {
    expect(maxGroupSize(1)).toBe(1);
    expect(maxGroupSize(2)).toBe(1);
    expect(maxGroupSize(3)).toBe(2);
    expect(maxGroupSize(7)).toBe(2);
    expect(maxGroupSize(8)).toBe(3);
  });

  it('speed grows 3% per tide', () => {
    expect(speedMult(1)).toBe(1);
    expect(speedMult(11)).toBeCloseTo(1.3);
  });
});
