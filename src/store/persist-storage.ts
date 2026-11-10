/**
 * Saving the app state without slowing it down: the newest state is written
 * shortly after changes settle (a sync can make hundreds of changes in a
 * second), and at once when the app goes to the background or the page is
 * closed.
 */
import type { PersistStorage, StorageValue } from 'zustand/middleware';

interface Kv {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<void>;
  removeItem(name: string): Promise<void>;
}

const flushers = new Set<() => Promise<void>>();

/** Writes anything waiting, now. */
export async function flushSaves(): Promise<void> {
  await Promise.all([...flushers].map((f) => f()));
}

export function batchedStorage<S>(kv: Kv, delayMs = 100): PersistStorage<S> {
  let pending: { name: string; value: StorageValue<S> } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const job = pending;
    pending = null;
    if (!job) return writing;
    writing = writing.then(() => kv.setItem(job.name, JSON.stringify(job.value))).catch((e) => console.warn('Could not save on this device', e));
    return writing;
  };
  flushers.add(flush);

  return {
    async getItem(name) {
      const raw = await kv.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
    },
    setItem(name, value) {
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delayMs);
    },
    async removeItem(name) {
      pending = null;
      await kv.removeItem(name);
    },
  };
}
