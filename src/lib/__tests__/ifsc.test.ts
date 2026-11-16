import { lookupIfsc } from '../ifsc';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockFetch(impl: (url: string) => Promise<{ status: number; ok: boolean; json?: () => Promise<unknown> }>) {
  const calls: string[] = [];
  global.fetch = ((url: string) => {
    calls.push(url);
    return impl(url);
  }) as unknown as typeof fetch;
  return calls;
}

describe('IFSC lookup', () => {
  it('finds the bank and branch, tidies the capitals, and remembers', async () => {
    const calls = mockFetch(async () => ({ status: 200, ok: true, json: async () => ({ BANK: 'State Bank of India', BRANCH: 'NEW DELHI MAIN BRANCH', CITY: 'NEW DELHI' }) }));
    const r = await lookupIfsc('sbin0000691');
    expect(r).toEqual({ status: 'found', info: { bank: 'State Bank of India', branch: 'New Delhi Main Branch', city: 'New Delhi' } });
    expect(calls).toEqual(['https://ifsc.razorpay.com/SBIN0000691']);
    await lookupIfsc('SBIN0000691');
    expect(calls).toHaveLength(1);
  });

  it('says unknown for a code that does not exist, without asking twice', async () => {
    const calls = mockFetch(async () => ({ status: 404, ok: false }));
    expect(await lookupIfsc('HDFC0999999')).toEqual({ status: 'unknown' });
    expect(await lookupIfsc('HDFC0999999')).toEqual({ status: 'unknown' });
    expect(calls).toHaveLength(1);
  });

  it('never sends something that is not an IFSC, and copes with no internet', async () => {
    const calls = mockFetch(async () => {
      throw new Error('Failed to fetch');
    });
    expect(await lookupIfsc('12345')).toEqual({ status: 'unknown' });
    expect(calls).toHaveLength(0);
    expect(await lookupIfsc('ICIC0001234')).toEqual({ status: 'offline' });
  });
});
