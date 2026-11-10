/**
 * Document files on the web (the iPhone version). Each file is encrypted with
 * its own key before it is stored in IndexedDB or uploaded, and opened only to
 * show or share it. Files missing here (added on another phone) are fetched
 * from the server once and kept, so they open without internet next time.
 */
import type { FileRef } from '@/domain/types';
import { decryptFile, encryptFile, fromB64, initCrypto } from '@/lib/crypto';
import { fileContext } from '@/sync/contexts';

import { idbDelete, idbGet, idbSet } from './idb';

export interface PickedFile {
  uri: string;
  name: string;
  mime?: string;
  size?: number;
  blob?: Blob;
}

type Remote = (familyId: string, fileId: string) => Promise<Uint8Array | null>;
let remote: Remote | null = null;

/** The sync layer tells this module how to fetch a file this device does not have yet. */
export function setFileRemote(fetcher: Remote | null): void {
  remote = fetcher;
}

const urls = new Map<string, string>();

async function asBytes(value: unknown): Promise<Uint8Array | null> {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value instanceof Blob) return new Uint8Array(await value.arrayBuffer());
  return null;
}

const locked = (ref: Pick<FileRef, 'key' | 'familyId'>): ref is { key: string; familyId: string } => !!ref.key && !!ref.familyId;

/** For the sync engine: the encrypted bytes, as stored and uploaded. */
export const cipherStore = {
  read: async (id: string) => asBytes(await idbGet('files', id)),
  write: async (id: string, bytes: Uint8Array) => {
    await idbSet('files', id, bytes);
  },
  has: async (id: string) => (await idbGet('files', id)) !== undefined,
  forget: async (id: string) => {
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
    await idbDelete('files', id);
  },
};

export async function saveFile(ref: FileRef, picked: PickedFile): Promise<void> {
  const blob = picked.blob ?? (await (await fetch(picked.uri)).blob());
  if (locked(ref)) {
    await initCrypto();
    const plain = new Uint8Array(await blob.arrayBuffer());
    await idbSet('files', ref.id, encryptFile(plain, fromB64(ref.key), fileContext(ref.familyId, ref.id)));
  } else {
    await idbSet('files', ref.id, blob);
  }
}

/** The file's own bytes, opened. Fetches it from the server first if this device does not have it. */
export async function fileBytes(ref: FileRef): Promise<Uint8Array | null> {
  let stored = await asBytes(await idbGet('files', ref.id));
  if (!stored && locked(ref) && remote) {
    stored = await remote(ref.familyId, ref.id);
    if (stored) await idbSet('files', ref.id, stored);
  }
  if (!stored) return null;
  if (!locked(ref)) return stored;
  await initCrypto();
  return decryptFile(stored, fromB64(ref.key), fileContext(ref.familyId, ref.id));
}

export async function fileUrl(ref: FileRef): Promise<string | null> {
  const cached = urls.get(ref.id);
  if (cached) return cached;
  const bytes = await fileBytes(ref);
  if (!bytes) return null;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: ref.mime || 'application/octet-stream' }));
  urls.set(ref.id, url);
  return url;
}

export async function removeFile(ref: Pick<FileRef, 'id'>): Promise<void> {
  await cipherStore.forget(ref.id);
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

export async function shareFile(ref: FileRef): Promise<boolean> {
  const bytes = await fileBytes(ref);
  if (!bytes) return false;
  return shareBlob(new Blob([bytes as BlobPart], { type: ref.mime }), ref.name, ref.mime);
}
