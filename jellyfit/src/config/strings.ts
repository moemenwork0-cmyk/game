/** All player-facing text (Arabic). */
export const GAME_TITLE_AR = 'جيلي فيت';

export const STR = {
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
  done: 'تم',
  on: 'تشغيل',
  off: 'إيقاف',
  pause: 'إيقاف مؤقت',
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
} as const;

export type WordKey = keyof typeof STR.words;

/** Western digits with thousands separators (clear at small sizes, common in Arabic games). */
export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
