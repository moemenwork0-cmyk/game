import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Current time, refreshed every `everyMs` and whenever the app comes back to the foreground. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), everyMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [everyMs]);
  return now;
}
