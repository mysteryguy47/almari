/**
 * Signing in and out with Supabase Auth, and getting this device ready
 * afterwards. Screens call these; none of them touch Supabase directly.
 */
import type { User } from '@supabase/supabase-js';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';

import { attemptsLeft } from '@/domain/family-rules';
import { normaliseEmail } from '@/domain/validation';
import { initCrypto } from '@/lib/crypto';
import { useApp } from '@/store/app-store';
import { flushSaves } from '@/store/persist-storage';
import { toast, useUi } from '@/store/ui-store';

import { CloudError } from './api';
import { api, deviceReady, setRevokedHandler, stopRealtime, supabase, syncNow } from './runtime';
import type { CloudState } from './types';
import { checkDevice, setUpNewAccount, type DeviceState } from './vault';

export function appOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  return 'almari://';
}

function friendly(error: { message?: string; code?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? '';
  const text = error?.message ?? '';
  if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(text)) return 'No internet. Connect and try again.';
  if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(text)) return 'Too many emails were sent just now. Wait a few minutes and try again.';
  if (code === 'over_request_rate_limit' || error?.status === 429) return 'Too many tries just now. Wait a minute and try again.';
  if (code === 'weak_password' || /password should be/i.test(text)) return 'Choose a stronger password: at least 8 characters, not a common one.';
  if (code === 'same_password') return 'That is your current password. Choose a new one.';
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(text)) return 'This email does not look right';
  if (/Email address not authorized/i.test(text)) return 'Almari cannot send email to this address yet. Ask the Almari team to add it for the beta.';
  if (code === 'reauthentication_needed' || /reauthenticat/i.test(text)) return 'For safety, sign out and sign in again, then set the password.';
  return text || 'Something went wrong. Try again.';
}

// ---------------------------------------------------------------- after any sign-in

const providersOf = (user: User): string[] => [
  ...new Set([...(user.identities ?? []).map((i) => i.provider), ...((user.app_metadata?.providers as string[] | undefined) ?? [])]),
];

function nameOf(user: User): string {
  const meta = user.user_metadata ?? {};
  return String(meta.full_name ?? meta.name ?? user.email?.split('@')[0] ?? '').trim();
}

function cloudFor(user: User, existing?: CloudState): CloudState {
  const providers = providersOf(user);
  return {
    keyring: [], currentVersion: 0, familyKeys: {}, memberships: {}, sync: {},
    ...existing,
    userId: user.id,
    email: normaliseEmail(user.email ?? ''),
    name: existing?.name || nameOf(user),
    google: providers.includes('google'),
    hasPassword: providers.includes('email') || user.user_metadata?.has_password === true,
  };
}

/** What the device-setup screen shows when this device needs letting in. */
export const useDeviceSetup = (() => {
  let last: DeviceState | null = null;
  return { get: () => last, set: (s: DeviceState | null) => (last = s) };
})();

/** Sets up the cloud state for whoever just signed in, and this device's keys. */
export async function afterSignIn(): Promise<void> {
  const { data } = await supabase().auth.getUser();
  const user = data.user;
  if (!user) throw new CloudError('The sign-in did not finish. Try again.');
  await initCrypto();
  const s = useApp.getState();
  if (s.cloud && s.cloud.userId !== user.id) s.clearLocal();
  useApp.setState((d) => {
    d.cloud = cloudFor(user, d.cloud);
    d.device.lockedOut = false;
    d.device.pinFailures = 0;
  });
  useUi.getState().unlock();
  void api().clearSignInFailures().catch(() => undefined);

  const cloud = useApp.getState().cloud as CloudState;
  const state = await checkDevice(api(), user.id, useApp.getState().device.deviceId, cloud.keyring);
  useDeviceSetup.set(state);
  if (state.status === 'new-account') {
    const keys = await setUpNewAccount(api(), user.id);
    useApp.setState((d) => {
      if (d.cloud) Object.assign(d.cloud, keys);
    });
  } else if (state.status === 'ready') {
    useApp.setState((d) => {
      if (!d.cloud) return;
      d.cloud.keyring = state.keyring;
      d.cloud.currentVersion = state.currentVersion;
      d.cloud.kitCreatedAt = state.kitCreatedAt ?? undefined;
    });
  } else {
    useApp.setState((d) => {
      if (d.cloud) d.cloud.currentVersion = state.currentVersion;
    });
  }
  if (deviceReady()) await syncNow();
}

/** Where to go once signed in. */
export function nextRoute(): Href {
  const s = useApp.getState();
  const pendingInvite = useUi.getState().pendingInvite;
  if (!s.cloud) return '/welcome';
  if (!deviceReady()) return '/setup/device';
  if (pendingInvite) return { pathname: '/join/[id]', params: { id: pendingInvite.id } };
  if (Object.keys(s.cloud.memberships).length === 0) return '/start/you';
  if (!s.device.pinHash) return '/start/pin';
  return '/';
}

// ---------------------------------------------------------------- email and password

export type SignUpOutcome = { status: 'signed-in' } | { status: 'check-email' } | { status: 'error'; message: string };

export async function signUp(name: string, email: string, password: string): Promise<SignUpOutcome> {
  const { data, error } = await supabase().auth.signUp({
    email: normaliseEmail(email),
    password,
    options: { emailRedirectTo: `${appOrigin()}/auth/callback`, data: { full_name: name.trim() } },
  });
  if (error) return { status: 'error', message: friendly(error) };
  if (data.session) {
    await afterSignIn();
    return { status: 'signed-in' };
  }
  // Same words whether or not the email already has an account, so nobody can probe for accounts.
  return { status: 'check-email' };
}

