/**
 * Short-lived UI state that is never saved: whether the app is locked, the
 * grace window after a fingerprint or PIN check, toasts, and the Add sheet.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';

/**
 * An invite link opened before signing in. Kept in this browser for a day, so
 * it survives the sign-up email (which opens a new tab) and the Google
 * redirect. It is useless without signing in as the invited email.
 */
export interface PendingInvite {
  id: string;
  secret: string;
}

const INVITE_KEY = 'almari:pending-invite';
const INVITE_TTL_MS = 86_400_000;

function loadPendingInvite(): PendingInvite | undefined {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(INVITE_KEY);
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as PendingInvite & { at: number };
    if (Date.now() - saved.at > INVITE_TTL_MS) {
      localStorage.removeItem(INVITE_KEY);
      return undefined;
    }
    return { id: saved.id, secret: saved.secret };
  } catch {
    return undefined;
  }
}

function savePendingInvite(invite: PendingInvite | undefined) {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return;
  try {
    if (invite) localStorage.setItem(INVITE_KEY, JSON.stringify({ ...invite, at: Date.now() }));
    else localStorage.removeItem(INVITE_KEY);
  } catch {
    // private mode: the invite simply has to be opened again
  }
}

export const REAUTH_GRACE_MS = 2 * 60 * 1000;
export const LOCK_AFTER_BACKGROUND_MS = 60 * 1000;

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warn';
  action?: { label: string; onPress: () => void };
}

interface UiState {
  locked: boolean;
  backgroundAt?: number;
  reauthUntil: number;
  toast?: Toast;
  addOpen: boolean;
  /** A pending "prove it's you" request (fingerprint or PIN), answered by ReauthHost. */
  reauth?: { reason: string; resolve: (ok: boolean) => void };
  lock(): void;
  unlock(): void;
  markBackground(at: number): void;
  markReauth(now?: number): void;
  showToast(text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>>): void;
  hideToast(id: number): void;
  setAddOpen(open: boolean): void;
  requestReauth(reason: string): Promise<boolean>;
  finishReauth(ok: boolean): void;
  pendingInvite?: PendingInvite;
  setPendingInvite(invite: PendingInvite | undefined): void;
}

let toastId = 0;

export const useUi = create<UiState>()((set) => ({
  locked: true,
  reauthUntil: 0,
  addOpen: false,
  pendingInvite: loadPendingInvite(),
  setPendingInvite: (invite) => {
    savePendingInvite(invite);
    set({ pendingInvite: invite });
  },
  lock: () => set({ locked: true, reauthUntil: 0 }),
  unlock: () => set({ locked: false, backgroundAt: undefined, reauthUntil: Date.now() + REAUTH_GRACE_MS }),
  markBackground: (at) => set({ backgroundAt: at }),
  markReauth: (now = Date.now()) => set({ reauthUntil: now + REAUTH_GRACE_MS }),
  showToast: (text, opts) => set({ toast: { id: ++toastId, text, tone: opts?.tone ?? 'info', action: opts?.action } }),
  hideToast: (id) => set((s) => (s.toast?.id === id ? { toast: undefined } : s)),
  setAddOpen: (open) => set({ addOpen: open }),
  requestReauth: (reason) =>
    new Promise<boolean>((resolve) => {
      useUi.getState().reauth?.resolve(false);
      set({ reauth: { reason, resolve } });
    }),
  finishReauth: (ok) =>
    set((s) => {
      s.reauth?.resolve(ok);
      return { reauth: undefined, reauthUntil: ok ? Date.now() + REAUTH_GRACE_MS : s.reauthUntil };
    }),
}));

export const toast = (text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>>) => useUi.getState().showToast(text, opts);
