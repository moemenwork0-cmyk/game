import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { cancelReminders, clearDelivered, resyncReminders, scheduleReminders } from './notifications';
import { deletePhoto } from './photos';
import { useSettings } from './settings';
import type { Draft, UndoItem } from './types';

const KEY = 'undolater/items/v1';

type Store = {
  items: UndoItem[];
  loaded: boolean;
  add: (draft: Draft) => Promise<UndoItem>;
  update: (id: string, change: Partial<Draft>) => Promise<void>;
  restore: (id: string) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  snooze: (id: string, ms: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const { settings, loaded: settingsLoaded } = useSettings();
  const [items, setItems] = useState<UndoItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(items);
  const settingsRef = useRef(settings);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as UndoItem[]) : [];
        ref.current = saved;
        setItems(saved);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const commit = useCallback((next: UndoItem[]) => {
    ref.current = next;
    setItems(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<UndoItem>) =>
      commit(ref.current.map((it) => (it.id === id ? { ...it, ...change } : it))),
    [commit],
  );

  // Rebuild all scheduled notifications on launch and whenever notification settings change.
  useEffect(() => {
    if (!loaded || !settingsLoaded) return;
    settingsRef.current = settings;
    resyncReminders(ref.current, settings)
      .then((byId) =>
        commit(
          ref.current.map((it) =>
            it.restoredAt || !it.remindAt ? it : { ...it, notificationId: undefined, notificationIds: byId[it.id] ?? [] },
          ),
        ),
      )
      .catch(() => {});
  }, [loaded, settingsLoaded, settings, commit]);

  const find = useCallback((id: string) => ref.current.find((it) => it.id === id), []);

  const schedule = useCallback(
    async (item: UndoItem) => {
      const notificationIds = await scheduleReminders(item, settingsRef.current);
      patch(item.id, { notificationIds, notificationId: undefined });
    },
    [patch],
  );

  const add = useCallback(
    async (draft: Draft) => {
      const item: UndoItem = { id: newId(), createdAt: Date.now(), ...draft };
      commit([item, ...ref.current]);
      await schedule(item);
      return item;
    },
    [commit, schedule],
  );

  const update = useCallback(
    async (id: string, change: Partial<Draft>) => {
      const old = find(id);
      if (!old) return;
      if ('photoUri' in change && old.photoUri && old.photoUri !== change.photoUri) deletePhoto(old.photoUri);
      const next: UndoItem = { ...old, ...change };
      patch(id, change);
      // Only reminder-relevant edits touch the schedule.
      if (!old.restoredAt && ('remindAt' in change || 'title' in change || 'note' in change)) {
        await cancelReminders(old);
        await schedule(next);
      }
    },
    [find, patch, schedule],
  );

  const restore = useCallback(
    async (id: string) => {
      const old = find(id);
      if (!old || old.restoredAt) return;
      patch(id, { restoredAt: Date.now(), notificationIds: [], notificationId: undefined });
      await cancelReminders(old);
      await clearDelivered(id);
    },
    [find, patch],
  );

  const reopen = useCallback(
    async (id: string) => {
      const old = find(id);
      if (!old) return;
      const next = { ...old, restoredAt: undefined };
      patch(id, { restoredAt: undefined });
      await schedule(next);
    },
    [find, patch, schedule],
  );

  const snooze = useCallback(
    async (id: string, ms: number) => {
      const old = find(id);
      if (!old) return;
      await cancelReminders(old);
      await clearDelivered(id);
      const next = { ...old, remindAt: Date.now() + ms, restoredAt: undefined };
      patch(id, { remindAt: next.remindAt, restoredAt: undefined });
      await schedule(next);
    },
    [find, patch, schedule],
  );

  const remove = useCallback(
    async (id: string) => {
      const old = find(id);
      if (!old) return;
      commit(ref.current.filter((it) => it.id !== id));
      deletePhoto(old.photoUri);
      await cancelReminders(old);
      await clearDelivered(id);
    },
    [commit, find],
  );

  const clearHistory = useCallback(async () => {
    ref.current.filter((it) => it.restoredAt).forEach((it) => deletePhoto(it.photoUri));
    commit(ref.current.filter((it) => !it.restoredAt));
  }, [commit]);

  const value = useMemo(
    () => ({ items, loaded, add, update, restore, reopen, snooze, remove, clearHistory }),
    [items, loaded, add, update, restore, reopen, snooze, remove, clearHistory],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

/** Pending first by due time (overdue on top, no reminder last); history newest first. */
export function splitItems(items: UndoItem[]) {
  const pending = items
    .filter((it) => !it.restoredAt)
    .sort((a, b) => (a.remindAt ?? Infinity) - (b.remindAt ?? Infinity) || b.createdAt - a.createdAt);
  const history = items
    .filter((it) => it.restoredAt)
    .sort((a, b) => (b.restoredAt ?? 0) - (a.restoredAt ?? 0));
  return { pending, history };
}
