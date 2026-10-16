import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Platform, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickPhoto } from '../../photos';
import { useStore } from '../../store';
import { fonts, usePalette } from '../../theme';
import { formatWhen, relative, shortWhen } from '../../time';
import type { UndoItem } from '../../types';
import { useNow } from '../../useNow';
import { useOverlay } from '../../ui/Overlay';
import { ConfirmSheet, MenuRow, PhotoSheet, ReminderSheet, SheetTitle } from '../../ui/Sheets';
import { Button, Hairline, IconButton, Press, T, haptic } from '../../ui/primitives';
import type { IconName } from '../../ui/primitives';

const HOUR = 3600e3;
const webInput = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const item = store.items.find((it) => it.id === id);
  const p = usePalette();
  const insets = useSafeAreaInsets();

  if (!item) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: p.bg }]}>
        <T v="heading">This item is gone</T>
        <Button label="Back" kind="ghost" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </View>
    );
  }
  return <Item item={item} topInset={insets.top} bottomInset={insets.bottom} />;
}

function Item({ item, topInset, bottomInset }: { item: UndoItem; topInset: number; bottomInset: number }) {
  const p = usePalette();
  const store = useStore();
  const overlay = useOverlay();
  const [title, setTitle] = useState(item.title);
  const [note, setNote] = useState(item.note ?? '');
  const now = useNow();
  const done = !!item.restoredAt;
  const overdue = !done && !!item.remindAt && item.remindAt <= now;

  const saveText = () => {
    const t = title.trim();
    if (!t) return setTitle(item.title);
    if (t !== item.title || note.trim() !== (item.note ?? '')) {
      store.update(item.id, { title: t, note: note.trim() || undefined });
    }
  };

  const status: { icon: IconName; text: string; tone: 'danger' | 'success' | 'secondary' } = done
    ? { icon: 'check-circle', text: `Restored ${relative(item.restoredAt!, now)}`, tone: 'success' }
    : overdue
      ? { icon: 'alert-circle', text: `Overdue · ${relative(item.remindAt!, now)}`, tone: 'danger' }
      : item.remindAt
        ? { icon: 'bell', text: `Reminder ${shortWhen(item.remindAt)}`, tone: 'secondary' }
        : { icon: 'clock', text: 'No reminder', tone: 'secondary' };
  const statusBg = status.tone === 'danger' ? p.dangerSoft : status.tone === 'success' ? p.successSoft : p.fill;
  const statusFg = status.tone === 'danger' ? p.danger : status.tone === 'success' ? p.success : p.secondary;

  const editPhoto = () => {
    haptic.tap();
    overlay.openSheet((close) => (
      <PhotoSheet
        close={close}
        onPick={async (source) => {
          const uri = await pickPhoto(source);
          if (uri) store.update(item.id, { photoUri: uri });
        }}
        onRemove={item.photoUri ? () => store.update(item.id, { photoUri: undefined }) : undefined}
      />
    ));
  };

  const editReminder = () => {
    haptic.tap();
    overlay.openSheet((close) => (
      <ReminderSheet
        value={item.remindAt}
        close={close}
        onPick={(remindAt) => {
          store.update(item.id, { remindAt });
          overlay.toast(remindAt ? `Reminder set for ${shortWhen(remindAt)}` : 'Reminder removed', { icon: 'bell' });
        }}
      />
    ));
  };

  const confirmDelete = () =>
    overlay.openSheet((close) => (
      <ConfirmSheet
        title="Delete this item?"
        message={`"${item.title}" and its reminders will be removed.`}
        action="Delete"
        close={close}
        onConfirm={() => {
          router.back();
          setTimeout(() => store.remove(item.id), 250);
        }}
      />
    ));

  const more = () => {
    haptic.tap();
    overlay.openSheet((close) => (
      <View>
        <SheetTitle title="Options" />
        {!done ? (
          <>
            <MenuRow icon="clock" label="Snooze 1 hour" onPress={() => { close(); snooze(HOUR); }} />
            <MenuRow icon="sunrise" label="Snooze until tomorrow" onPress={() => { close(); snooze(tomorrowNine() - Date.now()); }} />
          </>
        ) : null}
        <MenuRow icon="trash-2" label="Delete" danger onPress={() => { close(); setTimeout(confirmDelete, 280); }} />
      </View>
    ));
  };

  const snooze = (ms: number) => {
    store.snooze(item.id, ms);
    overlay.toast(`Snoozed until ${shortWhen(Date.now() + ms)}`, { icon: 'clock' });
  };

  const restore = () => {
    haptic.success();
    store.restore(item.id);
    overlay.toast('Marked as restored', { icon: 'check-circle', action: { label: 'Undo', onPress: () => store.reopen(item.id) } });
    router.back();
  };

  return (
    <View style={[styles.fill, { backgroundColor: p.bg }]}>
      <View style={[styles.bar, { paddingTop: topInset }]}>
        <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
        <IconButton icon="more-horizontal" label="Options" onPress={more} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={120}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 120 }}>
        <Animated.View entering={FadeIn.duration(250)} style={[styles.status, { backgroundColor: statusBg }]}>
          <Feather name={status.icon} size={13} color={statusFg} />
          <T v="label" style={{ color: statusFg, fontSize: 12 }}>
            {status.text}
          </T>
        </Animated.View>

        <TextInput
          value={title}
          onChangeText={setTitle}
          onEndEditing={saveText}
          onBlur={saveText}
          multiline
          maxLength={160}
          placeholder="What did you change?"
          placeholderTextColor={p.tertiary}
          style={[styles.title, { color: p.text }, webInput]}
        />
        <TextInput
          value={note}
          onChangeText={setNote}
          onEndEditing={saveText}
          onBlur={saveText}
          multiline
          maxLength={500}
          placeholder="Add how to put it back…"
          placeholderTextColor={p.tertiary}
          style={[styles.note, { color: p.secondary }, webInput]}
        />

        <Animated.View entering={FadeInDown.delay(60).springify().damping(20)}>
          {item.photoUri ? (
            <Press onPress={editPhoto} scaleTo={0.98}>
              <Image source={{ uri: item.photoUri }} style={[styles.photo, { backgroundColor: p.fill }]} />
              <View style={[styles.photoBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <Feather name="camera" size={12} color="#fff" />
                <T v="caption" style={{ color: '#fff', fontSize: 12 }}>
                  Before
                </T>
              </View>
            </Press>
          ) : (
            <Press onPress={editPhoto} scaleTo={0.98} style={[styles.addPhoto, { borderColor: p.borderStrong }]}>
              <View style={[styles.addPhotoIcon, { backgroundColor: p.fill }]}>
                <Feather name="camera" size={18} color={p.secondary} />
              </View>
              <T v="label" tone="secondary">
                Add a before photo
              </T>
            </Press>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(120).springify().damping(20)}
          style={[styles.info, { backgroundColor: p.card, borderColor: p.border }]}>
          <InfoRow
            icon="bell"
            label="Reminder"
            value={item.remindAt ? formatWhen(item.remindAt) : 'None'}
            danger={overdue}
            onPress={done ? undefined : editReminder}
          />
          <Hairline style={{ marginLeft: 48 }} />
          <InfoRow icon="edit-3" label="Changed" value={formatWhen(item.createdAt)} />
          {done ? (
            <>
              <Hairline style={{ marginLeft: 48 }} />
              <InfoRow icon="check-circle" label="Restored" value={formatWhen(item.restoredAt!)} />
            </>
          ) : null}
        </Animated.View>
      </KeyboardAwareScrollView>

      <View style={[styles.actions, { paddingBottom: bottomInset + 12 }]}>
        <LinearGradient
          colors={[p.dark ? 'rgba(23,23,24,0)' : 'rgba(248,248,247,0)', p.bg]}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {done ? (
          <Button
            label="Move back to pending"
            icon="rotate-ccw"
            kind="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              haptic.light();
              store.reopen(item.id);
              overlay.toast('Back in your list', { icon: 'rotate-ccw' });
            }}
          />
        ) : (
          <>
            <Button label="Snooze" icon="clock" kind="secondary" onPress={() => snooze(HOUR)} />
            <Button label="Mark as restored" icon="check" onPress={restore} style={{ flex: 1 }} />
          </>
        )}
      </View>
    </View>
  );
}

function tomorrowNine() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

function InfoRow({
  icon,
  label,
  value,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  const p = usePalette();
  return (
    <Press onPress={onPress} disabled={!onPress} scaleTo={0.98} style={styles.infoRow}>
      <Feather name={icon} size={17} color={p.tertiary} />
      <T v="body" tone="secondary" style={{ width: 84 }}>
        {label}
      </T>
      <T v="bodyMedium" tone={danger ? 'danger' : 'text'} style={{ flex: 1, textAlign: 'right', fontFamily: fonts.medium }} numberOfLines={1}>
        {value}
      </T>
      {onPress ? <Feather name="chevron-right" size={16} color={p.disabled} /> : null}
    </Press>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, height: 56 },
  status: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    marginTop: 12,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 26,
    lineHeight: 36,
    letterSpacing: -0.3,
    marginTop: 14,
    paddingVertical: 2,
    paddingHorizontal: 0,
    textAlignVertical: 'top',
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 0,
    minHeight: 30,
    textAlignVertical: 'top',
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 22, marginTop: 22 },
  photoBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
  },
  addPhoto: {
    marginTop: 22,
    height: 110,
    borderRadius: 22,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  addPhotoIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  info: { marginTop: 18, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 54 },
  actions: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 24 },
});
