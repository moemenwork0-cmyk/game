/**
 * Headless bot simulation (spec 18.3).
 *   npm run sim -- --games 2000 --seed 1 [--mercy] [--max 3000]
 */
import { Session } from '../src/game/session';
import { chooseMove } from './bot';
import { BALANCE } from '../src/config/balance';

// --set generator.mercyMin=0.7 overrides a balance number for tuning experiments.
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] !== '--set') continue;
  const [path, value] = process.argv[i + 1].split('=');
  const keys = path.split('.');
  let o = BALANCE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = JSON.parse(value);
}

function arg(name: string, def: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
}

const games = arg('games', 500);
const seed = arg('seed', 1);
const maxPlacements = arg('max', 3000);
const mercy = process.argv.includes('--mercy');

interface GameResult {
  placements: number;
  score: number;
  comeback: boolean;
  deals: number;
  unsolvableDeals: number;
  hopes: number;
  capped: boolean;
  maxCombo: number;
  maxFill: number;
}

function play(gameSeed: number): GameResult {
  const s = new Session({ seed: gameSeed, mercyGuarantee: mercy });
  let deals = 1;
  let unsolvable = s.lastDeal && !s.lastDeal.solvable ? 1 : 0;
  let hopes = 0;
  const fills: number[] = [];
  let comeback = false;
  while (!s.gameOver && s.stats.placements < maxPlacements) {
    const m = chooseMove(s);
    if (!m) break;
    const res = s.place(m.slot, m.r, m.c)!;
    fills.push(s.board.fill());
    if (res.newDeal) {
      deals++;
      if (s.lastDeal && !s.lastDeal.solvable) unsolvable++;
      if (s.lastDeal?.hope) hopes++;
    }
    // Comeback: fill >= 75% followed by fill <= 40% within 6 placements.
    if (!comeback && s.board.fill() <= 0.4) {
      const n = fills.length;
      for (let k = Math.max(0, n - 7); k < n - 1; k++) if (fills[k] >= 0.75) comeback = true;
    }
  }
  return {
    placements: s.stats.placements,
    score: s.score,
    comeback,
    deals,
    unsolvableDeals: unsolvable,
    hopes,
    capped: s.stats.placements >= maxPlacements,
    maxCombo: s.stats.maxCombo,
    maxFill: Math.max(0, ...fills),
  };
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const t0 = Date.now();
const results: GameResult[] = [];
for (let g = 0; g < games; g++) {
  results.push(play((seed * 1000003 + g * 7919) >>> 0));
  if (process.stdout.isTTY && g % 50 === 49) process.stdout.write(`\r${g + 1}/${games}`);
}
if (process.stdout.isTTY) process.stdout.write('\r');

const pl = results.map((r) => r.placements).sort((a, b) => a - b);
const sc = results.map((r) => r.score).sort((a, b) => a - b);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const deals = results.reduce((a, r) => a + r.deals, 0);
const out = {
  games,
  seed,
  mercyGuarantee: mercy,
  placements: {
    median: pct(pl, 0.5),
    mean: Math.round(mean(pl)),
    p10: pct(pl, 0.1),
    p90: pct(pl, 0.9),
  },
  score: { mean: Math.round(mean(sc)), median: pct(sc, 0.5) },
  comebackRate: +(results.filter((r) => r.comeback).length / games).toFixed(3),
  unsolvableDealRate: +(results.reduce((a, r) => a + r.unsolvableDeals, 0) / deals).toFixed(4),
  hopeInjectionsPerGame: +(results.reduce((a, r) => a + r.hopes, 0) / games).toFixed(2),
  avgMaxCombo: +mean(results.map((r) => r.maxCombo)).toFixed(2),
  reached75: +(results.filter((r) => r.maxFill >= 0.75).length / games).toFixed(3),
  maxFillMedian: pct(results.map((r) => r.maxFill).sort((a, b) => a - b), 0.5),
  cappedGames: results.filter((r) => r.capped).length,
  seconds: (Date.now() - t0) / 1000,
};
console.log(JSON.stringify(out, null, 2));
