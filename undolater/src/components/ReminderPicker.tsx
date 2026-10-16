import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { formatDue, reminderPresets } from '../time';
import { usePalette } from '../theme';
import { Chip } from './ui';

export type ReminderChoice = { key: string; date?: Date };

export function defaultChoice(): ReminderChoice {
  const presets = reminderPresets();
  const pick = presets.find((p) => p.key === 'tonight') ?? presets.find((p) => p.key === 'tomorrow')!;
  return { key: pick.key, date: pick.date };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReminderPicker({ value, onChange }: { value: ReminderChoice; onChange: (c: ReminderChoice) => void }) {
  const p = usePalette();
  const scheme = useColorScheme();
  const presets = useMemo(() => reminderPresets(), []);
  const customDate = value.date ?? presets[0].date;

  const pickCustom = () => {
    if (Platform.OS !== 'android') {
      onChange({ key: 'custom', date: customDate });
      return;
    }
    // Android shows the date dialog, then the time dialog.
    DateTimePickerAndroid.open({
      mode: 'date',
      value: customDate,
      minimumDate: new Date(),
      onValueChange: (_e, day) => {
        DateTimePickerAndroid.open({
          mode: 'time',
          value: day,
          onValueChange: (_e2, time) => onChange({ key: 'custom', date: time }),
        });
      },
    });
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.chips}>
        {presets.map((preset) => (
          <Chip
            key={preset.key}
            label={preset.label}
            selected={value.key === preset.key}
            onPress={() => onChange({ key: preset.key, date: preset.date })}
          />
        ))}
        <Chip label="Pick time" icon="calendar" selected={value.key === 'custom'} onPress={pickCustom} />
        <Chip label="None" icon="bell-off" selected={value.key === 'none'} onPress={() => onChange({ key: 'none' })} />
      </View>

      {value.key === 'custom' && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={customDate}
          mode="datetime"
          display="compact"
          minimumDate={new Date()}
          onValueChange={(_e, d) => onChange({ key: 'custom', date: d })}
          style={{ alignSelf: 'flex-start' }}
        />
      ) : null}
      {value.key === 'custom' && Platform.OS === 'web'
        ? createElement('input', {
            type: 'datetime-local',
            value: toLocalInput(customDate),
            min: toLocalInput(new Date()),
            onChange: (e: { target: { value: string } }) => {
              const d = new Date(e.target.value);
              if (!Number.isNaN(d.getTime())) onChange({ key: 'custom', date: d });
            },
            style: {
              font: 'inherit',
              fontSize: 15,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${p.border}`,
              background: p.surface,
              color: p.text,
              alignSelf: 'flex-start',
              colorScheme: scheme === 'dark' ? 'dark' : 'light',
            },
          })
        : null}

      <View style={[styles.summary, { backgroundColor: value.key === 'none' ? p.surfaceAlt : p.accentSoft }]}>
        <Feather name={value.key === 'none' ? 'bell-off' : 'bell'} size={15} color={value.key === 'none' ? p.muted : p.accent} />
        <Text style={[styles.summaryText, { color: value.key === 'none' ? p.muted : p.accent }]}>
          {value.key === 'none' || !value.date
            ? 'No reminder — it stays in your list'
            : formatDue(value.date.getTime())}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  summaryText: { fontSize: 14, fontWeight: '600' },
});
