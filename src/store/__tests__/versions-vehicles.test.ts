/**
 * Versions of one paper, merging papers saved twice, and family vehicles,
 * as the store applies them.
 */
import { emptyFamily } from '@/sync/model';
import { emptySync } from '@/sync/types';

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto');
  return {
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomBytes: (n: number) => new Uint8Array(nodeCrypto.randomBytes(n)),
    digestStringAsync: async (_alg: string, data: string) => nodeCrypto.createHash('sha256').update(data).digest('hex'),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  };
});

const mockMemory = new Map<string, string>();
jest.mock('@/store/kv', () => ({
  kv: {
    getItem: async (k: string) => mockMemory.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockMemory.set(k, v),
    removeItem: async (k: string) => void mockMemory.delete(k),
  },
}));
jest.mock('@/store/files', () => ({ removeFile: jest.fn(async () => undefined) }));

// Imported after the mocks on purpose: the store reads storage as it is created.
// eslint-disable-next-line import/first
import { useApp, viewerIdOf } from '../app-store';
// eslint-disable-next-line import/first
import { flushSaves } from '../persist-storage';

const store = () => useApp.getState();
const family = () => {
  const s = store();
  return s.families[s.session.familyId as string];
};
const viewer = () => viewerIdOf(store()) as string;

/** Signed in as Ayush, with one family where he is member "m-ayush". */
function signedInFamily(name = "Khurana's", familyId = 'fam-1') {
  useApp.setState((d) => {
    d.cloud ??= {
      userId: 'user-ayush', email: 'ayush@example.com', name: 'Ayush Khurana', google: false, hasPassword: true,
      keyring: [{ version: 1, amk: 'x' }], currentVersion: 1, familyKeys: {}, memberships: {}, sync: {},
    };
    d.cloud.memberships[familyId] = { memberId: 'm-ayush' };
    d.cloud.sync[familyId] = emptySync();
  });
  const f = emptyFamily(familyId, name, 'm-ayush');
  f.members.push({ id: 'm-ayush', kind: 'account', accountId: 'user-ayush', email: 'ayush@example.com', fullName: 'Ayush Khurana', ids: {}, status: 'active', createdAt: 1 });
  store().addFamily(f, true);
}


const img = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `${id}.jpg`, mime: 'image/jpeg', size: 1000, kind: 'image' as const, ...extra });

beforeEach(() => {
  mockMemory.clear();
  useApp.setState({
    families: {}, session: {}, cloud: undefined,
    device: { theme: 'system', pinFailures: 0, biometrics: false, seenPrototypeNote: false, deviceId: 'dev-1' },
  });
  signedInFamily();
});

const aadhaar = () => store().saveDocument({
  templateId: 'aadhaar', title: 'My Aadhaar', scope: 'personal', ownerId: viewer(), onlyMe: false, number: '2345 6789 0124',
  files: [img('front'), img('back')],
});
const docById = (id: string) => family().documents.find((d) => d.id === id)!;

describe('versions of one paper', () => {
  it('adds a version with its own pages, keeping the first one as it was', () => {
    const id = aadhaar();
    const vid = store().addDocVersion(id, 'Masked', [img('masked-front')]);
    const doc = docById(id);
    expect(doc.versions?.map((v) => v.label)).toEqual(['Original', 'Masked']);
    expect(doc.files.map((f) => [f.id, f.versionId])).toEqual([['front', undefined], ['back', undefined], ['masked-front', vid]]);
    expect(family().activity[0].text).toBe('added a masked version of My Aadhaar');
  });

  it('never gives two versions the same name', () => {
    const id = aadhaar();
    store().addDocVersion(id, 'Masked', [img('m1')]);
    store().addDocVersion(id, 'masked', [img('m2')]);
    expect(docById(id).versions?.map((v) => v.label)).toEqual(['Original', 'Masked', 'masked 2']);
    const second = docById(id).versions![2];
    store().renameDocVersion(id, second.id, 'Masked');
    expect(docById(id).versions![2].label).toBe('Masked 2');
    store().renameDocVersion(id, second.id, 'PVC card');
    expect(docById(id).versions![2].label).toBe('PVC card');
  });

  it('adds pages to a version already there', () => {
    const id = aadhaar();
    const vid = store().addDocVersion(id, 'Masked', [img('mf')])!;
    store().addVersionPages(id, vid, [img('mb')]);
    expect(docById(id).files.filter((f) => f.versionId === vid).map((f) => f.id)).toEqual(['mf', 'mb']);
  });

  it('removes a version and its pages; removing the first promotes the next', () => {
    const id = aadhaar();
    const masked = store().addDocVersion(id, 'Masked', [img('mf')])!;
    store().addDocVersion(id, 'PVC card', [img('pvc')]);
    store().removeDocVersion(id, masked);
    expect(docById(id).versions?.map((v) => v.label)).toEqual(['Original', 'PVC card']);
    expect(docById(id).files.map((f) => f.id)).toEqual(['front', 'back', 'pvc']);

    store().removeDocVersion(id, 'main');
    const doc = docById(id);
    expect(doc.versions?.map((v) => [v.id, v.label])).toEqual([['main', 'PVC card']]);
    expect(doc.files.map((f) => [f.id, f.versionId])).toEqual([['pvc', undefined]]);
    // The last version is the document itself: it stays.
    store().removeDocVersion(id, 'main');
    expect(docById(id).files).toHaveLength(1);
  });

  it('editing the document keeps the versions', () => {
    const id = aadhaar();
    store().addDocVersion(id, 'Masked', [img('mf')]);
    const doc = docById(id);
    store().saveDocument({ ...doc, id, title: 'Aadhaar card', files: doc.files });
    expect(docById(id).versions?.map((v) => v.label)).toEqual(['Original', 'Masked']);
    expect(docById(id).title).toBe('Aadhaar card');
  });
});

