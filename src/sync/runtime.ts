/**
 * The cloud, running inside the app: the Supabase client, the store as a sync
 * replica, the watcher that queues every local edit, and the scheduler that
 * syncs on start, on every change, when realtime says the family changed,
 * when the app comes back to the foreground or online, and every minute.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { AppState as RNAppState, Platform } from 'react-native';
import { create } from 'zustand';

import { fromB64, initCrypto, keyPairFromMaster, openSealed, toB64, type KeyPair } from '@/lib/crypto';
import { useApp } from '@/store/app-store';
import { cipherStore, setFileRemote } from '@/store/files';
import { kv } from '@/store/kv';
import { flushSaves } from '@/store/persist-storage';
import { toast } from '@/store/ui-store';

import { CloudApi, CloudError, type DeviceRequest } from './api';
import { queueChanges, syncFamily, type Replica, type SyncNotices } from './engine';
import { diffFamily, emptyFamily } from './model';
import { emptySync } from './types';
import { currentEntry } from './vault';

// ---------------------------------------------------------------- the client

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export function cloudConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_KEY;
}

let client: SupabaseClient | null = null;
let cloudApi: CloudApi | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new CloudError('Almari is not connected to its server. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.');
    }
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
        // The session is kept with the rest of Almari's data, encrypted with the device key on the web.
        storage: { getItem: (k) => kv.getItem(`auth:${k}`), setItem: (k, v) => kv.setItem(`auth:${k}`, v), removeItem: (k) => kv.removeItem(`auth:${k}`) },
      },
    });
  }
  return client;
}

export function api(): CloudApi {
  if (!cloudApi) cloudApi = new CloudApi(supabase());
  return cloudApi;
}

// ---------------------------------------------------------------- status for the screens

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export const useSyncStatus = create<{ state: SyncState; lastSyncedAt?: number; message?: string }>(() => ({ state: 'idle' }));

// ---------------------------------------------------------------- the store as a replica

let applying = 0;
const pairs = new Map<string, KeyPair>();

export const appReplica: Replica = {
  get userId() {
    return useApp.getState().cloud?.userId ?? '';
  },
  family: (familyId) => useApp.getState().families[familyId],
  applyRemote(familyId, fn) {
    applying++;
    try {
      useApp.setState((s) => {
        const family = s.families[familyId];
        if (family) fn(family);
      });
    } finally {
      applying--;
    }
  },
  sync: (familyId) => useApp.getState().cloud?.sync[familyId],
  updateSync(familyId, fn) {
    useApp.setState((s) => {
      const sync = s.cloud?.sync[familyId];
      if (sync) fn(sync);
    });
  },
  keyPair(version) {
    const cloud = useApp.getState().cloud;
    const entry = cloud && currentEntry(cloud.keyring, version);
    if (!entry) return undefined;
    const cacheKey = `${cloud.userId}:${version}:${entry.amk.slice(0, 8)}`;
    let pair = pairs.get(cacheKey);
    if (!pair) {
      pair = keyPairFromMaster(fromB64(entry.amk));
      pairs.set(cacheKey, pair);
    }
    return pair;
  },
  familyKey(familyId, keyVersion) {
    const b64 = useApp.getState().cloud?.familyKeys[familyId]?.[String(keyVersion)];
    return b64 ? fromB64(b64) : undefined;
  },
  currentFamilyKey(familyId) {
    const keys = useApp.getState().cloud?.familyKeys[familyId];
    if (!keys) return undefined;
    const version = Math.max(...Object.keys(keys).map(Number));
    return Number.isFinite(version) ? { version, key: fromB64(keys[String(version)]) } : undefined;
  },
};

/** The device holds the account's current key: it can sync. */
export function deviceReady(): boolean {
  const cloud = useApp.getState().cloud;
  return !!cloud && cloud.currentVersion > 0 && !!currentEntry(cloud.keyring, cloud.currentVersion);
}

// ---------------------------------------------------------------- one sync round

