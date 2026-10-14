import { describe, expect, it } from 'vitest';
import { comboMult, feedbackWord, lineBase, scorePlacement, stepCombo } from '../src/game/scoring';

describe('scoring', () => {
  it('line base table and beyond', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(lineBase)).toEqual([0, 100, 300, 600, 1000, 1500, 2100, 2800]);
    expect(lineBase(8)).toBe(3600);
    expect(lineBase(9)).toBe(4400);
  });

  it('combo multiplier grows by 0.5 and caps at 6', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(1)).toBe(1);
    expect(comboMult(3)).toBe(2);
    expect(comboMult(11)).toBe(6);
    expect(comboMult(30)).toBe(6);
  });

  it('combo survives up to 2 non-clearing placements and breaks on the 3rd', () => {
    let st = stepCombo({ combo: 0, sinceClear: 0 }, 1);
    expect(st.combo).toBe(1);
    st = stepCombo(st, 0);
    st = stepCombo(st, 0);
    expect(st.combo).toBe(1);
    st = stepCombo(st, 1);
    expect(st.combo).toBe(2);
    st = stepCombo(stepCombo(stepCombo(st, 0), 0), 0);
    expect(st.combo).toBe(0);
  });

  it('scores cells, lines, combo and perfect clear', () => {
    expect(scorePlacement(4, 0, 0, false).total).toBe(4);
    expect(scorePlacement(3, 2, 1, false).total).toBe(303);
    expect(scorePlacement(3, 2, 3, false).lineScore).toBe(600);
    const p = scorePlacement(1, 1, 1, true);
    expect(p.perfectBonus).toBe(3000);
    expect(scorePlacement(1, 1, 1, false, 2, 3).lineScore).toBe(600);
  });

  it('feedback words', () => {
    expect(feedbackWord(1, 1, false)).toBeNull();
    expect(feedbackWord(2, 1, false)).toBe('good');
    expect(feedbackWord(3, 1, false)).toBe('great');
    expect(feedbackWord(4, 1, false)).toBe('excellent');
    expect(feedbackWord(6, 1, false)).toBe('amazing');
    expect(feedbackWord(1, 5, false)).toBe('onFire');
    expect(feedbackWord(1, 8, false)).toBe('unstoppable');
    expect(feedbackWord(1, 1, true)).toBe('perfect');
    expect(feedbackWord(0, 9, false)).toBeNull();
  });
});
