import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { UndoItem } from './types';

export const CATEGORY = 'undo-reminder';
export const ACTION_RESTORE = 'restore';
export const ACTION_SNOOZE = 'snooze';
const CHANNEL = 'reminders';

// Local notifications only exist on iOS and Android; the web preview skips them.
export const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** One-time setup: foreground presentation, Android channel, action buttons. */
export async function setupNotifications() {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Reminders',
      // eslint-disable-next-line import/namespace -- re-exported enum the plugin can't see
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_RESTORE, buttonTitle: 'Restored', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 1 hour', options: { opensAppToForeground: true } },
  ]);
}

/** Asks for permission the first time it's actually needed. */
export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function scheduleReminder(item: UndoItem): Promise<string | undefined> {
  if (!supported || !item.remindAt || item.remindAt <= Date.now()) return undefined;
  if (!(await ensurePermission())) return undefined;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to undo',
      body: item.title,
      data: { itemId: item.id },
      categoryIdentifier: CATEGORY,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: item.remindAt,
      channelId: CHANNEL,
    },
  });
}

export async function cancelReminder(notificationId?: string) {
  if (!supported || !notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already delivered or gone: nothing to cancel.
  }
}

export type ReminderTap = { itemId: string; action: 'open' | 'restore' | 'snooze' };

function toTap(response: Notifications.NotificationResponse): ReminderTap | null {
  const itemId = response.notification.request.content.data?.itemId;
  if (typeof itemId !== 'string') return null;
  const action =
    response.actionIdentifier === ACTION_RESTORE
      ? 'restore'
      : response.actionIdentifier === ACTION_SNOOZE
        ? 'snooze'
        : 'open';
  return { itemId, action };
}

/**
 * Calls `onTap` for notification taps and action buttons, including the one that
 * cold-started the app. Each response is handled once.
 */
export function listenForReminderTaps(onTap: (tap: ReminderTap) => void): () => void {
  if (!supported) return () => {};
  const seen = new Set<string>();
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (seen.has(key)) return;
    seen.add(key);
    const tap = toTap(response);
    if (tap) onTap(tap);
    if (response.notification.request.identifier) {
      Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
    }
  };
  handle(Notifications.getLastNotificationResponse());
  Notifications.clearLastNotificationResponse();
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
