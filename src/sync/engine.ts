/**
 * The sync engine: moves a family's changes between this device and the
 * server, locked on the way out and opened on the way in.
 *
 * It works on a Replica (the device's copy: the family, its sync state and
 * the keys), so the same code runs in the app and in tests that play two
 * family members against the local server.
 */
import type { DocItem, Family, FileRef } from '@/domain/types';
import {
  CryptoError, decryptBytes, decryptJson, encryptBytes, encryptJson, fromB64, openSealed, randomKey, seal, toB64,
  type KeyPair,
} from '@/lib/crypto';

import type { CloudApi, PullRow, PushRow } from './api';
import { ikContext, recordContext } from './contexts';
import { deepEqual, mergeRecords } from './merge';
import { applyRecord, desiredVisibility, readRecord, type Change, type RecordKind } from './model';
import type { BaseEntry, FamilySync, OutboxEntry } from './types';

export interface Replica {
  readonly userId: string;
  family(familyId: string): Family | undefined;
  /** Applies what came from the server, without queueing it to go back. */
  applyRemote(familyId: string, fn: (draft: Family) => void): void;
  sync(familyId: string): FamilySync | undefined;
  updateSync(familyId: string, fn: (draft: FamilySync) => void): void;
  keyPair(version: number): KeyPair | undefined;
  familyKey(familyId: string, keyVersion: number): Uint8Array | undefined;
  currentFamilyKey(familyId: string): { version: number; key: Uint8Array } | undefined;
}

/** Where this device keeps encrypted file bytes. */
export interface CipherStore {
  read(fileId: string): Promise<Uint8Array | null>;
  write(fileId: string, bytes: Uint8Array): Promise<void>;
  has(fileId: string): Promise<boolean>;
  forget(fileId: string): Promise<void>;
}

export interface SyncNotices {
  /** Two people changed the same item at once, or an edit brought back a deleted item. */
  merged?(familyId: string, kind: RecordKind, title: string, restored: boolean): void;
}

export { fileContext, ikContext, recordContext } from './contexts';

let clock = 0;
/** Strictly increasing time stamps, so a newer edit is always told from one being sent. */
export function tick(): number {
  clock = Math.max(Date.now(), clock + 1);
  return clock;
}

function filesOf(data: unknown): FileRef[] {
  const files = (data as Partial<DocItem> | null)?.files;
  return Array.isArray(files) ? files : [];
}

function titleOf(kind: RecordKind, data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  return String(d.title ?? d.fullName ?? d.bank ?? d.name ?? kind);
}

// ---------------------------------------------------------------- local changes in

/** Queues changes made on this device. Called by the app for every edit of a synced family. */
export function queueChanges(replica: Replica, familyId: string, changes: Change[]): void {
  if (changes.length === 0) return;
  replica.updateSync(familyId, (s) => {
    for (const c of changes) {
      if (c.kind === 'activity' && (s.base[c.id] || s.outbox[c.id])) continue; // entries never change
      if (c.data === null && !s.base[c.id] && s.outbox[c.id]) {
        delete s.outbox[c.id]; // made and removed before it ever reached the server
        continue;
      }
      s.outbox[c.id] = { kind: c.kind, data: c.data, at: tick() };
      if (c.kind === 'document' && c.data) {
        const known = new Set(filesOf(s.base[c.id]?.data).map((f) => f.id));
        for (const f of filesOf(c.data)) {
          if (f.key && !known.has(f.id) && !s.pendingUploads.includes(f.id)) s.pendingUploads.push(f.id);
        }
      }
    }
  });
}

// ---------------------------------------------------------------- locking and opening

type Encoded = { row: PushRow; ik?: string; visibleTo: string | null } | 'drop' | 'wait';

