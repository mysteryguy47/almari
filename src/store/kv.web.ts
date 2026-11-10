/**
 * Key-value storage on the web: IndexedDB (localStorage is capped at about
 * 5 MB and is wiped more readily). Every value is encrypted with the device
 * key before it is written.
 */
import { isSealed, openLocal, sealLocal } from './device-key.web';
import { idbDelete, idbGet, idbSet } from './idb';

export const kv = {
  async getItem(name: string): Promise<string | null> {
    const stored = await idbGet<unknown>('kv', name);
    if (stored === undefined || stored === null) return null;
    if (isSealed(stored)) return openLocal(stored, name);
    return typeof stored === 'string' ? stored : null; // written before encryption existed
  },
  async setItem(name: string, value: string): Promise<void> {
    await idbSet('kv', name, await sealLocal(value, name));
  },
  async removeItem(name: string): Promise<void> {
    await idbDelete('kv', name);
  },
};
