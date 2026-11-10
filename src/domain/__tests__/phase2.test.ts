import { deflateSync } from 'zlib';

import { PDFDocument } from 'pdf-lib';

import { extractFromText, suggestFor } from '../extract';
import { bestQuality, coverCrop, exportFileName, EXPORT_PRESETS, fitWithin } from '../form-export';
import { moneyMap } from '../money-map';
import { lifeStageNudges } from '../nudges';
import { evaluatePack, getPack, PACKS, packDocuments } from '../packs';
import { A4, buildPackPdf, buildPrintSheet, CARD, CARDS_PER_PAGE } from '../pdf';
import { buildSampleFamily, SAMPLE_VIEWER_ID } from '../sample';
import { getTemplate } from '../templates';
import { formatAadhaar, verhoeffCheckDigit } from '../validation';
import { doc, family, member, NOW, task } from './factory';

/** A tiny valid PNG, made in the test so no fixture file is needed. */
function png(width: number, height: number): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.concat(Array.from({ length: height }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 200)])));
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

describe('life-stage nudges', () => {
  const kid = (dob: string, extra = {}) => family({ members: [member('papa'), member('riya', { kind: 'profile', dob, ...extra })] });

  it('Aadhaar biometric update at 5, and again at 15', () => {
    expect(lifeStageNudges(kid('2021-03-01'), NOW).map((n) => n.rule)).toEqual(['aadhaar-5']);
    expect(lifeStageNudges(kid('2011-01-15'), NOW).map((n) => n.rule)).toEqual(['aadhaar-15']);
    expect(lifeStageNudges(kid('2018-03-01'), NOW)).toEqual([]); // 8: nothing due
  });

  it('warns 60 days ahead of turning 5', () => {
    const n = lifeStageNudges(kid('2021-12-20'), NOW);
    expect(n.map((x) => x.rule)).toEqual(['aadhaar-5']);
    expect(n[0].dueDate).toBe('2026-12-20');
  });

  it('at 18: a Voter ID (unless saved) and a login of their own', () => {
    expect(lifeStageNudges(kid('2008-05-01'), NOW).map((n) => n.rule).sort()).toEqual(['own-login-18', 'voter-18']);
    expect(lifeStageNudges(kid('2008-05-01', { ids: { voter: 'ABC1234567' } }), NOW).map((n) => n.rule)).toEqual(['own-login-18']);
  });

  it('life certificate in November for pensioners, from 1 October at 80+', () => {
    const f = family({
      members: [member('dadi', { kind: 'profile', dob: '1944' }), member('nana', { kind: 'profile', dob: '1960-01-01' })],
      documents: [doc('p1', { templateId: 'ppo', ownerId: 'dadi' }), doc('p2', { templateId: 'ppo', ownerId: 'nana' })],
    });
    const rules = (d: Date) => lifeStageNudges(f, d).filter((n) => n.rule === 'life-certificate').map((n) => n.memberId).sort();
    expect(rules(new Date(2026, 8, 10))).toEqual(['dadi']); // 10 Sep: only the 80+ window (from 1 Oct) is near
    expect(rules(NOW)).toEqual(['dadi', 'nana']); // 10 Nov: both
    expect(rules(new Date(2026, 11, 2))).toEqual([]); // December: done for the year
  });

  it('stays quiet once a life-certificate task exists, or when dismissed', () => {
    const base = { members: [member('dadi', { kind: 'profile', dob: '1944' })], documents: [doc('p1', { templateId: 'ppo', ownerId: 'dadi' })] };
    expect(lifeStageNudges(family({ ...base, tasks: [task('t', { title: 'Submit Dadi’s life certificate' })] }), NOW)).toEqual([]);
    expect(lifeStageNudges(family({ ...base, dismissedNudges: ['dadi:life-certificate:2026'] }), NOW)).toEqual([]);
  });

  it('never nudges about members in loving memory or pets', () => {
    expect(lifeStageNudges(kid('2021-03-01', { status: 'memorial' }), NOW)).toEqual([]);
    expect(lifeStageNudges(kid('2021-03-01', { isPet: true }), NOW)).toEqual([]);
  });
});

