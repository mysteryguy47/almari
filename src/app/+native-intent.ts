/**
 * Links that open the app on a phone.
 *
 * - An invite link (https://almari.blackmonkey.in/join/<id>#<secret>, once
 *   Android App Links are verified): the router drops what follows the #, so
 *   the secret is kept for the join screen here.
 * - Google's return to almari://auth/callback while the sign-in call is still
 *   waiting for it: that call finishes the sign-in itself, and opening the
 *   callback screen too would use the same one-time code twice.
 */
import { useUi } from '@/store/ui-store';
import { googleSignInPending } from '@/sync/oauth-flag';

const INVITE = /\/join\/([A-Za-z0-9-]+)#([A-Za-z0-9_-]{40,})/;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    if (!initial && googleSignInPending() && /auth\/callback/.test(path)) return null;
    const invite = INVITE.exec(path);
    if (invite) {
      useUi.getState().setPendingInvite({ id: invite[1], secret: invite[2] });
      return `/join/${invite[1]}`;
    }
    return path;
  } catch {
    return path;
  }
}
