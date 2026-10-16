import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { permissionState } from '../notifications';
import { splitItems, useStore } from '../store';
import { softSpring, usePalette } from '../theme';
import { greeting, shortWhen } from '../time';
import { useNow } from '../useNow';
import type { Draft } from '../types';
import { Composer } from '../ui/Composer';
import type { ComposerHandle } from '../ui/Composer';
import { useOverlay } from '../ui/Overlay';
import { PendingRow } from '../ui/Rows';
import { ConfirmSheet, SettingsSheet } from '../ui/Sheets';
import { Sidebar } from '../ui/Sidebar';
import { IconButton, Press, T, haptic } from '../ui/primitives';
import type { IconName } from '../ui/primitives';

const SUGGESTIONS: { icon: IconName; text: string }[] = [
  { icon: 'home', text: 'Moved the sofa for the party' },
  { icon: 'thermometer', text: 'Turned the heating down' },
  { icon: 'key', text: 'Lent my spare key' },
  { icon: 'wifi', text: 'Switched on guest Wi-Fi' },
  { icon: 'smartphone', text: 'Changed a phone setting' },
];

export default function Home() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const store = useStore();
  const overlay = useOverlay();
  const { pending, history } = useMemo(() => splitItems(store.items), [store.items]);
  const composer = useRef<ComposerHandle>(null);
  const now = useNow();
  const [composerH, setComposerH] = useState(120);
  const overdue = pending.filter((it) => it.remindAt && it.remindAt <= now).length;
  const next = pending.find((it) => it.remindAt && it.remindAt > now);

  // ── Sidebar ────────────────────────────────────────────────────────────
  const drawerW = Math.min(width * 0.84, 340);
  const drawer = useSharedValue(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => {
    haptic.tap();
    Keyboard.dismiss();
    setDrawerOpen(true);
    drawer.set(withSpring(1, softSpring));
  }, [drawer]);
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    drawer.set(withSpring(0, softSpring));
  }, [drawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeDrawer();
      return true;
    });
    return () => sub.remove();
  }, [drawerOpen, closeDrawer]);

  const settle = (velocity: number, from: number) => {
    'worklet';
    const open = velocity > 500 || (velocity > -500 && from > 0.5);
    drawer.set(withSpring(open ? 1 : 0, { ...softSpring, velocity: velocity / drawerW }));
    scheduleOnRN(setDrawerOpen, open);
  };
  const edgePan = usePanGesture({
    activeOffsetX: 12,
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      drawer.set(Math.min(1, Math.max(0, e.translationX / drawerW)));
    },
    onDeactivate: (e) => {
      'worklet';
      settle(e.velocityX, drawer.get());
    },
  });
  const closePan = usePanGesture({
    activeOffsetX: -12,
    failOffsetY: [-14, 14],
    onUpdate: (e) => {
      'worklet';
      drawer.set(Math.min(1, Math.max(0, 1 + e.translationX / drawerW)));
    },
    onDeactivate: (e) => {
      'worklet';
      settle(e.velocityX, drawer.get());
    },
  });

  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawer.get() * drawerW * 0.22 }, { scale: 1 - drawer.get() * 0.04 }],
    borderRadius: drawer.get() * 28,
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: drawer.get() }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: (drawer.get() - 1) * drawerW }] }));

  // ── Scroll-linked header ───────────────────────────────────────────────
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const barTitle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [50, 90], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.get(), [50, 90], [6, 0], Extrapolation.CLAMP) }],
  }));
  const barLine = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [0, 30], [0, 1], Extrapolation.CLAMP) }));
  const hero = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 90], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.get(), [-100, 0, 100], [20, 0, -24], Extrapolation.CLAMP) }],
  }));

  // ── Actions ────────────────────────────────────────────────────────────
  const restore = useCallback(
    (id: string) => {
      store.restore(id);
      overlay.toast('Marked as restored', { icon: 'check-circle', action: { label: 'Undo', onPress: () => store.reopen(id) } });
    },
    [store, overlay],
  );

  const add = async (draft: Draft) => {
    const saved = store.add(draft);
    overlay.toast(draft.remindAt ? `Saved · reminder ${shortWhen(draft.remindAt)}` : 'Saved', { icon: 'check' });
    await saved;
    // Saving a reminder asks for notification permission; say so if it's blocked.
    if (draft.remindAt && (await permissionState()) === 'denied') {
      overlay.toast('Notifications are off', { icon: 'bell-off', action: { label: 'Settings', onPress: () => Linking.openSettings() } });
    }
  };

  const openSettings = () => {
    haptic.tap();
    Keyboard.dismiss();
    overlay.openSheet(() => (
      <SettingsSheet onTest={(ok) => overlay.toast(ok ? 'Test reminder in 3 seconds…' : 'Allow notifications first', { icon: 'bell' })} />
    ));
  };

  const open = (id: string) => {
    Keyboard.dismiss();
    router.push({ pathname: '/item/[id]', params: { id } });
  };

  const subtitle =
    pending.length === 0
      ? 'What needs undoing?'
      : pending.length === 1
        ? '1 thing to put back.'
        : `${pending.length} things to put back.`;

  return (
    <View style={[styles.fill, { backgroundColor: p.dark ? '#0E0E0F' : '#EDEDEB' }]}>
      <Animated.View style={[styles.fill, { backgroundColor: p.bg, overflow: 'hidden' }, mainStyle]}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: insets.top + 64,
            paddingBottom: composerH + insets.bottom + 40,
            paddingHorizontal: 16,
            flexGrow: 1,
          }}>
          <Animated.View style={[styles.hero, hero]} entering={FadeInDown.duration(500).springify().damping(20)}>
            <T v="display">{greeting(new Date(now))}</T>
            <T v="display" tone="tertiary">
              {subtitle}
            </T>
          </Animated.View>

          {pending.length > 0 ? (
            <Animated.View entering={FadeIn.delay(120)} style={styles.chips}>
              {overdue ? <Pill icon="alert-circle" text={`${overdue} overdue`} danger /> : null}
              {next?.remindAt ? <Pill icon="bell" text={`Next ${shortWhen(next.remindAt)}`} /> : null}
              <Pill icon="corner-down-right" text="Swipe right to restore" />
            </Animated.View>
          ) : null}

          <View style={{ gap: 10 }}>
            {pending.map((item, i) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(80 + i * 45).springify().damping(20)}
                exiting={FadeOut.duration(200)}
                layout={LinearTransition.springify().damping(22)}>
                <PendingRow item={item} now={now} onOpen={() => open(item.id)} onRestore={() => restore(item.id)} />
              </Animated.View>
            ))}
          </View>

          {store.loaded && pending.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(150).springify().damping(20)} style={{ marginTop: 8 }}>
              <T v="overline" tone="tertiary" style={{ marginBottom: 10, marginLeft: 4 }}>
                For example
              </T>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s, i) => (
                  <Animated.View key={s.text} entering={FadeInDown.delay(200 + i * 50).springify().damping(18)}>
                    <Press
                      onPress={() => {
                        haptic.tap();
                        composer.current?.fill(s.text);
                      }}
                      scaleTo={0.95}
                      style={[styles.suggestion, { backgroundColor: p.card, borderColor: p.border }]}>
                      <Feather name={s.icon} size={15} color={p.secondary} />
                      <T v="label" tone="secondary">
                        {s.text}
                      </T>
                    </Press>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </Animated.ScrollView>

        {/* Top bar */}
        <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: p.bg }]}>
          <View style={styles.barRow}>
            <IconButton icon="sidebar" label="History" onPress={openDrawer} />
            <Animated.View style={[styles.barTitle, barTitle]} pointerEvents="none">
              <T v="heading" style={{ fontSize: 17 }}>
                UndoLater
              </T>
            </Animated.View>
            <IconButton icon="bell" label="Notification settings" onPress={openSettings} />
          </View>
          <Animated.View style={[styles.barLine, { backgroundColor: p.border }, barLine]} />
        </View>

        {/* Composer, riding on top of the keyboard */}
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom - 6 }} style={styles.composerWrap}>
          <LinearGradient
            colors={[p.dark ? 'rgba(23,23,24,0)' : 'rgba(248,248,247,0)', p.bg]}
            locations={[0, 0.45]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View
            style={{ paddingHorizontal: 12, paddingTop: 20, paddingBottom: insets.bottom + 10 }}
            onLayout={(e) => setComposerH(e.nativeEvent.layout.height)}>
            <Composer ref={composer} onSubmit={add} />
          </View>
        </KeyboardStickyView>

        {/* Left-edge swipe opens the sidebar */}
        <GestureDetector gesture={edgePan}>
          <View style={[styles.edge, { top: insets.top + 60 }]} />
        </GestureDetector>
      </Animated.View>

      {/* Sidebar */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }, scrimStyle]} pointerEvents={drawerOpen ? 'auto' : 'none'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} accessibilityLabel="Close history" />
      </Animated.View>
      <GestureDetector gesture={closePan}>
        <Animated.View style={[styles.panel, { width: drawerW, backgroundColor: p.bg, borderColor: p.border }, panelStyle]}>
          <Sidebar
            pending={pending.length}
            history={history}
            now={now}
            onNew={() => {
              closeDrawer();
              setTimeout(() => composer.current?.focus(), 250);
            }}
            onOpen={(id) => {
              closeDrawer();
              open(id);
            }}
            onSettings={() => {
              closeDrawer();
              setTimeout(openSettings, 200);
            }}
            onClear={() =>
              overlay.openSheet((close) => (
                <ConfirmSheet
                  title="Clear history?"
                  message="All restored items and their photos will be removed."
                  action="Clear"
                  close={close}
                  onConfirm={() => store.clearHistory()}
                />
              ))
            }
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function Pill({ icon, text, danger }: { icon: IconName; text: string; danger?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.pill, { backgroundColor: danger ? p.dangerSoft : p.fill }]}>
      <Feather name={icon} size={12} color={danger ? p.danger : p.secondary} />
      <T v="caption" tone={danger ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hero: { paddingHorizontal: 4, marginBottom: 18, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: 13 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  barRow: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  barTitle: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  barLine: { height: StyleSheet.hairlineWidth },
  composerWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  edge: { position: 'absolute', left: 0, bottom: 160, width: 14 },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRightWidth: StyleSheet.hairlineWidth },
});
