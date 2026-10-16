import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDue, relative } from '../time';
import { radius, usePalette } from '../theme';
import type { UndoItem } from '../types';
import { Thumb } from './Thumb';
import { Button } from './ui';

type Props = { item: UndoItem; now: number; onPress: () => void; onRestore: () => void };

export function PendingCard({ item, now, onPress, onRestore }: Props) {
  const p = usePalette();
  const overdue = item.remindAt !== undefined && item.remindAt <= now;
  const metaColor = overdue ? p.danger : p.muted;
  const meta = item.remindAt
    ? overdue
      ? `Overdue · ${relative(item.remindAt, now)}`
      : formatDue(item.remindAt, now)
    : `Added ${relative(item.createdAt, now)}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Opens details"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: p.surface, borderColor: overdue ? p.dangerSoft : p.border },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}>
      <View style={styles.top}>
        <Thumb uri={item.photoUri} />
        <View style={styles.text}>
          <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.note ? (
            <Text style={[styles.note, { color: p.muted }]} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={[styles.meta, overdue && { backgroundColor: p.dangerSoft }]}>
          <Feather name={item.remindAt ? (overdue ? 'alert-circle' : 'bell') : 'clock'} size={13} color={metaColor} />
          <Text style={[styles.metaText, { color: metaColor }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Button label="Restored" icon="check" size="sm" variant={overdue ? 'ink' : 'soft'} onPress={onRestore} />
      </View>
    </Pressable>
  );
}

export function HistoryRow({ item, now, onPress }: Omit<Props, 'onRestore'>) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: p.surface, borderColor: p.border, opacity: pressed ? 0.8 : 1 }]}>
      <Thumb uri={item.photoUri} size={44} done />
      <View style={styles.text}>
        <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.rowMeta, { color: p.muted }]} numberOfLines={1}>
          Restored {relative(item.restoredAt ?? now, now)}
        </Text>
      </View>
      <Feather name="check-circle" size={18} color={p.success} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  top: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2, lineHeight: 21 },
  note: { fontSize: 14 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginLeft: -8,
    borderRadius: radius.pill,
  },
  metaText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md + 2,
    borderWidth: 1,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  rowMeta: { fontSize: 13 },
});
