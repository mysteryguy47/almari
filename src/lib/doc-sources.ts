import type { PdfSource } from '@/domain/pdf';
import type { DocItem, FileRef, ID } from '@/domain/types';
import { mainFiles, versionFiles } from '@/domain/versions';
import { fileBytes } from '@/store/files';

/** One stored file as a PDF ingredient: a photo, a PDF to copy in, or a note saying why it is not included. */
export async function fileToPdfSource(file: FileRef | undefined): Promise<PdfSource> {
  if (!file) return { kind: 'missing', reason: 'No file saved for this side.' };
  if (file.kind === 'sample') return { kind: 'missing', reason: 'Sample paper: in a real family, the photo or PDF goes here.' };
  if (file.kind === 'doc') return { kind: 'missing', reason: `${file.name} is a Word, Excel or text file. Share it separately.` };
  const bytes = await fileBytes(file);
  if (!bytes) return { kind: 'missing', reason: 'The file is no longer on this phone.' };
  return file.kind === 'pdf' ? { kind: 'pdf', bytes } : { kind: 'image', bytes, mime: file.mime };
}

/** A document's pages as PDF ingredients: one version's, or the first version's. */
export async function docToPdfSources(doc: DocItem, versionId?: ID): Promise<PdfSource[]> {
  const files = versionId ? versionFiles(doc, versionId) : mainFiles(doc);
  if (files.length === 0) return [{ kind: 'missing', reason: 'No file saved.' }];
  return Promise.all(files.map((f) => fileToPdfSource(f)));
}

export function todayLabel(now: Date = new Date()): string {
  return now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