const notices: SyncNotices = {
  merged(_familyId, _kind, title, restored) {
    toast(
      restored
        ? `“${title}” was deleted on one phone and changed on another, so it was kept.`
        : `Two people changed “${title}” at the same time. Both changes are kept; the earlier one is in its history.`,
      { tone: 'info' },
    );
  },
};

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let onRevoked: (() => void) | null = null;

/** What to do when this device was removed from the account (set by the account module). */
export function setRevokedHandler(fn: () => void) {
  onRevoked = fn;
}

export function deviceName(): string {
  if (Platform.OS !== 'web') return Platform.OS === 'android' ? 'Android phone' : 'Phone';
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'computer';
  return `${browser} on ${os}`;
}

/** Families and family keys from the server: new ones arrive, ones this account left or was removed from go. */
export async function syncMemberships(): Promise<void> {
  const cloud = useApp.getState().cloud;
  if (!cloud) return;
  const server = await api().myFamilies(cloud.userId);
  const keys = await api().myFamilyKeys(cloud.userId);
  const opened: Record<string, Record<string, string>> = {};
  for (const k of keys) {
    const pair = appReplica.keyPair(k.user_key_version);
    if (!pair) continue;
    try {
      (opened[k.family_id] ??= {})[String(k.key_version)] = toB64(openSealed(k.box, pair));
    } catch {
      // sealed for a key this device does not have
    }
  }
  const serverIds = new Set(server.map((f) => f.family_id));
  const gone = Object.keys(cloud.memberships).filter((id) => !serverIds.has(id));
  for (const id of gone) {
    const name = useApp.getState().families[id]?.name;
    useApp.getState().forgetFamily(id);
    if (name) toast(`You are no longer in ${name}. Its papers have left this device.`, { tone: 'info' });
  }
  useApp.setState((s) => {
    if (!s.cloud) return;
    for (const f of server) {
      s.cloud.memberships[f.family_id] = { memberId: f.member_id };
      s.cloud.sync[f.family_id] ??= emptySync();
      if (opened[f.family_id]) s.cloud.familyKeys[f.family_id] = { ...s.cloud.familyKeys[f.family_id], ...opened[f.family_id] };
      if (!s.families[f.family_id]) s.families[f.family_id] = emptyFamily(f.family_id);
      if (!s.session.familyId || !s.families[s.session.familyId]) s.session = { familyId: f.family_id };
    }
  });
}

/** After a family's first pull: this account's own member card says it has joined. */
function claimMyMember(familyId: string) {
  const s = useApp.getState();
  const memberId = s.cloud?.memberships[familyId]?.memberId;
  const family = s.families[familyId];
  const me = family?.members.find((m) => m.id === memberId);
  if (!s.cloud || !me || (me.status === 'active' && me.accountId === s.cloud.userId)) return;
  useApp.setState((d) => {
    const m = d.families[familyId]?.members.find((x) => x.id === memberId);
    if (!m || !d.cloud) return;
    m.status = 'active';
    m.kind = 'account';
    m.accountId = d.cloud.userId;
    m.email = d.cloud.email;
    m.inviteLink = undefined;
    d.families[familyId].activity.unshift({ id: crypto.randomUUID(), at: Date.now(), by: m.id, kind: 'member', text: 'joined the family' });
  });
}

async function round(): Promise<void> {
  const s0 = useApp.getState();
  if (!s0.cloud || !deviceReady()) return;
  await initCrypto();
  const touch = await api().touchDevice(s0.device.deviceId, deviceName());
  if (touch.revoked) {
    onRevoked?.();
    return;
  }
  await syncMemberships();
  const cloud = useApp.getState().cloud;
  if (!cloud) return;
  for (const familyId of Object.keys(cloud.memberships)) {
    if (!appReplica.currentFamilyKey(familyId)) continue;
    await syncFamily(api(), appReplica, familyId, { files: cipherStore, notices, prefetch: true });
    claimMyMember(familyId);
  }
  // A claim queues one more change: send it now.
  for (const familyId of Object.keys(useApp.getState().cloud?.memberships ?? {})) {
    if (Object.keys(useApp.getState().cloud?.sync[familyId]?.outbox ?? {}).length && appReplica.currentFamilyKey(familyId)) {
      await syncFamily(api(), appReplica, familyId, { files: cipherStore, notices });
    }
  }
  await flushSaves();
  watchRealtime();
}

