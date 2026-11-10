/**
 * How a family becomes records on the server, and back.
 *
 * Every member, document, login, bank account, card, note, task, contact and
 * activity entry is one record, keyed by its own id. The family's own fields
 * (name, sharing setting, removal requests, dismissed nudges) are one record
 * with the id "family", and each member's reminder settings are "prefs:<id>".
 *
 * Pure functions only: no network, no storage, no React.
 */
import type { Family, ID, Ownable, PersonalSharing, RemovalRequest, ReminderPrefs } from '@/domain/types';

export type RecordKind =
  | 'family' | 'member' | 'document' | 'login' | 'bank' | 'card' | 'note' | 'task' | 'contact' | 'activity' | 'prefs';

export const FAMILY_RECORD_ID = 'family';
const PREFS_PREFIX = 'prefs:';

type ListKey = 'members' | 'documents' | 'logins' | 'bankAccounts' | 'cards' | 'notes' | 'tasks' | 'contacts';

const LISTS: readonly { key: ListKey; kind: RecordKind }[] = [
  { key: 'members', kind: 'member' },
  { key: 'documents', kind: 'document' },
  { key: 'logins', kind: 'login' },
  { key: 'bankAccounts', kind: 'bank' },
  { key: 'cards', kind: 'card' },
  { key: 'notes', kind: 'note' },
  { key: 'tasks', kind: 'task' },
  { key: 'contacts', kind: 'contact' },
];

const LIST_OF: Partial<Record<RecordKind, ListKey>> = Object.fromEntries(LISTS.map((l) => [l.kind, l.key]));

/** Kinds that carry the "who can see it" fields (ownerId, onlyMe). */
export const OWNABLE_KINDS: ReadonlySet<RecordKind> = new Set(['document', 'login', 'bank', 'card', 'note']);

export const MAX_ACTIVITY = 300;

export interface FamilyFields {
  name: string;
  personalSharing: PersonalSharing;
  createdAt: number;
  createdBy: ID;
  removalRequests: RemovalRequest[];
  dismissedNudges: string[];
}

export function familyFields(family: Family): FamilyFields {
  return {
    name: family.name,
    personalSharing: family.personalSharing,
    createdAt: family.createdAt,
    createdBy: family.createdBy,
    removalRequests: family.removalRequests,
    dismissedNudges: family.dismissedNudges ?? [],
  };
}

export function emptyFamily(id: ID, name = '', createdBy: ID = ''): Family {
  return {
    id, name, createdAt: Date.now(), createdBy, personalSharing: 'family',
    members: [], documents: [], logins: [], bankAccounts: [], cards: [], notes: [], tasks: [], contacts: [],
    activity: [], reminderPrefs: {}, removalRequests: [], dismissedNudges: [],
  };
}

export interface Change {
  id: string;
  kind: RecordKind;
  /** null: the record is gone for good (purged). */
  data: unknown | null;
}

/**
 * What changed between two versions of a family, by object identity (the
 * store uses Immer, so untouched items keep their identity). Activity is
 * append-only: entries trimmed off the end of the list are not deletions.
 */
export function diffFamily(prev: Family | undefined, next: Family): Change[] {
  const changes: Change[] = [];
  const prevFields = prev ? familyFields(prev) : undefined;
  const nextFields = familyFields(next);
  if (
    !prevFields ||
    prevFields.name !== nextFields.name ||
    prevFields.personalSharing !== nextFields.personalSharing ||
    prevFields.createdAt !== nextFields.createdAt ||
    prevFields.createdBy !== nextFields.createdBy ||
    prev?.removalRequests !== next.removalRequests ||
    prev?.dismissedNudges !== next.dismissedNudges
  ) {
    changes.push({ id: FAMILY_RECORD_ID, kind: 'family', data: nextFields });
  }

  for (const { key, kind } of LISTS) {
    const before = prev?.[key] as { id: ID }[] | undefined;
    const after = next[key] as { id: ID }[];
    if (before === after) continue;
    const old = new Map((before ?? []).map((i) => [i.id, i]));
    for (const item of after) {
      if (old.get(item.id) !== item) changes.push({ id: item.id, kind, data: item });
      old.delete(item.id);
    }
    for (const id of old.keys()) changes.push({ id, kind, data: null });
  }

  if (prev?.activity !== next.activity) {
    const seen = new Set((prev?.activity ?? []).map((a) => a.id));
    for (const entry of next.activity) if (!seen.has(entry.id)) changes.push({ id: entry.id, kind: 'activity', data: entry });
  }

  if (prev?.reminderPrefs !== next.reminderPrefs) {
    const before = prev?.reminderPrefs ?? {};
    for (const [memberId, prefs] of Object.entries(next.reminderPrefs)) {
      if (before[memberId] !== prefs) changes.push({ id: PREFS_PREFIX + memberId, kind: 'prefs', data: prefs });
    }
    for (const memberId of Object.keys(before)) {
      if (!(memberId in next.reminderPrefs)) changes.push({ id: PREFS_PREFIX + memberId, kind: 'prefs', data: null });
    }
  }
  return changes;
}

