/**
 * The server's rules, tested against the local Supabase with real accounts.
 * Each test states one rule from docs/BACKEND.md.
 */
import { encryptJson, keyPairFromMaster, openSealed, randomKey, seal, toB64 } from '@/lib/crypto';

import { addToFamily, admin, anonClient, cleanUp, createFamily, newUser, type TestUser } from './harness';

afterAll(cleanUp);

function row(id: string, extra: Record<string, unknown> = {}) {
  return { id, kind: 'document', key_ref: 'f:1', key_box: '1.key', data_box: '1.data', ...extra };
}

async function push(user: TestUser, familyId: string, rows: Record<string, unknown>[]) {
  const { data, error } = await user.client.rpc('push_records', { p_family_id: familyId, p_rows: rows });
  if (error) throw error;
  return data as { id: string; status: string; seq?: number; current?: Record<string, unknown> }[];
}

async function pull(user: TestUser, familyId: string, since = 0) {
  const { data, error } = await user.client.rpc('pull_records', { p_family_id: familyId, p_since: since });
  if (error) throw error;
  return data as { id: string; visible: boolean; data_box: string | null; purged: boolean; seq: number }[];
}

describe('account keys', () => {
  it('lets an account set up its keys once, and keeps the vault private', async () => {
    const riya = await newUser('riya');
    const again = await riya.client.rpc('init_vault', { p_public_key: toB64(riya.pair.publicKey), p_keyring_box: '1.x' });
    expect(again.error?.message).toMatch(/already has keys/);
    const stranger = await newUser('stranger');
    const peek = await stranger.client.from('user_vaults').select('*').eq('user_id', riya.id);
    expect(peek.data).toEqual([]);
    const mine = await riya.client.from('user_vaults').select('current_version').eq('user_id', riya.id).single();
    expect(mine.data?.current_version).toBe(1);
  });

  it('lets the owner update the keyring and kit, but not the key version', async () => {
    const riya = await newUser('riya2');
    const ok = await riya.client.from('user_vaults').update({ recovery_box: '1.kit', kit_created_at: new Date().toISOString() }).eq('user_id', riya.id);
    expect(ok.error).toBeNull();
    const bad = await riya.client.from('user_vaults').update({ current_version: 9 }).eq('user_id', riya.id);
    expect(bad.error).not.toBeNull();
  });

  it('refuses signed-out callers', async () => {
    const anon = anonClient();
    const r = await anon.rpc('push_records', { p_family_id: crypto.randomUUID(), p_rows: [row('x')] });
    expect(r.error).not.toBeNull();
    const t = await anon.from('records').select('*');
    expect(t.error ?? (t.data?.length === 0 ? null : 'leak')).not.toBe('leak');
  });
});

