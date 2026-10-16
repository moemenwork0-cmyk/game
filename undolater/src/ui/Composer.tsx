import { Feather } from '@expo/vector-icons';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, TextInput, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated';

import { deletePhoto, pickPhoto } from '../photos';
import { fonts, usePalette } from '../theme';
import { reminderPresets, shortWhen } from '../time';
import type { Draft } from '../types';
import { useOverlay } from './Overlay';
import { PhotoSheet, ReminderSheet } from './Sheets';
import { Press, T, haptic } from './primitives';

export type ComposerHandle = { fill: (text: string) => void; focus: () => void };

function defaultReminder(): number {
  const presets = reminderPresets();
  return (presets.find((p) => p.key === 'tonight') ?? presets.find((p) => p.key === 'tomorrow')!).date.getTime();
}

/** The always-there input at the bottom of the home screen: type, attach, pick a time, send. */
export const Composer = forwardRef<ComposerHandle, { onSubmit: (draft: Draft) => void }>(function Composer(
  { onSubmit },
  ref,
) {
  const p = usePalette();
  const overlay = useOverlay();
  const input = useRef<TextInputInstance>(null);
  const [text, setText] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [remindAt, setRemindAt] = useState<number | undefined>(defaultReminder);
  const [focused, setFocused] = useState(false);
  const canSend = text.trim().length > 0;

  useImperativeHandle(ref, () => ({
    fill: (t) => {
      setText(t);
      input.current?.focus();
    },
    focus: () => input.current?.focus(),
  }));

  const active = useDerivedValue(() => withSpring(canSend ? 1 : 0, { damping: 16, stiffness: 260 }), [canSend]);
  const sendStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(active.get(), [0, 1], [p.fillStrong, p.button]),
    transform: [{ scale: 0.88 + active.get() * 0.12 }],
  }));
  const ring = useDerivedValue(() => withSpring(focused ? 1 : 0, { damping: 20, stiffness: 200 }), [focused]);
  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(ring.get(), [0, 1], [p.border, p.borderStrong]),
    shadowOpacity: 0.05 + ring.get() * 0.06,
  }));

  const send = () => {
    if (!canSend) return;
    haptic.light();
    onSubmit({ title: text.trim(), photoUri, remindAt });
    setText('');
    setPhotoUri(undefined);
    setRemindAt(defaultReminder());
  };

  const attach = () => {
    haptic.tap();
    input.current?.blur();
    overlay.openSheet((close) => (
      <PhotoSheet
        close={close}
        onPick={async (source) => {
          const uri = await pickPhoto(source);
          if (!uri) return;
          if (photoUri) deletePhoto(photoUri);
          setPhotoUri(uri);
        }}
      />
    ));
  };

  const chooseTime = () => {
    haptic.tap();
    input.current?.blur();
    overlay.openSheet((close) => <ReminderSheet value={remindAt} onPick={setRemindAt} close={close} />);
  };

  return (
    <Animated.View layout={LinearTransition.springify().damping(22)} style={[styles.card, { backgroundColor: p.card }, cardStyle]}>
      {photoUri ? (
        <Animated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(160)} style={styles.photoWrap}>
          <Image source={{ uri: photoUri }} style={[styles.photo, { backgroundColor: p.fill }]} />
          <Press
            accessibilityLabel="Remove photo"
            hitSlop={8}
            scaleTo={0.85}
            onPress={() => {
              deletePhoto(photoUri);
              setPhotoUri(undefined);
            }}
            style={[styles.removePhoto, { backgroundColor: p.button }]}>
            <Feather name="x" size={12} color={p.onButton} />
          </Press>
        </Animated.View>
      ) : null}
      <TextInput
        ref={input}
        value={text}
        onChangeText={setText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="What did you change?"
        placeholderTextColor={p.tertiary}
        multiline
        maxLength={160}
        style={[styles.input, { color: p.text }, Platform.select({ web: { outlineStyle: 'none' } as object })]}
        submitBehavior="blurAndSubmit"
        returnKeyType="send"
        onSubmitEditing={send}
      />
      <View style={styles.bar}>
        <Press
          onPress={attach}
          scaleTo={0.88}
          accessibilityLabel="Add a photo"
          style={[styles.round, { borderColor: p.borderStrong }]}>
          <Feather name={photoUri ? 'image' : 'plus'} size={18} color={p.text} />
        </Press>
        <Press onPress={chooseTime} scaleTo={0.94} accessibilityLabel="Reminder time" style={[styles.chip, { backgroundColor: p.fill }]}>
          <Feather name={remindAt ? 'bell' : 'bell-off'} size={14} color={p.secondary} />
          <Animated.View key={remindAt ?? 'none'} entering={FadeIn.duration(180)} exiting={FadeOut.duration(80)}>
            <T v="label" tone="secondary" numberOfLines={1}>
              {remindAt ? shortWhen(remindAt) : 'No reminder'}
            </T>
          </Animated.View>
        </Press>
        <View style={{ flex: 1 }} />
        <Press onPress={send} disabled={!canSend} scaleTo={0.85} accessibilityLabel="Save">
          <Animated.View style={[styles.send, sendStyle]}>
            <Feather name="arrow-up" size={18} color={canSend ? p.onButton : p.disabled} />
          </Animated.View>
        </Press>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 6,
    paddingHorizontal: 10,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  photoWrap: { marginTop: 6, marginLeft: 4, alignSelf: 'flex-start' },
  photo: { width: 64, height: 64, borderRadius: 14 },
  removePhoto: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 6,
    textAlignVertical: 'top',
  },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  round: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, maxWidth: 200 },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
