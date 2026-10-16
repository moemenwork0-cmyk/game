import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppState,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DetailSheet } from './src/components/DetailSheet';
import { EditorSheet } from './src/components/EditorSheet';
import { Empty } from './src/components/Empty';
import { HistoryRow, PendingCard } from './src/components/ItemCard';
import { Tabs } from './src/components/Tabs';
import { Toast } from './src/components/Toast';
import type { ToastData } from './src/components/Toast';
import { listenForReminderTaps, setupNotifications } from './src/notifications';
import { StoreProvider, splitItems, useStore } from './src/store';
import { radius, usePalette } from './src/theme';
import { todayLabel } from './src/time';
import type { Draft, UndoItem } from './src/types';

const HOUR = 60 * 60 * 1000;
const native = Platform.OS !== 'web';

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Home />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  if (!native) {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}

function haptic(kind: 'success' | 'light') {
  if (!native) return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function animateNext() {
  LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
}

function Home() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const { pending, history } = useMemo(() => splitItems(store.items), [store.items]);

  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [now, setNow] = useState(Date.now());
  // `seq` remounts the editor for every open so it starts from a fresh form.
  const [editor, setEditor] = useState<{ open: boolean; seq: number; item?: UndoItem }>({ open: false, seq: 0 });
  const openEditor = (item?: UndoItem) => setEditor((e) => ({ open: true, seq: e.seq + 1, item }));
  const closeEditor = () => setEditor((e) => ({ ...e, open: false }));
  const [detailId, setDetailId] = useState<string>();
  const [toast, setToast] = useState<ToastData>();
  const detail = store.items.find((it) => it.id === detailId);
  const overdue = pending.filter((it) => it.remindAt && it.remindAt <= now).length;

  // Keep "in 2h" / "overdue" labels fresh.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  const showToast = useCallback((text: string, action?: ToastData['action']) => {
    setToast({ id: Date.now(), text, action });
  }, []);
  const hideToast = useCallback(() => setToast(undefined), []);

  const restore = useCallback(
    (id: string) => {
      animateNext();
      store.restore(id);
      haptic('success');
      showToast('Marked as restored', { label: 'Undo', onPress: () => store.reopen(id) });
    },
    [store, showToast],
  );

  // Notification taps and their "Restored" / "Snooze" buttons.
  const { loaded, snooze } = store;
  useEffect(() => {
    if (!loaded) return;
    return listenForReminderTaps(({ itemId, action }) => {
      if (action === 'restore') restore(itemId);
      else if (action === 'snooze') {
        snooze(itemId, HOUR);
        showToast('Snoozed for 1 hour');
      } else {
        setTab('pending');
        setDetailId(itemId);
      }
    });
    // Subscribe once, after items are loaded; the handlers read the latest state via the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const save = (draft: Draft) => {
    const editing = editor.item;
    closeEditor();
    haptic('light');
    animateNext();
    if (editing) {
      store.update(editing.id, draft);
    } else {
      store.add(draft);
      setTab('pending');
      showToast(draft.remindAt ? "Saved — we'll remind you" : 'Saved');
    }
  };

  const remove = (item: UndoItem) =>
    confirm('Delete this item?', item.title, 'Delete', () => {
      setDetailId(undefined);
      animateNext();
      store.remove(item.id);
    });

  const data = tab === 'pending' ? pending : history;
  const summary =
    pending.length === 0
      ? 'All clear. Nothing to undo.'
      : `${pending.length} to undo${overdue ? ` · ${overdue} overdue` : ''}`;

  return (
    <View style={[styles.screen, { backgroundColor: p.bg }]}>
      <StatusBar style="auto" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.date, { color: p.muted }]}>{todayLabel(new Date(now))}</Text>
        <View style={styles.brandRow}>
          <Text style={[styles.brand, { color: p.text }]}>UndoLater</Text>
          <View style={[styles.logo, { backgroundColor: p.accent }]}>
            <Feather name="rotate-ccw" size={16} color={p.onAccent} />
          </View>
        </View>
        <Text style={[styles.summary, { color: overdue ? p.danger : p.muted }]}>{summary}</Text>
        <View style={{ marginTop: 18 }}>
          <Tabs
            value={tab}
            onChange={(k) => {
              animateNext();
              setTab(k);
            }}
            tabs={[
              { key: 'pending', label: 'Pending', count: pending.length },
              { key: 'history', label: 'History', count: history.length },
            ]}
          />
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
        ItemSeparatorComponent={() => <View style={{ height: tab === 'pending' ? 12 : 8 }} />}
        ListHeaderComponent={
          tab === 'history' && history.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={[styles.listHeaderText, { color: p.muted }]}>Completed</Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  confirm('Clear history?', 'All restored items will be removed.', 'Clear', () => {
                    animateNext();
                    store.clearHistory();
                  })
                }>
                <Text style={[styles.clear, { color: p.danger }]}>Clear</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          !store.loaded ? undefined : tab === 'pending' ? (
            <Empty
              icon="rotate-ccw"
              title="Nothing to undo"
              body="Changed something for now? Note it here and get a reminder to put it back."
            />
          ) : (
            <Empty icon="check" title="No history yet" body="Things you've restored will show up here." />
          )
        }
        renderItem={({ item }) =>
          tab === 'pending' ? (
            <PendingCard item={item} now={now} onPress={() => setDetailId(item.id)} onRestore={() => restore(item.id)} />
          ) : (
            <HistoryRow item={item} now={now} onPress={() => setDetailId(item.id)} />
          )
        }
      />

      <Toast toast={toast} bottom={insets.bottom + 96} onHide={hideToast} />

      <View style={[styles.fabWrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a change"
          onPress={() => openEditor()}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: p.ink, transform: [{ scale: pressed ? 0.96 : 1 }] },
          ]}>
          <Feather name="plus" size={20} color={p.onInk} />
          <Text style={[styles.fabText, { color: p.onInk }]}>New change</Text>
        </Pressable>
      </View>

      <DetailSheet
        item={detail}
        now={now}
        onClose={() => setDetailId(undefined)}
        onRestore={() => {
          if (!detail) return;
          setDetailId(undefined);
          restore(detail.id);
        }}
        onReopen={() => {
          if (!detail) return;
          setDetailId(undefined);
          animateNext();
          store.reopen(detail.id);
          setTab('pending');
          showToast('Moved back to pending');
        }}
        onSnooze={() => {
          if (!detail) return;
          setDetailId(undefined);
          store.snooze(detail.id, HOUR);
          showToast('Snoozed for 1 hour');
        }}
        onEdit={() => {
          if (!detail) return;
          setDetailId(undefined);
          // iOS can't present a sheet while another one is still sliding away.
          setTimeout(() => openEditor(detail), Platform.OS === 'ios' ? 450 : 0);
        }}
        onDelete={() => detail && remove(detail)}
      />

      <EditorSheet key={editor.seq} visible={editor.open} item={editor.item} onClose={closeEditor} onSave={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  date: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  brand: { fontSize: 36, fontWeight: '800', letterSpacing: -1.4 },
  logo: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  summary: { fontSize: 15, marginTop: 2, fontWeight: '500' },
  list: { paddingHorizontal: 20, paddingTop: 8, flexGrow: 1 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  listHeaderText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  clear: { fontSize: 14, fontWeight: '600' },
  fabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 56,
    paddingHorizontal: 26,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fabText: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
});
