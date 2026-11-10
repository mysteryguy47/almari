import type { PdfSource } from '@/domain/pdf';
import type { DocItem, FileRef } from '@/domain/types';
import { fileBytes } from '@/store/files';

/** One stored file as a PDF ingredient: a photo, a PDF to copy in, or a note saying why it is not included. */
export async function fileToPdfSource(file: FileRef | undefined): Promise<PdfSource> {
  if (!file) return { kind: 'missing', reason: 'No file saved for this side.' };
  if (file.kind === 'sample') return { kind: 'missing', reason: 'Sample paper: in a real family, the photo or PDF goes here.' };
  if (file.kind === 'doc') return { kind: 'missing', reason: `${file.name} is a Word, Excel or text file. Share it separately.` };
  const bytes = await fileBytes(file.id, file.name);
  if (!bytes) return { kind: 'missing', reason: 'The file is no longer on this phone.' };
  return file.kind === 'pdf' ? { kind: 'pdf', bytes } : { kind: 'image', bytes, mime: file.mime };
}

export async function docToPdfSources(doc: DocItem): Promise<PdfSource[]> {
  if (doc.files.length === 0) return [{ kind: 'missing', reason: 'No file saved.' }];
  return Promise.all(doc.files.map((f) => fileToPdfSource(f)));
}

export function todayLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
