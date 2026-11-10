/**
 * Key-value storage on Android: one JSON file per key in the app's private
 * documents folder. Each write goes to a temporary file that then replaces
 * the old one, so a crash mid-write never leaves half a file behind. Writes
 * run one at a time (serialWriter), so two quick saves can never collide.
 *
 * Prototype note: this file is not encrypted yet. The MVP replaces it with an
 * SQLCipher database whose key lives in Android Keystore.
 */
import { File, Paths } from 'expo-file-system';

import { serialWriter } from './serial';

const fileFor = (name: string) => new File(Paths.document, `${name}.json`);

const write = serialWriter(
  async (name, value) => {
    const tmp = new File(Paths.document, `${name}.${Date.now()}.tmp.json`);
    tmp.create({ overwrite: true });
    await tmp.write(value);
    await tmp.move(fileFor(name), { overwrite: true });
  },
  (e) => console.warn('Could not save to the phone', e),
);

export const kv = {
  async getItem(name: string): Promise<string | null> {
    const file = fileFor(name);
    return file.exists ? file.text() : null;
  },
  setItem(name: string, value: string): Promise<void> {
    return write(name, value);
  },
  async removeItem(name: string): Promise<void> {
    const file = fileFor(name);
    if (file.exists) file.delete();
  },
};
