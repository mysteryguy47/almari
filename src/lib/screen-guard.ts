/**
 * Android: Almari's screens cannot be screenshotted or recorded, and show
 * blank in the recent-apps view (the window's secure flag). The papers are
 * shared on purpose through Share, never by accident through a screenshot.
 */
import { preventScreenCaptureAsync } from 'expo-screen-capture';

export function guardScreen(): void {
  preventScreenCaptureAsync('almari').catch(() => undefined);
}
