/**
 * Two promises the sync engine keeps, against a stand-in server:
 * - a server whose database predates vehicles refuses them, and everything
 *   else still syncs while vehicles wait on the device;
 * - pages moved from one paper to another (merging duplicates) are never
 *   deleted from the server.
 */
import { produce } from 'immer';

import type { DocItem, Family, FileRef } from '@/domain/types';
import { initCrypto, randomKey } from '@/lib/crypto';

import type { CloudApi, PushRow } from '../api';
import { kindsRefusedByServer, push, queueChanges, resetRefusedKinds, type Replica } from '../engine';
import { diffFamily, emptyFamily } from '../model';
import { emptySync, type FamilySync } from '../types';

const FAMILY = 'fam-test';

class Device implements Replica {
  readonly userId = 'user-1';
  families: Record<string, Family> = { [FAMILY]: emptyFamily(FAMILY, "Test's", 'm1') };
  syncs: Record<string, FamilySync> = { [FAMILY]: emptySync() };
  constructor(private readonly key: Uint8Array) {}
  family = (id: string) => this.families[id];
  sync = (id: string) => this.syncs[id];
  applyRemote(id: string, fn: (d: Family) => void) {
    this.families[id] = produce(this.families[id], fn);
  }
  updateSync(id: string, fn: (d: FamilySync) => void) {
    this.syncs[id] = produce(this.syncs[id], fn);
  }
  keyPair = () => undefined;
  familyKey = () => this.key;
  currentFamilyKey = () => ({ version: 1, key: this.key });
  edit(fn: (d: Family) => void) {
    const prev = this.families[FAMILY];
    const next = produce(prev, fn);
    this.families[FAMILY] = next;
    queueChanges(this, FAMILY, diffFamily(prev, next));
  }
}

/** Accepts every row, or refuses a batch with a vehicle the way an older Postgres check does. */
function server(opts: { knowsVehicles: boolean }) {
  let seq = 0;
  const pushed: PushRow[][] = [];
  const removed: string[] = [];
  const api = {
    push: async (_familyId: string, rows: PushRow[]) => {
      if (!opts.knowsVehicles && rows.some((r) => r.kind === 'vehicle')) {
        throw Object.assign(new Error('new row for relation "records" violates check constraint "records_kind_check"'), { code: '23514' });
      }
      pushed.push(rows);
      return rows.map((r) => ({ id: r.id, status: 'ok' as const, seq: ++seq }));
    },
    removeFiles: async (_familyId: string, ids: string[]) => void removed.push(...ids),
  } as unknown as CloudApi;
  return { api, pushed, removed, opts };
}

const file = (id: string): FileRef => ({ id, name: `${id}.jpg`, mime: 'image/jpeg', size: 1, kind: 'image' });
const doc = (id: string, files: FileRef[], extra: Partial<DocItem> = {}): DocItem => ({
  id, templateId: 'aadhaar', title: id, scope: 'personal', onlyMe: false, createdBy: 'm1', createdAt: 1, updatedAt: 1, files, mutedBy: [], ...extra,
});

let device: Device;
beforeAll(async () => {
  await initCrypto();
});
beforeEach(() => {
  resetRefusedKinds();
  device = new Device(randomKey());
});

describe('a server that does not know vehicles yet', () => {
  it('keeps vehicles on the device and sends everything else', async () => {
    const s = server({ knowsVehicles: false });
    device.edit((f) => {
      f.documents.push(doc('d1', []));
      f.vehicles = [{ id: 'v1', name: 'Swift', kind: 'car', onlyMe: false, createdBy: 'm1', createdAt: 1, updatedAt: 1 }];
    });
    await push(s.api, device, FAMILY);
    expect(s.pushed.flat().map((r) => r.id)).toEqual(['d1']);
    expect(Object.keys(device.sync(FAMILY).outbox)).toEqual(['v1']);
    expect(kindsRefusedByServer()).toEqual(['vehicle']);

    // More edits keep flowing without trying the vehicle again.
    device.edit((f) => {
      f.documents[0] = { ...f.documents[0], title: 'Renamed' };
    });
    await push(s.api, device, FAMILY);
    expect(s.pushed).toHaveLength(2);
    expect(s.pushed[1].map((r) => r.id)).toEqual(['d1']);
  });

  it('sends the waiting vehicles once the server knows them (the next app start)', async () => {
    const s = server({ knowsVehicles: false });
    device.edit((f) => {
      f.vehicles = [{ id: 'v1', name: 'Swift', kind: 'car', onlyMe: false, createdBy: 'm1', createdAt: 1, updatedAt: 1 }];
    });
    await push(s.api, device, FAMILY);
    expect(device.sync(FAMILY).outbox.v1).toBeDefined();

    s.opts.knowsVehicles = true;
    resetRefusedKinds();
    await push(s.api, device, FAMILY);
    expect(s.pushed.flat().map((r) => [r.id, r.kind])).toEqual([['v1', 'vehicle']]);
    expect(device.sync(FAMILY).outbox).toEqual({});
  });

  it('still reports any other failure', async () => {
    const api = { push: async () => { throw new Error('offline'); } } as unknown as CloudApi;
    device.edit((f) => {
      f.vehicles = [{ id: 'v1', name: 'Swift', kind: 'car', onlyMe: false, createdBy: 'm1', createdAt: 1, updatedAt: 1 }];
    });
    await expect(push(api, device, FAMILY)).rejects.toThrow('offline');
    expect(kindsRefusedByServer()).toEqual([]);
  });
});

describe('pages that moved to another paper', () => {
  it('are not deleted from the server when their old paper goes', async () => {
    const s = server({ knowsVehicles: true });
    device.edit((f) => {
      f.documents.push(doc('keep', [file('f1')]), doc('dup', [file('f2'), file('f3')]));
    });
    await push(s.api, device, FAMILY);

    // Merge: the duplicate's pages join the kept paper; the duplicate is removed.
    device.edit((f) => {
      const keep = f.documents.find((d) => d.id === 'keep')!;
      keep.files = [...keep.files, { ...file('f2'), versionId: 'v2' }, { ...file('f3'), versionId: 'v2' }];
      f.documents = f.documents.filter((d) => d.id !== 'dup');
    });
    await push(s.api, device, FAMILY);
    expect(s.removed).toEqual([]);

    // A page really removed from the only paper that had it does go.
    device.edit((f) => {
      const keep = f.documents.find((d) => d.id === 'keep')!;
      keep.files = keep.files.filter((x) => x.id !== 'f3');
    });
    await push(s.api, device, FAMILY);
    expect(s.removed).toEqual(['f3']);
  });
});
