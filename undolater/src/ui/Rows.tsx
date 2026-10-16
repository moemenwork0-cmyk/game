import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { fonts, spring, usePalette } from '../theme';
import { dueLabel, relative } from '../time';
import type { UndoItem } from '../types';
import { Press, T, haptic } from './primitives';

const SWIPE_DONE = 96;

export function Thumb({ uri, size = 44, done }: { uri?: string; size?: number; done?: boolean }) {
  const p = usePalette();
  const r = Math.round(size * 0.28);
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r, backgroundColor: p.fill }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: done ? p.successSoft : p.fill, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={done ? 'check' : 'rotate-ccw'} size={size * 0.4} color={done ? p.success : p.secondary} />
    </View>
  );
}

/** A pending change. Swipe right or tap "Restored" to complete it. */
export function PendingRow({
  item,
  now,
  onOpen,
  onRestore,
}: {
  item: UndoItem;
  now: number;
  onOpen: () => void;
  onRestore: () => void;
}) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const check = useSharedValue(0);
  const armed = useSharedValue(0);
  const [done, setDone] = useState(false);
  const overdue = item.remindAt !== undefined && item.remindAt <= now;

  const finish = () => {
    if (done) return;
    setDone(true);
    haptic.success();
    check.set(withSpring(1, { damping: 14, stiffness: 260 }));
    // Let the check land before the row leaves the list.
    setTimeout(onRestore, 420);
  };

  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      const t = Math.max(0, e.translationX);
      x.set(t < SWIPE_DONE ? t : SWIPE_DONE + (t - SWIPE_DONE) * 0.35);
      const isArmed = x.get() >= SWIPE_DONE ? 1 : 0;
      if (isArmed !== armed.get()) {
        armed.set(isArmed);
        scheduleOnRN(haptic.tap);
      }
    },
    onDeactivate: () => {
      'worklet';
      if (x.get() >= SWIPE_DONE) {
        x.set(withTiming(width, { duration: 260 }));
        scheduleOnRN(finish);
      } else {
        x.set(withSpring(0, spring));
      }
      armed.set(0);
    },
  });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const underlay = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, 24, SWIPE_DONE], [0, 0.6, 1], Extrapolation.CLAMP),
    backgroundColor: interpolateColor(x.get(), [0, SWIPE_DONE], [p.successSoft, p.success]),
  }));
  const underIcon = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(x.get(), [20, SWIPE_DONE], [0.6, 1.1], Extrapolation.CLAMP) }],
  }));
  const pill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(check.get(), [0, 1], [overdue ? p.button : p.card, p.success]),
    borderColor: interpolateColor(check.get(), [0, 1], [overdue ? p.button : p.borderStrong, p.success]),
  }));
  const pillCheck = useAnimatedStyle(() => ({ transform: [{ scale: 1 + check.get() * 0.15 }] }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: 1 - check.get() * 0.5 }));

  const meta = item.remindAt
    ? overdue
      ? `Overdue · ${relative(item.remindAt, now)}`
      : dueLabel(item.remindAt, now)
    : `Added ${relative(item.createdAt, now)}`;
  const fg = overdue ? p.onButton : p.text;

  return (
    <View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.under, underlay]}>
        <Animated.View style={[styles.underInner, underIcon]}>
          <Feather name="check" size={20} color="#fff" />
          <T v="label" style={{ color: '#fff' }}>
            Restored
          </T>
        </Animated.View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          <Press
            onPress={onOpen}
            scaleTo={0.985}
            style={[styles.card, { backgroundColor: p.card, borderColor: overdue ? 'rgba(235,77,77,0.28)' : p.border }]}>
            <Thumb uri={item.photoUri} />
            <Animated.View style={[styles.text, titleStyle]}>
              <T
                v="bodyMedium"
                numberOfLines={2}
                style={done ? { textDecorationLine: 'line-through' } : undefined}>
                {item.title}
              </T>
              <View style={styles.meta}>
                <Feather
                  name={item.remindAt ? (overdue ? 'alert-circle' : 'bell') : 'clock'}
                  size={12}
                  color={overdue ? p.danger : p.tertiary}
                />
                <T v="caption" tone={overdue ? 'danger' : 'tertiary'} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {meta}
                </T>
              </View>
            </Animated.View>
            <Press onPress={finish} hitSlop={8} scaleTo={0.9} accessibilityLabel="Restored" accessibilityRole="button">
              <Animated.View style={[styles.pill, pill]}>
                <Animated.View style={pillCheck}>
                  <Feather name="check" size={14} color={done ? '#fff' : fg} />
                </Animated.View>
                <T v="label" style={{ color: done ? '#fff' : fg, fontFamily: fonts.medium }}>
                  {done ? 'Done' : 'Restored'}
                </T>
              </Animated.View>
            </Press>
          </Press>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function HistoryRow({ item, now, onOpen }: { item: UndoItem; now: number; onOpen: () => void }) {
  return (
    <Press onPress={onOpen} scaleTo={0.98} style={styles.historyRow}>
      <Thumb uri={item.photoUri} size={36} done />
      <View style={styles.text}>
        <T v="label" numberOfLines={1} style={{ fontSize: 14 }}>
          {item.title}
        </T>
        <T v="caption" tone="tertiary" numberOfLines={1} style={{ fontSize: 12 }}>
          Restored {relative(item.restoredAt ?? now, now)}
        </T>
      </View>
    </Press>
  );
}


const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    paddingRight: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  under: { borderRadius: 18, justifyContent: 'center', paddingLeft: 20 },
  underInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
});
