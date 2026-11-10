import { serialWriter } from '../serial';

describe('serialWriter', () => {
  it('never overlaps two writes, and the last value always wins', async () => {
    const written: string[] = [];
    let active = 0;
    let maxActive = 0;
    const write = serialWriter(async (_key, value) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      written.push(value);
      active--;
    });
    const all = [write('state', 'v1'), write('state', 'v2'), write('state', 'v3')];
    await Promise.all(all);
    expect(maxActive).toBe(1);
    expect(written[written.length - 1]).toBe('v3');
    expect(written.length).toBeLessThanOrEqual(2); // superseded values are skipped
  });

  it('keeps going after a failed write and reports it', async () => {
    const errors: unknown[] = [];
    let calls = 0;
    const write = serialWriter(async () => {
      calls++;
      if (calls === 1) throw new Error('disk full');
    }, (e) => errors.push(e));
    await write('a', '1');
    await write('a', '2');
    expect(errors).toHaveLength(1);
    expect(calls).toBe(2);
  });
});
