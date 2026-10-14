import { BALANCE } from '../config/balance';

const T = BALANCE.tides;

/** Number of critters spawned in tide n (1-based), before boss and depth modifiers. */
export function tideCount(n: number): number {
  return Math.round(T.countBase + T.countPerTide * n);
}

/** Seconds between spawn groups in tide n. */
export function spawnInterval(n: number): number {
  return Math.max(T.intervalMin, T.intervalBase * Math.pow(T.intervalDecay, n - 1));
}

/** Largest spawn group size in tide n (groups are 1..max). */
export function maxGroupSize(n: number): number {
  if (n < T.groupMax1Below) return 1;
  if (n < T.groupMax2Below) return 2;
  return T.groupMaxLate;
}

/** Critter speed multiplier in tide n. */
export function speedMult(n: number): number {
  return 1 + T.speedPerTide * (n - 1);
}
