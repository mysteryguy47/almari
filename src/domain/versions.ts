/**
 * One paper, many copies. A person has one Aadhaar, but a family keeps it as
 * the card, the masked copy, the e-Aadhaar PDF and a self-attested
 * photocopy. Those are versions of one document, not four documents.
 *
 * A version's pages are the document's files carrying its id (`versionId`).
 * Files without one belong to the first version, MAIN_VERSION. Keeping every
 * file in `files` means syncing, uploading and deleting files work as before.
 */
import { visibleTo } from './access';
import { getTemplate } from './templates';
import { MAIN_VERSION, type DocItem, type DocVersion, type Family, type FileRef, type ID } from './types';

export const MAX_VERSIONS = 8;
/** Pages or sides per version (a property deed can run long). */
export const MAX_PAGES = 10;
export const DEFAULT_MAIN_LABEL = 'Original';

/** The document's versions in order. A document never given a second one has just the first. */
export function docVersions(doc: Pick<DocItem, 'versions' | 'createdAt' | 'createdBy'>): DocVersion[] {
  const list = doc.versions?.length ? doc.versions : [];
  if (list.some((v) => v.id === MAIN_VERSION)) return list;
  return [{ id: MAIN_VERSION, label: DEFAULT_MAIN_LABEL, addedAt: doc.createdAt, addedBy: doc.createdBy }, ...list];
}

export function versionOf(file: FileRef): ID {
  return file.versionId ?? MAIN_VERSION;
}

/** The pages of one version. */
export function versionFiles(doc: Pick<DocItem, 'files'>, versionId: ID = MAIN_VERSION): FileRef[] {
  return doc.files.filter((f) => versionOf(f) === versionId);
}

/** The first version's pages: what thumbnails, sheets and packs use. Falls back to any page. */
export function mainFiles(doc: Pick<DocItem, 'files'>): FileRef[] {
  const main = versionFiles(doc, MAIN_VERSION);
  return main.length ? main : doc.files;
}

/** A label not yet used on this document: "Masked", then "Masked 2". */
export function freshLabel(doc: Pick<DocItem, 'versions' | 'createdAt' | 'createdBy'>, wanted: string): string {
  const taken = new Set(docVersions(doc).map((v) => v.label.trim().toLowerCase()));
  const base = wanted.trim() || 'Copy';
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
  return `${base} ${Date.now()}`;
}

/**
 * The saved document this one would duplicate: same one-per-person paper,
 * same person, not deleted, and one the viewer can see. Undefined when the
 * paper can repeat (degrees, bills) or belongs to the whole family.
 * Vehicle papers repeat per vehicle: an RC is one per vehicle.
 */
export function existingUnique(
  family: Family,
  viewerId: ID,
  templateId: string,
  ownerId: ID | undefined,
  options: { exceptId?: ID; vehicleId?: ID } = {},
): DocItem | undefined {
  const template = getTemplate(templateId);
  if (!template.unique) return undefined;
  if (template.perVehicle) {
    if (!options.vehicleId) return undefined;
    return visibleTo(family, viewerId, family.documents).find((d) => d.id !== options.exceptId && d.templateId === templateId && d.vehicleId === options.vehicleId);
  }
  if (!ownerId) return undefined;
  return visibleTo(family, viewerId, family.documents).find((d) => d.id !== options.exceptId && d.templateId === templateId && d.ownerId === ownerId);
}

/** Groups of documents that should be one (saved before the one-per-person rule, Nov 2026). Oldest first in each group. */
export function duplicateGroups(family: Family, viewerId: ID): DocItem[][] {
  const groups = new Map<string, DocItem[]>();
  for (const d of visibleTo(family, viewerId, family.documents)) {
    const template = getTemplate(d.templateId);
    if (!template.unique) continue;
    const key = template.perVehicle ? (d.vehicleId ? `v:${d.vehicleId}:${d.templateId}` : '') : d.ownerId ? `p:${d.ownerId}:${d.templateId}` : '';
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => a.createdAt - b.createdAt));
}

/** The other documents a unique one duplicates. */
export function duplicatesOf(family: Family, viewerId: ID, doc: DocItem): DocItem[] {
  return duplicateGroups(family, viewerId).find((g) => g.some((d) => d.id === doc.id))?.filter((d) => d.id !== doc.id) ?? [];
}

/** True when a file id is used by any document of the family other than `exceptDocId`. */
export function fileUsedElsewhere(family: Pick<Family, 'documents'>, fileId: ID, exceptDocId: ID): boolean {
  return family.documents.some((d) => d.id !== exceptDocId && d.files.some((f) => f.id === fileId));
}
