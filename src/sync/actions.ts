/**
 * Things that need the server first: making a family, inviting and joining,
 * leaving and removing, devices, and the Recovery Kit. Each talks to the
 * server, then changes the store; ordinary edits sync on their own.
 */
import { displayName, findMember } from '@/domain/access';
import { canJoinAnotherFamily, checkRemoval } from '@/domain/family-rules';
import type { Family, ID, Member } from '@/domain/types';
import { normaliseEmail } from '@/domain/validation';
import {
  decryptJson, encryptJson, fromB64, initCrypto, inviteKey, randomBytes, randomKey, seal, toB64,
} from '@/lib/crypto';
import { useApp, type Result } from '@/store/app-store';
import { newId } from '@/store/secrets';
import { toast, useUi } from '@/store/ui-store';

import { CloudError, type DeviceRequest, type DeviceRow, type InviteRow } from './api';
import { appOrigin, signOutAndForget } from './account';
import { inviteContext } from './contexts';
import { queueChanges } from './engine';
import { allRecords, emptyFamily } from './model';
import { api, appReplica, deviceName, syncNow } from './runtime';
import { emptySync, type CloudState } from './types';
import { approveRequest, checkApproval, makeKit, requestApproval, startFresh, openWithKit, type ApprovalCheck } from './vault';

const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: unknown): Result<never> => ({ ok: false, error: error instanceof Error ? error.message : String(error) });

function cloudOrThrow(): CloudState {
  const cloud = useApp.getState().cloud;
  if (!cloud) throw new CloudError('Sign in first');
  return cloud;
}

function myPublicKey(): Uint8Array {
  const cloud = cloudOrThrow();
  const pair = appReplica.keyPair(cloud.currentVersion);
  if (!pair) throw new CloudError('This device is not set up yet');
  return pair.publicKey;
}

function currentFamily(): { family: Family; memberId: ID } {
  const s = useApp.getState();
  const family = s.session.familyId ? s.families[s.session.familyId] : undefined;
  const memberId = family && s.cloud?.memberships[family.id]?.memberId;
  if (!family || !memberId) throw new CloudError('No family open');
  return { family, memberId };
}

// ---------------------------------------------------------------- families

