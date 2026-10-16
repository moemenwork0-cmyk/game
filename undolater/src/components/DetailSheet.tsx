import { Feather } from '@expo/vector-icons';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDue, formatWhen } from '../time';
import { radius, usePalette } from '../theme';
import type { UndoItem } from '../types';
import { Sheet } from './Sheet';
import { Button, IconButton } from './ui';
import type { IconName } from './ui';

type Props = {
  item?: UndoItem;
  now: number;
  onClose: () => void;
  onRestore: () => void;
  onReopen: () => void;
  onSnooze: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function DetailSheet({ item, now, onClose, onRestore, onReopen, onSnooze, onEdit, onDelete }: Props) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const done = !!item?.restoredAt;
  const overdue = !done && !!item?.remindAt && item.remindAt <= now;

  return (
    <Sheet
      visible={!!item}
      onClose={onClose}
      left={<IconButton icon="x" label="Close" onPress={onClose} />}
      right={!done ? <IconButton icon="edit-2" label="Edit" onPress={onEdit} /> : null}>
      {item ? (
        <>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 }]}>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} style={[styles.photo, { backgroundColor: p.surfaceAlt }]} />
            ) : null}
            <View style={[styles.status, { backgroundColor: done ? p.successSoft : overdue ? p.dangerSoft : p.accentSoft }]}>
              <Feather
                name={done ? 'check' : overdue ? 'alert-circle' : 'rotate-ccw'}
                size={13}
                color={done ? p.success : overdue ? p.danger : p.accent}
              />
              <Text style={[styles.statusText, { color: done ? p.success : overdue ? p.danger : p.accent }]}>
                {done ? 'Restored' : overdue ? 'Overdue' : 'Pending'}
              </Text>
            </View>
            <Text style={[styles.title, { color: p.text }]}>{item.title}</Text>
            {item.note ? <Text style={[styles.note, { color: p.muted }]}>{item.note}</Text> : null}

            <View style={[styles.facts, { backgroundColor: p.surface, borderColor: p.border }]}>
              <Fact icon="edit-3" label="Changed" value={`${formatWhen(item.createdAt)}`} />
              {done ? (
                <Fact icon="check-circle" label="Restored" value={formatWhen(item.restoredAt!)} last />
              ) : (
                <Fact
                  icon={item.remindAt ? 'bell' : 'bell-off'}
                  label="Reminder"
                  value={item.remindAt ? formatDue(item.remindAt, now) : 'None'}
                  danger={overdue}
                  last
                />
              )}
            </View>

            <Pressable onPress={onDelete} style={styles.delete} hitSlop={6}>
              <Feather name="trash-2" size={15} color={p.danger} />
              <Text style={[styles.deleteText, { color: p.danger }]}>Delete</Text>
            </Pressable>
          </ScrollView>

          <View style={[styles.actions, { paddingBottom: insets.bottom + 12, borderTopColor: p.border }]}>
            {done ? (
              <Button label="Move back to pending" icon="rotate-ccw" variant="soft" size="lg" onPress={onReopen} style={{ flex: 1 }} />
            ) : (
              <>
                <Button label="Snooze 1h" icon="clock" variant="soft" size="lg" onPress={onSnooze} />
                <Button label="Restored" icon="check" variant="ink" size="lg" onPress={onRestore} style={{ flex: 1 }} />
              </>
            )}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

function Fact({
  icon,
  label,
  value,
  danger,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  danger?: boolean;
  last?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={[styles.fact, !last && { borderBottomWidth: 1, borderBottomColor: p.border }]}>
      <Feather name={icon} size={16} color={p.muted} />
      <Text style={[styles.factLabel, { color: p.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: danger ? p.danger : p.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.xl, marginBottom: 20 },
  status: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: 12,
  },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.8, lineHeight: 34 },
  note: { fontSize: 16, lineHeight: 23, marginTop: 8 },
  facts: { marginTop: 24, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 16 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  factLabel: { fontSize: 14, width: 76 },
  factValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 28, padding: 8 },
  deleteText: { fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
