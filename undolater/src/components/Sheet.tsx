import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
};

/** A full-height sheet: native page sheet on iOS, slide-up screen elsewhere. */
export function Sheet({ visible, onClose, title, left, right, children }: Props) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const ios = Platform.OS === 'ios';
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={ios ? 'pageSheet' : 'fullScreen'}
      statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.fill, { backgroundColor: p.bg }]}
        behavior={ios ? 'padding' : undefined}>
        {ios ? <View style={[styles.grabber, { backgroundColor: p.faint }]} /> : null}
        <View style={[styles.header, { paddingTop: ios ? 10 : insets.top + 8 }]}>
          <View style={styles.side}>{left}</View>
          <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
        </View>
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginTop: 8, opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, minHeight: 52 },
  side: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center', flex: 2 },
});
