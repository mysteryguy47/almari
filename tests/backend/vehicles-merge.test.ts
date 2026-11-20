/**
 * Vehicles and merged duplicates against the local server.
 *
 * Run once against a server without the vehicles migration (OLD_SERVER=1):
 * vehicles wait on the device and everything else syncs. Then, migrated:
 * vehicles reach the other member, and pages moved by a merge stay
 * downloadable.
 */
import { produce } from 'immer';

import type { DocItem, Family, Member } from '@/domain/types';
import { decryptFile, encryptFile, encryptJson, fromB64, openSealed, randomKey, toB64, type KeyPair } from '@/lib/crypto';
import { CloudApi } from '@/sync/api';
import { fileContext, kindsRefusedByServer, queueChanges, resetRefusedKinds, syncFamily, type CipherStore, type Replica } from '@/sync/engine';
import { diffFamily, emptyFamily } from '@/sync/model';
import { emptySync, type FamilySync } from '@/sync/types';

import { addToFamily, admin, cleanUp, createFamily, newUser, type TestUser } from './harness';

afterAll(cleanUp);

class Device implements Replica {
  families: Record<string, Family> = {};
  syncs: Record<string, FamilySync> = {};
  keys: Record<string, Uint8Array> = {};
  files = new Map<string, Uint8Array>();
  readonly api: CloudApi;
  readonly userId: string;
  private readonly pair: KeyPair;

  constructor(user: TestUser) {
    this.api = new CloudApi(user.client);
    this.userId = user.id;
    this.pair = user.pair;
  }

  join(familyId: string, familyKey: Uint8Array) {
    this.keys[familyId] = familyKey;
    this.families[familyId] ??= emptyFamily(familyId);
    this.syncs[familyId] ??= emptySync();
  }

  family = (id: string) => this.families[id];
  sync = (id: string) => this.syncs[id];
  applyRemote(id: string, fn: (d: Family) => void) {
    this.families[id] = produce(this.families[id], fn);
  }
  updateSync(id: string, fn: (d: FamilySync) => void) {
    this.syncs[id] = produce(this.syncs[id], fn);
  }
  keyPair = (v: number) => (v === 1 ? this.pair : undefined);
  familyKey = (id: string, v: number) => (v === 1 ? this.keys[id] : undefined);
  currentFamilyKey = (id: string) => (this.keys[id] ? { version: 1, key: this.keys[id] } : undefined);

  /** A local edit, queued the way the app queues it. */
  edit(familyId: string, fn: (d: Family) => void) {
    const prev = this.families[familyId];
    const next = produce(prev, fn);
    this.families[familyId] = next;
    queueChanges(this, familyId, diffFamily(prev, next));
  }

  store: CipherStore = {
    read: async (id) => this.files.get(id) ?? null,
    write: async (id, b) => void this.files.set(id, b),
    has: async (id) => this.files.has(id),
    forget: async (id) => void this.files.delete(id),
  };

  run(familyId: string) {
    return syncFamily(this.api, this, familyId, { files: this.store, prefetch: true });
  }
}

function member(id: string, extra: Partial<Member> = {}): Member {
  return { id, kind: 'account', fullName: `${id} Sharma`, ids: {}, status: 'active', createdAt: 1, ...extra };
}

function doc(id: string, extra: Partial<DocItem> = {}): DocItem {
  return {
    id, templateId: 'pan', title: id, scope: 'personal', onlyMe: false, createdBy: 'm-papa', createdAt: 1, updatedAt: 1,
    files: [], mutedBy: [], ...extra,
  };
}

async function family(): Promise<{ papa: Device; mummy: Device; familyId: string; papaUser: TestUser; mummyUser: TestUser }> {
  const papaUser = await newUser('papa');
  const mummyUser = await newUser('mummy');
  const { familyId, familyKey } = await createFamily(papaUser, 'm-papa');
  await addToFamily(papaUser, familyId, familyKey, mummyUser, 'm-mummy');
  const papa = new Device(papaUser);
  const mummy = new Device(mummyUser);
  papa.join(familyId, familyKey);
  mummy.join(familyId, familyKey);
  papa.edit(familyId, (d) => {
    d.name = "Sharma's";
    d.createdBy = 'm-papa';
    d.members.push(member('m-papa', { accountId: papaUser.id }), member('m-mummy', { accountId: mummyUser.id }), member('m-kabir', { kind: 'profile' }));
    d.documents.push(doc('pan-papa', { ownerId: 'm-papa', number: 'ABCPE1234F' }), doc('house', { scope: 'common' }));
  });
  await papa.run(familyId);
  await mummy.run(familyId);
  return { papa, mummy, familyId, papaUser, mummyUser };
}


