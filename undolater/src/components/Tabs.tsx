import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, usePalette } from '../theme';

type Tab<K extends string> = { key: K; label: string; count?: number };

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Tab<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, tabs.findIndex((t) => t.key === value));
  const [x] = useState(() => new Animated.Value(index));

  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  }, [index, x]);

  const tabWidth = width / tabs.length;
  return (
    <View
      style={[styles.wrap, { backgroundColor: p.surfaceAlt }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 8)}
      accessibilityRole="tablist">
      {width > 0 ? (
        <Animated.View
          style={[
            styles.indicator,
            {
              width: tabWidth,
              backgroundColor: p.raised,
              transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, tabWidth] }) }],
            },
          ]}
        />
      ) : null}
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            style={styles.tab}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}>
            <Text style={[styles.label, { color: active ? p.text : p.muted }]}>{t.label}</Text>
            {t.count ? (
              <View style={[styles.badge, { backgroundColor: active ? p.accent : p.border }]}>
                <Text style={[styles.badgeText, { color: active ? p.onAccent : p.muted }]}>{t.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, height: 46 },
  indicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
