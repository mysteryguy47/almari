/**
 * The logo files and the bank list agree: every logo belongs to a bank Almari
 * knows, the banks people pick most all have one, and the generated index
 * lists every file (run `node scripts/logo-index.mjs` after adding one).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BANKS, bankMark, findBank, POPULAR_BANKS } from '../banks';

const root = join(__dirname, '..', '..', '..');
const files = (dir: string) => readdirSync(join(root, 'assets/logos', dir)).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''));
const bankLogos = files('banks');
const docLogos = files('docs');
const logoOf = (name: string) => bankMark(name).logo;

describe('bank logos', () => {
  it('every logo file belongs to a bank in the list', () => {
    const named = new Set(BANKS.map((b) => b.logo ?? b.ifsc?.toLowerCase()).filter(Boolean));
    expect(bankLogos.filter((f) => !named.has(f))).toEqual([]);
  });

  it('the banks people pick most all have their logo', () => {
    const missing = POPULAR_BANKS.filter((name) => !bankLogos.includes(logoOf(name) ?? ''));
    expect(missing).toEqual([]);
  });

  it('a logo is found from the names people type', () => {
    expect(logoOf('sbi')).toBe('sbin');
    expect(logoOf('Vijaya Bank')).toBe('barb');
    expect(logoOf('slice')).toBe('nesf');
    expect(logoOf('Emirates NBD')).toBe('ebil');
  });

  it('card issuers borrow a logo that exists', () => {
    expect(logoOf('SBI Card')).toBe('sbin');
    expect(logoOf('American Express')).toBe('amex');
    expect(docLogos).toContain('amex');
  });

  it('banks without a logo still get a mark', () => {
    const mark = bankMark('Saraswat Co-operative Bank');
    expect(bankLogos).not.toContain(mark.logo);
    expect(mark.text).toBe('SARAS');
    expect(bankMark('Some Local Bank').logo).toBeUndefined();
  });

  it('new foreign banks are found by their usual names', () => {
    expect(findBank('societe generale')?.ifsc).toBe('SOGE');
    expect(findBank('uob')?.ifsc).toBe('UOVB');
  });
});

describe('the generated logo index', () => {
  const index = readFileSync(join(root, 'src/components/logo-assets.ts'), 'utf8');
  it('lists every logo file', () => {
    for (const f of bankLogos) expect(index).toContain(`/banks/${f}.webp`);
    for (const f of docLogos) expect(index).toContain(`/docs/${f}.webp`);
  });

  it('names only files that exist', () => {
    const named = [...index.matchAll(/assets\/logos\/(banks|docs)\/([a-z0-9-]+)\.webp/g)].map((m) => `${m[1]}/${m[2]}`);
    const present = [...bankLogos.map((f) => `banks/${f}`), ...docLogos.map((f) => `docs/${f}`)];
    expect(named.filter((n) => !present.includes(n))).toEqual([]);
  });
});
