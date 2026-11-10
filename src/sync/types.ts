/** What this device keeps about the signed-in account and its sync. Persisted, encrypted at rest. */
import type { RecordKind } from './model';

export interface KeyringEntry {
  version: number;
  /** The account master key for this version, base64. */
  amk: string;
}

export interface BaseEntry {
  seq: number;
  kind: RecordKind;
  /** The record as last seen on the server; null when it is gone. */
  data: unknown | null;
  /** The record's own key, base64. */
  ik?: string;
  /** null: the whole family can read it; otherwise the one account that can. */
  visibleTo: string | null;
}

export interface OutboxEntry {
  kind: RecordKind;
  /** null: purge (gone for good). */
  data: unknown | null;
  /** When it was queued; also tells a newer edit from the one being sent. */
  at: number;
}

export interface FamilySync {
  cursor: number;
  base: Record<string, BaseEntry>;
  outbox: Record<string, OutboxEntry>;
  /** Records this device cannot open yet (an older key, or a private item). */
  locked: Record<string, RecordKind>;
  /** Member id → account id, from the server. */
  members: Record<string, string>;
  /** Account id → newest public key. */
  publicKeys: Record<string, { version: number; key: string }>;
  /** Files saved here that still need uploading. */
  pendingUploads: string[];
  lastSyncedAt?: number;
  lastError?: string;
}

export interface PendingApproval {
  requestId: string;
  /** The master key this device will use if a family member approves, base64. */
  nextAmk: string;
  nextVersion: number;
  createdAt: number;
}

export interface CloudState {
  userId: string;
  email: string;
  name: string;
  google: boolean;
  hasPassword: boolean;
  /** Every master key version this device holds. Empty until the device is set up. */
  keyring: KeyringEntry[];
  /** The account's current key version on the server (0 before the first one is made). */
  currentVersion: number;
  /** Family id → key version → family key, base64. */
  familyKeys: Record<string, Record<string, string>>;
  /** Family id → this account's member id in it. */
  memberships: Record<string, { memberId: string }>;
  sync: Record<string, FamilySync>;
  kitCreatedAt?: string;
  pendingApproval?: PendingApproval;
}

export function emptySync(): FamilySync {
  return { cursor: 0, base: {}, outbox: {}, locked: {}, members: {}, publicKeys: {}, pendingUploads: [] };
}
