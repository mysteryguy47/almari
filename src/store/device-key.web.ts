/**
 * The web app's device key: an AES-GCM key the browser generates and keeps in
 * IndexedDB as a non-extractable CryptoKey, so its bytes can never be read
 * out, not even by Almari's own code. Everything the web app saves (records,
 * the account's keys, the sign-in session) is encrypted with it.
 */
import { idbGet, idbSet } from './idb';

const KEY_NAME = '__device_key';
let keyPromise: Promise<CryptoKey> | null = null;

function deviceKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const existing = await idbGet<CryptoKey>('kv', KEY_NAME);
      if (existing) return existing;
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await idbSet('kv', KEY_NAME, key);
      return key;
    })();
    keyPromise.catch(() => {
      keyPromise = null;
    });
  }
  return keyPromise;
}

export interface Sealed {
  v: 1;
  iv: Uint8Array;
  data: ArrayBuffer;
}

export function isSealed(value: unknown): value is Sealed {
  return !!value && typeof value === 'object' && (value as Sealed).v === 1 && (value as Sealed).iv instanceof Uint8Array;
}

export async function sealLocal(text: string, label: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(label) }, await deviceKey(), new TextEncoder().encode(text));
  return { v: 1, iv, data };
}

export async function openLocal(sealed: Sealed, label: string): Promise<string | null> {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv as BufferSource, additionalData: new TextEncoder().encode(label) }, await deviceKey(), sealed.data);
    return new TextDecoder().decode(plain);
  } catch {
    return null; // the device key is gone or the data is damaged: start clean, the cloud copy restores it
  }
}
