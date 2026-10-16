import { Feather } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { fonts, spring, usePalette } from '../theme';
import { T } from './primitives';
import type { IconName } from './primitives';

type Toast = { id: number; text: string; icon?: IconName; action?: { label: string; onPress: () => void } };
type SheetRender = (close: () => void) => ReactNode;

type Overlay = {
  toast: (text: string, opts?: { icon?: IconName; action?: Toast['action'] }) => void;
  openSheet: (render: SheetRender) => void;
  closeSheet: () => void;
};

const OverlayContext = createContext<Overlay | null>(null);

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error('useOverlay outside <OverlayProvider>');
  return ctx;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toastData, setToast] = useState<Toast>();
  const [sheet, setSheet] = useState<{ id: number; render: SheetRender }>();
  const [closeRequest, setCloseRequest] = useState(0);

  const toast = useCallback<Overlay['toast']>((text, opts) => setToast({ id: Date.now(), text, ...opts }), []);
  const openSheet = useCallback((render: SheetRender) => setSheet({ id: Date.now(), render }), []);
  const closeSheet = useCallback(() => setCloseRequest((n) => n + 1), []);
  const value = useMemo(() => ({ toast, openSheet, closeSheet }), [toast, openSheet, closeSheet]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      {sheet ? (
        <Sheet
          key={sheet.id}
          render={sheet.render}
          closeRequest={closeRequest}
          onClosed={() => setSheet(undefined)}
        />
      ) : null}
      <ToastView toast={toastData} onDone={() => setToast(undefined)} />
    </OverlayContext.Provider>
  );
}

function Sheet({
  render,
  closeRequest,
  onClosed,
}: {
  render: SheetRender;
  /** Bumped by closeSheet(); any change after mount closes this sheet. */
  closeRequest: number;
  onClosed: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const y = useSharedValue(screenH);
  const h = useSharedValue(screenH);
  const open = useSharedValue(0);
  const closing = useSharedValue(false);

  const close = useCallback(() => {
    if (closing.get()) return;
    closing.set(true);
    open.set(withTiming(0, { duration: 220 }));
    y.set(withTiming(h.get() + 40, { duration: 240, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) scheduleOnRN(onClosed);
    }));
  }, [closing, h, onClosed, open, y]);

  const [openedAt] = useState(closeRequest);
  useEffect(() => {
    if (closeRequest !== openedAt) close();
  }, [closeRequest, openedAt, close]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close]);

  const pan = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      // Rubber-band when dragged upward.
      y.set(e.translationY > 0 ? e.translationY : e.translationY * 0.15);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > h.get() * 0.3 || e.velocityY > 900) scheduleOnRN(close);
      else y.set(withSpring(0, spring));
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: open.get() * interpolate(y.get(), [0, h.get()], [1, 0.2]),
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          onLayout={(e) => {
            const measured = e.nativeEvent.layout.height;
            if (h.get() === screenH) {
              h.set(measured);
              y.set(measured);
              open.set(withTiming(1, { duration: 260 }));
              y.set(withSpring(0, spring));
            } else {
              h.set(measured);
            }
          }}
          style={[
            styles.sheet,
            { backgroundColor: p.menu, paddingBottom: insets.bottom + 12, borderColor: p.border },
            sheetStyle,
          ]}>
          <View style={[styles.grabber, { backgroundColor: p.fillStrong }]} />
          {render(close)}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function ToastView({ toast, onDone }: { toast?: Toast; onDone: () => void }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const t = useSharedValue(0);

  useEffect(() => {
    if (!toast) return;
    t.set(0);
    t.set(withSpring(1, { damping: 18, stiffness: 220 }));
    const timer = setTimeout(() => {
      t.set(withTiming(0, { duration: 200 }, (done) => {
        if (done) scheduleOnRN(onDone);
      }));
    }, 3200);
    return () => clearTimeout(timer);
  }, [toast, onDone, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.get(),
    transform: [{ translateY: interpolate(t.get(), [0, 1], [-24, 0]) }, { scale: interpolate(t.get(), [0, 1], [0.94, 1]) }],
  }));

  if (!toast) return null;
  const shown = toast;
  return (
    <View style={[styles.toastWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Animated.View style={[styles.toast, { backgroundColor: p.dark ? '#F2F2F2' : '#1A1A19' }, style]}>
        {shown.icon ? <Feather name={shown.icon} size={16} color={p.dark ? '#1A1A19' : '#FFFFFF'} /> : null}
        <T v="label" style={{ color: p.dark ? '#1A1A19' : '#FFFFFF', fontSize: 14 }} numberOfLines={1}>
          {shown.text}
        </T>
        {shown.action ? (
          <Pressable
            hitSlop={12}
            onPress={() => {
              shown.action?.onPress();
              t.set(withTiming(0, { duration: 160 }, (done) => {
                if (done) scheduleOnRN(onDone);
              }));
            }}>
            <T v="label" style={{ color: p.dark ? '#0081F2' : '#6CB8FF', fontFamily: fonts.semibold, fontSize: 14 }}>
              {shown.action.label}
            </T>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -6 },
    elevation: 24,
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 6 },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
});
