import { Feather } from '@expo/vector-icons';
import { Image, View } from 'react-native';

import { usePalette } from '../theme';

export function Thumb({ uri, size = 52, done }: { uri?: string; size?: number; done?: boolean }) {
  const p = usePalette();
  const r = size * 0.3;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r, backgroundColor: p.surfaceAlt }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: done ? p.successSoft : p.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Feather name={done ? 'check' : 'rotate-ccw'} size={size * 0.4} color={done ? p.success : p.accent} />
    </View>
  );
}
