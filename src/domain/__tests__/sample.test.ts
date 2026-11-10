/** The sample family must never contain anything that could be a real person's details. */
import { attentionFor } from '../reminders';
import { buildSampleFamily, SAMPLE_VIEWER_ID } from '../sample';
import { getTemplate } from '../templates';
import { digitsOnly, luhnValid } from '../validation';
import { NOW } from './factory';

const sample = buildSampleFamily(NOW);

describe('sample family', () => {
  it('uses impossible Aadhaar numbers (real ones never start with 0 or 1)', () => {
    const numbers = [
      ...sample.members.map((m) => m.ids.aadhaar),
      ...sample.documents.filter((d) => d.templateId === 'aadhaar').map((d) => d.number),
    ].filter(Boolean) as string[];
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(digitsOnly(n)[0]).toBe('1');
  });

  it('uses impossible PANs (4th letter O is not a holder type)', () => {
    const pans = sample.members.map((m) => m.ids.pan).filter(Boolean) as string[];
    for (const pan of pans) expect(pan[3]).toBe('O');
  });

  it('uses impossible phone numbers and reserved emails', () => {
    const phones = [...sample.members.map((m) => m.phone), ...sample.contacts.map((c) => c.phone)].filter(Boolean) as string[];
    for (const phone of phones) expect(phone).toMatch(/^\+91 0/);
    for (const m of sample.members) if (m.email) expect(m.email).toMatch(/@example\.com$/);
  });

  it('uses only published test card numbers that pass the checksum', () => {
    const testNumbers = ['4111111111111111', '5555555555554444', '4000056655665556', '4012888888881881', '5105105105105100'];
    for (const card of sample.cards) {
      expect(testNumbers).toContain(card.number);
      expect(luhnValid(card.number)).toBe(true);
    }
  });

  it('is internally consistent', () => {
    const memberIds = new Set(sample.members.map((m) => m.id));
    for (const doc of sample.documents) {
      expect(getTemplate(doc.templateId).id).toBe(doc.templateId);
      expect(doc.files.length).toBeGreaterThan(0);
      if (doc.ownerId) expect(memberIds.has(doc.ownerId)).toBe(true);
      expect(doc.title.length).toBeLessThanOrEqual(50);
    }
    for (const card of sample.cards) if (card.linkedAccountId) {
      expect(sample.bankAccounts.some((a) => a.id === card.linkedAccountId && a.ownerId === card.ownerId)).toBe(true);
    }
  });

  it('always has something expiring, overdue and due for the first viewer', () => {
    const severities = new Set(attentionFor(sample, SAMPLE_VIEWER_ID, NOW).map((a) => a.severity));
    expect(severities).toEqual(new Set(['expired', 'soon', 'upcoming']));
  });

  it('shows a credit card with no bank account, and two cards from one bank', () => {
    const ananyaCards = sample.cards.filter((c) => c.ownerId === SAMPLE_VIEWER_ID);
    const ananyaBanks = new Set(sample.bankAccounts.filter((a) => a.ownerId === SAMPLE_VIEWER_ID).map((a) => a.bank));
    expect(ananyaCards.some((c) => c.type === 'credit' && !ananyaBanks.has(c.bank))).toBe(true);
    expect(ananyaCards.filter((c) => c.bank === 'HDFC Bank')).toHaveLength(2);
  });
});
