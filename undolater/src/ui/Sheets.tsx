import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { permissionState, sendTestNotification } from '../notifications';
import type { PermissionState } from '../notifications';
import { useSettings } from '../settings';
import type { Settings } from '../settings';
import { fonts, usePalette } from '../theme';
import { formatWhen, reminderPresets, shortWhen } from '../time';
import { Button, Hairline, Press, T, haptic } from './primitives';
import type { IconName } from './primitives';

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function toLocalInput(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SheetTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.titleWrap}>
      <T v="heading">{title}</T>
      {subtitle ? (
        <T v="caption" tone="tertiary" style={{ marginTop: 2 }}>
          {subtitle}
        </T>
      ) : null}
    </View>
  );
}

export function MenuRow({
  icon,
  label,
  detail,
  selected,
  danger,
  onPress,
  right,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  selected?: boolean;
  danger?: boolean;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <Press onPress={onPress} disabled={!onPress} scaleTo={0.98} style={styles.row} accessibilityRole="button">
      <View style={[styles.rowIcon, { backgroundColor: danger ? p.dangerSoft : p.fill }]}>
        <Feather name={icon} size={17} color={danger ? p.danger : p.text} />
      </View>
      <T v="bodyMedium" tone={danger ? 'danger' : 'text'} style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </T>
      {detail ? (
        <T v="caption" tone="tertiary" numberOfLines={1}>
          {detail}
        </T>
      ) : null}
      {right}
      {selected ? (
        <Animated.View entering={FadeIn.duration(150)}>
          <Feather name="check" size={18} color={p.text} />
        </Animated.View>
      ) : null}
    </Press>
  );
}