export async function createFamily(name: string, you: Pick<Member, 'fullName' | 'dob' | 'gender' | 'phone'>): Promise<Result<ID>> {
  try {
    await initCrypto();
    const cloud = cloudOrThrow();
    if (!canJoinAnotherFamily({ familyIds: Object.keys(cloud.memberships) })) {
      return fail('You can be in up to 3 families. Leave one to start another.');
    }
    const familyId = crypto.randomUUID();
    const memberId = newId();
    const familyKey = randomKey();
    await api().createFamily(familyId, memberId, seal(familyKey, myPublicKey()));
    const now = Date.now();
    const family: Family = {
      ...emptyFamily(familyId, name.trim(), memberId),
      members: [{
        id: memberId, kind: 'account', accountId: cloud.userId, email: cloud.email, fullName: you.fullName.trim(),
        dob: you.dob, gender: you.gender, phone: you.phone, ids: {}, status: 'active', addedBy: memberId, createdAt: now,
      }],
      activity: [{ id: newId(), at: now, by: memberId, kind: 'member', text: `started ${name.trim()}` }],
    };
    useApp.setState((d) => {
      if (!d.cloud) return;
      d.cloud.memberships[familyId] = { memberId };
      d.cloud.familyKeys[familyId] = { '1': toB64(familyKey) };
      d.cloud.sync[familyId] = emptySync();
      d.cloud.name = you.fullName.trim();
      d.families[familyId] = family;
      d.session = { familyId };
    });
    queueChanges(appReplica, familyId, allRecords(family));
    void syncNow();
    return ok(familyId);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- invites

interface InviteBox {
  familyKey: string;
  keyVersion: number;
  familyName: string;
  invitedBy: string;
}

/** Makes an invite for an account member's email and keeps its link on their member card. */
export async function inviteMember(memberId: ID): Promise<Result<string>> {
  try {
    await initCrypto();
    const cloud = cloudOrThrow();
    const { family, memberId: me } = currentFamily();
    const member = findMember(family, memberId);
    if (!member?.email || member.kind !== 'account') return fail('Add their email first');
    const fk = appReplica.currentFamilyKey(family.id);
    if (!fk) return fail('This device cannot open the family key yet');
    const secret = randomBytes(32);
    const box: InviteBox = { familyKey: toB64(fk.key), keyVersion: fk.version, familyName: family.name, invitedBy: displayName(findMember(family, me)) };
    const inviteId = await api().createInvite({
      family_id: family.id, email: normaliseEmail(member.email), member_id: memberId,
      box: encryptJson(box, inviteKey(secret), inviteContext(family.id, memberId)), created_by: cloud.userId,
    });
    const link = `${appOrigin()}/join/${inviteId}#${toB64(secret)}`;
    useApp.setState((d) => {
      const m = d.families[family.id]?.members.find((x) => x.id === memberId);
      if (m) {
        m.inviteLink = link;
        m.inviteId = inviteId;
      }
    });
    return ok(link);
  } catch (e) {
    return fail(e);
  }
}

export async function cancelInvite(memberId: ID): Promise<Result> {
  try {
    const { family } = currentFamily();
    const member = findMember(family, memberId);
    if (member?.inviteId) await api().revokeInvite(member.inviteId);
    useApp.setState((d) => {
      const m = d.families[family.id]?.members.find((x) => x.id === memberId);
      if (m) {
        m.inviteLink = undefined;
        m.inviteId = undefined;
      }
    });
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function readInvite(inviteId: string, secret: string): Promise<Result<{ invite: InviteRow; box: InviteBox }>> {
  try {
    await initCrypto();
    const invite = await api().invite(inviteId);
    if (!invite) {
      return fail(`This invite is for another email. Sign in with the email it was sent to${useApp.getState().cloud ? ` (you are signed in as ${useApp.getState().cloud?.email})` : ''}.`);
    }
    if (invite.revoked_at) return fail('This invite was cancelled. Ask for a new one.');
    if (invite.accepted_at) return fail('This invite has already been used.');
    let box: InviteBox;
    try {
      box = decryptJson<InviteBox>(invite.box, inviteKey(fromB64(secret)), inviteContext(invite.family_id, invite.member_id));
    } catch {
      return fail('This link is incomplete. Open the whole link from the message.');
    }
    return ok({ invite, box });
  } catch (e) {
    return fail(e);
  }
}

export async function acceptInvite(inviteId: string, secret: string): Promise<Result<ID>> {
  const read = await readInvite(inviteId, secret);
  if (!read.ok) return read;
  try {
    const { invite, box } = read.value;
    const familyKey = fromB64(box.familyKey);
    await api().acceptInvite(inviteId, seal(familyKey, myPublicKey()));
    useApp.setState((d) => {
      if (!d.cloud) return;
      d.cloud.memberships[invite.family_id] = { memberId: invite.member_id };
      d.cloud.familyKeys[invite.family_id] = { [String(box.keyVersion)]: box.familyKey };
      d.cloud.sync[invite.family_id] = emptySync();
      d.families[invite.family_id] ??= emptyFamily(invite.family_id, box.familyName);
      d.session = { familyId: invite.family_id };
    });
    useUi.getState().setPendingInvite(undefined);
    await syncNow();
    return ok(invite.family_id);
  } catch (e) {
    return fail(e);
  }
}

/** Invites waiting for this account's email (opened without the link). */
export async function invitesForMe(): Promise<InviteRow[]> {
  const cloud = useApp.getState().cloud;
  if (!cloud) return [];
  const mine = new Set(Object.keys(cloud.memberships));
  return (await api().invitesFor(cloud.email)).filter((i) => !mine.has(i.family_id));
}

export async function askToJoin(inviteId: string): Promise<Result> {
  try {
    await api().requestJoin(inviteId);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- leaving, removing

export async function leaveFamily(): Promise<Result> {
  try {
    const { family } = currentFamily();
    const sync = useApp.getState().cloud?.sync[family.id];
    const others = Object.values(sync?.members ?? {}).filter((u) => u !== useApp.getState().cloud?.userId).length;
    useApp.getState().leaveLocally();
    await syncNow(); // their personal papers and member card leave with them
    if (others === 0) {
      const files = await api().listFiles(family.id);
      for (let i = 0; i < files.length; i += 500) await api().removeFiles(family.id, files.slice(i, i + 500));
    }
    await api().leaveFamily(family.id);
    useApp.getState().forgetFamily(family.id);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

function userOfMember(familyId: ID, memberId: ID): string | undefined {
  return useApp.getState().cloud?.sync[familyId]?.members[memberId];
}

export async function requestRemoval(memberId: ID): Promise<Result<'removed' | 'requested'>> {
  try {
    const { family, memberId: me } = currentFamily();
    const check = checkRemoval(family, me, memberId);
    if (!check.ok) return fail(check.reason);
    const userId = userOfMember(family.id, memberId);
    if (check.needsApproval && userId) await api().requestRemoval(family.id, userId);
    const member = findMember(family, memberId);
    if (!check.needsApproval && member?.inviteId) await api().revokeInvite(member.inviteId).catch(() => undefined);
    return useApp.getState().requestRemoval(memberId);
  } catch (e) {
    return fail(e);
  }
}

export async function approveRemoval(memberId: ID): Promise<Result> {
  try {
    const { family } = currentFamily();
    const userId = userOfMember(family.id, memberId);
    const member = findMember(family, memberId);
    if (userId) await api().approveRemoval(family.id, userId);
    else if (member?.inviteId) await api().revokeInvite(member.inviteId).catch(() => undefined);
    const result = useApp.getState().approveRemoval(memberId);
    void syncNow();
    return result;
  } catch (e) {
    return fail(e);
  }
}

export async function cancelRemoval(memberId: ID): Promise<Result> {
  try {
    const { family } = currentFamily();
    const userId = userOfMember(family.id, memberId);
    if (userId) await api().cancelRemoval(family.id, userId);
    useApp.getState().cancelRemoval(memberId);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- deleting the account

export async function deleteAccount(): Promise<Result> {
  try {
    const cloud = cloudOrThrow();
    for (const familyId of Object.keys(cloud.memberships)) {
      const others = Object.values(cloud.sync[familyId]?.members ?? {}).filter((u) => u !== cloud.userId).length;
      useApp.getState().switchFamily(familyId);
      useApp.getState().leaveLocally();
      if (others === 0) {
        const files = await api().listFiles(familyId);
        for (let i = 0; i < files.length; i += 500) await api().removeFiles(familyId, files.slice(i, i + 500));
      }
    }
    await syncNow();
    await api().deleteMyAccount();
    await signOutAndForget();
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- the Recovery Kit

export async function makeRecoveryKit(): Promise<Result<{ words: string[]; qr: string }>> {
  try {
    await initCrypto();
    const cloud = cloudOrThrow();
    const kit = await makeKit(api(), cloud.userId, cloud.keyring);
    useApp.setState((d) => {
      if (d.cloud) d.cloud.kitCreatedAt = kit.createdAt;
    });
    return ok({ words: kit.words, qr: kit.qr });
  } catch (e) {
    return fail(e);
  }
}

/** Opens the account with the kit. 'older': the kit predates the newest key; a family member must still approve. */
export async function restoreWithKit(entropy: Uint8Array): Promise<Result<'ready' | 'older'>> {
  try {
    await initCrypto();
    const cloud = cloudOrThrow();
    const result = await openWithKit(api(), cloud.userId, entropy, cloud.keyring);
    useApp.setState((d) => {
      if (!d.cloud) return;
      d.cloud.keyring = result.keyring;
      d.cloud.currentVersion = result.currentVersion;
      d.cloud.pendingApproval = undefined;
      // Pull everything again: records locked to older keys can open now.
      for (const sync of Object.values(d.cloud.sync)) sync.cursor = 0;
    });
    if (result.status === 'ready') await syncNow();
    return ok(result.status);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- letting this device in

export async function beginApproval(): Promise<Result> {
  try {
    await initCrypto();
    const s = useApp.getState();
    const cloud = cloudOrThrow();
    const pending = await requestApproval(api(), s.device.deviceId, deviceName(), cloud.currentVersion);
    useApp.setState((d) => {
      if (d.cloud) d.cloud.pendingApproval = pending;
    });
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function pollApproval(): Promise<ApprovalCheck | null> {
  const cloud = useApp.getState().cloud;
  if (!cloud?.pendingApproval) return null;
  await initCrypto();
  const result = await checkApproval(api(), cloud.userId, cloud.pendingApproval, cloud.keyring);
  if (result.status === 'ready') {
    useApp.setState((d) => {
      if (!d.cloud) return;
      d.cloud.keyring = result.keyring;
      d.cloud.currentVersion = result.currentVersion;
      d.cloud.pendingApproval = undefined;
      for (const sync of Object.values(d.cloud.sync)) sync.cursor = 0;
    });
    await syncNow();
  } else if (result.status !== 'waiting') {
    useApp.setState((d) => {
      if (d.cloud) d.cloud.pendingApproval = undefined;
    });
  }
  return result;
}

export async function startFreshAccount(): Promise<Result> {
  try {
    await initCrypto();
    const cloud = cloudOrThrow();
    const result = await startFresh(api(), cloud.userId);
    for (const id of Object.keys(cloud.memberships)) useApp.getState().forgetFamily(id);
    useApp.setState((d) => {
      if (!d.cloud) return;
      d.cloud.keyring = result.keyring;
      d.cloud.currentVersion = result.currentVersion;
      d.cloud.pendingApproval = undefined;
      d.cloud.kitCreatedAt = undefined;
    });
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- approving and removing others' devices

/** Who a device or request belongs to, as this family calls them. */
export function personName(userId: string): string {
  const s = useApp.getState();
  if (userId === s.cloud?.userId) return 'You';
  for (const [familyId, sync] of Object.entries(s.cloud?.sync ?? {})) {
    const memberId = Object.entries(sync.members).find(([, u]) => u === userId)?.[0];
    const family = s.families[familyId];
    if (memberId && family) return displayName(findMember(family, memberId));
  }
  return 'Someone in your family';
}

export async function approveDevice(request: DeviceRequest): Promise<Result> {
  try {
    await initCrypto();
    const cloud = cloudOrThrow();
    const shared = Object.entries(cloud.sync)
      .filter(([, sync]) => Object.values(sync.members).includes(request.user_id))
      .map(([familyId]) => ({ familyId, current: appReplica.currentFamilyKey(familyId) }))
      .filter((x): x is { familyId: string; current: { version: number; key: Uint8Array } } => !!x.current)
      .map((x) => ({ familyId: x.familyId, keyVersion: x.current.version, key: x.current.key }));
    await approveRequest(api(), { userId: cloud.userId, keyring: cloud.keyring }, request, shared);
    toast(request.user_id === cloud.userId ? 'Approved. Your new device is setting up.' : `Approved. ${personName(request.user_id)}’s new device is setting up.`, { tone: 'success' });
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function declineDevice(request: DeviceRequest): Promise<Result> {
  try {
    await api().declineRequest(request.id);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}

export async function listDevices(): Promise<(DeviceRow & { owner: string; thisDevice: boolean })[]> {
  const s = useApp.getState();
  const rows = await api().devices();
  return rows.map((d) => ({ ...d, owner: personName(d.user_id), thisDevice: d.id === s.device.deviceId }));
}

export async function removeDevice(deviceId: string): Promise<Result> {
  try {
    await api().revokeDevice(deviceId);
    return ok(undefined);
  } catch (e) {
    return fail(e);
  }
}
