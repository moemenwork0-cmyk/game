/**
 * Smart piece generator (spec 6.2). PURE: all randomness comes from the passed Rng.
 */
import { BALANCE } from '../config/balance';
import { CL, clearFullLines, filledCount } from '../core/bitboard';
import type { Rng } from '../core/rng';
import { PIECES, anyFit } from './rules';

const G = BALANCE.generator;

export type Triple = [number, number, number];
export type Zone = 'open' | 'normal' | 'mercy';

export interface GenState {
  /** Deals dealt so far in this game (the first deal is index 0). */
  dealIndex: number;
  /** Consecutive finished deals during which nothing was cleared. */
  dealsWithoutClear: number;
  /** Deal index of the last hope injection (negative when never). */
  lastHopeDeal: number;
  /** Never deal an unsolvable triple (first games ever). */
  mercyGuarantee: boolean;
}

export interface DealInfo {
  zone: Zone;
  fill: number;
  tier: number;
  solvable: boolean;
  clearPotential: number;
  fitCount: number;
  hope: boolean;
  mercyPick: boolean;
  analysed: number;
}

export interface Analysis {
  solvable: boolean;
  clearPotential: number;
  nodes: number;
}

// ---------------------------------------------------------------------------
// Tiers and weights

export function tierForScore(score: number): number {
  const t = BALANCE.tierScores;
  let d = 0;
  for (let i = 1; i < t.length; i++) if (score >= t[i]) d = i;
  return d;
}

const cumulativeByTier: Float64Array[] = [];

export function pieceWeight(piece: number, tier: number): number {
  const p = PIECES[piece];
  let w = p.weight;
  if (p.n >= G.bigCells) w *= 1 + G.bigPerTier * tier;
  if (p.id === '1x1' || p.id === 'h2' || p.id === 'v2') w *= Math.max(0, 1 - G.smallPerTier * tier);
  return w;
}

function cumulative(tier: number): Float64Array {
  let cum = cumulativeByTier[tier];
  if (!cum) {
    cum = new Float64Array(PIECES.length);
    let s = 0;
    for (let i = 0; i < PIECES.length; i++) {
      s += pieceWeight(i, tier);
      cum[i] = s;
    }
    cumulativeByTier[tier] = cum;
  }
  return cum;
}

export function samplePiece(rng: Rng, tier: number): number {
  const cum = cumulative(tier);
  const x = rng.next() * cum[cum.length - 1];
  let a = 0;
  let b = cum.length - 1;
  while (a < b) {
    const m = (a + b) >> 1;
    if (cum[m] > x) b = m;
    else a = m + 1;
  }
  return a;
}

// ---------------------------------------------------------------------------
// Bitboard search

let sTri: Triple = [0, 0, 0];
let sNodes = 0;
let sCap = 0;
let sBest = -1;
let sWantMax = false;
let sStop = false;

function dfs(lo: number, hi: number, used: number, depth: number, lines: number): void {
  if (depth === 3) {
    if (lines > sBest) sBest = lines;
    if (!sWantMax) sStop = true;
    return;
  }
  for (let s = 0; s < 3; s++) {
    if (used & (1 << s)) continue;
    // Identical unused pieces are interchangeable: only expand the first one.
    let dup = false;
    for (let t = 0; t < s; t++) if (!(used & (1 << t)) && sTri[t] === sTri[s]) dup = true;
    if (dup) continue;
    const p = PIECES[sTri[s]];
    const L = p.plLo;
    const H = p.plHi;
    // With sWantMax, try line-clearing placements first so the node cap finds good sequences.
    for (let pass = sWantMax ? 0 : 1; pass < 2; pass++) {
      for (let k = 0; k < L.length; k++) {
        if ((lo & L[k]) !== 0 || (hi & H[k]) !== 0) continue;
        const n = clearFullLines(lo | L[k], hi | H[k]);
        if (sWantMax && pass === 0 ? n === 0 : sWantMax && n > 0) continue;
        if (++sNodes > sCap) {
          sStop = true;
          return;
        }
        dfs(CL.lo, CL.hi, used | (1 << s), depth + 1, lines + n);
        if (sStop) return;
      }
    }
  }
}

/**
 * Is there an order and placements that fit all three pieces (clearing lines after each)?
 * With wantMax, also finds the most lines clearable along the way (within the node cap).
 */
export function analyseTriple(lo: number, hi: number, tri: Triple, wantMax: boolean, cap: number = G.nodeCap): Analysis {
  sTri = tri;
  sNodes = 0;
  sCap = cap;
  sBest = -1;
  sWantMax = wantMax;
  sStop = false;
  dfs(lo, hi, 0, 0, 0);
  return { solvable: sBest >= 0, clearPotential: Math.max(0, sBest), nodes: Math.min(sNodes, cap) };
}

export function fitCount(lo: number, hi: number, tri: readonly number[]): number {
  let n = 0;
  for (const p of tri) if (anyFit(lo, hi, p)) n++;
  return n;
}

/** The piece (and line count) that completes the most lines right now. */
export function bestHopePiece(lo: number, hi: number): { piece: number; lines: number } {
  let best = -1;
  let bestLines = 0;
  for (let i = 0; i < PIECES.length; i++) {
    const p = PIECES[i];
    for (let k = 0; k < p.plLo.length; k++) {
      if ((lo & p.plLo[k]) !== 0 || (hi & p.plHi[k]) !== 0) continue;
      const n = clearFullLines(lo | p.plLo[k], hi | p.plHi[k]);
      // Prefer more lines; on ties prefer the smaller piece (it leaves more room).
      if (n > bestLines || (n === bestLines && n > 0 && p.n < PIECES[best].n)) {
        best = i;
        bestLines = n;
      }
    }
  }
  return { piece: best, lines: bestLines };
}

