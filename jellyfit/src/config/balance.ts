/** All gameplay tunables (spec rule 6). Visual/feel numbers live in theme.ts. */
export const BALANCE = {
  /** Difficulty tiers by in-game score (6.2.1). */
  tierScores: [0, 1500, 4000, 8000, 15000, 25000],

  generator: {
    candidates: 40,
    /** Max search nodes (placements tried) per candidate triple. */
    nodeCap: 2000,
    /** Tier weight shift: pieces with >= bigCells cells get +bigPerTier per tier. */
    bigCells: 5,
    bigPerTier: 0.1,
    /** Singles and 1×2 bars get −smallPerTier per tier. */
    smallPerTier: 0.05,
    mercyFill: 0.55,
    mercyP0: 0.9,
    mercyPerTier: 0.06,
    mercyMin: 0.55,
    normalFill: 0.3,
    normalSolvableP: 0.8,
    openChallengeCells: 11,
    openChallengeP: 0.6,
    hopeFill: 0.5,
    hopeNoClearDeals: 2,
    hopeMinLines: 2,
    hopeEveryDeals: 4,
    /**
     * Pressure (tuning addition, see DECISIONS.md): per tier, probability that the open/normal zone
     * deals the hardest solvable candidate (most cells) instead of a random one.
     */
    pressureByTier: [0.2, 0.4, 0.6, 0.8, 0.9, 1.0] as readonly number[],
    /** Mercy zone, when the mercy roll fails: 'random' candidate (spec) or the one with the most cells. */
    mercyMissPick: 'hardest' as 'random' | 'hardest',
    /** First N games ever: never deal an unsolvable triple. */
    mercyGames: 3,
    /** Extra candidates sampled when the mercy guarantee found no solvable triple. */
    mercyExtraCandidates: 160,
  },

  scoring: {
    perCell: 1,
    lineBase: [0, 100, 300, 600, 1000, 1500, 2100, 2800],
    lineBeyond: 800,
    /** Combo stays alive while a clear happens within this many consecutive placements. */
    comboGrace: 3,
    comboStep: 0.5,
    comboMaxMult: 6,
    perfectClear: 3000,
  },

  words: {
    lines: { 2: 'Good', 3: 'Great', 4: 'Excellent', 5: 'Amazing' } as Record<number, string>,
    comboOnFire: 5,
    comboUnstoppable: 8,
  },
} as const;