describe('money map', () => {
  it('lists accounts and nominee-worthy papers, and counts the ones without a nominee', () => {
    const sample = buildSampleFamily(NOW);
    const { entries, withoutNominee } = moneyMap(sample, SAMPLE_VIEWER_ID);
    expect(entries.filter((e) => e.kind === 'bank')).toHaveLength(4);
    expect(entries.some((e) => e.kind === 'doc' && e.title === 'SBI fixed deposit')).toBe(true);
    expect(entries.every((e) => e.kind === 'bank' || getTemplate(sample.documents.find((d) => d.id === e.id)!.templateId).nominee)).toBe(true);
    expect(withoutNominee).toBe(entries.filter((e) => !e.nominee).length);
    expect(withoutNominee).toBeGreaterThan(0);
  });

  it('respects privacy', () => {
    const f = family({ personalSharing: 'private', documents: [doc('fd', { templateId: 'fd-receipt', ownerId: 'papa', createdBy: 'papa' })] });
    expect(moneyMap(f, 'ananya').entries).toHaveLength(0);
    expect(moneyMap(f, 'papa').entries).toHaveLength(1);
  });
});

describe('situation packs', () => {
  it('every pack names real templates', () => {
    for (const p of PACKS) for (const i of p.items) for (const t of i.templateIds) expect(getTemplate(t).id).toBe(t);
  });

  it('finds the person’s papers and the family’s, and counts what is missing', () => {
    const sample = buildSampleFamily(NOW);
    const vehicle = getPack('vehicle')!;
    const { results, missingRequired } = evaluatePack(vehicle, sample, SAMPLE_VIEWER_ID, 's-papa');
    expect(results.map((r) => r.docs[0]?.title)).toEqual(["Papa's driving licence", 'Car RC', 'Car insurance', 'Car PUC']);
    expect(missingRequired).toBe(0);
    const bank = evaluatePack(getPack('bank-kyc')!, sample, SAMPLE_VIEWER_ID, 's-kabir');
    expect(bank.missingRequired).toBe(2); // Kabir has no PAN, no photo
  });

  it('puts each paper in the PDF once', () => {
    const sample = buildSampleFamily(NOW);
    const { results } = evaluatePack(getPack('bank-kyc')!, sample, SAMPLE_VIEWER_ID, 's-papa');
    const docs = packDocuments(results);
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
  });
});

describe('reading numbers from a scan', () => {
  const aadhaar = '23456789012' + verhoeffCheckDigit('23456789012');

  it('finds a valid Aadhaar and ignores numbers that fail the check', () => {
    const text = `Government of India\nRajesh Kumar\nDOB: 02/05/1966\n${formatAadhaar(aadhaar)}\nVID 9123 4567 8901 2345`;
    const found = extractFromText(text);
    expect(found.aadhaar).toEqual([formatAadhaar(aadhaar)]);
    expect(found.dob).toBe('1966-05-02');
    expect(extractFromText('1234 5678 9012').aadhaar).toEqual([]); // starts with 1
  });

  it('fixes the usual OCR swaps in a PAN', () => {
    expect(extractFromText('Permanent Account Number\nABCPE1234F').pan).toEqual(['ABCPE1234F']);
    expect(extractFromText('A8CPE12З4F').pan).toEqual([]); // a Cyrillic letter is not a digit
    expect(extractFromText('A8CPE1234F').pan).toEqual(['ABCPE1234F']); // 8 in a letter position is a B
    expect(extractFromText('ABCPEL2S4F').pan).toEqual(['ABCPE1254F']); // L→1, S→5 in digit positions
  });

  it('finds passport, licence, IFSC and vehicle numbers', () => {
    const found = extractFromText('Passport No. Z1234567\nDL No: DL-04 2011 0012345\nIFSC: SBIN0001234\nReg No. DL 3C AB 1234');
    expect(found.passport).toEqual(['Z1234567']);
    expect(found.dl).toEqual(['DL0420110012345']);
    expect(found.ifsc).toEqual(['SBIN0001234']);
    expect(found.vehicle).toContain('DL 3C AB 1234');
  });

  it('suggests the latest date as expiry and the earliest as issue', () => {
    const found = extractFromText('Issue 12/03/2016\nValid till 11/03/2036\nDOB 02/05/1966');
    expect(suggestFor('dl', found, true)).toEqual({ number: undefined, dob: '1966-05-02', expiryDate: '2036-03-11', issueDate: '2016-03-12' });
  });
});

