import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { radius, usePalette } from '../theme';

export type ToastData = { id: number; text: string; action?: { label: string; onPress: () => void } };

export function Toast({ toast, bottom, onHide }: { toast?: ToastData; bottom: number; onHide: () => void }) {
  const p = usePalette();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(onHide);
    }, 3500);
    return () => clearTimeout(t);
  }, [toast, anim, onHide]);

  if (!toast) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          bottom,
          backgroundColor: p.ink,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        },
      ]}>
      <Text style={[styles.text, { color: p.onInk }]} numberOfLines={1}>
        {toast.text}
      </Text>
      {toast.action ? (
        <Pressable
          onPress={() => {
            toast.action?.onPress();
            onHide();
          }}
          hitSlop={10}>
          <Text style={[styles.action, { color: p.onInkAccent }]}>{toast.action.label}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  action: { fontSize: 15, fontWeight: '700' },
});
