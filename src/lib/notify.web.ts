/**
 * The web app has no phone notifications yet (iPhone web push needs a push
 * server). Reminders show on Home and on the Reminders screen.
 */
export const NOTIFY_AVAILABLE = false;

export type NotifyStatus = 'on' | 'off' | 'blocked';

export async function notifyStatus(): Promise<NotifyStatus> {
  return 'off';
}

export async function turnOnNotifications(): Promise<NotifyStatus> {
  return 'off';
}

export async function askOnceForReminders(): Promise<void> {}

export function startNotifications(): () => void {
  return () => undefined;
}