function encode(replica: Replica, familyId: string, id: string, entry: OutboxEntry, base: BaseEntry | undefined): Encoded {
  if (entry.data === null) {
    if (!base || base.data === null) return 'drop';
    return { row: { id, purge: true, base_seq: base.seq }, visibleTo: null };
  }
  // Somebody else's private record is not ours to write.
  if (base && base.visibleTo && base.visibleTo !== replica.userId) return 'drop';
  const family = replica.family(familyId);
  const sync = replica.sync(familyId);
  if (!family || !sync) return 'wait';
  const visibleTo = desiredVisibility(family, entry.kind, entry.data, (memberId) => sync.members[memberId]);
  const ik = base?.ik ? fromB64(base.ik) : randomKey();
  let keyBox: string;
  let keyRef: string;
  if (visibleTo === null) {
    const fk = replica.currentFamilyKey(familyId);
    if (!fk) return 'wait';
    keyBox = encryptBytes(ik, fk.key, ikContext(familyId, id));
    keyRef = `f:${fk.version}`;
  } else {
    const pk = sync.publicKeys[visibleTo];
    if (!pk) return 'wait';
    keyBox = seal(ik, fromB64(pk.key));
    keyRef = `u:${visibleTo}:${pk.version}`;
  }
  return {
    row: {
      id, kind: entry.kind, visible_to: visibleTo, key_ref: keyRef, key_box: keyBox,
      data_box: encryptJson(entry.data, ik, recordContext(familyId, id, entry.kind)), base_seq: base?.seq ?? null,
    },
    ik: toB64(ik),
    visibleTo,
  };
}

type Opened = { data: unknown; ik: string; visibleTo: string | null } | 'locked';

export function openRow(replica: Replica, familyId: string, row: PullRow): Opened {
  if (!row.key_ref || !row.key_box || !row.data_box) return 'locked';
  try {
    let ik: Uint8Array;
    let visibleTo: string | null = null;
    if (row.key_ref.startsWith('f:')) {
      const fk = replica.familyKey(familyId, Number(row.key_ref.slice(2)));
      if (!fk) return 'locked';
      ik = decryptBytes(row.key_box, fk, ikContext(familyId, row.id));
    } else if (row.key_ref.startsWith('u:')) {
      const [, userId, version] = row.key_ref.split(':');
      if (userId !== replica.userId) return 'locked';
      const pair = replica.keyPair(Number(version));
      if (!pair) return 'locked';
      ik = openSealed(row.key_box, pair);
      visibleTo = userId;
    } else {
      return 'locked';
    }
    const data = decryptJson(row.data_box, ik, recordContext(familyId, row.id, row.kind));
    return { data, ik: toB64(ik), visibleTo };
  } catch (e) {
    if (e instanceof CryptoError || e instanceof SyntaxError) return 'locked';
    throw e;
  }
}

// ---------------------------------------------------------------- server changes in

function receive(replica: Replica, familyId: string, row: PullRow, notices: SyncNotices, files?: CipherStore): void {
  const sync = replica.sync(familyId);
  if (!sync) return;
  const base = sync.base[row.id];
  if (base && row.seq <= base.seq) return; // our own write coming back
  const kind = row.kind as RecordKind;
  const pending = sync.outbox[row.id];

  if (row.purged || !row.visible) {
    const gone = readRecord(replica.family(familyId) as Family, kind, row.id);
    replica.applyRemote(familyId, (d) => applyRecord(d, kind, row.id, null));
    replica.updateSync(familyId, (s) => {
      if (row.purged) s.base[row.id] = { seq: row.seq, kind, data: null, visibleTo: null };
      else delete s.base[row.id];
      delete s.outbox[row.id];
      delete s.locked[row.id];
    });
    if (files) for (const f of filesOf(gone)) void files.forget(f.id).catch(() => undefined);
    return;
  }

  const opened = openRow(replica, familyId, row);
  if (opened === 'locked') {
    replica.updateSync(familyId, (s) => {
      s.locked[row.id] = kind;
    });
    return;
  }
  const remote: BaseEntry = { seq: row.seq, kind, data: opened.data, ik: opened.ik, visibleTo: opened.visibleTo };

  if (!pending || kind === 'activity') {
    replica.applyRemote(familyId, (d) => applyRecord(d, kind, row.id, opened.data));
    replica.updateSync(familyId, (s) => {
      s.base[row.id] = remote;
      delete s.locked[row.id];
      if (kind === 'activity') delete s.outbox[row.id];
    });
    return;
  }

  if (pending.data === null) {
    // A purge waiting to go: it still goes, now against the newer version.
    replica.updateSync(familyId, (s) => {
      s.base[row.id] = remote;
    });
    return;
  }

  const m = mergeRecords(base?.data, pending.data, opened.data);
  const same = deepEqual(m.merged, opened.data);
  replica.applyRemote(familyId, (d) => applyRecord(d, kind, row.id, m.merged));
  replica.updateSync(familyId, (s) => {
    s.base[row.id] = remote;
    delete s.locked[row.id];
    if (same) delete s.outbox[row.id];
    else s.outbox[row.id] = { kind, data: m.merged, at: tick() };
  });
  if (m.overwritten.length || m.restored) notices.merged?.(familyId, kind, titleOf(kind, m.merged), m.restored);
}

