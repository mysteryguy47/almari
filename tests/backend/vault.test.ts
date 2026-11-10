/** Device set-up and recovery against the local server. */
import { entropyFromKitQr, fromB64, keyPairFromMaster, newKitWords, openSealed, randomKey, seal, toB64 } from '@/lib/crypto';
import { CloudApi } from '@/sync/api';
import {
  approveRequest, checkApproval, checkDevice, makeKit, requestApproval, setUpNewAccount, startFresh, symbolsFor, openWithKit,
} from '@/sync/vault';

import { cleanUp, newFamilyId, newUser } from './harness';

afterAll(cleanUp);

const device = () => crypto.randomUUID();

describe('setting up and letting devices in', () => {
  it('makes keys for a new account, and knows a device that has them', async () => {
    const riya = await newUser('riya', { vault: false });
    const api = new CloudApi(riya.client);
    expect((await checkDevice(api, riya.id, device(), [])).status).toBe('new-account');
    const { keyring } = await setUpNewAccount(api, riya.id);
    expect(await checkDevice(api, riya.id, device(), keyring)).toMatchObject({ status: 'ready', currentVersion: 1 });
    const fresh = await checkDevice(api, riya.id, device(), []);
    expect(fresh).toMatchObject({ status: 'needs-approval', hasKit: false, familyCanHelp: false });
  });

  it('lets your own other device approve, showing the same symbols on both', async () => {
    const riya = await newUser('riya2', { vault: false });
    const api = new CloudApi(riya.client);
    const { keyring } = await setUpNewAccount(api, riya.id);
    const phone = device();
    await api.touchDevice(phone, 'Old phone');
    const laptop = device();
    const state = await checkDevice(api, riya.id, laptop, []);
    expect(state).toMatchObject({ status: 'needs-approval', ownDevices: [expect.objectContaining({ name: 'Old phone' })] });

    const pending = await requestApproval(api, laptop, 'Chrome on Mac', 1);
    const [request] = await api.openDeviceRequests();
    expect(symbolsFor(request.public_key)).toEqual(symbolsFor(toB64(keyPairFromMaster(fromB64(pending.nextAmk)).publicKey)));
    expect((await checkApproval(api, riya.id, pending)).status).toBe('waiting');

    await approveRequest(api, { userId: riya.id, keyring }, request, []);
    const done = await checkApproval(api, riya.id, pending);
    expect(done).toEqual({ status: 'ready', keyring, currentVersion: 1, byFamily: false });
  });

  it('lets a family member approve; the kit then opens the older Only me items', async () => {
    const papaUser = await newUser('papa3', { vault: false });
    const riyaUser = await newUser('riya3', { vault: false });
    const papa = new CloudApi(papaUser.client);
    const riya = new CloudApi(riyaUser.client);
    const papaKeys = await setUpNewAccount(papa, papaUser.id);
    const riyaKeys = await setUpNewAccount(riya, riyaUser.id);
    const kit = await makeKit(riya, riyaUser.id, riyaKeys.keyring);
    expect(kit.words).toHaveLength(24);

    // A family with both of them.
    const familyId = newFamilyId();
    const familyKey = randomKey();
    const papaPair = keyPairFromMaster(fromB64(papaKeys.keyring[0].amk));
    await papa.createFamily(familyId, 'm-papa', seal(familyKey, papaPair.publicKey));
    const inviteId = await papa.createInvite({ family_id: familyId, email: riyaUser.email, member_id: 'm-riya', box: '1.x', created_by: papaUser.id });
    const riyaPair = keyPairFromMaster(fromB64(riyaKeys.keyring[0].amk));
    await riya.acceptInvite(inviteId, seal(familyKey, riyaPair.publicKey));

    // Riya loses her phone. A new one asks; Papa approves.
    const newPhone = device();
    const state = await checkDevice(riya, riyaUser.id, newPhone, []);
    expect(state).toMatchObject({ status: 'needs-approval', familyCanHelp: true, hasKit: true });
    const pending = await requestApproval(riya, newPhone, 'New phone', 1);
    const [request] = (await papa.openDeviceRequests()).filter((r) => r.user_id === riyaUser.id);
    await approveRequest(papa, { userId: papaUser.id, keyring: papaKeys.keyring }, request, [{ familyId, keyVersion: 1, key: familyKey }]);
    const done = await checkApproval(riya, riyaUser.id, pending);
    expect(done).toMatchObject({ status: 'ready', currentVersion: 2, byFamily: true });
    if (done.status !== 'ready') throw new Error('not ready');

    // The new version opens the family key Papa sealed for it.
    const keys = await riya.myFamilyKeys(riyaUser.id);
    const v2 = keys.find((k) => k.user_key_version === 2);
    expect(openSealed(v2?.box as string, keyPairFromMaster(fromB64(done.keyring[0].amk)))).toEqual(familyKey);

    // The kit made before still opens version 1, and now covers both.
    const entropy = entropyFromKitQr(kit.qr) as Uint8Array;
    const restored = await openWithKit(riya, riyaUser.id, entropy, done.keyring);
    expect(restored.status).toBe('ready');
    expect(restored.keyring.map((k) => k.version)).toEqual([1, 2]);
    const again = await openWithKit(riya, riyaUser.id, entropy, []);
    expect(again).toMatchObject({ status: 'ready', currentVersion: 2 });
    expect(again.keyring.map((k) => k.version)).toEqual([1, 2]);
  });

  it('says plainly when the words are not this account’s kit', async () => {
    const riya = await newUser('riya4', { vault: false });
    const api = new CloudApi(riya.client);
    const { keyring } = await setUpNewAccount(api, riya.id);
    await makeKit(api, riya.id, keyring);
    await expect(openWithKit(api, riya.id, newKitWords().entropy, [])).rejects.toThrow(/not this account’s Recovery Kit/);
  });

  it('starts fresh only when nobody in the family could help', async () => {
    const alone = await newUser('alone5', { vault: false });
    const api = new CloudApi(alone.client);
    await setUpNewAccount(api, alone.id);
    const fresh = await startFresh(api, alone.id);
    expect(fresh.currentVersion).toBe(2);
    expect(await checkDevice(api, alone.id, device(), fresh.keyring)).toMatchObject({ status: 'ready', currentVersion: 2 });
  });
});
