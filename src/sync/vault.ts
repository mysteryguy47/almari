/**
 * The account's keys on this device: first set-up, letting a new device in
 * (from your own other device or a family member's), the Recovery Kit, and
 * starting fresh. See docs/BACKEND.md, "A new device, and recovery".
 */
import {
  CryptoError, decryptJson, encryptJson, fromB64, fromUtf8, keyPairFromMaster, keySymbols, kitKey, kitQrText, newKitWords,
  openSealed, randomKey, seal, toB64, utf8,
} from '@/lib/crypto';

import { CloudError, type CloudApi, type DeviceRequest } from './api';
import type { KeyringEntry, PendingApproval } from './types';

export const keyringContext = (userId: string) => `keyring:${userId}`;
export const kitContext = (userId: string) => `kit:${userId}`;

export function currentEntry(keyring: KeyringEntry[], version: number): KeyringEntry | undefined {
  return keyring.find((k) => k.version === version);
}

export function mergeKeyrings(...rings: KeyringEntry[][]): KeyringEntry[] {
  const byVersion = new Map<number, KeyringEntry>();
  for (const ring of rings) for (const k of ring) byVersion.set(k.version, k);
  return [...byVersion.values()].sort((a, b) => a.version - b.version);
}

export function symbolsFor(publicKeyB64: string) {
  return keySymbols(fromB64(publicKeyB64));
}

// ---------------------------------------------------------------- state of this device

export type DeviceState =
  | { status: 'new-account' }
  | { status: 'ready'; keyring: KeyringEntry[]; currentVersion: number; kitCreatedAt: string | null }
  | {
      status: 'needs-approval';
      currentVersion: number;
      hasKit: boolean;
      /** Other devices of this account that could approve. */
      ownDevices: { id: string; name: string; lastSeen: string }[];
      /** Someone in one of your families could let you back in. */
      familyCanHelp: boolean;
      /** Older key versions this device holds (from a kit), kept while it waits. */
      partialKeyring: KeyringEntry[];
    };

export async function checkDevice(api: CloudApi, userId: string, deviceId: string, localKeyring: KeyringEntry[]): Promise<DeviceState> {
  const vault = await api.vault(userId);
  if (!vault) return { status: 'new-account' };
  const entry = currentEntry(localKeyring, vault.current_version);
  if (entry) {
    const keys = await api.publicKeys([userId]);
    const server = keys.find((k) => k.version === vault.current_version)?.public_key;
    if (server && server === toB64(keyPairFromMaster(fromB64(entry.amk)).publicKey)) {
      return { status: 'ready', keyring: localKeyring, currentVersion: vault.current_version, kitCreatedAt: vault.kit_created_at };
    }
  }
  const devices = (await api.devices()).filter((d) => d.user_id === userId && !d.revoked_at && d.id !== deviceId);
  let familyCanHelp = false;
  for (const f of await api.myFamilies(userId)) {
    if ((await api.familyMembers(f.family_id)).length > 1) {
      familyCanHelp = true;
      break;
    }
  }
  return {
    status: 'needs-approval',
    currentVersion: vault.current_version,
    hasKit: !!vault.recovery_box,
    ownDevices: devices.map((d) => ({ id: d.id, name: d.name, lastSeen: d.last_seen_at })),
    familyCanHelp,
    partialKeyring: localKeyring,
  };
}

// ---------------------------------------------------------------- a brand-new account

export async function setUpNewAccount(api: CloudApi, userId: string): Promise<{ keyring: KeyringEntry[]; currentVersion: number }> {
  const amk = randomKey();
  const keyring = [{ version: 1, amk: toB64(amk) }];
  await api.initVault(toB64(keyPairFromMaster(amk).publicKey), encryptJson(keyring, amk, keyringContext(userId)));
  return { keyring, currentVersion: 1 };
}

// ---------------------------------------------------------------- letting a new device in

export async function requestApproval(api: CloudApi, deviceId: string, deviceName: string, currentVersion: number): Promise<PendingApproval> {
  const amk = randomKey();
  const publicKey = toB64(keyPairFromMaster(amk).publicKey);
  const requestId = await api.createDeviceRequest(deviceId, deviceName, publicKey);
  return { requestId, nextAmk: toB64(amk), nextVersion: currentVersion + 1, createdAt: Date.now() };
}

export function pendingPublicKey(pending: PendingApproval): string {
  return toB64(keyPairFromMaster(fromB64(pending.nextAmk)).publicKey);
}

export type ApprovalCheck =
  | { status: 'waiting' | 'declined' | 'expired' }
  | { status: 'ready'; keyring: KeyringEntry[]; currentVersion: number; byFamily: boolean };

