import {
  afterRightPassword, afterWrongPassword, afterWrongPin, canApproveRemoval, canJoinAnotherFamily, checkRemoval,
  eAadhaarPasswordGuess, establishedYear, familyNameSuggestions, isPasswordPaused, normaliseIdNumber,
  PASSWORD_PAUSE_MS, readiness,
} from '../family-rules';
import {
  bankFromIfsc, detectNetwork, formatRupees, groupCardNumber, maskAadhaar, ordinal, shareAccountText,
} from '../money';
import { buildIndex, editDistance, searchEntries, templateEntries } from '../search';
import { CATEGORIES, TEMPLATES, getTemplate, templateForIdKind } from '../templates';
import { ID_KINDS, type BankAccount } from '../types';
import { doc, family, member } from './factory';

describe('search', () => {
  const entries = templateEntries(TEMPLATES);
  const top = (q: string) => searchEntries(q, entries)[0]?.id;

  it('forgives typos and Hinglish', () => {
    expect(top('pen card')).toBe('pan');
    expect(top('adhar')).toBe('aadhaar');
    expect(top('aadhar card')).toBe('aadhaar');
    expect(top('registry')).toBe('sale-deed');
    expect(top('bijli')).toBe('electricity');
    expect(searchEntries('gaadi', entries).map((h) => h.id)).toEqual(expect.arrayContaining(['rc', 'vehicle-insurance', 'puc']));
    expect(searchEntries('bima', entries).map((h) => h.id)).toEqual(expect.arrayContaining(['life-insurance', 'family-floater']));
  });

  it('needs every word to match something', () => {
    expect(searchEntries('pan zebra', entries)).toEqual([]);
    expect(searchEntries('   ', entries)).toEqual([]);
  });

  it('measures edit distance with an early exit', () => {
    expect(editDistance('adhar', 'aadhaar', 2)).toBe(2);
    expect(editDistance('pan', 'pen', 1)).toBe(1);
    expect(editDistance('abc', 'xyzxyz', 1)).toBe(2);
  });

  it('finds documents by number and owner, but never someone else’s private papers', () => {
    const f = family({
      personalSharing: 'private',
      documents: [
        doc('d1', { title: "Papa's licence", templateId: 'driving-licence', ownerId: 'papa', createdBy: 'papa', number: 'DL0420110012345' }),
        doc('d2', { title: 'Car RC', templateId: 'rc', scope: 'common', number: 'DL 3C AB 1234' }),
      ],
    });
    expect(searchEntries('DL3CAB1234', buildIndex(f, 'ananya')).map((h) => h.id)).toEqual(['d2']);
    expect(searchEntries('licence', buildIndex(f, 'ananya')).filter((h) => h.kind === 'doc')).toEqual([]);
    expect(searchEntries('licence', buildIndex(f, 'papa')).map((h) => h.id)).toContain('d1');
  });
});