const OLD_SERVER = process.env.OLD_SERVER === '1';
const swift = { id: 'veh-swift', name: 'Swift', kind: 'car' as const, number: 'DL3CAB1234', onlyMe: false, createdBy: 'm-papa', createdAt: 1, updatedAt: 1 };

beforeEach(() => resetRefusedKinds());

describe('vehicles', () => {
  (OLD_SERVER ? it : it.skip)('wait on the device while the server predates them; everything else syncs', async () => {
    const { papa, mummy, familyId } = await family();
    papa.edit(familyId, (d) => {
      d.vehicles = [swift];
      d.documents.push(doc('rc', { templateId: 'rc', scope: 'common', vehicleId: swift.id, title: 'Swift RC' }));
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    expect(kindsRefusedByServer()).toEqual(['vehicle']);
    expect(Object.keys(papa.syncs[familyId].outbox)).toEqual([swift.id]);
    expect(mummy.families[familyId].documents.find((x) => x.id === 'rc')?.vehicleId).toBe(swift.id);
    expect(mummy.families[familyId].vehicles ?? []).toEqual([]);
  });

  (OLD_SERVER ? it.skip : it)('reach the other member, locked like every record', async () => {
    const { papa, mummy, familyId } = await family();
    papa.edit(familyId, (d) => {
      d.vehicles = [swift];
      d.documents.push(doc('rc', { templateId: 'rc', scope: 'common', vehicleId: swift.id, title: 'Swift RC' }));
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    expect(kindsRefusedByServer()).toEqual([]);
    expect(mummy.families[familyId].vehicles).toEqual([expect.objectContaining({ id: swift.id, name: 'Swift', number: 'DL3CAB1234' })]);
    const raw = await admin().from('records').select('kind, data_box').eq('family_id', familyId).eq('id', swift.id);
    expect(raw.data?.[0]?.kind).toBe('vehicle');
    expect(JSON.stringify(raw.data)).not.toContain('Swift');
    // Deleting it (softly) reaches her too.
    papa.edit(familyId, (d) => {
      d.vehicles = (d.vehicles ?? []).map((v) => ({ ...v, deletedAt: 5 }));
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    expect(mummy.families[familyId].vehicles?.[0].deletedAt).toBe(5);
  });
});

describe('merging duplicates', () => {
  (OLD_SERVER ? it.skip : it)('keeps the moved pages on the server for everyone', async () => {
    const { papa, mummy, familyId } = await family();
    const page = (id: string) => ({ id, name: `${id}.jpg`, mime: 'image/jpeg', size: 3, kind: 'image' as const, key: toB64(randomKey()), familyId });
    const a = page('aad-a');
    const b = page('aad-b');
    for (const f of [a, b]) papa.files.set(f.id, encryptFile(new Uint8Array([1, 2, 3]), fromB64(f.key), fileContext(familyId, f.id)));
    papa.edit(familyId, (d) => {
      d.documents.push(doc('aad-1', { templateId: 'aadhaar', ownerId: 'm-papa', files: [a] }), doc('aad-2', { templateId: 'aadhaar', ownerId: 'm-papa', files: [b] }));
    });
    await papa.run(familyId);

    // The merge, as the store does it: the second one's page moves to the first, the second goes.
    papa.edit(familyId, (d) => {
      const keep = d.documents.find((x) => x.id === 'aad-1') as DocItem;
      keep.files = [...keep.files, { ...b, versionId: 'v-copy' }];
      keep.versions = [{ id: 'main', label: 'Original', addedAt: 1, addedBy: 'm-papa' }, { id: 'v-copy', label: 'Another copy', addedAt: 1, addedBy: 'm-papa' }];
      d.documents = d.documents.filter((x) => x.id !== 'aad-2');
    });
    await papa.run(familyId);
    await mummy.run(familyId);

    const merged = mummy.families[familyId].documents.find((x) => x.id === 'aad-1') as DocItem;
    expect(merged.files.map((f) => f.id)).toEqual(['aad-a', 'aad-b']);
    expect(mummy.families[familyId].documents.some((x) => x.id === 'aad-2')).toBe(false);
    const stored = await papa.api.listFiles(familyId);
    expect(stored).toEqual(expect.arrayContaining(['aad-a', 'aad-b']));
    const bytes = await mummy.api.downloadFile(familyId, 'aad-b');
    expect(Array.from(decryptFile(bytes as Uint8Array, fromB64(b.key), fileContext(familyId, 'aad-b')))).toEqual([1, 2, 3]);
  });
});
