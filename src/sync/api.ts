/**
 * The server, as the app uses it: thin, typed wrappers over Supabase, with
 * errors turned into plain sentences. Nothing here knows about the store.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const FILES_BUCKET = 'family-files';

export class CloudError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly offline = false,
  ) {
    super(message);
    this.name = 'CloudError';
  }
}

export interface PullRow {
  id: string;
  kind: string;
  visible: boolean;
  key_ref: string | null;
  key_box: string | null;
  data_box: string | null;
  purged: boolean;
  seq: number;
  updated_at?: string;
  updated_by?: string | null;
}

export interface PushRow {
  id: string;
  kind?: string;
  visible_to?: string | null;
  key_ref?: string;
  key_box?: string;
  data_box?: string;
  base_seq?: number | null;
  purge?: boolean;
}

export interface PushResult {
  id: string;
  status: 'ok' | 'conflict' | 'forbidden' | 'gone';
  seq?: number;
  current?: PullRow;
}

export interface DeviceRequest {
  id: string;
  user_id: string;
  device_id: string;
  device_name: string;
  public_key: string;
  next_version: number;
  created_at: string;
  expires_at: string;
  status: 'pending' | 'approved' | 'declined' | 'done';
  mode: 'own' | 'family' | null;
  keyring_box: string | null;
}

export interface DeviceRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
}

export interface InviteRow {
  id: string;
  family_id: string;
  email: string;
  member_id: string;
  box: string;
  created_at: string;
  expires_at: string;
  requested_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
}

function isOffline(error: unknown): boolean {
  const text = String((error as { message?: string })?.message ?? error);
  return /Failed to fetch|NetworkError|Network request failed|fetch failed|ECONNREFUSED|Load failed/i.test(text);
}

function fail(error: { message?: string; code?: string } | null | undefined): never {
  if (isOffline(error)) throw new CloudError('No internet. Your changes are saved on this phone and will sync later.', 'offline', true);
  throw new CloudError(error?.message ?? 'Something went wrong on the server', error?.code);
}

async function call<T>(work: PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>): Promise<T> {
  let result;
  try {
    result = await work;
  } catch (e) {
    fail(e as { message?: string });
  }
  if (result.error) fail(result.error);
  return result.data as T;
}

export class CloudApi {
  constructor(readonly client: SupabaseClient) {}

  // ---------------------------------------------------------------- records
  push(familyId: string, rows: PushRow[]): Promise<PushResult[]> {
    return call(this.client.rpc('push_records', { p_family_id: familyId, p_rows: rows }));
  }

  async pull(familyId: string, since: number, limit = 500): Promise<PullRow[]> {
    return (await call<PullRow[]>(this.client.rpc('pull_records', { p_family_id: familyId, p_since: since, p_limit: limit }))) ?? [];
  }

  // ---------------------------------------------------------------- families
  async myFamilies(userId: string): Promise<{ family_id: string; member_id: string }[]> {
    return (await call(this.client.from('family_members').select('family_id, member_id').eq('user_id', userId))) ?? [];
  }

  async familyMembers(familyId: string): Promise<{ user_id: string; member_id: string }[]> {
    return (await call(this.client.from('family_members').select('user_id, member_id').eq('family_id', familyId))) ?? [];
  }

  async publicKeys(userIds: string[]): Promise<{ user_id: string; version: number; public_key: string }[]> {
    if (userIds.length === 0) return [];
    return (await call(this.client.from('user_keys').select('user_id, version, public_key').in('user_id', userIds))) ?? [];
  }

  async myFamilyKeys(userId: string): Promise<{ family_id: string; key_version: number; user_key_version: number; box: string }[]> {
    return (await call(this.client.from('family_keys').select('family_id, key_version, user_key_version, box').eq('user_id', userId))) ?? [];
  }

  createFamily(familyId: string, memberId: string, keyBox: string): Promise<void> {
    return call(this.client.rpc('create_family', { p_family_id: familyId, p_member_id: memberId, p_key_box: keyBox }));
  }

  leaveFamily(familyId: string): Promise<boolean> {
    return call(this.client.rpc('leave_family', { p_family_id: familyId }));
  }

  requestRemoval(familyId: string, userId: string): Promise<void> {
    return call(this.client.rpc('request_removal', { p_family_id: familyId, p_user_id: userId }));
  }

  approveRemoval(familyId: string, userId: string): Promise<void> {
    return call(this.client.rpc('approve_removal', { p_family_id: familyId, p_user_id: userId }));
  }

  cancelRemoval(familyId: string, userId: string): Promise<void> {
    return call(this.client.rpc('cancel_removal', { p_family_id: familyId, p_user_id: userId }));
  }

  // ---------------------------------------------------------------- invites
  async createInvite(row: { family_id: string; email: string; member_id: string; box: string; created_by: string }): Promise<string> {
    const data = await call<{ id: string }>(this.client.from('invites').insert(row).select('id').single());
    return data.id;
  }

  async invite(inviteId: string): Promise<InviteRow | null> {
    const rows = await call<InviteRow[]>(this.client.from('invites').select('*').eq('id', inviteId));
    return rows?.[0] ?? null;
  }

  async invitesFor(email: string): Promise<InviteRow[]> {
    return (
      (await call<InviteRow[]>(
        this.client.from('invites').select('*').eq('email', email).is('accepted_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString()),
      )) ?? []
    );
  }

  async familyInvites(familyId: string): Promise<InviteRow[]> {
    return (await call<InviteRow[]>(this.client.from('invites').select('*').eq('family_id', familyId))) ?? [];
  }

  revokeInvite(inviteId: string): Promise<void> {
    return call(this.client.rpc('revoke_invite', { p_invite_id: inviteId }));
  }

  acceptInvite(inviteId: string, keyBox: string): Promise<{ family_id: string; member_id: string }> {
    return call(this.client.rpc('accept_invite', { p_invite_id: inviteId, p_key_box: keyBox }));
  }

  requestJoin(inviteId: string): Promise<void> {
    return call(this.client.rpc('request_join', { p_invite_id: inviteId }));
  }

  async pendingJoins(familyId: string): Promise<{ invite_id: string; email: string; member_id: string; user_id: string; user_key_version: number; public_key: string }[]> {
    return (await call(this.client.rpc('pending_joins', { p_family_id: familyId }))) ?? [];
  }

  completeJoin(inviteId: string, keyBox: string): Promise<void> {
    return call(this.client.rpc('complete_join', { p_invite_id: inviteId, p_key_box: keyBox }));
  }

  // ---------------------------------------------------------------- the account's keys
  async vault(userId: string): Promise<{ current_version: number; keyring_box: string; recovery_box: string | null; kit_created_at: string | null } | null> {
    const rows = await call<{ current_version: number; keyring_box: string; recovery_box: string | null; kit_created_at: string | null }[]>(
      this.client.from('user_vaults').select('current_version, keyring_box, recovery_box, kit_created_at').eq('user_id', userId),
    );
    return rows?.[0] ?? null;
  }

  initVault(publicKey: string, keyringBox: string): Promise<void> {
    return call(this.client.rpc('init_vault', { p_public_key: publicKey, p_keyring_box: keyringBox }));
  }

  async updateVault(userId: string, patch: { keyring_box?: string; recovery_box?: string | null; kit_created_at?: string | null }): Promise<void> {
    await call(this.client.from('user_vaults').update(patch).eq('user_id', userId));
  }

  resetVault(publicKey: string, keyringBox: string): Promise<number> {
    return call(this.client.rpc('reset_vault', { p_public_key: publicKey, p_keyring_box: keyringBox }));
  }

  // ---------------------------------------------------------------- devices
  touchDevice(deviceId: string, name: string): Promise<{ revoked: boolean }> {
    return call(this.client.rpc('touch_device', { p_device_id: deviceId, p_name: name }));
  }

  async devices(): Promise<DeviceRow[]> {
    return (await call<DeviceRow[]>(this.client.from('devices').select('*').order('last_seen_at', { ascending: false }))) ?? [];
  }

  revokeDevice(deviceId: string): Promise<void> {
    return call(this.client.rpc('revoke_device', { p_device_id: deviceId }));
  }

  createDeviceRequest(deviceId: string, name: string, publicKey: string): Promise<string> {
    return call(this.client.rpc('create_device_request', { p_device_id: deviceId, p_device_name: name, p_public_key: publicKey }));
  }

  async deviceRequest(id: string): Promise<DeviceRequest | null> {
    const rows = await call<DeviceRequest[]>(this.client.from('device_requests').select('*').eq('id', id));
    return rows?.[0] ?? null;
  }

  async openDeviceRequests(): Promise<DeviceRequest[]> {
    return (
      (await call<DeviceRequest[]>(
        this.client.from('device_requests').select('*').eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at'),
      )) ?? []
    );
  }

  approveOwn(requestId: string, keyringBox: string): Promise<void> {
    return call(this.client.rpc('approve_device_request_own', { p_request_id: requestId, p_keyring_box: keyringBox }));
  }

  approveFamily(requestId: string, boxes: { family_id: string; key_version: number; box: string }[]): Promise<void> {
    return call(this.client.rpc('approve_device_request_family', { p_request_id: requestId, p_boxes: boxes }));
  }

  declineRequest(requestId: string): Promise<void> {
    return call(this.client.rpc('decline_device_request', { p_request_id: requestId }));
  }

  finishOwnApproval(requestId: string): Promise<void> {
    return call(this.client.rpc('finish_own_approval', { p_request_id: requestId }));
  }

  finishFamilyRecovery(requestId: string, keyringBox: string): Promise<number> {
    return call(this.client.rpc('finish_family_recovery', { p_request_id: requestId, p_keyring_box: keyringBox }));
  }

  // ---------------------------------------------------------------- sign-in pause and account
  signInStatus(email: string): Promise<{ failures: number; paused_until: string | null }> {
    return call(this.client.rpc('sign_in_status', { p_email: email }));
  }

  noteSignInFailure(email: string): Promise<{ failures: number; paused_until: string | null }> {
    return call(this.client.rpc('note_sign_in_failure', { p_email: email }));
  }

  clearSignInFailures(): Promise<void> {
    return call(this.client.rpc('clear_sign_in_failures'));
  }

  deleteMyAccount(): Promise<void> {
    return call(this.client.rpc('delete_my_account'));
  }

  // ---------------------------------------------------------------- files (always encrypted bytes)
  async uploadFile(familyId: string, fileId: string, bytes: Uint8Array): Promise<void> {
    const body = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
    await call(this.client.storage.from(FILES_BUCKET).upload(`${familyId}/${fileId}`, body, { contentType: 'application/octet-stream', upsert: true }));
  }

  async downloadFile(familyId: string, fileId: string): Promise<Uint8Array | null> {
    let result;
    try {
      result = await this.client.storage.from(FILES_BUCKET).download(`${familyId}/${fileId}`);
    } catch (e) {
      fail(e as { message?: string });
    }
    if (result.error) {
      const status = (result.error as { statusCode?: string | number }).statusCode;
      if (String(status) === '404' || /not found/i.test(result.error.message)) return null;
      fail(result.error);
    }
    return new Uint8Array(await result.data.arrayBuffer());
  }

  async removeFiles(familyId: string, fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;
    await call(this.client.storage.from(FILES_BUCKET).remove(fileIds.map((id) => `${familyId}/${id}`)));
  }

  async listFiles(familyId: string): Promise<string[]> {
    const rows = await call<{ name: string }[]>(this.client.storage.from(FILES_BUCKET).list(familyId, { limit: 1000 }));
    return (rows ?? []).map((r) => r.name);
  }
}
