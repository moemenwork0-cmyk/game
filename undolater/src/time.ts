const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function at(base: Date, days: number, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export type Preset = { key: string; label: string; date: Date };

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

  const presets: Preset[] = [{ key: '1h', label: 'In 1 hour', date: hour }];
  if (tonight) presets.push({ key: 'tonight', label: 'Tonight', date: tonight });
  presets.push({ key: 'tomorrow', label: 'Tomorrow', date: tomorrow });
  if (toSaturday > 1 && toSaturday < 7) presets.push({ key: 'weekend', label: 'Weekend', date: weekend });
  presets.push({ key: 'week', label: 'Next week', date: nextWeek });
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

/** Due time with a relative hint only when it's close, e.g. "Today, 7:00 PM · in 2h". */
export function formatDue(ts: number, now = Date.now()): string {
  const when = formatWhen(ts, new Date(now));
  return Math.abs(ts - now) < DAY ? `${when} · ${relative(ts, now)}` : when;
}

export function todayLabel(now = new Date()): string {
  return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}
