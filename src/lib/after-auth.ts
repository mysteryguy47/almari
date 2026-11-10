import { router } from 'expo-router';

import { useApp } from '@/store/app-store';
import { toast, useUi } from '@/store/ui-store';

/**
 * After any successful sign-in: join families that invited this email, then
 * go to setup, the PIN step, or home. The person just proved who they are, so
 * the app lock does not ask again straight away.
 */
export function afterAuth() {
  const app = useApp.getState();
  useUi.getState().unlock();
  const joined = app.joinPendingInvites();
  const state = useApp.getState();
  const account = state.session.accountId ? state.accounts[state.session.accountId] : undefined;
  if (joined.length) toast(`You joined ${state.families[joined[0]]?.name ?? 'your family'}`, { tone: 'success' });
  if (!account?.familyIds.length) return router.replace('/start/you');
  if (!state.device.pinHash) return router.replace('/start/pin');
  router.replace('/');
}