describe('families and records', () => {
  it('shows a family only to its members', async () => {
    const papa = await newUser('papa');
    const stranger = await newUser('stranger2');
    const { familyId } = await createFamily(papa);
    await push(papa, familyId, [row('doc-1')]);
    expect((await pull(papa, familyId)).map((r) => r.id)).toEqual(['doc-1']);
    expect(await pull(stranger, familyId)).toEqual([]);
    const direct = await stranger.client.from('records').select('*').eq('family_id', familyId);
    expect(direct.data).toEqual([]);
    const write = await stranger.client.rpc('push_records', { p_family_id: familyId, p_rows: [row('doc-2')] });
    expect(write.error?.message).toMatch(/not in this family/);
  });

  it('allows at most 3 families per account', async () => {
    const busy = await newUser('busy');
    for (let i = 0; i < 3; i++) await createFamily(busy, `m-${i}`);
    await expect(createFamily(busy, 'm-4')).rejects.toMatchObject({ message: expect.stringMatching(/up to 3 families/) });
  });

  it('detects a stale write as a conflict and returns the current version', async () => {
    const papa = await newUser('papa3');
    const { familyId } = await createFamily(papa);
    const [first] = await push(papa, familyId, [row('doc-1', { data_box: '1.v1' })]);
    expect(first.status).toBe('ok');
    const [second] = await push(papa, familyId, [row('doc-1', { data_box: '1.v2', base_seq: first.seq })]);
    expect(second.status).toBe('ok');
    const [stale] = await push(papa, familyId, [row('doc-1', { data_box: '1.v3', base_seq: first.seq })]);
    expect(stale.status).toBe('conflict');
    expect(stale.current).toMatchObject({ data_box: '1.v2', seq: second.seq });
    const [fresh] = await push(papa, familyId, [row('doc-1', { data_box: '1.new' })]);
    expect(fresh.status).toBe('conflict'); // a "new" record whose id already exists
  });

  it('orders a family by commit, so a cursor never skips a change', async () => {
    const papa = await newUser('papa4');
    const { familyId } = await createFamily(papa);
    await Promise.all(Array.from({ length: 8 }, (_, i) => push(papa, familyId, [row(`d-${i}`)])));
    const rows = await pull(papa, familyId);
    const seqs = rows.map((r) => r.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(rows).toHaveLength(8);
    const half = await pull(papa, familyId, seqs[3]);
    expect(half.map((r) => r.seq)).toEqual(seqs.slice(4));
  });

  it('keeps private records from other members, and tells them to drop one that became private', async () => {
    const papa = await newUser('papa5');
    const mummy = await newUser('mummy5');
    const { familyId, familyKey } = await createFamily(papa, 'm-papa');
    await addToFamily(papa, familyId, familyKey, mummy, 'm-mummy');

    const [shared] = await push(papa, familyId, [row('shared'), row('mine', { visible_to: papa.id, key_ref: `u:${papa.id}:1` })]);
    const mummyView = await pull(mummy, familyId);
    expect(mummyView.find((r) => r.id === 'shared')?.visible).toBe(true);
    const hidden = mummyView.find((r) => r.id === 'mine');
    expect(hidden).toMatchObject({ visible: false, data_box: null });

    // Mummy cannot overwrite Papa's private record.
    const [forbidden] = await push(mummy, familyId, [row('mine', { base_seq: hidden?.seq })]);
    expect(forbidden.status).toBe('forbidden');

    // Papa makes the shared one private: Mummy's next pull carries a hidden stub.
    const cursor = Math.max(...mummyView.map((r) => r.seq));
    await push(papa, familyId, [row('shared', { base_seq: shared.seq, visible_to: papa.id })]);
    const next = await pull(mummy, familyId, cursor);
    expect(next).toEqual([expect.objectContaining({ id: 'shared', visible: false, data_box: null })]);
  });

  it('only lets a record be private to someone in the family', async () => {
    const papa = await newUser('papa6');
    const stranger = await newUser('stranger6');
    const { familyId } = await createFamily(papa);
    const r = await papa.client.rpc('push_records', { p_family_id: familyId, p_rows: [row('x', { visible_to: stranger.id })] });
    expect(r.error?.message).toMatch(/belong to someone in the family/);
  });

  it('turns a purged record into a tombstone everyone receives', async () => {
    const papa = await newUser('papa7');
    const { familyId } = await createFamily(papa);
    const [a] = await push(papa, familyId, [row('doc')]);
    const [p] = await push(papa, familyId, [{ id: 'doc', purge: true, base_seq: a.seq }]);
    expect(p.status).toBe('ok');
    const [tomb] = await pull(papa, familyId, a.seq);
    expect(tomb).toMatchObject({ id: 'doc', purged: true, data_box: null });
    const [again] = await push(papa, familyId, [row('doc', { base_seq: p.seq })]);
    expect(again.status).toBe('conflict'); // purged is final
  });

  it('never lets a record change its kind', async () => {
    const papa = await newUser('papa8');
    const { familyId } = await createFamily(papa);
    const [a] = await push(papa, familyId, [row('x')]);
    const r = await papa.client.rpc('push_records', { p_family_id: familyId, p_rows: [row('x', { kind: 'login', base_seq: a.seq })] });
    expect(r.error?.message).toMatch(/cannot change its kind/);
  });

  it('keeps the latest 500 activity entries', async () => {
    const papa = await newUser('papa9');
    const { familyId } = await createFamily(papa);
    for (let batch = 0; batch < 3; batch++) {
      await push(papa, familyId, Array.from({ length: 200 }, (_, i) => row(`a-${batch}-${i}`, { kind: 'activity' })));
    }
    const count = await admin().from('records').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('kind', 'activity');
    expect(count.count).toBe(500);
  });
});

describe('invites', () => {
  it('lets the invited email join with the link, and nobody else', async () => {
    const papa = await newUser('papa10');
    const riya = await newUser('riya10');
    const other = await newUser('other10');
    const { familyId, familyKey } = await createFamily(papa);
    const { data: invite } = await papa.client
      .from('invites').insert({ family_id: familyId, email: riya.email, member_id: 'm-riya', box: '1.box', created_by: papa.id }).select('id').single();
    expect(invite?.id).toBeTruthy();

    const seen = await riya.client.from('invites').select('id, family_id').eq('id', invite?.id);
    expect(seen.data).toHaveLength(1);
    const notSeen = await other.client.from('invites').select('id').eq('id', invite?.id);
    expect(notSeen.data).toEqual([]);

    const wrong = await other.client.rpc('accept_invite', { p_invite_id: invite?.id, p_key_box: '1.x' });
    expect(wrong.error?.message).toMatch(/Sign in with that email/);

    const ok = await riya.client.rpc('accept_invite', { p_invite_id: invite?.id, p_key_box: seal(familyKey, riya.pair.publicKey) });
    expect(ok.data).toEqual({ family_id: familyId, member_id: 'm-riya' });
    const used = await riya.client.rpc('accept_invite', { p_invite_id: invite?.id, p_key_box: '1.x' });
    expect(used.error?.message).toMatch(/already been used/);

    const keys = await riya.client.from('family_keys').select('box').eq('family_id', familyId);
    expect(openSealed(keys.data?.[0].box, riya.pair)).toEqual(familyKey);
  });

  it('refuses invites from non-members, cancelled invites and expired ones', async () => {
    const papa = await newUser('papa11');
    const stranger = await newUser('stranger11');
    const riya = await newUser('riya11');
    const { familyId } = await createFamily(papa);
    const sneaky = await stranger.client.from('invites').insert({ family_id: familyId, email: riya.email, member_id: 'x', box: '1.b', created_by: stranger.id });
    expect(sneaky.error).not.toBeNull();

    const { data: invite } = await papa.client
      .from('invites').insert({ family_id: familyId, email: riya.email, member_id: 'm-riya', box: '1.b', created_by: papa.id }).select('id').single();
    await papa.client.rpc('revoke_invite', { p_invite_id: invite?.id });
    const r = await riya.client.rpc('accept_invite', { p_invite_id: invite?.id, p_key_box: '1.x' });
    expect(r.error?.message).toMatch(/cancelled/);

    const { data: old } = await papa.client
      .from('invites').insert({ family_id: familyId, email: riya.email, member_id: 'm-riya2', box: '1.b', created_by: papa.id }).select('id').single();
    await admin().from('invites').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', old?.id);
    const e = await riya.client.rpc('accept_invite', { p_invite_id: old?.id, p_key_box: '1.x' });
    expect(e.error?.message).toMatch(/expired/);
  });

  it('lets a family member complete a join asked for without the link', async () => {
    const papa = await newUser('papa12');
    const riya = await newUser('riya12');
    const { familyId, familyKey } = await createFamily(papa);
    const { data: invite } = await papa.client
      .from('invites').insert({ family_id: familyId, email: riya.email, member_id: 'm-riya', box: '1.b', created_by: papa.id }).select('id').single();
    expect((await riya.client.rpc('request_join', { p_invite_id: invite?.id })).error).toBeNull();

    const { data: pending } = await papa.client.rpc('pending_joins', { p_family_id: familyId });
    expect(pending).toEqual([expect.objectContaining({ invite_id: invite?.id, user_id: riya.id, public_key: toB64(riya.pair.publicKey) })]);

    const done = await papa.client.rpc('complete_join', { p_invite_id: invite?.id, p_key_box: seal(familyKey, riya.pair.publicKey) });
    expect(done.error).toBeNull();
    const members = await riya.client.from('family_members').select('user_id, member_id').eq('family_id', familyId);
    expect(members.data).toHaveLength(2);
  });
});

describe('removing members, leaving', () => {
  it('needs a second member to approve, and then the removed member loses access', async () => {
    const papa = await newUser('papa13');
    const mummy = await newUser('mummy13');
    const riya = await newUser('riya13');
    const { familyId, familyKey } = await createFamily(papa, 'm-papa');
    await addToFamily(papa, familyId, familyKey, mummy, 'm-mummy');
    await addToFamily(papa, familyId, familyKey, riya, 'm-riya');
    await push(riya, familyId, [row('riya-only', { visible_to: riya.id }), row('common')]);

    expect((await papa.client.rpc('request_removal', { p_family_id: familyId, p_user_id: riya.id })).error).toBeNull();
    const self = await papa.client.rpc('approve_removal', { p_family_id: familyId, p_user_id: riya.id });
    expect(self.error?.message).toMatch(/second member/);
    const target = await riya.client.rpc('approve_removal', { p_family_id: familyId, p_user_id: riya.id });
    expect(target.error?.message).toMatch(/second member/);
    expect((await mummy.client.rpc('approve_removal', { p_family_id: familyId, p_user_id: riya.id })).error).toBeNull();

    expect(await pull(riya, familyId)).toEqual([]);
    const keys = await riya.client.from('family_keys').select('*').eq('family_id', familyId);
    expect(keys.data).toEqual([]);
    const left = await admin().from('records').select('id').eq('family_id', familyId);
    expect(left.data?.map((r) => r.id)).toEqual(['common']); // her private record went with her
  });

  it('deletes a family when its last member leaves', async () => {
    const papa = await newUser('papa14');
    const { familyId } = await createFamily(papa);
    await push(papa, familyId, [row('d')]);
    const r = await papa.client.rpc('leave_family', { p_family_id: familyId });
    expect(r.data).toBe(true);
    const gone = await admin().from('families').select('id').eq('id', familyId);
    expect(gone.data).toEqual([]);
  });
});

describe('devices and approving a new one', () => {
  it('lets a family member remove a device, and the device learns it next time', async () => {
    const papa = await newUser('papa15');
    const mummy = await newUser('mummy15');
    const stranger = await newUser('stranger15');
    const { familyId, familyKey } = await createFamily(papa);
    await addToFamily(papa, familyId, familyKey, mummy, 'm-mummy');
    const device = crypto.randomUUID();
    expect((await mummy.client.rpc('touch_device', { p_device_id: device, p_name: 'Chrome on Mac' })).data).toEqual({ revoked: false });
    expect((await stranger.client.rpc('revoke_device', { p_device_id: device })).error?.message).toMatch(/cannot remove/);
    expect((await papa.client.rpc('revoke_device', { p_device_id: device })).error).toBeNull();
    expect((await mummy.client.rpc('touch_device', { p_device_id: device, p_name: 'Chrome on Mac' })).data).toEqual({ revoked: true });
  });

  it('own-device approval hands over the keyring', async () => {
    const riya = await newUser('riya16');
    const newDevice = { amk: randomKey() };
    const pair = keyPairFromMaster(newDevice.amk);
    const { data: requestId } = await riya.client.rpc('create_device_request', {
      p_device_id: crypto.randomUUID(), p_device_name: 'Safari on iPhone', p_public_key: toB64(pair.publicKey),
    });
    const keyring = encryptJson({ any: 'thing' }, randomKey(), 'x');
    expect((await riya.client.rpc('approve_device_request_own', { p_request_id: requestId, p_keyring_box: keyring })).error).toBeNull();
    const seen = await riya.client.from('device_requests').select('status, mode, keyring_box').eq('id', requestId).single();
    expect(seen.data).toEqual({ status: 'approved', mode: 'own', keyring_box: keyring });
    expect((await riya.client.rpc('finish_own_approval', { p_request_id: requestId })).error).toBeNull();
  });

  it('family approval gives the new key version the family keys and signs out the old devices', async () => {
    const papa = await newUser('papa17');
    const riya = await newUser('riya17');
    const { familyId, familyKey } = await createFamily(papa);
    await addToFamily(papa, familyId, familyKey, riya, 'm-riya');
    const oldDevice = crypto.randomUUID();
    await riya.client.rpc('touch_device', { p_device_id: oldDevice, p_name: 'Old phone' });

    const nextAmk = randomKey();
    const next = keyPairFromMaster(nextAmk);
    const newDevice = crypto.randomUUID();
    const { data: requestId } = await riya.client.rpc('create_device_request', {
      p_device_id: newDevice, p_device_name: 'New phone', p_public_key: toB64(next.publicKey),
    });
    const ownTry = await riya.client.rpc('approve_device_request_family', { p_request_id: requestId, p_boxes: [] });
    expect(ownTry.error?.message).toMatch(/own other device/);

    const approve = await papa.client.rpc('approve_device_request_family', {
      p_request_id: requestId,
      p_boxes: [{ family_id: familyId, key_version: 1, box: seal(familyKey, next.publicKey) }],
    });
    expect(approve.error).toBeNull();
    const version = await riya.client.rpc('finish_family_recovery', { p_request_id: requestId, p_keyring_box: '1.keyring-v2' });
    expect(version.data).toBe(2);

    const keys = await riya.client.from('family_keys').select('user_key_version, box').eq('family_id', familyId).eq('user_key_version', 2);
    expect(openSealed(keys.data?.[0].box, next)).toEqual(familyKey);
    const devices = await riya.client.from('devices').select('id, revoked_at').eq('user_id', riya.id);
    expect(devices.data?.find((d) => d.id === oldDevice)?.revoked_at).not.toBeNull();
    const pk = await papa.client.from('user_keys').select('version').eq('user_id', riya.id).order('version');
    expect(pk.data?.map((k) => k.version)).toEqual([1, 2]);
  });

  it('lets someone start fresh only when nobody in their families could let them in', async () => {
    const papa = await newUser('papa18');
    const riya = await newUser('riya18');
    const { familyId, familyKey } = await createFamily(papa);
    await addToFamily(papa, familyId, familyKey, riya, 'm-riya');
    const blocked = await riya.client.rpc('reset_vault', { p_public_key: toB64(riya.pair.publicKey), p_keyring_box: '1.k' });
    expect(blocked.error?.message).toMatch(/approve this device/);

    const alone = await newUser('alone18');
    const { familyId: own } = await createFamily(alone);
    const fresh = await alone.client.rpc('reset_vault', { p_public_key: toB64(alone.pair.publicKey), p_keyring_box: '1.k' });
    expect(fresh.data).toBe(2);
    const gone = await admin().from('families').select('id').eq('id', own);
    expect(gone.data).toEqual([]);
  });
});

describe('the password pause', () => {
  it('pauses after five failures, for every device, until a sign-in clears it', async () => {
    const riya = await newUser('riya19');
    const anon = anonClient();
    for (let i = 1; i <= 4; i++) {
      const r = await anon.rpc('note_sign_in_failure', { p_email: riya.email.toUpperCase() });
      expect(r.data).toMatchObject({ failures: i, paused_until: null });
    }
    const fifth = await anon.rpc('note_sign_in_failure', { p_email: riya.email });
    expect(fifth.data.paused_until).not.toBeNull();
    const status = await anonClient().rpc('sign_in_status', { p_email: ` ${riya.email} ` });
    expect(new Date(status.data.paused_until).getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
    await riya.client.rpc('clear_sign_in_failures');
    const cleared = await anon.rpc('sign_in_status', { p_email: riya.email });
    expect(cleared.data).toEqual({ failures: 0, paused_until: null });
  });
});

describe('files', () => {
  it('lets family members read and write their family folder, and nobody else', async () => {
    const papa = await newUser('papa20');
    const stranger = await newUser('stranger20');
    const { familyId } = await createFamily(papa);
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const path = `${familyId}/file-1`;
    const up = await papa.client.storage.from('family-files').upload(path, bytes, { contentType: 'application/octet-stream' });
    expect(up.error).toBeNull();
    const down = await papa.client.storage.from('family-files').download(path);
    expect(new Uint8Array(await (down.data as Blob).arrayBuffer())).toEqual(bytes);
    const peek = await stranger.client.storage.from('family-files').download(path);
    expect(peek.error).not.toBeNull();
    const drop = await stranger.client.storage.from('family-files').upload(`${familyId}/evil`, bytes, { contentType: 'application/octet-stream' });
    expect(drop.error).not.toBeNull();
    const plain = await papa.client.storage.from('family-files').upload(`${familyId}/x.txt`, bytes, { contentType: 'text/plain' });
    expect(plain.error).not.toBeNull(); // only encrypted blobs
    await papa.client.storage.from('family-files').remove([path]);
  });
});

describe('deleting an account', () => {
  it('removes the account, and the family when nobody is left', async () => {
    const papa = await newUser('papa21');
    const { familyId } = await createFamily(papa);
    await push(papa, familyId, [row('d')]);
    const r = await papa.client.rpc('delete_my_account');
    expect(r.error).toBeNull();
    const user = await admin().auth.admin.getUserById(papa.id);
    expect(user.data.user).toBeNull();
    const family = await admin().from('families').select('id').eq('id', familyId);
    expect(family.data).toEqual([]);
  });
});