describe('form-ready export', () => {
  it('crops to the target shape without stretching', () => {
    expect(coverCrop(1000, 1000, 200, 230)).toEqual({ x: 65, y: 0, width: 870, height: 1000 });
    expect(coverCrop(1200, 400, 140, 60)).toEqual({ x: 134, y: 0, width: 933, height: 400 });
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it('finds the best quality under the size limit', async () => {
    const encode = async (q: number) => ({ bytes: Math.round(q * 100_000), output: q });
    const r = await bestQuality(encode, 50_000);
    expect(r.fits).toBe(true);
    expect(r.bytes).toBeLessThanOrEqual(50_000);
    expect(r.quality).toBeGreaterThan(0.4);
  });

  it('says plainly when even the lowest quality is too big', async () => {
    const r = await bestQuality(async (q) => ({ bytes: 200_000 + q, output: q }), 50_000);
    expect(r.fits).toBe(false);
  });

  it('names files with size and dimensions', () => {
    expect(exportFileName("Papa's photo", EXPORT_PRESETS[0], 48_100)).toBe('papa-s-photo-200x230-47KB.jpg');
  });
});

describe('PDFs', () => {
  it('builds a pack: a checklist page, an image page, a copied PDF, a note for missing files', async () => {
    const inner = await PDFDocument.create();
    inner.addPage();
    inner.addPage();
    const bytes = await buildPackPdf({
      title: 'Bank KYC', person: 'Rajesh ₹ Sharma', familyName: "Sharma's", generatedOn: '10 Nov 2026',
      checklist: [{ label: 'PAN card', done: true }, { label: 'Signature', done: false, optional: true }],
      docs: [
        { title: "Papa's PAN", number: 'ABCPE1234F', sources: [{ kind: 'image', bytes: png(40, 25), mime: 'image/png' }] },
        { title: 'Policy', sources: [{ kind: 'pdf', bytes: await inner.save() }] },
        { title: 'Sample', sources: [{ kind: 'missing', reason: 'Sample paper: no file' }] },
      ],
    });
    const out = await PDFDocument.load(bytes);
    expect(out.getPageCount()).toBe(1 + 1 + 2 + 1);
    expect(Math.round(out.getPage(0).getWidth())).toBe(Math.round(A4.width));
  });

  it('a locked or broken PDF becomes a note page instead of failing', async () => {
    const bytes = await buildPackPdf({
      title: 'X', person: 'Y', familyName: 'Z', generatedOn: 'today', checklist: [],
      docs: [{ title: 'Broken', sources: [{ kind: 'pdf', bytes: new Uint8Array([1, 2, 3]) }] }],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });

  it('print sheet: four cards per A4 page at true size', async () => {
    const cards = Array.from({ length: 5 }, (_, i) => ({ title: `Card ${i}`, front: { kind: 'image' as const, bytes: png(86, 54), mime: 'image/png' } }));
    const out = await PDFDocument.load(await buildPrintSheet(cards, "Sharma's"));
    expect(out.getPageCount()).toBe(Math.ceil(5 / CARDS_PER_PAGE));
    expect(CARD.width / (72 / 25.4)).toBeCloseTo(85.6, 5);
    expect(CARD.height / (72 / 25.4)).toBeCloseTo(54, 5);
  });
});

describe('masked Aadhaar', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { aadhaarMaskRect } = require('../extract') as typeof import('../extract');
  const valid = '23456789012' + verhoeffCheckDigit('23456789012');
  const box = (x0: number, x1: number) => ({ x0, y0: 100, x1, y1: 140 });

  it('covers the first two groups of a 4-4-4 number, padded', () => {
    const words = [
      { text: 'Aadhaar', bbox: box(10, 90) },
      { text: valid.slice(0, 4), bbox: box(200, 280) },
      { text: valid.slice(4, 8), bbox: box(300, 380) },
      { text: valid.slice(8), bbox: box(400, 480) },
    ];
    expect(aadhaarMaskRect(words)).toEqual({ x: 194, y: 94, width: 192, height: 52 });
  });

  it('covers two thirds of a single 12-digit word', () => {
    expect(aadhaarMaskRect([{ text: valid, bbox: box(0, 240) }], 0)).toEqual({ x: 0, y: 100, width: 160, height: 40 });
  });

  it('finds nothing in an invalid number (so the person places the bar)', () => {
    expect(aadhaarMaskRect([{ text: '1234', bbox: box(0, 1) }, { text: '5678', bbox: box(2, 3) }, { text: '9012', bbox: box(4, 5) }])).toBeNull();
  });
});
