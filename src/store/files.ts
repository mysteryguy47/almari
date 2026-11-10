/**
 * Document files on Android: copied into the app's private folder, so a file
 * stays readable even if the original in Downloads or WhatsApp is deleted.
 *
 * Prototype note: files are stored as picked. The MVP compresses photos,
 * converts HEIC to JPG and encrypts every file before it is written.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { extensionOf } from '@/domain/validation';

export interface PickedFile {
  uri: string;
  name: string;
  mime?: string;
  size?: number;
  /** Web only: the picked File object. */
  blob?: Blob;
}

function folder(): Directory {
  const dir = new Directory(Paths.document, 'files');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function storedName(id: string, name: string): string {
  const ext = extensionOf(name);
  return ext ? `${id}.${ext}` : id;
}

export async function saveFile(id: string, picked: PickedFile): Promise<void> {
  const source = new File(picked.uri);
  const target = new File(folder(), storedName(id, picked.name));
  await source.copy(target, { overwrite: true });
}

export async function fileUrl(id: string, name: string): Promise<string | null> {
  const file = new File(folder(), storedName(id, name));
  return file.exists ? file.uri : null;
}

export async function removeFile(id: string, name: string): Promise<void> {
  const file = new File(folder(), storedName(id, name));
  if (file.exists) file.delete();
}

/** Opens the phone's share sheet (WhatsApp, Gmail, Drive...). */
export async function shareFile(id: string, name: string, mime: string): Promise<boolean> {
  const url = await fileUrl(id, name);
  if (!url || !(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(url, { mimeType: mime, dialogTitle: name });
  return true;
}
