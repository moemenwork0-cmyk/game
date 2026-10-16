import { Feather } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { radius, usePalette } from '../theme';

export type IconName = ComponentProps<typeof Feather>['name'];

type ButtonProps = {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'ink' | 'accent' | 'soft' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, icon, onPress, variant = 'ink', size = 'md', disabled, style }: ButtonProps) {
  const p = usePalette();
  const colors = {
    ink: [p.ink, p.onInk],
    accent: [p.accent, p.onAccent],
    soft: [p.surfaceAlt, p.text],
    danger: [p.dangerSoft, p.danger],
    success: [p.successSoft, p.success],
  }[variant];
  const h = { sm: 34, md: 46, lg: 56 }[size];
  const fs = { sm: 13, md: 15, lg: 16 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        styles.button,
        {
          height: h,
          paddingHorizontal: size === 'sm' ? 12 : 20,
          backgroundColor: colors[0],
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        style,
      ]}>
      {icon ? <Feather name={icon} size={fs + 2} color={colors[1]} /> : null}
      <Text style={[styles.buttonText, { color: colors[1], fontSize: fs }]}>{label}</Text>
    </Pressable>
  );
}

type ChipProps = { label: string; icon?: IconName; selected?: boolean; onPress: () => void };

export function Chip({ label, icon, selected, onPress }: ChipProps) {
  const p = usePalette();
  const fg = selected ? p.onInk : p.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? p.ink : p.surface,
          borderColor: selected ? p.ink : p.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      {icon ? <Feather name={icon} size={14} color={fg} /> : null}
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: p.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}>
      <Feather name={icon} size={18} color={p.text} />
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={[styles.section, { color: p.muted }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.pill,
  },
  buttonText: { fontWeight: '600', letterSpacing: -0.2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
});
