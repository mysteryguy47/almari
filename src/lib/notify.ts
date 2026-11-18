/**
 * Phone notifications for reminders, on Android. They are scheduled on the
 * phone itself, with no push server: the next reminders of every family on
 * this device, rebuilt whenever a family changes and whenever the app comes
 * back to the front. Texts name the paper or task, never a number; on a
 * locked phone they follow Android's "hide sensitive content" setting.
 */
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { AppState, Linking } from 'react-native';

import { plannedNotifications, routeForReminder } from '@/domain/reminders';
import { useApp, viewerIdIn, type PersistedState } from '@/store/app-store';
import { kv } from '@/store/kv';

export const NOTIFY_AVAILABLE = true;

/** 'on'; 'off' (Android can still ask); 'blocked' (only the system settings can turn it on). */
export type NotifyStatus = 'on' | 'off' | 'blocked';

const CHANNEL = 'reminders';
/** Android keeps up to 500 alarms per app; the next 60 cover weeks of a busy family. */
const MAX_SCHEDULED = 60;
const ASKED_KEY = 'notify-asked';

let channel: Promise<unknown> | null = null;
function ensureChannel(): Promise<unknown> {
  channel ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    description: 'Papers about to expire, card bills and family tasks',
    importance: AndroidImportance.HIGH,
    // With Android's "hide sensitive content" on, a locked phone shows only that Almari has a reminder.
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: '#34574A',
  }).catch((e) => {
    channel = null;
    console.warn('Could not set up reminders', e);
  });
  return channel;
}

export async function notifyStatus(): Promise<NotifyStatus> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return 'on';
  return p.canAskAgain ? 'off' : 'blocked';
}

/** Asks Android. Once Android stops asking (denied twice), opens Almari's system settings instead. */
export async function turnOnNotifications(): Promise<NotifyStatus> {
  await ensureChannel();
  const now = await notifyStatus();
  if (now === 'on') return now;
  if (now === 'blocked') {
    await Linking.openSettings();
    return now;
  }
  await kv.setItem(ASKED_KEY, '1');
  const p = await Notifications.requestPermissionsAsync();
  if (p.granted) rescheduleSoon(true);
  return p.granted ? 'on' : p.canAskAgain ? 'off' : 'blocked';
}

/**
 * Right after someone saves a date that will remind them (an expiry, a task's
 * due date): ask once, at the moment it makes sense, never at launch.
 */
export async function askOnceForReminders(): Promise<void> {
  try {
    if ((await kv.getItem(ASKED_KEY)) === '1') return;
    if ((await notifyStatus()) !== 'off') return;
    await turnOnNotifications();
  } catch (e) {
    console.warn('Could not ask about reminders', e);
  }
}

/** "2026-11-14T09:00" in the phone's own time zone. */
function localTime(at: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(at);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null;
}

interface Plan {
  date: Date;
  title: string;
  body: string;
  route: string;
  familyId: string;
}

function plansFor(state: PersistedState, now = new Date()): Plan[] {
  const out: Plan[] = [];
  for (const family of Object.values(state.families)) {
    if (family.isSample) continue; // the made-up family never reminds anyone
    const viewerId = viewerIdIn(state, family);
    if (!viewerId) continue;
    for (const p of plannedNotifications(family, viewerId, now)) {
      const date = localTime(p.at);
      const route = routeForReminder(p.key);
      if (!date || !route || date.getTime() <= now.getTime() + 60_000) continue;
      out.push({ date, title: p.title, body: p.body, route, familyId: family.id });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_SCHEDULED);
}

let lastSignature = '';
let running: Promise<void> | null = null;

/** Replaces what is scheduled with the current plan; does nothing when the plan has not changed. */
async function reschedule(force = false): Promise<void> {
  const plans = plansFor(useApp.getState());
  const signature = JSON.stringify(plans.map((p) => [p.date.getTime(), p.title, p.body, p.route, p.familyId]));
  if (!force && signature === lastSignature) return;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  // Scheduled even before permission is given: switching notifications on in the
  // system settings later then works without opening Almari again.
  for (const p of plans) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: { route: p.route, familyId: p.familyId }, color: '#34574A' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL },
    });
  }
  lastSignature = signature;
}

function rescheduleSoon(force = false) {
  // One run at a time; a change during a run is picked up by the next.
  running = (running ?? Promise.resolve()).then(() => reschedule(force)).catch((e) => console.warn('Could not schedule reminders', e));
}

function open(response: Notifications.NotificationResponse | null) {
  if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const data = response.notification.request.content.data as { route?: string; familyId?: string } | undefined;
  if (!data?.route) return;
  const state = useApp.getState();
  if (data.familyId && state.families[data.familyId] && state.session.familyId !== data.familyId) state.switchFamily(data.familyId);
  router.push(data.route as Href);
}

/**
 * Starts reminders on this phone: shows them while Almari is open too, opens
 * the right screen on a tap, and keeps the schedule in step with the families.
 * Call once the saved data has loaded and the screens are mounted.
 */
export function startNotifications(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  void ensureChannel();

  const tap = Notifications.addNotificationResponseReceivedListener(open);
  // A tap that launched the app before this listener existed.
  Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (!r) return;
      open(r);
      return Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = useApp.subscribe((s, prev) => {
    if (s.families === prev.families && s.cloud === prev.cloud && s.session === prev.session) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => rescheduleSoon(), 2000);
  });
  // Dates move on while the phone sleeps: plan again whenever Almari comes back.
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') rescheduleSoon(true);
  });
  rescheduleSoon(true);

  return () => {
    tap.remove();
    unsubscribe();
    appState.remove();
    if (timer) clearTimeout(timer);
  };
}