/** Every record a family is made of (for the first upload of a family). */
export function allRecords(family: Family): Change[] {
  return diffFamily(undefined, family);
}

/** Puts one record into a family (an Immer draft or a plain object), or takes it out when data is null. */
export function applyRecord(family: Family, kind: RecordKind, id: string, data: unknown | null): void {
  if (kind === 'family') {
    if (!data) return;
    const f = data as Partial<FamilyFields>;
    if (typeof f.name === 'string') family.name = f.name;
    if (f.personalSharing === 'family' || f.personalSharing === 'private') family.personalSharing = f.personalSharing;
    if (typeof f.createdAt === 'number') family.createdAt = f.createdAt;
    if (typeof f.createdBy === 'string') family.createdBy = f.createdBy;
    family.removalRequests = Array.isArray(f.removalRequests) ? f.removalRequests : [];
    family.dismissedNudges = Array.isArray(f.dismissedNudges) ? f.dismissedNudges : [];
    return;
  }
  if (kind === 'prefs') {
    const memberId = id.startsWith(PREFS_PREFIX) ? id.slice(PREFS_PREFIX.length) : id;
    if (data) family.reminderPrefs[memberId] = data as ReminderPrefs;
    else delete family.reminderPrefs[memberId];
    return;
  }
  if (kind === 'activity') {
    if (!data || family.activity.some((a) => a.id === id)) return;
    const entry = data as Family['activity'][number];
    const index = family.activity.findIndex((a) => a.at < entry.at);
    if (index < 0) family.activity.push(entry);
    else family.activity.splice(index, 0, entry);
    if (family.activity.length > MAX_ACTIVITY) family.activity.length = MAX_ACTIVITY;
    return;
  }
  const key = LIST_OF[kind];
  if (!key) return;
  const list = family[key] as { id: ID }[];
  const index = list.findIndex((i) => i.id === id);
  if (!data) {
    if (index >= 0) list.splice(index, 1);
    return;
  }
  const item = { ...(data as object), id } as { id: ID };
  if (index >= 0) list[index] = item;
  else list.push(item);
}

/** The current value of one record in a family, or undefined when it is not there. */
export function readRecord(family: Family, kind: RecordKind, id: string): unknown | undefined {
  if (kind === 'family') return familyFields(family);
  if (kind === 'prefs') return family.reminderPrefs[id.startsWith(PREFS_PREFIX) ? id.slice(PREFS_PREFIX.length) : id];
  if (kind === 'activity') return family.activity.find((a) => a.id === id);
  const key = LIST_OF[kind];
  return key ? (family[key] as { id: ID }[]).find((i) => i.id === id) : undefined;
}

/**
 * Who may read a record on the server: null for the whole family, or one
 * account. The same rule as src/domain/access.ts canSee, in server terms.
 * `userOf` maps a member id to the account that joined as that member.
 */
export function desiredVisibility(
  family: Family,
  kind: RecordKind,
  data: unknown,
  userOf: (memberId: ID) => string | undefined,
): string | null {
  if (!OWNABLE_KINDS.has(kind) || !data) return null;
  const item = data as Ownable;
  if (item.onlyMe) return userOf(item.createdBy) ?? null;
  if (!item.ownerId) return null;
  const owner = family.members.find((m) => m.id === item.ownerId);
  if (!owner || owner.kind === 'profile') return null;
  if (family.personalSharing === 'family') return null;
  return userOf(owner.id) ?? null;
}
