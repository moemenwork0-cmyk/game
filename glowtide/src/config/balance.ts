/**
 * Every tunable gameplay number lives here. Units: world units, seconds, per-second rates.
 * Gameplay code reads from BALANCE and never hardcodes these values.
 */
export const BALANCE = {
  view: {
    /** k = clamp(min(viewW, viewH) / designSize, minScale, maxScale) */
    designSize: 640,
    minScale: 0.55,
    maxScale: 1.6,
    maxDpr: 2,
  },

  sim: {
    step: 1 / 60,
    maxFrameDelta: 0.1,
  },

  pearl: {
    radius: 46,
    baseShell: 10,
    invulnTime: 0.25,
    /** Real seconds of slow motion before the run-end screen. */
    deathSlowmoTime: 1.0,
    deathTimeScale: 0.2,
    hitShakeTrauma: 0.35,
    segmentFlashTime: 0.4,
  },

  link: {
    hitPadMouse: 14,
    hitPadTouch: 22,
    reach: 150,
    breakFactor: 1.35,
    heldSpeedMult: 0.5,
    minChain: 3,
    /** Seconds between consecutive node pops on release. */
    popStagger: 0.035,
    /** Pointer path is sampled at this spacing so fast drags don't skip critters. */
    pathSampleStep: 8,
  },

  focus: {
    max: 3.0,
    drainPerSec: 1.0,
    regenPerSec: 0.7,
    regenDelay: 0.5,
    timeScale: 0.35,
    slowLerpTime: 0.12,
    restoreLerpTime: 0.15,
  },

  chainEffects: {
    burstThreshold: 5,
    rippleThreshold: 8,
    surgeThreshold: 12,
    burstRadius: 70,
    burstDamage: 1,
    burstShakeTrauma: 0.12,
  },

  critters: {
    wobbleAmp: 12,
    wobbleFreqMin: 0.8,
    wobbleFreqMax: 1.4,
    emergeTime: 0.5,
    /** Velocity (units/s) added per unit of overlap with a neighbor. */
    separationStiffness: 8,
    blinkIntervalMin: 2,
    blinkIntervalMax: 5,
    blinkDuration: 0.12,
    drifter: { radius: 22, speed: 36, hp: 1, damage: 1, glow: 1 },
  },

  spawn: {
    /** Spawn ring = visible rectangle expanded by this many world units. */
    margin: 40,
    /** Same-color chance for multi-critter groups. */
    groupSameColorChance: 0.6,
    groupAngleJitter: 0.14,
    groupDepthSpacing: 34,
    /** Entities that drift further than this outside the view after a resize are pulled back. */
    resizeClampMargin: 80,
  },

  /** Tide formulas (spec Section 7). n is the 1-based tide number. */
  tides: {
    countBase: 8,
    countPerTide: 3.2,
    intervalBase: 1.5,
    intervalDecay: 0.94,
    intervalMin: 0.32,
    speedPerTide: 0.03,
    groupMax1Below: 3,
    groupMax2Below: 8,
    groupMaxLate: 3,
  },

  /**
   * M1 prototype only: endless spawning where the "virtual tide" (used for the tide formulas)
   * advances every `secondsPerTide` seconds. Replaced by real tides in M2.
   */
  prototype: {
    secondsPerTide: 25,
    colors: 3,
    /** Opening trio of one color, side by side, so a first chain is possible within seconds. */
    openingDelay: 0.3,
    openingCount: 3,
    openingSpacing: 60,
  },

  feel: {
    shakeMaxOffsetPx: 10,
    shakeDecayPerSec: 1.5,
  },

  limits: {
    maxParticles: 600,
    maxCritters: 400,
    maxEffects: 128,
    spatialCellSize: 64,
  },
} as const;

export type Balance = typeof BALANCE;