// ---------------------------------------------------------------- the steps

export async function refreshMembers(api: CloudApi, replica: Replica, familyId: string): Promise<void> {
  const rows = await api.familyMembers(familyId);
  const keys = await api.publicKeys(rows.map((r) => r.user_id));
  const newest: FamilySync['publicKeys'] = {};
  for (const k of keys) {
    if (!newest[k.user_id] || k.version > newest[k.user_id].version) newest[k.user_id] = { version: k.version, key: k.public_key };
  }
  replica.updateSync(familyId, (s) => {
    s.members = Object.fromEntries(rows.map((r) => [r.member_id, r.user_id]));
    s.publicKeys = newest;
  });
}

export async function uploadFiles(api: CloudApi, replica: Replica, familyId: string, files: CipherStore): Promise<void> {
  for (const fileId of [...(replica.sync(familyId)?.pendingUploads ?? [])]) {
    const bytes = await files.read(fileId);
    if (bytes) await api.uploadFile(familyId, fileId, bytes);
    replica.updateSync(familyId, (s) => {
      s.pendingUploads = s.pendingUploads.filter((id) => id !== fileId);
    });
  }
}

export async function push(api: CloudApi, replica: Replica, familyId: string, notices: SyncNotices = {}, files?: CipherStore): Promise<void> {
  for (let round = 0; round < 50; round++) {
    const sync = replica.sync(familyId);
    if (!sync) return;
    const ids = Object.keys(sync.outbox).slice(0, 100);
    if (ids.length === 0) return;
    const sent = new Map<string, { at: number; entry: OutboxEntry; ik?: string; visibleTo: string | null }>();
    const rows: PushRow[] = [];
    for (const id of ids) {
      const entry = sync.outbox[id];
      const result = encode(replica, familyId, id, entry, sync.base[id]);
      if (result === 'drop') {
        replica.updateSync(familyId, (s) => {
          if (s.outbox[id]?.at === entry.at) delete s.outbox[id];
        });
        continue;
      }
      if (result === 'wait') continue;
      rows.push(result.row);
      sent.set(id, { at: entry.at, entry, ik: result.ik, visibleTo: result.visibleTo });
    }
    if (rows.length === 0) return;

    const results = await api.push(familyId, rows);
    let conflicts = 0;
    for (const res of results) {
      const item = sent.get(res.id);
      if (!item) continue;
      const before = replica.sync(familyId)?.base[res.id];
      if (res.status === 'ok' && typeof res.seq === 'number' && item.visibleTo && item.visibleTo !== replica.userId) {
        // Sealed for someone else (the family made personal papers private): it leaves this device now.
        replica.applyRemote(familyId, (d) => applyRecord(d, item.entry.kind, res.id, null));
        replica.updateSync(familyId, (s) => {
          delete s.base[res.id];
          if (s.outbox[res.id]?.at === item.at) delete s.outbox[res.id];
        });
        if (files) for (const f of filesOf(item.entry.data)) await files.forget(f.id).catch(() => undefined);
      } else if (res.status === 'ok' && typeof res.seq === 'number') {
        const seq = res.seq;
        replica.updateSync(familyId, (s) => {
          s.base[res.id] = { seq, kind: item.entry.kind, data: item.entry.data, ik: item.ik, visibleTo: item.visibleTo };
          if (s.outbox[res.id]?.at === item.at) delete s.outbox[res.id];
        });
        // Files no longer referenced leave the server too.
        if (item.entry.kind === 'document') {
          const keep = new Set(filesOf(item.entry.data).map((f) => f.id));
          const removed = filesOf(before?.data).map((f) => f.id).filter((id) => !keep.has(id));
          if (removed.length) {
            await api.removeFiles(familyId, removed).catch(() => undefined);
            if (files) for (const id of removed) await files.forget(id).catch(() => undefined);
          }
        }
      } else if (res.status === 'conflict' && res.current) {
        conflicts++;
        receive(replica, familyId, { ...res.current, visible: true }, notices, files);
      } else {
        // forbidden or gone: it is no longer ours to have.
        replica.applyRemote(familyId, (d) => applyRecord(d, item.entry.kind, res.id, null));
        replica.updateSync(familyId, (s) => {
          delete s.outbox[res.id];
          delete s.base[res.id];
        });
      }
    }
    // Go round again only for merged conflicts or items edited again while they were being sent.
    // Anything else left is waiting for a key and goes with a later sync.
    const left = Object.keys(replica.sync(familyId)?.outbox ?? {});
    const attempted = new Set(ids);
    if (conflicts === 0 && !left.some((id) => sent.has(id) || !attempted.has(id))) return;
  }
}

