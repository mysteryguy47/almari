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

export async function fileBytes(id: string, _name?: string): Promise<Uint8Array | null> {
  const blob = await idbGet<Blob>('files', id);
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
}

/** Shares a Blob through the Web Share API (iPhone Safari supports files); downloads it otherwise. */
export async function shareBlob(blob: Blob, name: string, mime: string): Promise<boolean> {
  const file = new File([blob], name, { type: mime });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return true;
    } catch (e) {
      // Closing the share sheet is a choice; any other failure falls back to a download.
      if ((e as Error)?.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export async function shareBytes(bytes: Uint8Array, name: string, mime: string): Promise<boolean> {
  return shareBlob(new Blob([bytes as BlobPart], { type: mime }), name, mime);
}

export async function shareUri(uri: string, name: string, mime: string): Promise<boolean> {
  return shareBlob(await (await fetch(uri)).blob(), name, mime);
}

/** Shares an image made in the browser, straight from the tap when the Blob is already in memory. */
export async function shareResult(result: { uri: string; blob?: Blob }, name: string, mime: string): Promise<boolean> {
  return result.blob ? shareBlob(result.blob, name, mime) : shareUri(result.uri, name, mime);
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
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return false; // the person closed the share sheet
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