/** "When should we remind you?" — presets, a custom time, or none. */
export function ReminderSheet({
  value,
  onPick,
  close,
}: {
  value?: number;
  onPick: (remindAt: number | undefined) => void;
  close: () => void;
}) {
  const p = usePalette();
  const [presets] = useState(() => reminderPresets());
  const [custom, setCustom] = useState<Date | null>(null);
  const near = (a?: number, b?: number) => a !== undefined && b !== undefined && Math.abs(a - b) < 60_000;
  const isPreset = presets.some((x) => near(x.date.getTime(), value));

  const pick = (at: number | undefined) => {
    haptic.tap();
    onPick(at);
    close();
  };

  const openCustom = () => {
    const start = value && value > Date.now() ? new Date(value) : presets[0].date;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        value: start,
        minimumDate: new Date(),
        onValueChange: (_e, day) =>
          DateTimePickerAndroid.open({
            mode: 'time',
            value: day,
            onValueChange: (_e2, time) => pick(time.getTime()),
          }),
      });
    } else {
      setCustom(start);
    }
  };

  return (
    <View>
      <SheetTitle title="Remind me" subtitle="We'll nudge you with a gentle chime." />
      {presets.map((preset) => (
        <MenuRow
          key={preset.key}
          icon={preset.icon}
          label={preset.label}
          detail={shortWhen(preset.date.getTime())}
          selected={near(preset.date.getTime(), value)}
          onPress={() => pick(preset.date.getTime())}
        />
      ))}
      <MenuRow
        icon="edit-3"
        label="Pick date & time"
        detail={value && !isPreset ? shortWhen(value) : undefined}
        selected={!!value && !isPreset}
        onPress={openCustom}
      />
      <MenuRow icon="bell-off" label="No reminder" selected={!value} onPress={() => pick(undefined)} />

      {custom ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.custom}>
          <Hairline style={{ marginBottom: 12 }} />
          {Platform.OS === 'web' ? (
            createElement('input', {
              type: 'datetime-local',
              value: toLocalInput(custom),
              min: toLocalInput(new Date()),
              onChange: (e: { target: { value: string } }) => {
                const d = new Date(e.target.value);
                if (!Number.isNaN(d.getTime())) setCustom(d);
              },
              style: {
                font: 'inherit',
                fontSize: 15,
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${p.borderStrong}`,
                background: p.card,
                color: p.text,
                colorScheme: p.dark ? 'dark' : 'light',
              },
            })
          ) : (
            <DateTimePicker
              value={custom}
              mode="datetime"
              display="inline"
              minimumDate={new Date()}
              onValueChange={(_e, d) => setCustom(d)}
            />
          )}
          <Button
            label={`Remind me ${formatWhen(custom.getTime()).replace(',', '')}`}
            onPress={() => pick(custom.getTime())}
            style={{ marginTop: 12 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function PhotoSheet({
  onPick,
  onRemove,
  close,
}: {
  onPick: (source: 'camera' | 'library') => void;
  onRemove?: () => void;
  close: () => void;
}) {
  const go = (fn: () => void) => {
    close();
    // Let the sheet slide away before the system picker covers the screen.
    setTimeout(fn, 260);
  };
  return (
    <View>
      <SheetTitle title="Before photo" subtitle="A quick snap of how it was makes restoring easy." />
      {Platform.OS !== 'web' ? <MenuRow icon="camera" label="Take photo" onPress={() => go(() => onPick('camera'))} /> : null}
      <MenuRow icon="image" label="Choose from library" onPress={() => go(() => onPick('library'))} />
      {onRemove ? <MenuRow icon="trash-2" label="Remove photo" danger onPress={() => go(onRemove)} /> : null}
    </View>
  );
}

export function ConfirmSheet({
  title,
  message,
  action,
  onConfirm,
  close,
}: {
  title: string;
  message: string;
  action: string;
  onConfirm: () => void;
  close: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 4 }}>
      <T v="heading" style={{ marginTop: 10 }}>
        {title}
      </T>
      <T v="body" tone="secondary" style={{ marginTop: 6 }}>
        {message}
      </T>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
        <Button label="Cancel" kind="ghost" onPress={close} style={{ flex: 1 }} />
        <Button
          label={action}
          kind="danger"
          onPress={() => {
            haptic.warn();
            close();
            onConfirm();
          }}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const FOLLOW_UPS: { value: Settings['followUpHours']; label: string }[] = [
  { value: 0, label: 'Off' },
  { value: 1, label: 'Every hour' },
  { value: 3, label: 'Every 3 hours' },
];

export function SettingsSheet({ onTest }: { onTest: (ok: boolean) => void }) {
  const p = usePalette();
  const { settings, update } = useSettings();
  const [perm, setPerm] = useState<PermissionState>('undetermined');

  useEffect(() => {
    permissionState().then(setPerm).catch(() => {});
  }, []);

  return (
    <View>
      <SheetTitle title="Notifications" subtitle="How UndoLater reminds you." />
      {perm === 'denied' ? (
        <Press onPress={() => Linking.openSettings()} style={[styles.banner, { backgroundColor: p.dangerSoft }]}>
          <Feather name="bell-off" size={16} color={p.danger} />
          <T v="label" tone="danger" style={{ flex: 1 }}>
            Notifications are turned off for UndoLater. Tap to open settings.
          </T>
        </Press>
      ) : null}
      <MenuRow
        icon="music"
        label="Reminder chime"
        right={
          <Switch
            value={settings.sound}
            onValueChange={(sound) => {
              haptic.tap();
              update({ sound });
            }}
            trackColor={{ true: p.success, false: p.fillStrong }}
            thumbColor="#FFFFFF"
          />
        }
      />
      <View style={styles.row}>
        <View style={[styles.rowIcon, { backgroundColor: p.fill }]}>
          <Feather name="repeat" size={17} color={p.text} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="bodyMedium">Nudge again if still pending</T>
          <T v="caption" tone="tertiary">
            Up to 3 gentle follow-ups
          </T>
        </View>
      </View>
      <View style={[styles.segment, { backgroundColor: p.fill }]}>
        {FOLLOW_UPS.map((o) => {
          const active = settings.followUpHours === o.value;
          return (
            <Press
              key={o.value}
              scaleTo={0.97}
              onPress={() => {
                haptic.tap();
                update({ followUpHours: o.value });
              }}
              style={[styles.segmentItem, active && { backgroundColor: p.card, borderColor: p.border, borderWidth: 1 }]}>
              <T v="label" tone={active ? 'text' : 'tertiary'} style={active ? { fontFamily: fonts.semibold } : null}>
                {o.label}
              </T>
            </Press>
          );
        })}
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
        <Button
          label="Send a test notification"
          icon="bell"
          kind="secondary"
          onPress={async () => {
            haptic.light();
            const ok = await sendTestNotification(settings);
            setPerm(await permissionState());
            onTest(ok);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleWrap: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, minHeight: 56 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  custom: { paddingHorizontal: 20, paddingTop: 8 },
  banner: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segment: { marginHorizontal: 20, marginTop: 4, padding: 4, borderRadius: 14, flexDirection: 'row' },
  segmentItem: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
