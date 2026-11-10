/**
 * Small device helpers that differ between Android and the web app:
 * haptics, the clipboard, and opening phone numbers.
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Linking, Platform, Share } from 'react-native';

const native = Platform.OS !== 'web';

export const haptic = {
  tap() {
    if (native) Haptics.selectionAsync().catch(() => undefined);
  },
  press() {
    if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  success() {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  warn() {
    if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};

let clearTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Copies text. On Android a copied secret is cleared from the clipboard
 * after 60 seconds if nothing else was copied since. (Browsers do not let a
 * web app read the clipboard back without asking, so the web app cannot.)
 */
export async function copyText(text: string, { secret = false } = {}): Promise<void> {
  await Clipboard.setStringAsync(text);
  haptic.success();
  if (secret && native) {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(async () => {
      try {
        if ((await Clipboard.getStringAsync()) === text) await Clipboard.setStringAsync('');
      } catch {
        // Clipboard unavailable: nothing to clear.
      }
    }, 60_000);
  }
}

export function callNumber(phone: string) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => undefined);
}

export async function shareText(text: string, title?: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    const nav = navigator as Navigator;
    if (nav.share) {
      try {
        await nav.share({ text, title });
        return 'shared';
      } catch {
        // closed the sheet, or not allowed: fall back to copying
      }
    }
    await copyText(text);
    return 'copied';
  }
  await Share.share({ message: text, title });
  return 'shared';
}
