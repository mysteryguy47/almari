/**
 * Key-value storage on the web: IndexedDB (localStorage is capped at about
 * 5 MB and is wiped more readily). Prototype note: not encrypted yet; the MVP
 * encrypts every record with libsodium before it is stored.
 */
import { idbDelete, idbGet, idbSet } from './idb';

export const kv = {
  async getItem(name: string): Promise<string | null> {
    return (await idbGet<string>('kv', name)) ?? null;
  },
  async setItem(name: string, value: string): Promise<void> {
    await idbSet('kv', name, value);
  },
  async removeItem(name: string): Promise<void> {
    await idbDelete('kv', name);
  },
};
