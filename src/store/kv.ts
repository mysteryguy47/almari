/**
 * Key-value storage on Android: one file per key in the app's private
 * documents folder, each value encrypted (XChaCha20-Poly1305) with a device
 * key kept in Android Keystore through expo-secure-store. Each write goes to
 * a temporary file that then replaces the old one, so a crash mid-write never
 * leaves half a file behind, and writes run one at a time (serialWriter).
 */
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { decryptBytes, encryptBytes, fromB64, fromUtf8, initCrypto, randomKey, toB64, utf8 } from '@/lib/crypto';

import { serialWriter } from './serial';

const fileFor = (name: string) => new File(Paths.document, `${name.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
const KEY_NAME = 'almari.device-key';

let keyPromise: Promise<Uint8Array> | null = null;

/** The device key: made once, kept in Android Keystore, never leaves the phone. */
function deviceKey(): Promise<Uint8Array> {
  if (!keyPromise) {
    keyPromise = (async () => {
      await initCrypto();
      const saved = await SecureStore.getItemAsync(KEY_NAME);
      if (saved) return fromB64(saved);
      const key = randomKey();
      await SecureStore.setItemAsync(KEY_NAME, toB64(key));
      return key;
    })();
    keyPromise.catch(() => {
      keyPromise = null;
    });
  }
  return keyPromise;
}

const write = serialWriter(
  async (name, value) => {
    const sealed = encryptBytes(utf8(value), await deviceKey(), `kv:${name}`);
    const tmp = new File(Paths.document, `${name.replace(/[^a-zA-Z0-9._-]/g, '_')}.${Date.now()}.tmp.json`);
    tmp.create({ overwrite: true });
    await tmp.write(sealed);
    await tmp.move(fileFor(name), { overwrite: true });
  },
  (e) => console.warn('Could not save to the phone', e),
);

export const kv = {
  async getItem(name: string): Promise<string | null> {
    const file = fileFor(name);
    if (!file.exists) return null;
    const text = await file.text();
    if (!text.startsWith('1.')) return text; // written before encryption existed
    try {
      return fromUtf8(decryptBytes(text, await deviceKey(), `kv:${name}`));
    } catch {
      return null; // the device key is gone (app data cleared): start clean, the cloud copy restores it
    }
  },
  setItem(name: string, value: string): Promise<void> {
    return write(name, value);
  },
  async removeItem(name: string): Promise<void> {
    const file = fileFor(name);
    if (file.exists) file.delete();
  },
};
