/**
 * The app's state, end to end: sign-in and lockouts, linking Google and a
 * password, invites, the three-family limit, profile numbers, privacy,
 * deletes and restores, the PIN lockout, and the sample family.
 */
import { SAMPLE_FAMILY_ID, SAMPLE_VIEWER_ID } from '@/domain/sample';
import { PASSWORD_PAUSE_MS } from '@/domain/family-rules';

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

const store = () => useApp.getState();
const family = () => {
  const s = store();
  return s.families[s.session.familyId as string];
};
const viewer = () => viewerIdOf(store()) as string;

beforeEach(() => {
  mockMemory.clear();
  useApp.setState({
    accounts: {}, families: {}, session: {},
    device: { theme: 'system', pinFailures: 0, biometrics: false, seenPrototypeNote: false },
  });
});

const you = (fullName: string) => ({ fullName, dob: '1990-01-01', gender: 'female' as const });

describe('sign-in', () => {
  it('signs up with email and refuses a second account on the same email', async () => {
    expect((await store().signUpWithEmail('Neha Khurana', 'Neha@Example.com', 'almari2026')).ok).toBe(true);
    expect(Object.values(store().accounts)[0].email).toBe('neha@example.com');
    expect(Object.values(store().accounts)[0].passwordHash).not.toContain('almari2026');
    store().signOut();
    expect((await store().signUpWithEmail('Neha', 'neha@example.com', 'another123')).ok).toBe(false);
  });

  it('five wrong passwords pause sign-in for 30 minutes; a reset unlocks it', async () => {
    await store().signUpWithEmail('Neha', 'neha@example.com', 'almari2026');
    store().signOut();
    const t = Date.now();
    for (let i = 4; i >= 1; i--) {
      expect(await store().signInWithEmail('neha@example.com', 'wrong-pass', t)).toEqual({ status: 'wrong', attemptsLeft: i });
    }
    expect((await store().signInWithEmail('neha@example.com', 'wrong-pass', t)).status).toBe('paused');
    // Even the right password waits while paused.
    expect((await store().signInWithEmail('neha@example.com', 'almari2026', t + 1000)).status).toBe('paused');
    expect((await store().signInWithEmail('neha@example.com', 'almari2026', t + PASSWORD_PAUSE_MS + 1)).status).toBe('ok');

    store().signOut();
    for (let i = 0; i < 5; i++) await store().signInWithEmail('neha@example.com', 'wrong-pass', t);
    await store().resetPassword('neha@example.com', 'fresh-start-1');
    expect((await store().signInWithEmail('neha@example.com', 'fresh-start-1', t)).status).toBe('ok');
  });

  it('a Google user can add a password and then sign in either way, to the same account', async () => {
    store().continueWithGoogle('Ayush Khurana', 'ayush@example.com');
    const id = store().session.accountId;
    store().signOut();
    expect((await store().signInWithEmail('ayush@example.com', 'anything1')).status).toBe('google-only');

    store().continueWithGoogle('Ayush Khurana', 'ayush@example.com');
    expect((await store().setPassword('my-new-pass-1')).ok).toBe(true);
    store().signOut();
    expect((await store().signInWithEmail('ayush@example.com', 'my-new-pass-1')).status).toBe('ok');
    expect(store().session.accountId).toBe(id);
  });

  it('changing a password needs the current one', async () => {
    await store().signUpWithEmail('Neha', 'neha@example.com', 'almari2026');
    expect((await store().setPassword('next-pass-1', 'not-it')).ok).toBe(false);
    expect((await store().setPassword('next-pass-1', 'almari2026')).ok).toBe(true);
  });
});

describe('families', () => {
  it('one person can be in at most three families', async () => {
    await store().signUpWithEmail('Neha', 'neha@example.com', 'almari2026');
    expect(store().createFamily("Khurana's", you('Neha Khurana')).ok).toBe(true);
    expect(store().createFamily("Arora's", you('Neha Khurana')).ok).toBe(true);
    expect(store().createFamily('Neha & Raghav', you('Neha Khurana')).ok).toBe(true);
    const fourth = store().createFamily('One more', you('Neha Khurana'));
    expect(fourth.ok).toBe(false);
    const account = Object.values(store().accounts)[0];
    store().switchFamily(account.familyIds[0]);
    expect(family().name).toBe("Khurana's");
  });

  it('an invited email joins the family when that person signs up', async () => {
    await store().signUpWithEmail('Ayush', 'ayush@example.com', 'almari2026');
    store().createFamily("Khurana's", you('Ayush Khurana'));
    expect(store().saveMember({ kind: 'account', fullName: 'Riya Khurana', email: 'Riya@Example.com', ids: {} }).ok).toBe(true);
    expect(family().members.find((m) => m.fullName === 'Riya Khurana')?.status).toBe('invited');
    store().signOut();

    await store().signUpWithEmail('Riya', 'riya@example.com', 'riya-pass-1');
    const joined = store().joinPendingInvites();
    expect(joined).toHaveLength(1);
    expect(family().name).toBe("Khurana's");
    expect(family().members.find((m) => m.id === viewer())?.fullName).toBe('Riya Khurana');
  });

  it('privacy changes are announced in the activity list', async () => {
    await store().signUpWithEmail('Ayush', 'ayush@example.com', 'almari2026');
    store().createFamily("Khurana's", you('Ayush Khurana'));
    store().setPersonalSharing('private');
    expect(family().personalSharing).toBe('private');
    expect(family().activity[0].text).toMatch(/private/);
  });
});

describe('documents and profile numbers', () => {
  beforeEach(async () => {
    await store().signUpWithEmail('Ayush', 'ayush@example.com', 'almari2026');
    store().createFamily("Khurana's", you('Ayush Khurana'));
  });

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
  it('five wrong PINs lock the app and ask for a sign-in; nothing is wiped', async () => {
    await store().signUpWithEmail('Ayush', 'ayush@example.com', 'almari2026');
    store().createFamily("Khurana's", you('Ayush Khurana'));
    await store().setPin('2468');
    expect(await store().verifyPin('2468')).toEqual({ status: 'ok' });
    for (let left = 4; left >= 1; left--) {
      expect(await store().verifyPin('0000')).toEqual({ status: 'wrong', attemptsLeft: left });
    }
    expect(await store().verifyPin('0000')).toEqual({ status: 'locked-out' });
    expect(store().session.accountId).toBeUndefined();
    expect(Object.keys(store().families)).toHaveLength(1);
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
});

describe('saving to the phone', () => {
  it('writes every change to storage', async () => {
    await store().signUpWithEmail('Ayush', 'ayush@example.com', 'almari2026');
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse(mockMemory.get('almari-state') as string);
    expect(Object.values(saved.state.accounts)).toHaveLength(1);
    expect(saved.state.hydrated).toBeUndefined();
  });
});
