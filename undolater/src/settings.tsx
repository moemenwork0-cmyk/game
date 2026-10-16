import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Settings = {
  /** Play the UndoLater chime (otherwise vibrate only). */
  sound: boolean;
  /** Hours between gentle follow-up nudges while still pending; 0 turns them off. */
  followUpHours: 0 | 1 | 3;
};

const KEY = 'undolater/settings/v1';
export const defaultSettings: Settings = { sound: true, followUpHours: 3 };

type Ctx = { settings: Settings; loaded: boolean; update: (change: Partial<Settings>) => void };
const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings({ ...defaultSettings, ...JSON.parse(raw) }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((change: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...change };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside <SettingsProvider>');
  return ctx;
}