describe('money', () => {
  it('detects card networks from the first digits', () => {
    expect(detectNetwork('4111111111111111')).toBe('visa');
    expect(detectNetwork('5555555555554444')).toBe('mastercard');
    expect(detectNetwork('2221000000000009')).toBe('mastercard');
    expect(detectNetwork('378282246310005')).toBe('amex');
    expect(detectNetwork('6521 0000 0000 0000')).toBe('rupay');
    expect(detectNetwork('6074 0000 0000 0000')).toBe('rupay');
  });

  it('groups and masks numbers', () => {
    expect(groupCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
    expect(groupCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(maskAadhaar('2345 6789 0124')).toBe('XXXX XXXX 0124');
  });

  it('names the bank from an IFSC', () => {
    expect(bankFromIfsc('sbin0001234')).toBe('State Bank of India');
    expect(bankFromIfsc('ZZZZ0001234')).toBeUndefined();
  });

  it('shares account details without any secret', () => {
    const account: BankAccount = {
      id: 'a', bank: 'State Bank of India', type: 'savings', accountNumber: '000123456789', ifsc: 'sbin0001234',
      netbankingId: 'rajesh66', netbankingPassword: 'secret-pass', onlyMe: false, createdBy: 'papa', createdAt: 0, updatedAt: 0,
    };
    const text = shareAccountText(account, 'Rajesh Sharma');
    expect(text).toBe('Name: Rajesh Sharma\nAccount number: 000123456789\nIFSC: SBIN0001234\nBank: State Bank of India');
    expect(text).not.toMatch(/secret|rajesh66/);
  });

  it('writes rupees the Indian way', () => {
    expect(formatRupees(250000)).toBe('₹2,50,000');
    expect(formatRupees(1234567)).toBe('₹12,34,567');
    expect(formatRupees(999)).toBe('₹999');
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(13)).toBe('13th');
  });
});

describe('family rules', () => {
  it('one person can belong to at most three families', () => {
    expect(canJoinAnotherFamily({ familyIds: ['a', 'b'] })).toBe(true);
    expect(canJoinAnotherFamily({ familyIds: ['a', 'b', 'c'] })).toBe(false);
  });

  it('suggests family names from the surname', () => {
    expect(familyNameSuggestions('Ayush Khurana')).toEqual(["Khurana's", 'Khurana Parivaar', 'Khurana Family']);
    expect(familyNameSuggestions('Neha Das')).toEqual(["Das'", 'Das Parivaar', 'Das Family']);
    expect(establishedYear(family())).toBe(1944);
  });

  it('removal needs a second member; nobody removes anyone in a family of two', () => {
    const f = family();
    expect(checkRemoval(f, 'ananya', 'ananya').ok).toBe(false);
    expect(checkRemoval(f, 'ananya', 'kabir')).toEqual({ ok: true, needsApproval: false });
    expect(checkRemoval(f, 'ananya', 'papa')).toEqual({ ok: true, needsApproval: true });
    const two = family({ members: [member('a'), member('b')] });
    expect(checkRemoval(two, 'a', 'b').ok).toBe(false);
  });

  it('approval must come from a third member', () => {
    const f = family({ removalRequests: [{ memberId: 'papa', requestedBy: 'ananya', at: 0 }] });
    expect(canApproveRemoval(f, 'ananya', 'papa')).toBe(false);
    expect(canApproveRemoval(f, 'papa', 'papa')).toBe(false);
    expect(canApproveRemoval(f, 'mummy', 'papa')).toBe(true);
    expect(canApproveRemoval(f, 'kabir', 'papa')).toBe(false); // profile-only members cannot approve
  });

  it('five wrong passwords pause password sign-in for 30 minutes', () => {
    let account = { failedPasswordAttempts: 0, passwordPausedUntil: undefined as number | undefined };
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) account = afterWrongPassword(account, t);
    expect(account.failedPasswordAttempts).toBe(4);
    expect(isPasswordPaused(account, t)).toBe(false);
    account = afterWrongPassword(account, t);
    expect(isPasswordPaused(account, t)).toBe(true);
    expect(isPasswordPaused(account, t + PASSWORD_PAUSE_MS)).toBe(false);
    expect(afterRightPassword(account)).toEqual({ failedPasswordAttempts: 0, passwordPausedUntil: undefined });
  });

  it('five wrong PINs lock the app', () => {
    let failures = 0;
    let locked = false;
    for (let i = 0; i < 5; i++) ({ failures, lockedOut: locked } = afterWrongPin(failures));
    expect(failures).toBe(5);
    expect(locked).toBe(true);
    expect(afterWrongPin(3).lockedOut).toBe(false);
  });

  it('guesses the e-Aadhaar password from the profile', () => {
    expect(eAadhaarPasswordGuess('Rajesh Kumar Sharma', '1966-05-02')).toEqual({ guess: 'RAJE1966', certain: true });
    expect(eAadhaarPasswordGuess('Om', '1990')).toEqual({ guess: 'OM1990', certain: false });
    expect(eAadhaarPasswordGuess('Rajesh', undefined)).toBeNull();
  });

  it('keeps profile numbers in one canonical form', () => {
    expect(normaliseIdNumber('aadhaar', '234567890124')).toBe('2345 6789 0124');
    expect(normaliseIdNumber('pan', 'abcpe 1234f')).toBe('ABCPE1234F');
  });

  it('readiness counts the essentials and hides what the viewer cannot see', () => {
    const f = family({
      personalSharing: 'private',
      documents: [doc('a1', { templateId: 'aadhaar', ownerId: 'ananya', createdBy: 'ananya' })],
    });
    const r = readiness(f, 'ananya');
    // Visible: Ananya (5 essentials), Kabir aged 12 (2), family health (1). Papa and Mummy are private.
    expect(r.total).toBe(8);
    expect(r.done).toBe(1);
    expect(r.items.filter((i) => i.hidden).length).toBe(10);
  });
});

describe('the catalogue', () => {
  it('has about 120 templates with unique ids in 16 categories', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(115);
    expect(CATEGORIES).toHaveLength(16);
    for (const c of CATEGORIES) expect(TEMPLATES.some((t) => t.category === c.id)).toBe(true);
  });

  it('has exactly one template for each profile number', () => {
    for (const kind of ID_KINDS) {
      expect(TEMPLATES.filter((t) => t.profileId === kind)).toHaveLength(1);
      expect(templateForIdKind(kind).profileId).toBe(kind);
    }
  });

  it('falls back to Something else for unknown ids', () => {
    expect(getTemplate('nope').id).toBe('custom');
  });
});

describe('numbers in lists', () => {
  it('never shows a full Aadhaar number in a list', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { listNumber } = require('../money') as typeof import('../money');
    expect(listNumber('aadhaar', '2345 6789 0124')).toBe('XXXX XXXX 0124');
    expect(listNumber('pan', 'ABCPE1234F')).toBe('ABCPE1234F');
    expect(listNumber('pan', undefined)).toBeUndefined();
  });
});
