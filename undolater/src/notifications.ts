import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Settings } from './settings';
import type { UndoItem } from './types';

export const CATEGORY = 'undo-reminder';
export const ACTION_RESTORE = 'restore';
export const ACTION_SNOOZE = 'snooze';
const SOUND = 'undo_chime.wav';
// Android fixes a channel's sound when it is created, so sound on/off are two channels.
const CHANNEL_CHIME = 'reminders-chime';
const CHANNEL_QUIET = 'reminders-quiet';
const MAX_FOLLOW_UPS = 3;

// Local notifications only exist on iOS and Android; the web preview skips them.
export const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/** One-time setup: foreground presentation, Android channels, action buttons. */
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
    const common = {
      // eslint-disable-next-line import/namespace -- re-exported enum the plugin can't see
      importance: Notifications.AndroidImportance.HIGH,
      // eslint-disable-next-line import/namespace
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      lightColor: '#25BA3B',
      enableVibrate: true,
      vibrationPattern: [0, 90, 70, 90],
    };
    await Notifications.setNotificationChannelAsync(CHANNEL_CHIME, {
      ...common,
      name: 'Reminders',
      description: 'Reminders to put things back, with the UndoLater chime.',
      sound: SOUND,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
      ...common,
      name: 'Reminders (silent)',
      description: 'Reminders without sound, vibration only.',
      sound: null,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_RESTORE, buttonTitle: '✓ Restored', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 1 hour', options: { opensAppToForeground: true } },
  ]);
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function permissionState(): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
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

function content(item: Pick<UndoItem, 'id' | 'title' | 'note'>, settings: Settings, followUp: number) {
  return {
    title: followUp === 0 ? item.title : `Still waiting: ${item.title}`,
    body:
      followUp === 0
        ? item.note || "Time to put it back. Tap Restored once it's done."
        : 'A gentle nudge. Put it back, or snooze it for later.',
    data: { itemId: item.id },
    categoryIdentifier: CATEGORY,
    sound: settings.sound ? SOUND : false,
    color: '#1A1A19',
    priority: Notifications.AndroidNotificationPriority.HIGH,
  } satisfies Notifications.NotificationContentInput;
}

/** The reminder itself plus a few spaced follow-ups while it stays pending; only future ones. */
export function reminderPlan(remindAt: number, settings: Settings, now = Date.now()) {
  const plan = [{ at: remindAt, followUp: 0 }];
  if (settings.followUpHours > 0) {
    for (let k = 1; k <= MAX_FOLLOW_UPS; k++) plan.push({ at: remindAt + k * settings.followUpHours * 3600e3, followUp: k });
  }
  return plan.filter((p) => p.at > now + 1000);
}

/** Schedules every upcoming notification for an item and returns their ids. */
export async function scheduleReminders(item: UndoItem, settings: Settings, ask = true): Promise<string[]> {
  if (!supported || item.restoredAt || !item.remindAt) return [];
  const allowed = ask ? await ensurePermission() : (await permissionState()) === 'granted';
  if (!allowed) return [];
  const channelId = settings.sound ? CHANNEL_CHIME : CHANNEL_QUIET;
  const ids: string[] = [];
  for (const { at, followUp } of reminderPlan(item.remindAt, settings)) {
    try {
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: content(item, settings, followUp),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
        }),
      );
    } catch {
      // A failed schedule shouldn't block saving the item.
    }
  }
  return ids;
}

export async function cancelReminders(item?: Pick<UndoItem, 'notificationIds' | 'notificationId'>) {
  if (!supported || !item) return;
  const ids = [...(item.notificationIds ?? []), ...(item.notificationId ? [item.notificationId] : [])];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/**
 * Rebuilds every scheduled reminder from the saved items, so notifications always match the
 * list (after settings changes, app updates, or permission granted later).
 */
export async function resyncReminders(items: UndoItem[], settings: Settings): Promise<Record<string, string[]>> {
  if (!supported) return {};
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  const result: Record<string, string[]> = {};
  for (const item of items) {
    if (item.restoredAt || !item.remindAt) continue;
    result[item.id] = await scheduleReminders(item, settings, false);
  }
  return result;
}

/** Fires a sample notification in a few seconds so the sound and buttons can be checked. */
export async function sendTestNotification(settings: Settings): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      ...content({ id: 'test', title: 'This is how a reminder looks', note: undefined }, settings, 0),
      body: 'You will get one like this when it is time to put something back.',
      data: {},
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: settings.sound ? CHANNEL_CHIME : CHANNEL_QUIET,
    },
  });
  return true;
}

export async function clearDelivered(itemId: string) {
  if (!supported) return;
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    shown
      .filter((n) => n.request.content.data?.itemId === itemId)
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {})),
  );
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
    Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
  };
  handle(Notifications.getLastNotificationResponse());
  Notifications.clearLastNotificationResponse();
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