// ---------------------------------------------------------------------------
// Deal

export function zoneFor(fill: number): Zone {
  if (fill >= G.mercyFill) return 'mercy';
  if (fill >= G.normalFill) return 'normal';
  return 'open';
}

export function mercyProbability(tier: number): number {
  return Math.max(G.mercyMin, G.mercyP0 - G.mercyPerTier * tier);
}

interface Candidate {
  tri: Triple;
  cells: number;
  a?: Analysis;
  aMax?: boolean;
}

function analyse(lo: number, hi: number, c: Candidate, wantMax: boolean): Analysis {
  if (!c.a || (wantMax && !c.aMax)) {
    c.a = analyseTriple(lo, hi, c.tri, wantMax);
    c.aMax = wantMax;
  }
  return c.a;
}

function sampleCandidates(rng: Rng, tier: number, n: number): Candidate[] {
  const out: Candidate[] = [];
  for (let i = 0; i < n; i++) {
    const tri: Triple = [samplePiece(rng, tier), samplePiece(rng, tier), samplePiece(rng, tier)];
    out.push({ tri, cells: PIECES[tri[0]].n + PIECES[tri[1]].n + PIECES[tri[2]].n });
  }
  return out;
}

/** First solvable candidate in random order (lazy: stops analysing once found). */
function randomSolvable(lo: number, hi: number, cands: Candidate[], rng: Rng): Candidate | null {
  const order = rng.shuffle(cands.map((_, i) => i));
  for (const i of order) if (analyse(lo, hi, cands[i], false).solvable) return cands[i];
  return null;
}

/** Solvable candidate with the most cells (ties random), analysing in descending size order. */
function hardestSolvable(lo: number, hi: number, cands: Candidate[], rng: Rng): Candidate | null {
  const order = rng.shuffle(cands.slice()).sort((a, b) => b.cells - a.cells);
  for (const c of order) if (analyse(lo, hi, c, false).solvable) return c;
  return null;
}

export function generateDeal(
  lo: number,
  hi: number,
  score: number,
  st: GenState,
  rng: Rng,
): { pieces: Triple; info: DealInfo } {
  const fill = filledCount(lo, hi) / 64;
  const tier = tierForScore(score);
  const zone = zoneFor(fill);
  let cands = sampleCandidates(rng, tier, G.candidates);
  let chosen: Candidate | null = null;
  let mercyPick = false;

  if (zone === 'mercy') {
    if (rng.chance(mercyProbability(tier))) {
      mercyPick = true;
      let best = -1;
      let ties: Candidate[] = [];
      for (const c of cands) {
        const a = analyse(lo, hi, c, true);
        if (!a.solvable) continue;
        if (a.clearPotential > best) {
          best = a.clearPotential;
          ties = [c];
        } else if (a.clearPotential === best) ties.push(c);
      }
      if (ties.length) chosen = rng.pick(ties);
    } else if (G.mercyMissPick === 'hardest') {
      let most = -1;
      for (const c of rng.shuffle(cands.slice())) {
        if (c.cells > most) {
          most = c.cells;
          chosen = c;
        }
      }
    } else {
      chosen = rng.pick(cands);
    }
  } else if (rng.chance(G.pressureByTier[Math.min(tier, G.pressureByTier.length - 1)])) {
    chosen = hardestSolvable(lo, hi, cands, rng);
  } else if (zone === 'normal') {
    chosen = rng.chance(G.normalSolvableP) ? randomSolvable(lo, hi, cands, rng) : rng.pick(cands);
  } else {
    if (rng.chance(G.openChallengeP)) {
      const big = cands.filter((c) => c.cells >= G.openChallengeCells);
      chosen = randomSolvable(lo, hi, big, rng);
    }
    if (!chosen) chosen = randomSolvable(lo, hi, cands, rng);
  }

  if (st.mercyGuarantee && (!chosen || !analyse(lo, hi, chosen, false).solvable)) {
    chosen = null;
    const extra = sampleCandidates(rng, 0, G.mercyExtraCandidates);
    cands = cands.concat(extra);
    chosen = randomSolvable(lo, hi, extra, rng);
    if (!chosen) {
      const one = PIECES.findIndex((p) => p.id === '1x1');
      chosen = { tri: [one, one, one], cells: 3 };
    }
  }
  if (!chosen) {
    // Nothing solvable: give the triple where the most pieces fit right now.
    let bestFit = -1;
    for (const c of cands) {
      const f = fitCount(lo, hi, c.tri);
      if (f > bestFit) {
        bestFit = f;
        chosen = c;
      }
    }
  }
  const pieces: Triple = [...chosen!.tri];

  // Hope injection (6.2.5).
  let hope = false;
  if (
    fill >= G.hopeFill &&
    st.dealsWithoutClear >= G.hopeNoClearDeals &&
    st.dealIndex - st.lastHopeDeal >= G.hopeEveryDeals
  ) {
    const h = bestHopePiece(lo, hi);
    if (h.lines >= G.hopeMinLines) {
      let slot = -1;
      for (let s = 0; s < 3 && slot < 0; s++) {
        const t: Triple = [...pieces];
        t[s] = h.piece;
        if (analyseTriple(lo, hi, t, false).solvable) slot = s;
      }
      pieces[slot < 0 ? 0 : slot] = h.piece;
      hope = true;
    }
  }

  const final = analyseTriple(lo, hi, pieces, zone === 'mercy');
  return {
    pieces,
    info: {
      zone,
      fill,
      tier,
      solvable: final.solvable,
      clearPotential: final.clearPotential,
      fitCount: fitCount(lo, hi, pieces),
      hope,
      mercyPick,
      analysed: cands.filter((c) => c.a).length,
    },
  };
}
