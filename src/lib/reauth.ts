import { useApp } from '@/store/app-store';
import { useUi } from '@/store/ui-store';

/**
 * Asks for the fingerprint or app PIN before showing or copying a secret,
 * unless the person proved it was them in the last two minutes. A device
 * with no PIN set (the sample family) has nothing to check against.
 */
export async function ensureReauth(reason: string): Promise<boolean> {
  const ui = useUi.getState();
  if (Date.now() < ui.reauthUntil) return true;
  if (!useApp.getState().device.pinHash) return true;
  return ui.requestReauth(reason);
}
