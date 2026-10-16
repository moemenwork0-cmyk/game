const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function at(base: Date, days: number, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export type Preset = { key: string; label: string; date: Date; icon: 'clock' | 'moon' | 'sunrise' | 'coffee' | 'calendar' };

/** Quick reminder choices, computed relative to `now`. */
export function reminderPresets(now = new Date()): Preset[] {
  const hour = new Date(now.getTime() + HOUR);
  hour.setSeconds(0, 0);
  // "Tonight" is 7pm today, or 9pm if it is already evening.
  const tonight = now.getHours() < 18 ? at(now, 0, 19) : now.getHours() < 20 ? at(now, 0, 21) : null;
  const tomorrow = at(now, 1, 9);
  const toSaturday = (6 - now.getDay() + 7) % 7 || 7;
  const weekend = at(now, toSaturday, 10);
  const toMonday = (1 - now.getDay() + 7) % 7 || 7;
  const nextWeek = at(now, toMonday, 9);

  const presets: Preset[] = [{ key: '1h', label: 'In 1 hour', date: hour, icon: 'clock' }];
  if (tonight) presets.push({ key: 'tonight', label: 'Tonight', date: tonight, icon: 'moon' });
  presets.push({ key: 'tomorrow', label: 'Tomorrow morning', date: tomorrow, icon: 'sunrise' });
  if (toSaturday > 1 && toSaturday < 7) presets.push({ key: 'weekend', label: 'This weekend', date: weekend, icon: 'coffee' });
  presets.push({ key: 'week', label: 'Next week', date: nextWeek, icon: 'calendar' });
  return presets;
}

/** "in 2h", "in 3 days", "5m ago" ... */
export function relative(ts: number, now = Date.now()): string {
  const diff = ts - now;
  const abs = Math.abs(diff);
  let text: string;
  if (abs < MIN) return diff >= 0 ? 'now' : 'just now';
  if (abs < HOUR) text = `${Math.round(abs / MIN)}m`;
  else if (abs < DAY) text = `${Math.round(abs / HOUR)}h`;
  else {
    const days = Math.round(abs / DAY);
    text = days === 1 ? '1 day' : `${days} days`;
  }
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** "Today, 7:00 PM", "Tomorrow, 9:00 AM", "Sat, Oct 18, 10:00 AM" (locale dependent) */
export function formatWhen(ts: number, now = new Date()): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayDiff = Math.round((at(d, 0, 0).getTime() - at(now, 0, 0).getTime()) / DAY);
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date}, ${time}`;
}


/** Short label for a chip: "7:00 PM", "Tomorrow 9:00 AM", "Sat 10:00 AM". */
export function shortWhen(ts: number, now = new Date()): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayDiff = Math.round((at(d, 0, 0).getTime() - at(now, 0, 0).getTime()) / DAY);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${time}`;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** History grouping label. */
export function dayBucket(ts: number, now = new Date()): string {
  const dayDiff = Math.round((at(now, 0, 0).getTime() - at(new Date(ts), 0, 0).getTime()) / DAY);
  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return 'This week';
  return 'Earlier';
}

/** Compact due label for list rows: "5:24 PM · in 2h" when close, else "Tomorrow 1:12 PM". */
export function dueLabel(ts: number, now = Date.now()): string {
  const near = ts - now < 12 * HOUR;
  return near ? `${shortWhen(ts, new Date(now))} · ${relative(ts, now)}` : shortWhen(ts, new Date(now));
}
