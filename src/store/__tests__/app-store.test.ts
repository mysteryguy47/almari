/**
 * The app's state on the device: families, profile numbers, privacy, deletes
 * and restores, the PIN lockout, the sample family, saving, and wiping on
 * sign-out. Signing in itself is real now and tested against the server
 * (tests/backend).
 */
import { SAMPLE_FAMILY_ID, SAMPLE_VIEWER_ID } from '@/domain/sample';
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

beforeEach(() => {
  mockMemory.clear();
  useApp.setState({
    families: {}, session: {}, cloud: undefined,
    device: { theme: 'system', pinFailures: 0, biometrics: false, seenPrototypeNote: false, deviceId: 'dev-1' },
  });
});

describe('families on this device', () => {
  it('knows who the viewer is from the account’s membership', () => {
    signedInFamily();
    expect(viewer()).toBe('m-ayush');
  });

  it('switches only between families the account belongs to', () => {
    signedInFamily("Khurana's", 'fam-1');
    signedInFamily("Arora's", 'fam-2');
    store().switchFamily('fam-1');
    expect(family().name).toBe("Khurana's");
    store().switchFamily('not-mine');
    expect(family().name).toBe("Khurana's");
  });

  it('forgets a family the account left, and opens another', () => {
    signedInFamily("Khurana's", 'fam-1');
    signedInFamily("Arora's", 'fam-2');
    store().forgetFamily('fam-2');
    expect(store().families['fam-2']).toBeUndefined();
    expect(store().cloud?.memberships['fam-2']).toBeUndefined();
    expect(store().session.familyId).toBe('fam-1');
  });

  it('marks an invited email as invited, and announces privacy changes', () => {
    signedInFamily();
    expect(store().saveMember({ kind: 'account', fullName: 'Riya Khurana', email: 'Riya@Example.com', ids: {} }).ok).toBe(true);
    const riya = family().members.find((m) => m.fullName === 'Riya Khurana');
    expect(riya).toMatchObject({ status: 'invited', email: 'riya@example.com' });
    store().setPersonalSharing('private');
    expect(family().personalSharing).toBe('private');
    expect(family().activity[0].text).toMatch(/private/);
  });

  it('leaving takes the viewer’s personal items and member card with them', () => {
    signedInFamily();
    const me = viewer();
    store().saveNote({ title: 'Mine', body: 'x', onlyMe: true });
    store().saveDocument({ templateId: 'pan', title: 'My PAN', scope: 'personal', ownerId: me, onlyMe: false, files: [] });
    store().saveDocument({ templateId: 'house-deed', title: 'Flat', scope: 'common', onlyMe: false, files: [] });
    store().leaveLocally();
    expect(family().notes).toHaveLength(0);
    expect(family().documents.map((d) => d.title)).toEqual(['Flat']);
    expect(family().members.some((m) => m.id === me)).toBe(false);
  });
});

