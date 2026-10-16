import { Feather } from '@expo/vector-icons';
import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../theme';
import { dayBucket } from '../time';
import type { UndoItem } from '../types';
import { Button, Press, T } from './primitives';
import { HistoryRow } from './Rows';

/** Manus-style sidebar: brand, a "New change" action, and the history of restored items. */
export function Sidebar({
  pending,
  history,
  now,
  onNew,
  onOpen,
  onClear,
  onSettings,
}: {
  pending: number;
  history: UndoItem[];
  now: number;
  onNew: () => void;
  onOpen: (id: string) => void;
  onClear: () => void;
  onSettings: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  let lastBucket = '';

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: p.button }]}>
          <Feather name="rotate-ccw" size={15} color={p.onButton} />
        </View>
        <T v="heading" style={{ fontSize: 19 }}>
          UndoLater
        </T>
      </View>

      <Button label="New change" icon="plus" onPress={onNew} style={{ marginHorizontal: 16, marginTop: 18, height: 44 }} />

      <View style={styles.stats}>
        <Stat label="Pending" value={pending} />
        <Stat label="Restored" value={history.length} />
      </View>

      <T v="overline" tone="tertiary" style={styles.section}>
        History
      </T>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 12 }}>
        {history.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="check-circle" size={22} color={p.disabled} />
            <T v="caption" tone="tertiary" style={{ textAlign: 'center' }}>
              Things you restore will be kept here.
            </T>
          </View>
        ) : (
          history.map((item) => {
            const bucket = dayBucket(item.restoredAt ?? now, new Date(now));
            const header = bucket !== lastBucket;
            lastBucket = bucket;
            return (
              <Fragment key={item.id}>
                {header ? (
                  <T v="caption" tone="tertiary" style={styles.bucket}>
                    {bucket}
                  </T>
                ) : null}
                <HistoryRow item={item} now={now} onOpen={() => onOpen(item.id)} />
              </Fragment>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: p.border }]}>
        <Press onPress={onSettings} style={styles.footerBtn} scaleTo={0.95}>
          <Feather name="bell" size={16} color={p.secondary} />
          <T v="label" tone="secondary">
            Notifications
          </T>
        </Press>
        {history.length ? (
          <Press onPress={onClear} style={styles.footerBtn} scaleTo={0.95}>
            <Feather name="trash-2" size={16} color={p.tertiary} />
            <T v="label" tone="tertiary">
              Clear
            </T>
          </Press>
        ) : null}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const p = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: p.fill }]}>
      <T v="title" style={{ fontSize: 22, lineHeight: 28 }}>
        {value}
      </T>
      <T v="caption" tone="tertiary">
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, height: 40 },
  logo: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  stat: { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
  section: { paddingHorizontal: 18, marginTop: 22, marginBottom: 4 },
  bucket: { paddingHorizontal: 14, marginTop: 10, marginBottom: 2, fontSize: 12 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 30, paddingHorizontal: 30 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 8 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, height: 40, borderRadius: 12 },
});
