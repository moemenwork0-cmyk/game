// Per-weight imports so only the fonts in use are bundled.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { LibreBaskerville_400Regular } from '@expo-google-fonts/libre-baskerville/400Regular';
import { LibreBaskerville_700Bold } from '@expo-google-fonts/libre-baskerville/700Bold';
import { useFonts } from 'expo-font';
import { Stack, router, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { listenForReminderTaps, setupNotifications } from '../notifications';
import { SettingsProvider } from '../settings';
import { StoreProvider, useStore } from '../store';
import { usePalette } from '../theme';
import { shortWhen } from '../time';
import { OverlayProvider, useOverlay } from '../ui/Overlay';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const p = usePalette();
  const [fontsLoaded, fontError] = useFonts({
    LibreBaskerville_400Regular,
    LibreBaskerville_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(p.bg).catch(() => {});
  }, [p.bg]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    setupNotifications().catch(() => {});
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <SettingsProvider>
            <StoreProvider>
              <OverlayProvider>
                <StatusBar style={p.dark ? 'light' : 'dark'} />
                <ReminderBridge />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: p.bg },
                    animation: 'ios_from_right',
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                  }}
                />
              </OverlayProvider>
            </StoreProvider>
          </SettingsProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/** Routes notification taps and their "Restored" / "Snooze" buttons into the app. */
function ReminderBridge() {
  const store = useStore();
  const overlay = useOverlay();
  const { loaded, restore, reopen, snooze } = store;
  // A tap that cold-starts the app must wait until navigation is mounted.
  const navReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (!loaded || !navReady) return;
    return listenForReminderTaps(({ itemId, action }) => {
      if (action === 'restore') {
        restore(itemId);
        overlay.toast('Marked as restored', { icon: 'check-circle', action: { label: 'Undo', onPress: () => reopen(itemId) } });
      } else if (action === 'snooze') {
        snooze(itemId, 3600e3);
        overlay.toast(`Snoozed until ${shortWhen(Date.now() + 3600e3)}`, { icon: 'clock' });
      } else {
        router.push({ pathname: '/item/[id]', params: { id: itemId } });
      }
    });
  }, [loaded, navReady, restore, reopen, snooze, overlay]);

  return null;
}
