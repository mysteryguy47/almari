import { canSee } from '../access';
import {
  attentionFor, cardBillRecipients, cardExpiryDate, expiryRecipients, nextMonthlyDate, plannedNotifications,
  reminderDates, taskRecipients,
} from '../reminders';
import { card, doc, family, member, NOW, task } from './factory';

describe('who can see what', () => {
  it('common documents: everyone', () => {
    const f = family();
    const house = doc('deed', { scope: 'common', ownerId: undefined });
    expect(['papa', 'mummy', 'ananya'].every((id) => canSee(f, id, house))).toBe(true);
  });

  it('personal documents follow the family setting', () => {
    const pan = doc('papa-pan', { ownerId: 'papa', createdBy: 'papa' });
    expect(canSee(family({ personalSharing: 'family' }), 'ananya', pan)).toBe(true);
    expect(canSee(family({ personalSharing: 'private' }), 'ananya', pan)).toBe(false);
    expect(canSee(family({ personalSharing: 'private' }), 'papa', pan)).toBe(true);
  });

  it('a profile-only member’s papers stay visible to the family even when private', () => {
    const marksheet = doc('kabir-10th', { ownerId: 'kabir', createdBy: 'mummy' });
    expect(canSee(family({ personalSharing: 'private' }), 'papa', marksheet)).toBe(true);
  });

  it('Only me beats every other rule', () => {
    const report = doc('report', { ownerId: 'ananya', createdBy: 'ananya', onlyMe: true });
    expect(canSee(family(), 'ananya', report)).toBe(true);
    expect(canSee(family(), 'mummy', report)).toBe(false);
  });

  it('deleted items are hidden from everyone', () => {
    expect(canSee(family(), 'ananya', doc('gone', { deletedAt: 1 }))).toBe(false);
  });
});

describe('who gets expiry reminders', () => {
  it('everyone who can see it, by default (account members who have joined)', () => {
    const f = family({ members: [...family().members, member('chachu', { status: 'invited' })] });
    const rc = doc('rc', { scope: 'common', templateId: 'rc' });
    expect(expiryRecipients(f, rc, 'vehicles').sort()).toEqual(['ananya', 'mummy', 'papa']);
  });

  it('anyone can opt out of one document', () => {
    const rc = doc('rc', { scope: 'common', mutedBy: ['papa'] });
    expect(expiryRecipients(family(), rc, 'vehicles')).not.toContain('papa');
  });

  it('muting all family reminders keeps your own', () => {
    const f = family({ reminderPrefs: { papa: { familyMuted: true, mutedCategories: [] } } });
    const rc = doc('rc', { scope: 'common' });
    const papasDl = doc('dl', { ownerId: 'papa', createdBy: 'papa' });
    expect(expiryRecipients(f, rc, 'vehicles')).not.toContain('papa');
    expect(expiryRecipients(f, papasDl, 'identity')).toContain('papa');
  });

  it('muting a category mutes only that category', () => {
    const f = family({ reminderPrefs: { mummy: { familyMuted: false, mutedCategories: ['vehicles'] } } });
    expect(expiryRecipients(f, doc('rc', { scope: 'common' }), 'vehicles')).not.toContain('mummy');
    expect(expiryRecipients(f, doc('deed', { scope: 'common' }), 'home')).toContain('mummy');
  });

  it('private documents remind only their owner', () => {
    const f = family({ personalSharing: 'private' });
    const dl = doc('dl', { ownerId: 'papa', createdBy: 'papa' });
    expect(expiryRecipients(f, dl, 'identity')).toEqual(['papa']);
    const onlyMe = doc('policy', { ownerId: 'ananya', createdBy: 'ananya', onlyMe: true });
    expect(expiryRecipients(family(), onlyMe, 'health')).toEqual(['ananya']);
  });

  it('a child’s papers remind every account member', () => {
    const kabir = doc('kabir-passport', { ownerId: 'kabir', createdBy: 'mummy' });
    expect(expiryRecipients(family({ personalSharing: 'private' }), kabir, 'identity').sort()).toEqual(['ananya', 'mummy', 'papa']);
  });

  it('a member in loving memory causes no reminders', () => {
    expect(expiryRecipients(family(), doc('dadi-ppo', { ownerId: 'dadi' }), 'work')).toEqual([]);
  });

  it('credit-card bills remind the cardholder only', () => {
    expect(cardBillRecipients(family(), card('c1', { ownerId: 'papa', createdBy: 'papa' }))).toEqual(['papa']);
    expect(cardBillRecipients(family(), card('c2', { ownerId: 'papa', mutedBy: ['papa'] }))).toEqual([]);
    expect(cardBillRecipients(family(), card('c3', { ownerId: 'papa', type: 'debit' }))).toEqual([]);
  });

  it('tasks remind their assignees, or everyone for Anyone', () => {
    expect(taskRecipients(family(), task('t', { assignees: ['papa'] }))).toEqual(['papa']);
    expect(taskRecipients(family(), task('t')).sort()).toEqual(['ananya', 'mummy', 'papa']);
    expect(taskRecipients(family(), task('t', { done: true }))).toEqual([]);
  });
});