export async function pull(api: CloudApi, replica: Replica, familyId: string, notices: SyncNotices = {}, files?: CipherStore): Promise<number> {
  let received = 0;
  for (;;) {
    const cursor = replica.sync(familyId)?.cursor ?? 0;
    const rows = await api.pull(familyId, cursor, 500);
    for (const row of rows) receive(replica, familyId, row, notices, files);
    received += rows.length;
    if (rows.length) {
      const last = rows[rows.length - 1].seq;
      replica.updateSync(familyId, (s) => {
        s.cursor = Math.max(s.cursor, last);
      });
    }
    if (rows.length < 500) return received;
  }
}

/**
 * Re-seals records whose "who can read it" is out of date: after the family
 * setting changed, someone joined, or an item was made Only me. Queues them;
 * the next push does the work.
 */
export function reconcile(replica: Replica, familyId: string): number {
  const family = replica.family(familyId);
  const sync = replica.sync(familyId);
  if (!family || !sync) return 0;
  const userOf = (memberId: string) => sync.members[memberId];
  const queue: Change[] = [];
  for (const [id, base] of Object.entries(sync.base)) {
    if (base.data === null || sync.outbox[id]) continue;
    if (base.visibleTo && base.visibleTo !== replica.userId) continue;
    const current = readRecord(family, base.kind, id) ?? base.data;
    if (desiredVisibility(family, base.kind, current, userOf) !== base.visibleTo) queue.push({ id, kind: base.kind, data: current });
  }
  if (queue.length) {
    replica.updateSync(familyId, (s) => {
      for (const c of queue) s.outbox[c.id] = { kind: c.kind, data: c.data, at: tick() };
    });
  }
  return queue.length;
}

/** Lets in people who asked to join with their invited email but without the link. */
export async function completeJoins(api: CloudApi, replica: Replica, familyId: string): Promise<number> {
  const waiting = await api.pendingJoins(familyId);
  const fk = replica.currentFamilyKey(familyId);
  if (!fk || waiting.length === 0) return 0;
  for (const w of waiting) await api.completeJoin(w.invite_id, seal(fk.key, fromB64(w.public_key)));
  return waiting.length;
}

/** Downloads files this device does not have yet, so they open without internet. */
export async function prefetchFiles(api: CloudApi, replica: Replica, familyId: string, files: CipherStore, limit = 50): Promise<number> {
  const family = replica.family(familyId);
  if (!family) return 0;
  let fetched = 0;
  for (const doc of family.documents) {
    for (const f of doc.files) {
      if (!f.key || fetched >= limit) continue;
      if (await files.has(f.id)) continue;
      const bytes = await api.downloadFile(familyId, f.id).catch(() => null);
      if (bytes) {
        await files.write(f.id, bytes);
        fetched++;
      }
    }
  }
  return fetched;
}

/** One full round for a family: who is in it, files up, changes up, changes down, privacy re-seals, joins. */
export async function syncFamily(
  api: CloudApi,
  replica: Replica,
  familyId: string,
  opts: { files?: CipherStore; notices?: SyncNotices; prefetch?: boolean } = {},
): Promise<void> {
  const notices = opts.notices ?? {};
  await refreshMembers(api, replica, familyId);
  if (opts.files) await uploadFiles(api, replica, familyId, opts.files);
  await push(api, replica, familyId, notices, opts.files);
  await pull(api, replica, familyId, notices, opts.files);
  if (reconcile(replica, familyId) > 0 || Object.keys(replica.sync(familyId)?.outbox ?? {}).length) {
    await push(api, replica, familyId, notices, opts.files);
    await pull(api, replica, familyId, notices, opts.files);
  }
  if ((await completeJoins(api, replica, familyId)) > 0) await refreshMembers(api, replica, familyId);
  if (opts.files && opts.prefetch) await prefetchFiles(api, replica, familyId, opts.files);
  replica.updateSync(familyId, (s) => {
    s.lastSyncedAt = Date.now();
    s.lastError = undefined;
  });
}
