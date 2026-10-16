import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { cancelReminder, scheduleReminder } from './notifications';
import { deletePhoto } from './photos';
import type { Draft, UndoItem } from './types';

const KEY = 'undolater/items/v1';

type Store = {
  items: UndoItem[];
  loaded: boolean;
  add: (draft: Draft) => Promise<UndoItem>;
  update: (id: string, draft: Draft) => Promise<void>;
  restore: (id: string) => Promise<void>;
  reopen: (id: string) => Promise<void>;
  snooze: (id: string, ms: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UndoItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(items);

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

  const find = (id: string) => ref.current.find((it) => it.id === id);

  const add = useCallback(
    async (draft: Draft) => {
      const item: UndoItem = { id: newId(), createdAt: Date.now(), ...draft };
      commit([item, ...ref.current]);
      const notificationId = await scheduleReminder(item);
      if (notificationId) patch(item.id, { notificationId });
      return item;
    },
    [commit, patch],
  );

  const update = useCallback(
    async (id: string, draft: Draft) => {
      const old = find(id);
      if (!old) return;
      if (old.photoUri && old.photoUri !== draft.photoUri) deletePhoto(old.photoUri);
      await cancelReminder(old.notificationId);
      const next: UndoItem = { ...old, ...draft, notificationId: undefined };
      patch(id, next);
      if (!next.restoredAt) {
        const notificationId = await scheduleReminder(next);
        if (notificationId) patch(id, { notificationId });
      }
    },
    [patch],
  );

  const restore = useCallback(
    async (id: string) => {
      const old = find(id);
      if (!old || old.restoredAt) return;
      patch(id, { restoredAt: Date.now(), notificationId: undefined });
      await cancelReminder(old.notificationId);
    },
    [patch],
  );

  const reopen = useCallback(
    async (id: string) => {
      const old = find(id);
      if (!old) return;
      patch(id, { restoredAt: undefined });
      const notificationId = await scheduleReminder(old);
      if (notificationId) patch(id, { notificationId });
    },
    [patch],
  );

  const snooze = useCallback(
    async (id: string, ms: number) => {
      const old = find(id);
      if (!old) return;
      await cancelReminder(old.notificationId);
      const remindAt = Date.now() + ms;
      patch(id, { remindAt, restoredAt: undefined, notificationId: undefined });
      const notificationId = await scheduleReminder({ ...old, remindAt });
      if (notificationId) patch(id, { notificationId });
    },
    [patch],
  );

  const remove = useCallback(
    async (id: string) => {
      const old = find(id);
      if (!old) return;
      commit(ref.current.filter((it) => it.id !== id));
      deletePhoto(old.photoUri);
      await cancelReminder(old.notificationId);
    },
    [commit],
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