describe('when reminders fire', () => {
  it('30, 7 and 1 day before by default', () => {
    expect(reminderDates('2026-12-31')).toEqual(['2026-12-01', '2026-12-24', '2026-12-30']);
  });

  it('passports: 9 and 3 months before', () => {
    expect(reminderDates('2027-08-31', { months: [9, 3] })).toEqual(['2026-11-30', '2027-05-31']);
  });

  it('card expiry is the last day of the month', () => {
    expect(cardExpiryDate('02/28')).toBe('2028-02-29');
    expect(cardExpiryDate('13/28')).toBeUndefined();
  });

  it('a due day of 31 lands on the last day of short months', () => {
    expect(nextMonthlyDate(31, new Date(2027, 1, 10))).toBe('2027-02-28');
    expect(nextMonthlyDate(5, NOW)).toBe('2026-12-05');
    expect(nextMonthlyDate(10, NOW)).toBe('2026-11-10');
  });

  it('Needs attention: soonest first, expired included, outside the window left out', () => {
    const f = family({
      documents: [
        doc('puc', { scope: 'common', templateId: 'puc', expiryDate: '2026-11-07', title: 'PUC' }),
        doc('ins', { scope: 'common', templateId: 'vehicle-insurance', expiryDate: '2026-11-22', title: 'Insurance' }),
        doc('far', { scope: 'common', templateId: 'vehicle-insurance', expiryDate: '2027-06-01', title: 'Far' }),
        doc('pp', { ownerId: 'ananya', templateId: 'passport', expiryDate: '2027-07-01', title: 'Passport' }),
      ],
      tasks: [task('t1', { title: 'Pay tax', assignees: ['ananya'], dueAt: '2026-11-12T18:00' })],
      cards: [card('cc', { ownerId: 'ananya', dueDay: 15 })],
    });
    const items = attentionFor(f, 'ananya', NOW);
    expect(items.map((i) => i.title)).toEqual(['PUC', 'Pay tax', 'HDFC Bank card bill', 'Insurance', 'Passport']);
    expect(items[0].severity).toBe('expired');
    expect(items.find((i) => i.title === 'Insurance')?.daysLeft).toBe(12);
    // Mummy is not the cardholder or the assignee, but sees Ananya's shared passport by default.
    expect(attentionFor(f, 'mummy', NOW).map((i) => i.title)).toEqual(['PUC', 'Insurance', 'Passport']);
    // With personal papers private, the passport reminds Ananya only.
    expect(attentionFor({ ...f, personalSharing: 'private' }, 'mummy', NOW).map((i) => i.title)).toEqual(['PUC', 'Insurance']);
  });

  it('plans notifications outside quiet hours', () => {
    const f = family({
      documents: [doc('ins', { scope: 'common', templateId: 'vehicle-insurance', expiryDate: '2026-11-22', title: 'Car insurance' })],
      tasks: [task('t1', { title: 'Renew', assignees: ['papa'], dueAt: '2026-11-14T18:00' })],
    });
    const planned = plannedNotifications(f, 'papa', NOW);
    expect(planned.map((p) => p.at)).toEqual(['2026-11-13T19:00', '2026-11-14T09:00', '2026-11-15T09:00', '2026-11-21T09:00']);
    for (const p of planned) {
      const hour = Number(p.at.slice(11, 13));
      expect(hour >= 8 && hour < 22).toBe(true);
    }
  });
});
