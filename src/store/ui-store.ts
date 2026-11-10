/**
 * Short-lived UI state that is never saved: whether the app is locked, the
 * grace window after a fingerprint or PIN check, toasts, and the Add sheet.
 */
import { create } from 'zustand';

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
}

let toastId = 0;

export const useUi = create<UiState>()((set) => ({
  locked: true,
  reauthUntil: 0,
  addOpen: false,
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
