/**
 * All player-facing text, Arabic and English. `setLang()` runs once at boot, before any screen is
 * built; everything reads `STR` at use time (it is a live binding).
 */
export type Lang = 'ar' | 'en';

export const GAME_TITLE_AR = 'جيلي فيت';
export const GAME_TITLE_EN = 'Jelly Fit';

const AR = {
  title: GAME_TITLE_AR,
  tagline: 'ركّب القطع واملأ الصفوف',
  playNow: 'العب الآن',
  continueGame: 'كمّل اللعب',
  best: 'أفضل نتيجة',
  score: 'النقاط',
  newBest: 'رقم قياسي جديد!',
  newBestShort: 'رقم قياسي!',
  gameOverTitle: 'انتهى الدور',
  playAgain: 'العب مرة أخرى',
  home: 'الرئيسية',
  lines: 'صفوف',
  bestCombo: 'أفضل كومبو',
  noSpace: 'لا توجد مساحة!',
  comboWord: 'كومبو',
  paused: 'استراحة',
  resume: 'متابعة',
  settings: 'الإعدادات',
  sound: 'المؤثرات الصوتية',
  music: 'الموسيقى',
  haptics: 'الاهتزاز',
  reducedMotion: 'تقليل الحركة',
  jelloTalk: 'كلام جيلو',
  language: 'اللغة',
  done: 'تم',
  on: 'تشغيل',
  off: 'إيقاف',
  pause: 'إيقاف مؤقت',
  board: 'لوحة اللعب',
  fatal: 'حدث خطأ ما. أعد تحميل الصفحة.',
  words: {
    good: 'جيد',
    great: 'رائع',
    excellent: 'ممتاز',
    amazing: 'مذهل',
    onFire: 'مشتعل!',
    unstoppable: 'لا يُوقَف!',
    perfect: 'مثالي!',
  },
};

export type Strings = typeof AR;

const EN: Strings = {
  title: GAME_TITLE_EN,
  tagline: 'Fit the jelly, fill the lines',
  playNow: 'Play',
  continueGame: 'Continue',
  best: 'Best',
  score: 'Score',
  newBest: 'New best!',
  newBestShort: 'New best!',
  gameOverTitle: 'Out of moves',
  playAgain: 'Play again',
  home: 'Home',
  lines: 'Lines',
  bestCombo: 'Best combo',
  noSpace: 'No space left!',
  comboWord: 'Combo',
  paused: 'Paused',
  resume: 'Resume',
  settings: 'Settings',
  sound: 'Sound effects',
  music: 'Music',
  haptics: 'Vibration',
  reducedMotion: 'Reduced motion',
  jelloTalk: "Jello's chatter",
  language: 'Language',
  done: 'Done',
  on: 'On',
  off: 'Off',
  pause: 'Pause',
  board: 'Game board',
  fatal: 'Something went wrong. Reload the page.',
  words: {
    good: 'Good',
    great: 'Great',
    excellent: 'Excellent',
    amazing: 'Amazing',
    onFire: 'On fire!',
    unstoppable: 'Unstoppable!',
    perfect: 'Perfect!',
  },
};

/** Each language's own name, for the language switch. */
export const LANG_NAMES: Record<Lang, string> = { ar: 'العربية', en: 'English' };

export let STR: Strings = AR;
export let LANG: Lang = 'ar';

export function setLang(l: Lang): void {
  LANG = l;
  STR = l === 'en' ? EN : AR;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
    document.title = STR.title;
    document.getElementById('game')?.setAttribute('aria-label', STR.board);
  }
}

/** Canvas text direction for the current language. */
export function textDir(): CanvasDirection {
  return LANG === 'ar' ? 'rtl' : 'ltr';
}

export type WordKey = keyof Strings['words'];

/** Western digits with thousands separators (clear at small sizes, common in Arabic games). */
export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
