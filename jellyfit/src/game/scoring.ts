/** PURE scoring, combo and feedback words (spec 7). */
import { BALANCE } from '../config/balance';
import type { WordKey } from '../config/strings';

const S = BALANCE.scoring;
const W = BALANCE.words;

export function lineBase(lines: number): number {
  if (lines <= 0) return 0;
  const t = S.lineBase;
  if (lines < t.length) return t[lines];
  return t[t.length - 1] + (lines - (t.length - 1)) * S.lineBeyond;
}

export function comboMult(combo: number): number {
  if (combo < 1) return 1;
  return Math.min(S.comboMaxMult, 1 + S.comboStep * (combo - 1));
}

export interface ComboState {
  combo: number;
  /** Placements since the last clear (0 right after a clearing placement). */
  sinceClear: number;
}

/** Advances the combo state for one placement. */
export function stepCombo(st: ComboState, lines: number): ComboState {
  if (lines > 0) return { combo: st.combo + 1, sinceClear: 0 };
  const since = st.sinceClear + 1;
  if (st.combo > 0 && since >= S.comboGrace) return { combo: 0, sinceClear: since };
  return { combo: st.combo, sinceClear: since };
}

/** Fraction of the grace window left (1 right after a clear, 0 when the combo is about to break). */
export function graceLeft(st: ComboState): number {
  if (st.combo < 1) return 0;
  return Math.max(0, 1 - st.sinceClear / S.comboGrace);
}

export interface ScoreParts {
  cellPoints: number;
  lineScore: number;
  perfectBonus: number;
  total: number;
}

export function scorePlacement(
  cells: number,
  lines: number,
  combo: number,
  perfect: boolean,
  rushMult = 1,
  missionMult = 1,
): ScoreParts {
  const cellPoints = cells * S.perCell;
  const mult = comboMult(combo) * rushMult * missionMult;
  const lineScore = Math.round(lineBase(lines) * mult);
  const perfectBonus = perfect ? Math.round(S.perfectClear * mult) : 0;
  return { cellPoints, lineScore, perfectBonus, total: cellPoints + lineScore + perfectBonus };
}

/**
 * Feedback word for a placement. Priority: perfect > unstoppable > amazing (5+ lines) > on fire > lines.
 */
export function feedbackWord(lines: number, combo: number, perfect: boolean): WordKey | null {
  if (perfect) return 'perfect';
  if (lines <= 0) return null;
  if (combo >= W.comboUnstoppable) return 'unstoppable';
  if (lines >= 5) return W.lines[5];
  if (combo >= W.comboOnFire) return 'onFire';
  return W.lines[Math.min(lines, 5)] ?? null;
}
