/**
 * Document files on the web: stored as Blobs in IndexedDB, shown through
 * object URLs, shared through the Web Share API where the browser allows it
 * (Safari on iPhone does) and downloaded otherwise.
 */
import { idbDelete, idbGet, idbSet } from './idb';

export interface PickedFile {
  uri: string;
  name: string;
  mime?: string;
  size?: number;
  blob?: Blob;
}

const urls = new Map<string, string>();

export async function saveFile(id: string, picked: PickedFile): Promise<void> {
  const blob = picked.blob ?? (await (await fetch(picked.uri)).blob());
  await idbSet('files', id, blob);
}

export async function fileUrl(id: string, _name?: string): Promise<string | null> {
  const cached = urls.get(id);
  if (cached) return cached;
  const blob = await idbGet<Blob>('files', id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export async function removeFile(id: string, _name?: string): Promise<void> {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  await idbDelete('files', id);
}

export async function shareFile(id: string, name: string, mime: string): Promise<boolean> {
  const blob = await idbGet<Blob>('files', id);
  if (!blob) return false;
  const file = new File([blob], name, { type: mime });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return true;
    } catch {
      return false; // the person closed the share sheet
    }
  }
  const url = await fileUrl(id);
  if (!url) return false;
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  return true;
}
