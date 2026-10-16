import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme';
import type { IconName } from './ui';

export function Empty({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const p = usePalette();
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, { borderColor: p.border }]}>
        <View style={[styles.circle, { backgroundColor: p.accentSoft }]}>
          <Feather name={icon} size={30} color={p.accent} />
        </View>
      </View>
      <Text style={[styles.title, { color: p.text }]}>{title}</Text>
      <Text style={[styles.body, { color: p.muted }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 72, gap: 8 },
  ring: { padding: 10, borderRadius: 60, borderWidth: 1, marginBottom: 14 },
  circle: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  body: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
});