describe('documents and profile numbers', () => {
  beforeEach(() => signedInFamily());

  it('a PAN document fills the profile, and editing the profile updates the document', () => {
    const me = viewer();
    const docId = store().saveDocument({
      templateId: 'pan', title: 'My PAN', scope: 'personal', ownerId: me, onlyMe: false, number: 'abcpe 1234f',
      files: [{ id: 'f1', name: 'pan.jpg', mime: 'image/jpeg', size: 1000, kind: 'image' }],
    });
    expect(family().members.find((m) => m.id === me)?.ids.pan).toBe('ABCPE1234F');

    const meMember = family().members.find((m) => m.id === me)!;
    store().saveMember({ ...meMember, ids: { ...meMember.ids, pan: 'ABCPE9999F' } });
    expect(family().documents.find((d) => d.id === docId)?.number).toBe('ABCPE9999F');
  });

  it('deletes are soft, restorable, and purged after 30 days', () => {
    const id = store().saveNote({ title: 'Locker', body: 'SBI 214', onlyMe: false });
    store().deleteItem('notes', id);
    expect(family().notes.find((n) => n.id === id)?.deletedAt).toBeDefined();
    store().restoreItem('notes', id);
    expect(family().notes.find((n) => n.id === id)?.deletedAt).toBeUndefined();
    store().deleteItem('notes', id);
    store().purgeDeleted(Date.now() + 29 * 86_400_000);
    expect(family().notes).toHaveLength(1);
    store().purgeDeleted(Date.now() + 31 * 86_400_000);
    expect(family().notes).toHaveLength(0);
  });

  it('only credit cards keep a limit, statement day and due day', () => {
    const id = store().saveCard({
      type: 'debit', bank: 'SBI', number: '4111111111111111', network: 'visa', onlyMe: false,
      creditLimit: 5000, statementDay: 3, dueDay: 20,
    });
    const saved = family().cards.find((c) => c.id === id)!;
    expect([saved.creditLimit, saved.statementDay, saved.dueDay]).toEqual([undefined, undefined, undefined]);
  });

  it('a nudge is allowed once a day', () => {
    const t = store().saveTask({ title: 'Renew insurance', assignees: [], repeat: 'none' });
    const id = t.ok ? t.value : '';
    const now = Date.now();
    expect(store().nudgeTask(id, now).ok).toBe(true);
    expect(store().nudgeTask(id, now + 3_600_000).ok).toBe(false);
    expect(store().nudgeTask(id, now + 86_400_001).ok).toBe(true);
  });
});

describe('removing a member needs a second member', () => {
  it('works in the sample family of three account members', () => {
    store().startSample();
    expect(store().requestRemoval('s-papa')).toEqual({ ok: true, value: 'requested' });
    expect(store().approveRemoval('s-papa').ok).toBe(false); // the requester cannot approve
    store().setViewAs('s-mummy');
    expect(store().approveRemoval('s-papa').ok).toBe(true);
    expect(family().members.some((m) => m.id === 's-papa')).toBe(false);
  });
});

describe('app PIN', () => {
  it('five wrong PINs lock the app until a sign-in; nothing is wiped', async () => {
    signedInFamily();
    await store().setPin('2468');
    expect(await store().verifyPin('2468')).toEqual({ status: 'ok' });
    for (let left = 4; left >= 1; left--) {
      expect(await store().verifyPin('0000')).toEqual({ status: 'wrong', attemptsLeft: left });
    }
    expect(await store().verifyPin('0000')).toEqual({ status: 'locked-out' });
    expect(store().device.lockedOut).toBe(true);
    expect(Object.keys(store().families)).toHaveLength(1);
    expect(store().cloud?.userId).toBe('user-ayush');
  });
});

describe('sample family', () => {
  it('opens as Ananya, can be viewed as another account member, and leaves no trace', () => {
    store().startSample();
    expect(viewer()).toBe(SAMPLE_VIEWER_ID);
    store().setViewAs('s-kabir'); // profile-only members cannot be "viewed as"
    expect(viewer()).toBe(SAMPLE_VIEWER_ID);
    store().setViewAs('s-papa');
    expect(viewer()).toBe('s-papa');
    store().exitSample();
    expect(store().families[SAMPLE_FAMILY_ID]).toBeUndefined();
  });

  it('returns to the account’s own family after the sample', () => {
    signedInFamily();
    store().startSample();
    store().exitSample();
    expect(store().session.familyId).toBe('fam-1');
  });
});

describe('saving on this device', () => {
  it('writes changes to storage, without the loading flag', async () => {
    signedInFamily();
    await flushSaves();
    const saved = JSON.parse(mockMemory.get('almari-state') as string);
    expect(saved.state.families['fam-1'].name).toBe("Khurana's");
    expect(saved.state.cloud.userId).toBe('user-ayush');
    expect(saved.state.hydrated).toBeUndefined();
  });

  it('signing out wipes everything but the theme', async () => {
    signedInFamily();
    store().setTheme('dark');
    const before = store().device.deviceId;
    store().clearLocal();
    expect(store().families).toEqual({});
    expect(store().cloud).toBeUndefined();
    expect(store().device.theme).toBe('dark');
    expect(store().device.deviceId).not.toBe(before);
  });
});
