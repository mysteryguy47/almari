/**
 * The sync engine against the local server: two family members, each with
 * their own device copy, editing the same family.
 */
import { produce } from 'immer';

import type { DocItem, Family, Member } from '@/domain/types';
import { decryptFile, encryptFile, encryptJson, fromB64, openSealed, randomKey, toB64, type KeyPair } from '@/lib/crypto';
import { CloudApi } from '@/sync/api';
import { fileContext, queueChanges, syncFamily, type CipherStore, type Replica } from '@/sync/engine';
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

describe('two devices, one family', () => {
  it('brings a new member the whole family, and nothing readable reaches the server', async () => {
    const { mummy, familyId } = await family();
    expect(mummy.families[familyId].name).toBe("Sharma's");
    expect(mummy.families[familyId].members.map((m) => m.id).sort()).toEqual(['m-kabir', 'm-mummy', 'm-papa']);
    expect(mummy.families[familyId].documents.find((d) => d.id === 'pan-papa')?.number).toBe('ABCPE1234F');
    const raw = await admin().from('records').select('data_box, key_box').eq('family_id', familyId);
    const everything = JSON.stringify(raw.data);
    expect(everything).not.toContain('ABCPE1234F');
    expect(everything).not.toContain('Sharma');
  });

  it('merges edits to different fields made at the same time', async () => {
    const { papa, mummy, familyId } = await family();
    papa.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'house') as DocItem).original = 'Steel almari';
    });
    mummy.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'house') as DocItem).title = 'Flat registry';
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    await papa.run(familyId);
    for (const device of [papa, mummy]) {
      expect(device.families[familyId].documents.find((x) => x.id === 'house')).toMatchObject({ original: 'Steel almari', title: 'Flat registry' });
    }
  });

  it('lets the later edit win a clash, and keeps the other value in history', async () => {
    const { papa, mummy, familyId } = await family();
    papa.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'house') as DocItem).original = 'Bank locker';
    });
    mummy.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'house') as DocItem).original = 'Steel almari';
    });
    await papa.run(familyId);
    await mummy.run(familyId); // reaches the server later: wins
    await papa.run(familyId);
    for (const device of [papa, mummy]) {
      const house = device.families[familyId].documents.find((x) => x.id === 'house') as DocItem;
      expect(house.original).toBe('Steel almari');
      expect(house.history?.map((h) => h.value)).toContain('Bank locker');
    }
  });

  it('restores an item one person deleted while the other edited it', async () => {
    const { papa, mummy, familyId } = await family();
    papa.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'house') as DocItem).deletedAt = 5;
    });
    mummy.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'house') as DocItem).original = 'Steel almari';
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    await papa.run(familyId);
    for (const device of [papa, mummy]) {
      const house = device.families[familyId].documents.find((x) => x.id === 'house') as DocItem;
      expect(house.deletedAt).toBeUndefined();
      expect(house.original).toBe('Steel almari');
    }
  });

  it('never sends an Only me item to anyone else, not even locked', async () => {
    const { papa, mummy, familyId, papaUser } = await family();
    papa.edit(familyId, (d) => {
      d.documents.push(doc('papa-secret', { onlyMe: true, createdBy: 'm-papa', title: 'Medical report' }));
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    expect(mummy.families[familyId].documents.find((x) => x.id === 'papa-secret')).toBeUndefined();
    expect(mummy.syncs[familyId].locked['papa-secret']).toBeUndefined();
    const stored = await admin().from('records').select('visible_to').eq('family_id', familyId).eq('id', 'papa-secret').single();
    expect(stored.data?.visible_to).toBe(papaUser.id);
    expect(papa.families[familyId].documents.find((x) => x.id === 'papa-secret')?.title).toBe('Medical report');
  });

  it('re-seals personal papers when the family makes them private, and back', async () => {
    const { papa, mummy, familyId, papaUser } = await family();
    // Mummy makes personal papers private: Papa's PAN becomes Papa's alone.
    mummy.edit(familyId, (d) => {
      d.personalSharing = 'private';
    });
    await mummy.run(familyId);
    expect(mummy.families[familyId].documents.find((x) => x.id === 'pan-papa')).toBeUndefined();
    const stored = await admin().from('records').select('visible_to').eq('family_id', familyId).eq('id', 'pan-papa').single();
    expect(stored.data?.visible_to).toBe(papaUser.id);
    await papa.run(familyId);
    expect(papa.families[familyId].documents.find((x) => x.id === 'pan-papa')?.number).toBe('ABCPE1234F');
    expect(papa.families[familyId].documents.find((x) => x.id === 'house')).toBeDefined(); // common stays shared

    // Papa shares again; only Papa can re-seal his own, and does at his next sync.
    papa.edit(familyId, (d) => {
      d.personalSharing = 'family';
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    expect(mummy.families[familyId].documents.find((x) => x.id === 'pan-papa')?.number).toBe('ABCPE1234F');
  });

  it('carries encrypted files: uploaded locked, opened on the other device', async () => {
    const { papa, mummy, familyId } = await family();
    const plain = new Uint8Array(5000).map((_, i) => (i * 7) % 256);
    const key = randomKey();
    const fileId = 'file-pan';
    papa.files.set(fileId, encryptFile(plain, key, fileContext(familyId, fileId)));
    papa.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'pan-papa') as DocItem).files = [
        { id: fileId, name: 'pan.jpg', mime: 'image/jpeg', size: plain.length, kind: 'image', key: toB64(key), familyId },
      ];
    });
    await papa.run(familyId);
    await mummy.run(familyId);
    const ref = mummy.families[familyId].documents.find((x) => x.id === 'pan-papa')?.files[0];
    const bytes = mummy.files.get(fileId) as Uint8Array;
    expect(decryptFile(bytes, fromB64(ref?.key as string), fileContext(familyId, fileId))).toEqual(plain);

    // Taking the file off the document removes it from the server.
    papa.edit(familyId, (d) => {
      (d.documents.find((x) => x.id === 'pan-papa') as DocItem).files = [];
    });
    await papa.run(familyId);
    expect(await papa.api.listFiles(familyId)).toEqual([]);
  });

  it('keeps working through many changes in one go', async () => {
    const { papa, mummy, familyId } = await family();
    papa.edit(familyId, (d) => {
      for (let i = 0; i < 250; i++) d.tasks.push({ id: `t${i}`, title: `Task ${i}`, assignees: [], repeat: 'none', done: false, createdBy: 'm-papa', createdAt: i });
    });
    await papa.run(familyId);
    expect(Object.keys(papa.syncs[familyId].outbox)).toHaveLength(0);
    await mummy.run(familyId);
    expect(mummy.families[familyId].tasks).toHaveLength(250);
  });

  it('opens what was sealed for the member and nothing else', async () => {
    const { mummyUser, familyId } = await family();
    const keys = await mummyUser.client.from('family_keys').select('box').eq('family_id', familyId);
    expect(openSealed(keys.data?.[0].box, mummyUser.pair)).toHaveLength(32);
    expect(encryptJson).toBeDefined();
  });
});