export async function resendConfirmation(email: string): Promise<string | null> {
  const { error } = await supabase().auth.resend({ type: 'signup', email: normaliseEmail(email), options: { emailRedirectTo: `${appOrigin()}/auth/callback` } });
  return error ? friendly(error) : null;
}

export type SignInOutcome =
  | { status: 'ok' }
  | { status: 'wrong'; attemptsLeft: number }
  | { status: 'paused'; until: number }
  | { status: 'unconfirmed' }
  | { status: 'error'; message: string };

export async function signIn(email: string, password: string): Promise<SignInOutcome> {
  const address = normaliseEmail(email);
  try {
    const status = await api().signInStatus(address);
    if (status.paused_until && new Date(status.paused_until).getTime() > Date.now()) {
      return { status: 'paused', until: new Date(status.paused_until).getTime() };
    }
  } catch (e) {
    if (e instanceof CloudError && e.offline) return { status: 'error', message: 'No internet. Connect and try again.' };
  }
  const { error } = await supabase().auth.signInWithPassword({ email: address, password });
  if (error) {
    if (error.code === 'email_not_confirmed') return { status: 'unconfirmed' };
    if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
      const after = await api().noteSignInFailure(address).catch(() => null);
      if (after?.paused_until) return { status: 'paused', until: new Date(after.paused_until).getTime() };
      return { status: 'wrong', attemptsLeft: attemptsLeft(after?.failures ?? 1) };
    }
    return { status: 'error', message: friendly(error) };
  }
  await afterSignIn();
  return { status: 'ok' };
}

export async function signInWithGoogle(): Promise<string | null> {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${appOrigin()}/auth/callback`, queryParams: { prompt: 'select_account' } },
  });
  return error ? friendly(error) : null;
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const { error } = await supabase().auth.resetPasswordForEmail(normaliseEmail(email), { redirectTo: `${appOrigin()}/auth/reset` });
  // A rate limit is worth saying; anything about the account itself is not (no probing for accounts).
  if (error && (error.status === 429 || /rate limit|network|fetch/i.test(error.message))) return friendly(error);
  return null;
}

/**
 * Finishes a link from an email or from Google: a PKCE code, or a token hash
 * (when the email templates use {{ .TokenHash }}). Returns what kind of link it was.
 */
export async function finishRedirect(params: { code?: string; token_hash?: string; type?: string; error_description?: string }): Promise<
  { status: 'ok'; recovery: boolean } | { status: 'error'; message: string; confirmed?: boolean }
> {
  if (params.error_description) return { status: 'error', message: params.error_description.replace(/\+/g, ' ') };
  if (params.token_hash && params.type) {
    const type = params.type as 'signup' | 'recovery' | 'email' | 'invite' | 'magiclink' | 'email_change';
    const { error } = await supabase().auth.verifyOtp({ token_hash: params.token_hash, type });
    if (error) return { status: 'error', message: 'This link has expired or was already used. Ask for a new one.' };
    return { status: 'ok', recovery: type === 'recovery' };
  }
  if (params.code) {
    const { data, error } = await supabase().auth.exchangeCodeForSession(params.code);
    if (error) {
      // Opened on another device or browser than the one that asked: the email is confirmed all the same.
      if (/code verifier|flow state|both auth code and code verifier/i.test(error.message)) {
        return { status: 'error', message: 'Done. Now sign in on this device.', confirmed: true };
      }
      return { status: 'error', message: 'This link has expired or was already used. Ask for a new one.' };
    }
    if (!data.session) return { status: 'error', message: 'The sign-in did not finish. Try again.' };
    return { status: 'ok', recovery: false }; // the route that received the link knows whether it was a reset
  }
  return { status: 'error', message: 'This link is incomplete. Open the whole link from the email.' };
}

/** Sets a new password: after a reset link, or a Google user adding one in Settings. */
export async function setNewPassword(password: string): Promise<string | null> {
  const { error } = await supabase().auth.updateUser({ password, data: { has_password: true } });
  if (error) return friendly(error);
  await api().clearSignInFailures().catch(() => undefined);
  useApp.setState((d) => {
    if (d.cloud) d.cloud.hasPassword = true;
  });
  return null;
}

/** Settings: a new password, checking the current one first when there is one. */
export async function changePassword(next: string, current?: string): Promise<string | null> {
  const email = useApp.getState().cloud?.email;
  if (!email) return 'Sign in first';
  if (current !== undefined) {
    const { error } = await supabase().auth.signInWithPassword({ email, password: current });
    if (error) {
      if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) {
        await api().noteSignInFailure(email).catch(() => undefined);
        return 'Your current password is not right';
      }
      return friendly(error);
    }
  }
  return setNewPassword(next);
}

// ---------------------------------------------------------------- signing out

/** Signs out and removes everything Almari keeps on this device. The family's copy on the server is untouched. */
export async function signOutAndForget(): Promise<void> {
  stopRealtime();
  await supabase().auth.signOut({ scope: 'local' }).catch(() => undefined);
  useApp.getState().clearLocal();
  useUi.getState().lock();
  await flushSaves();
}

setRevokedHandler(() => {
  void signOutAndForget().then(() => toast('This device was removed from your account, so Almari’s data has left it.', { tone: 'warn' }));
});

/** On start-up: is the saved session still good, and for the same account? */
export async function resumeSession(): Promise<void> {
  const s = useApp.getState();
  const { data } = await supabase().auth.getSession();
  const user = data.session?.user;
  if (!user) return; // signed out (or never signed in): local data stays until someone signs in
  if (s.cloud && s.cloud.userId !== user.id) {
    s.clearLocal();
    return;
  }
  if (!s.cloud) {
    await afterSignIn().catch(() => undefined);
    return;
  }
  useApp.setState((d) => {
    if (d.cloud) d.cloud = cloudFor(user, d.cloud);
  });
  if (deviceReady()) void syncNow();
}
