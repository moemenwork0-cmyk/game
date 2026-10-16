/** Which language to show: the player's own choice, else the portal/browser locale, else a default. */
import type { Lang } from '../config/strings';

const KEY = 'jellyfit.lang';

export function pickLang(saved: string | null, locale: string | null, fallback: Lang): Lang {
  if (saved === 'ar' || saved === 'en') return saved;
  if (locale) return locale.trim().toLowerCase().startsWith('ar') ? 'ar' : 'en';
  return fallback;
}

export function savedLang(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLang(l: Lang): void {
  try {
    window.localStorage.setItem(KEY, l);
  } catch {
    /* the choice just won't be remembered */
  }
}