/** Runs a sync now (or right after the one in progress). Resolves when it is done. */
export function syncNow(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (running) {
    again = true;
    return running;
  }
  useSyncStatus.setState({ state: 'syncing' });
  running = (async () => {
    try {
      do {
        again = false;
        await round();
      } while (again);
      useSyncStatus.setState({ state: 'idle', lastSyncedAt: Date.now(), message: undefined });
    } catch (e) {
      const offline = e instanceof CloudError && e.offline;
      useSyncStatus.setState({ state: offline ? 'offline' : 'error', message: (e as Error).message });
      if (!offline) console.warn('Sync failed', e);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Asks for a sync soon, gathering quick edits into one. */
export function requestSync(delayMs = 700): void {
  if (!cloudConfigured() || !deviceReady()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delayMs);
}

// ---------------------------------------------------------------- realtime: the family changed

let channels: { key: string; channel: RealtimeChannel }[] = [];
let realtimeKey = '';

function watchRealtime() {
  const cloud = useApp.getState().cloud;
  const families = Object.keys(cloud?.memberships ?? {}).sort();
  const key = `${cloud?.userId}:${families.join(',')}`;
  if (!cloud || key === realtimeKey) return;
  stopRealtime();
  realtimeKey = key;
  const sb = supabase();
  for (const familyId of families) {
    const channel = sb
      .channel(`family:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `family_id=eq.${familyId}` }, () => requestSync(400))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${familyId}` }, () => requestSync(400))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invites', filter: `family_id=eq.${familyId}` }, () => requestSync(400))
      .subscribe();
    channels.push({ key: familyId, channel });
  }
  const personal = sb
    .channel(`account:${cloud.userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'device_requests' }, () => useDeviceRequests.getState().refresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members', filter: `user_id=eq.${cloud.userId}` }, () => requestSync(400))
    .subscribe();
  channels.push({ key: 'account', channel: personal });
}

export function stopRealtime() {
  for (const { channel } of channels) void supabase().removeChannel(channel);
  channels = [];
  realtimeKey = '';
}

// ---------------------------------------------------------------- requests to let a device in (shown to approvers)

export const useDeviceRequests = create<{ requests: DeviceRequest[]; refresh(): Promise<void> }>((set) => ({
  requests: [],
  async refresh() {
    const s = useApp.getState();
    if (!s.cloud || !deviceReady()) return set({ requests: [] });
    try {
      const all = await api().openDeviceRequests();
      // Not this device's own request.
      set({ requests: all.filter((r) => r.device_id !== s.device.deviceId) });
    } catch {
      // try again at the next sync
    }
  },
}));

// ---------------------------------------------------------------- start-up

let started = false;

/** Called once the store has loaded. Watches edits and keeps the device in sync. */
export function startCloud(): void {
  if (started || !cloudConfigured()) return;
  started = true;
  setFileRemote((familyId, fileId) => api().downloadFile(familyId, fileId));

  // Every local edit of a synced family is queued for the server.
  useApp.subscribe((state, prev) => {
    if (applying > 0 || !state.cloud || state.families === prev.families) return;
    let queued = false;
    for (const [familyId, family] of Object.entries(state.families)) {
      if (family.isSample || !state.cloud.memberships[familyId]) continue;
      const before = prev.families[familyId];
      if (before === family || !prev.cloud?.memberships[familyId]) continue;
      const changes = diffFamily(before, family);
      if (changes.length) {
        queueChanges(appReplica, familyId, changes);
        queued = true;
      }
    }
    if (queued) requestSync();
  });

  RNAppState.addEventListener('change', (state) => {
    if (state === 'active') requestSync(200);
    if (state === 'background') void flushSaves();
  });
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => requestSync(200));
    window.addEventListener('focus', () => requestSync(200));
    window.addEventListener('pagehide', () => void flushSaves());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushSaves();
    });
  }
  setInterval(() => requestSync(0), 60_000);
  setInterval(() => void useDeviceRequests.getState().refresh(), 30_000);
  requestSync(0);
  void useDeviceRequests.getState().refresh();
}