export async function checkApproval(api: CloudApi, userId: string, pending: PendingApproval, partial: KeyringEntry[] = []): Promise<ApprovalCheck> {
  const request = await api.deviceRequest(pending.requestId);
  if (!request) return { status: 'expired' };
  if (request.status === 'declined') return { status: 'declined' };
  if (request.status === 'pending') return new Date(request.expires_at).getTime() < Date.now() ? { status: 'expired' } : { status: 'waiting' };
  if (request.status !== 'approved') return { status: 'expired' };
  const pair = keyPairFromMaster(fromB64(pending.nextAmk));
  if (request.mode === 'own' && request.keyring_box) {
    const given = JSON.parse(fromUtf8(openSealed(request.keyring_box, pair))) as KeyringEntry[];
    await api.finishOwnApproval(request.id);
    const vault = await api.vault(userId);
    return { status: 'ready', keyring: mergeKeyrings(partial, given), currentVersion: vault?.current_version ?? given[given.length - 1].version, byFamily: false };
  }
  // A family member approved: this device's new key version becomes the account's.
  const keyring = mergeKeyrings(partial, [{ version: request.next_version, amk: pending.nextAmk }]);
  const amk = fromB64(pending.nextAmk);
  const version = await api.finishFamilyRecovery(request.id, encryptJson(keyring, amk, keyringContext(userId)));
  return { status: 'ready', keyring, currentVersion: version, byFamily: true };
}

/**
 * Approving someone's new device from this one. Your own: the keyring goes
 * over. A family member's: the keys of the families you share with them only.
 */
export async function approveRequest(
  api: CloudApi,
  me: { userId: string; keyring: KeyringEntry[] },
  request: DeviceRequest,
  shared: { familyId: string; keyVersion: number; key: Uint8Array }[],
): Promise<void> {
  const publicKey = fromB64(request.public_key);
  if (request.user_id === me.userId) {
    await api.approveOwn(request.id, seal(utf8(JSON.stringify(me.keyring)), publicKey));
    return;
  }
  if (shared.length === 0) throw new CloudError('You do not share a family with this person');
  await api.approveFamily(
    request.id,
    shared.map((s) => ({ family_id: s.familyId, key_version: s.keyVersion, box: seal(s.key, publicKey) })),
  );
}

// ---------------------------------------------------------------- the Recovery Kit

export async function makeKit(api: CloudApi, userId: string, keyring: KeyringEntry[]): Promise<{ words: string[]; qr: string; createdAt: string }> {
  const { words, entropy } = newKitWords();
  const createdAt = new Date().toISOString();
  await api.updateVault(userId, { recovery_box: encryptJson(keyring, kitKey(entropy), kitContext(userId)), kit_created_at: createdAt });
  return { words, qr: kitQrText(entropy), createdAt };
}

export type KitResult =
  | { status: 'ready'; keyring: KeyringEntry[]; currentVersion: number }
  | { status: 'older'; keyring: KeyringEntry[]; currentVersion: number };

export async function openWithKit(api: CloudApi, userId: string, entropy: Uint8Array, localKeyring: KeyringEntry[]): Promise<KitResult> {
  const vault = await api.vault(userId);
  if (!vault?.recovery_box) throw new CloudError('No Recovery Kit was made for this account');
  let fromKit: KeyringEntry[];
  const key = kitKey(entropy);
  try {
    fromKit = decryptJson<KeyringEntry[]>(vault.recovery_box, key, kitContext(userId));
  } catch (e) {
    if (e instanceof CryptoError) throw new CloudError('These words are not this account’s Recovery Kit. Check each word, or use the newest kit.');
    throw e;
  }
  const keyring = mergeKeyrings(localKeyring, fromKit);
  const current = currentEntry(keyring, vault.current_version);
  if (!current) return { status: 'older', keyring, currentVersion: vault.current_version };
  // Keep the kit and the keyring covering every version.
  if (keyring.length !== fromKit.length) {
    await api.updateVault(userId, {
      recovery_box: encryptJson(keyring, key, kitContext(userId)),
      keyring_box: encryptJson(keyring, fromB64(current.amk), keyringContext(userId)),
    });
  }
  return { status: 'ready', keyring, currentVersion: vault.current_version };
}

// ---------------------------------------------------------------- starting fresh

/** Only when nobody could let this person back in (the server checks). Their families' files go first. */
export async function startFresh(api: CloudApi, userId: string): Promise<{ keyring: KeyringEntry[]; currentVersion: number }> {
  const vault = await api.vault(userId);
  const next = (vault?.current_version ?? 0) + 1;
  for (const f of await api.myFamilies(userId)) {
    if ((await api.familyMembers(f.family_id)).length > 1) {
      throw new CloudError('Someone in your family can let you back in. Ask them to approve this device.');
    }
    const files = await api.listFiles(f.family_id);
    for (let i = 0; i < files.length; i += 500) await api.removeFiles(f.family_id, files.slice(i, i + 500));
  }
  const amk = randomKey();
  const keyring = [{ version: next, amk: toB64(amk) }];
  const version = await api.resetVault(toB64(keyPairFromMaster(amk).publicKey), encryptJson(keyring, amk, keyringContext(userId)));
  if (version !== next) throw new CloudError('Your keys changed while starting fresh. Try again.');
  return { keyring, currentVersion: version };
}
