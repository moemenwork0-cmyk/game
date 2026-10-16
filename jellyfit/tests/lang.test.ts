import { describe, expect, it } from 'vitest';
import { pickLang } from '../src/meta/lang';
import { LINES, LINES_EN } from '../src/jello/lines';

describe('language', () => {
  it('prefers the saved choice, then the locale, then the fallback', () => {
    expect(pickLang('en', 'ar-EG', 'ar')).toBe('en');
    expect(pickLang('ar', 'en-US', 'en')).toBe('ar');
    expect(pickLang(null, 'ar-EG', 'en')).toBe('ar');
    expect(pickLang(null, 'AR', 'en')).toBe('ar');
    expect(pickLang(null, 'en-US', 'ar')).toBe('en');
    expect(pickLang(null, 'fr-FR', 'ar')).toBe('en');
    expect(pickLang('xx', null, 'ar')).toBe('ar');
    expect(pickLang(null, null, 'en')).toBe('en');
  });

  it('Jello has English lines for every situation, with the same placeholders', () => {
    for (const k of Object.keys(LINES) as (keyof typeof LINES)[]) {
      expect(LINES_EN[k].length, k).toBeGreaterThan(0);
      const vars = (a: readonly string[]) => [...new Set(a.flatMap((l) => l.match(/\{\w+\}/g) ?? []))].sort();
      expect(vars(LINES_EN[k]), k).toEqual(vars(LINES[k]));
    }
  });
});