describe('papers saved twice', () => {
  it('folds the second into the first as a version, with its pages, details and tasks', () => {
    const me = viewer();
    const first = aadhaar();
    const second = store().saveDocument({
      templateId: 'aadhaar', title: 'Aadhaar again', scope: 'personal', ownerId: me, onlyMe: false, original: 'Steel almari',
      files: [img('copy-front'), img('copy-back')],
    });
    const masked = store().addDocVersion(second, 'Masked', [img('copy-masked')]);
    expect(masked).toBeDefined();
    const task = store().saveTask({ title: 'Update address', assignees: [], repeat: 'none', linkedDocId: second });
    store().mergeDocuments(first, [second]);

    expect(family().documents.map((d) => d.id)).toEqual([first]);
    const doc = docById(first);
    expect(doc.versions?.map((v) => v.label)).toEqual(['Original', 'Another copy', 'Masked']);
    expect(doc.files.map((f) => f.id)).toEqual(['front', 'back', 'copy-front', 'copy-back', 'copy-masked']);
    const another = doc.versions![1].id;
    expect(doc.files.filter((f) => f.versionId === another).map((f) => f.id)).toEqual(['copy-front', 'copy-back']);
    expect(doc.original).toBe('Steel almari');
    expect(doc.number).toBe('2345 6789 0124');
    expect(family().tasks.find((t) => task.ok && t.id === task.value)?.linkedDocId).toBe(first);
  });

  it('only merges the same kind of paper', () => {
    const first = aadhaar();
    const pan = store().saveDocument({ templateId: 'pan', title: 'PAN', scope: 'personal', ownerId: viewer(), onlyMe: false, files: [img('p')] });
    store().mergeDocuments(first, [pan]);
    expect(family().documents).toHaveLength(2);
  });
});

describe('vehicles', () => {
  it('belong to the whole family, and an RC with the same plate files itself', () => {
    const rc = store().saveDocument({ templateId: 'rc', title: 'Car RC', scope: 'common', onlyMe: false, number: 'DL 3C AB 1234', files: [img('rc')] });
    const ins = store().saveDocument({ templateId: 'vehicle-insurance', title: 'Car insurance', scope: 'common', onlyMe: false, files: [img('ins')] });
    const id = store().saveVehicle({ name: 'Swift', kind: 'car', number: 'DL3CAB1234' });
    const v = family().vehicles!.find((x) => x.id === id)!;
    expect(v).toMatchObject({ name: 'Swift', onlyMe: false, ownerId: undefined });
    expect(docById(rc).vehicleId).toBe(id);
    expect(docById(ins).vehicleId).toBeUndefined();

    store().fileUnderVehicle([ins], id);
    expect(docById(ins).vehicleId).toBe(id);
    expect(family().activity[0].text).toBe('filed a paper under Swift');
  });

  it('are deleted softly; their papers stay', () => {
    const id = store().saveVehicle({ name: 'Activa', kind: 'scooter' });
    const puc = store().saveDocument({ templateId: 'puc', title: 'PUC', scope: 'common', onlyMe: false, vehicleId: id, files: [img('puc')] });
    store().deleteItem('vehicles', id);
    expect(family().vehicles![0].deletedAt).toBeDefined();
    expect(docById(puc)).toBeDefined();
    store().restoreItem('vehicles', id);
    expect(family().vehicles![0].deletedAt).toBeUndefined();
    expect(family().activity.map((a) => a.text)).toContain('deleted Activa');
  });

  it('work in a family saved before vehicles existed', () => {
    useApp.setState((d) => {
      delete d.families['fam-1'].vehicles;
    });
    const id = store().saveVehicle({ name: 'Tractor', kind: 'tractor' });
    expect(family().vehicles?.map((v) => v.id)).toEqual([id]);
  });
});

afterAll(async () => {
  await flushSaves();
});
