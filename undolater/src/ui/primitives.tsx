import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps, StyleProp, TextProps, TextStyle, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { fonts, usePalette } from '../theme';
import type { Palette } from '../theme';

export type IconName = ComponentProps<typeof Feather>['name'];

export const haptic = {
  tap: () => Platform.OS !== 'web' && Haptics.selectionAsync().catch(() => {}),
  light: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () =>
    Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warn: () =>
    Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
};

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyMedium' | 'label' | 'caption' | 'overline';
type Tone = 'text' | 'secondary' | 'tertiary' | 'disabled' | 'danger' | 'success' | 'blue' | 'onButton';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 40, letterSpacing: -0.4 },
  title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 33, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
};

export function T({
  v = 'body',
  tone = 'text',
  style,
  ...rest
}: TextProps & { v?: Variant; tone?: Tone; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return <Text {...rest} style={[variants[v], { color: p[tone] }, style]} />;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that springs down slightly while held. */
export function Press({
  style,
  scaleTo = 0.96,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: ReactNode;
}) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        s.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.set(withSpring(1, { damping: 14, stiffness: 300 }));
        onPressOut?.(e);
      }}
      style={[style, anim]}>
      {children}
    </AnimatedPressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 40,
  filled,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  filled?: boolean;
  color?: string;
}) {
  const p = usePalette();
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      scaleTo={0.9}
      style={[
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        filled && { backgroundColor: p.fill },
      ]}>
      <Feather name={icon} size={20} color={color ?? p.text} />
    </Press>
  );
}

type ButtonProps = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function Button({ label, icon, onPress, kind = 'primary', style, disabled }: ButtonProps) {
  const p = usePalette();
  const look = buttonLook(p, kind);
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, look.box, disabled && { opacity: 0.4 }, style]}>
      {icon ? <Feather name={icon} size={17} color={look.fg} /> : null}
      <Text style={[styles.buttonText, { color: look.fg }]}>{label}</Text>
    </Press>
  );
}

function buttonLook(p: Palette, kind: ButtonProps['kind']) {
  switch (kind) {
    case 'secondary':
      return { box: { backgroundColor: p.card, borderColor: p.borderStrong, borderWidth: 1 }, fg: p.text };
    case 'ghost':
      return { box: { backgroundColor: p.fill }, fg: p.text };
    case 'danger':
      return { box: { backgroundColor: p.dangerSoft }, fg: p.danger };
    default:
      return { box: { backgroundColor: p.button }, fg: p.onButton };
  }
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <Animated.View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: p.borderStrong }, style]} />;
}

const styles = StyleSheet.create({
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  button: {
    height: 50,
    borderRadius: 999,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: { fontFamily: fonts.medium, fontSize: 15, letterSpacing: -0.1 },
});
