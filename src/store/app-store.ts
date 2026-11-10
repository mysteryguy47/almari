/**
 * The app's state: families, this device's settings and the signed-in
 * account's cloud state, saved on the device after every change (encrypted at
 * rest on the web). Every rule lives in src/domain; this file only applies
 * those rules and records what happened.
 *
 * Edits here are local. src/sync watches the families that belong to the
 * signed-in account and carries every change to the server, locked.
 * Sign-in, invites, leaving and removals talk to the server first, in
 * src/sync/actions.ts, then change the state here.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { displayName, findMember } from '@/domain/access';
import { afterWrongPin, attemptsLeft, canApproveRemoval, checkRemoval, MAX_MEMBERS, normaliseIdNumber } from '@/domain/family-rules';
import { buildSampleFamily, SAMPLE_FAMILY_ID, SAMPLE_VIEWER_ID } from '@/domain/sample';
import { getTemplate } from '@/domain/templates';
import type {
  ActivityKind, BankAccount, CardItem, Contact, DocItem, Family, ID, IdKind, LoginItem, Member,
  PersonalSharing, ReminderPrefs, SecureNote, Task, ThemePref,
} from '@/domain/types';
import { normaliseEmail } from '@/domain/validation';
import type { CloudState } from '@/sync/types';

import { removeFile } from './files';
import { kv } from './kv';
import { batchedStorage } from './persist-storage';
import { hashSecret, newId, newSalt } from './secrets';

export const RECENTLY_DELETED_DAYS = 30;

export interface Device {
  theme: ThemePref;
  pinHash?: string;
  pinSalt?: string;
  pinFailures: number;
  biometrics: boolean;
  /** Has seen the note about using test papers while Almari is in beta. */
  seenPrototypeNote: boolean;
  /** This device's id on the server (Settings → Devices). */
  deviceId: string;
  /** Five wrong PINs: the person must sign in again. Nothing is wiped. */
  lockedOut?: boolean;
}

export interface Session {
  familyId?: ID;
  /** Sample family only: whose eyes we are looking through. */
  viewAs?: ID;
}

export interface PersistedState {
  version: 2;
  families: Record<ID, Family>;
  session: Session;
  device: Device;
  /** The signed-in account. Undefined when signed out. */
  cloud?: CloudState;
}

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

export type PinResult = { status: 'ok' } | { status: 'wrong'; attemptsLeft: number } | { status: 'locked-out' };

export type Collection = 'documents' | 'logins' | 'bankAccounts' | 'cards' | 'notes';

export type DocInput = Omit<DocItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'mutedBy'> & { id?: ID };
export type LoginInput = Omit<LoginItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: ID };
export type BankInput = Omit<BankAccount, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: ID };
export type CardInput = Omit<CardItem, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'mutedBy'> & { id?: ID };
export type NoteInput = Omit<SecureNote, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> & { id?: ID };
export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'done'> & { id?: ID };
export type ContactInput = Omit<Contact, 'id' | 'createdAt' | 'createdBy'> & { id?: ID };
export type MemberInput = Omit<Member, 'id' | 'createdAt' | 'status' | 'addedBy'> & { id?: ID };

export interface AppState extends PersistedState {
  hydrated: boolean;

  /** Forgets everything this device holds for the account (sign-out, a removed device). Keeps the theme. */
  clearLocal(): void;

  // ---- families
  /** Puts a family the account just created or joined on this device. */
  addFamily(family: Family, open: boolean): void;
  /** Takes a family off this device (left it, removed, or deleted). */
  forgetFamily(familyId: ID): void;
  switchFamily(familyId: ID): void;
  renameFamily(name: string): void;
  setPersonalSharing(value: PersonalSharing): void;
  /** Before leaving: the viewer's personal items and member card leave the family with them. */
  leaveLocally(): void;

  // ---- members
  saveMember(input: MemberInput): Result<ID>;
  setMemorial(memberId: ID, memorial: boolean): void;
  requestRemoval(memberId: ID): Result<'removed' | 'requested'>;
  approveRemoval(memberId: ID): Result;
  cancelRemoval(memberId: ID): void;
  /** A member who left or was removed elsewhere: their member card goes too. */
  dropMember(memberId: ID, by?: ID): void;

  // ---- items
  saveDocument(input: DocInput): ID;
  saveLogin(input: LoginInput): ID;
  saveBankAccount(input: BankInput): ID;
  saveCard(input: CardInput): ID;
  saveNote(input: NoteInput): ID;
  deleteItem(collection: Collection, id: ID): void;
  restoreItem(collection: Collection, id: ID): void;
  purgeDeleted(now?: number): void;
  toggleMute(collection: 'documents' | 'cards', id: ID): void;
  setReminderPrefs(patch: Partial<ReminderPrefs>): void;
  dismissNudge(key: string): void;

  // ---- tasks and numbers
  saveTask(input: TaskInput): Result<ID>;
  setTaskDone(id: ID, done: boolean): void;
  nudgeTask(id: ID, now?: number): Result;
  deleteTask(id: ID): void;
  restoreTask(id: ID): void;
  saveContact(input: ContactInput): ID;
  deleteContact(id: ID): void;

  // ---- this device
  setTheme(theme: ThemePref): void;
  setPin(pin: string): Promise<void>;
  verifyPin(pin: string): Promise<PinResult>;
  setBiometrics(on: boolean): void;
  markPrototypeNoteSeen(): void;

  // ---- sample family
  startSample(): void;
  setViewAs(memberId: ID): void;
  exitSample(): void;
}

// ------------------------------------------------------------------ helpers

function familyOf(s: PersistedState): Family | undefined {
  return s.session.familyId ? s.families[s.session.familyId] : undefined;
}

/** The member the person on this device is, in the current family. */
export function viewerIdOf(s: PersistedState): ID | undefined {
  const family = familyOf(s);
  if (!family) return undefined;
  if (family.isSample) return s.session.viewAs ?? SAMPLE_VIEWER_ID;
  const memberId = s.cloud?.memberships[family.id]?.memberId;
  if (!memberId || !family.members.some((m) => m.id === memberId)) return undefined;
  return memberId;
}

function log(family: Family, by: ID, kind: ActivityKind, text: string) {
  family.activity.unshift({ id: newId(), at: Date.now(), by, kind, text });
  if (family.activity.length > 300) family.activity.length = 300;
}

function collectionLabel(collection: Collection): string {
  return { documents: 'document', logins: 'login', bankAccounts: 'bank account', cards: 'card', notes: 'note' }[collection];
}

function itemTitle(family: Family, collection: Collection, id: ID): string {
  const item = (family[collection] as { id: ID; title?: string; bank?: string; nickname?: string }[]).find((i) => i.id === id);
  if (!item) return collectionLabel(collection);
  if (collection === 'bankAccounts') return `${item.bank} account`;
  if (collection === 'cards') return `${item.bank} ${item.nickname ?? 'card'}`;
  return item.title ?? collectionLabel(collection);
}

function upsert<T extends { id: ID; createdAt: number; updatedAt: number; createdBy: ID }>(
  list: T[],
  input: Partial<T> & { id?: ID },
  by: ID,
  extra: Partial<T> = {},
): { id: ID; created: boolean } {
  const now = Date.now();
  if (input.id) {
    const index = list.findIndex((i) => i.id === input.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...input, updatedAt: now };
      return { id: input.id, created: false };
    }
  }
  const id = input.id ?? newId();
  list.push({ ...extra, ...input, id, createdAt: now, updatedAt: now, createdBy: by } as T);
  return { id, created: true };
}

/** Removes a member's own items from a family (on leaving or removal); files are deleted too. */
function dropPersonalItems(family: Family, memberId: ID) {
  for (const doc of family.documents) {
    if (doc.ownerId === memberId || (doc.onlyMe && doc.createdBy === memberId)) {
      doc.files.forEach((f) => void removeFile(f).catch(() => undefined));
    }
  }
  const keep = <T extends { ownerId?: ID; onlyMe: boolean; createdBy: ID }>(items: T[]) =>
    items.filter((i) => i.ownerId !== memberId && !(i.onlyMe && i.createdBy === memberId));
  family.documents = keep(family.documents);
  family.logins = keep(family.logins);
  family.bankAccounts = keep(family.bankAccounts);
  family.cards = keep(family.cards);
  family.notes = keep(family.notes);
}

function freshDevice(theme: ThemePref = 'system'): Device {
  return { theme, pinFailures: 0, biometrics: false, seenPrototypeNote: false, deviceId: newId() };
}

const INITIAL: PersistedState = {
  version: 2,
  families: {},
  session: {},
  device: freshDevice(),
};

// ------------------------------------------------------------------ the store

export const useApp = create<AppState>()(
  persist(
    immer((set, get) => {
      /** Runs a change on the current family as the current viewer. */
      const onFamily = (fn: (family: Family, viewer: ID, s: PersistedState) => void) =>
        set((s) => {
          const family = familyOf(s);
          const viewer = viewerIdOf(s);
          if (family && viewer) fn(family, viewer, s);
        });

      const nameOf = (family: Family, id: ID) => displayName(findMember(family, id));

      return {
        ...INITIAL,
        hydrated: false,

        clearLocal() {
          set((s) => {
            for (const family of Object.values(s.families)) {
              for (const doc of family.documents) doc.files.forEach((f) => void removeFile(f).catch(() => undefined));
            }
            s.families = {};
            s.session = {};
            s.cloud = undefined;
            s.device = freshDevice(s.device.theme);
          });
        },

        // ---------------------------------------------------------- families
        addFamily(family, open) {
          set((s) => {
            s.families[family.id] = family;
            if (open || !s.session.familyId || !s.families[s.session.familyId] || s.families[s.session.familyId]?.isSample) {
              s.session = { familyId: family.id };
            }
          });
        },

        forgetFamily(familyId) {
          set((s) => {
            const family = s.families[familyId];
            if (!family) return;
            for (const doc of family.documents) doc.files.forEach((f) => void removeFile(f).catch(() => undefined));
            delete s.families[familyId];
            if (s.cloud) {
              delete s.cloud.memberships[familyId];
              delete s.cloud.sync[familyId];
              delete s.cloud.familyKeys[familyId];
            }
            if (s.session.familyId === familyId) {
              const next = Object.keys(s.cloud?.memberships ?? {}).find((id) => s.families[id]);
              s.session = next ? { familyId: next } : {};
            }
          });
        },

        switchFamily(familyId) {
          set((s) => {
            if (s.cloud?.memberships[familyId] && s.families[familyId]) s.session = { familyId };
          });
        },

        renameFamily(name) {
          onFamily((family, viewer) => {
            const old = family.name;
            family.name = name.trim();
            log(family, viewer, 'changed', `renamed the family from ${old} to ${family.name}`);
          });
        },

        setPersonalSharing(value) {
          onFamily((family, viewer) => {
            if (family.personalSharing === value) return;
            family.personalSharing = value;
            log(family, viewer, 'privacy', value === 'private'
              ? 'made personal documents private: each person now sees only their own'
              : 'shared personal documents with the whole family');
          });
        },

        leaveLocally() {
          onFamily((family, viewer) => {
            if (family.isSample) return;
            const me = findMember(family, viewer);
            dropPersonalItems(family, viewer);
            family.members = family.members.filter((m) => m.id !== viewer);
            family.removalRequests = family.removalRequests.filter((r) => r.memberId !== viewer && r.requestedBy !== viewer);
            log(family, viewer, 'member', `${me?.fullName ?? 'Someone'} left the family`);
          });
        },

        // ---------------------------------------------------------- members
        saveMember(input) {
          const s0 = get();
          const family = familyOf(s0);
          const viewer = viewerIdOf(s0);
          if (!family || !viewer) return fail('No family open');
          const email = input.email ? normaliseEmail(input.email) : undefined;
          if (email && family.members.some((m) => m.email === email && m.id !== input.id)) {
            return fail('Someone in the family already uses this email');
          }
          if (!input.id && family.members.length >= MAX_MEMBERS) return fail(`A family can have up to ${MAX_MEMBERS} members`);
          const id = input.id ?? newId();
          onFamily((f, by) => {
            const existing = f.members.find((m) => m.id === id);
            const ids: Partial<Record<IdKind, string>> = {};
            for (const [kind, value] of Object.entries(input.ids ?? {}) as [IdKind, string | undefined][]) {
              if (value?.trim()) ids[kind] = normaliseIdNumber(kind, value);
            }
            if (existing) {
              const wasProfile = existing.kind === 'profile';
              Object.assign(existing, { ...input, email, ids });
              if (wasProfile && existing.kind === 'account' && !existing.accountId) existing.status = 'invited';
              // One stored value: the profile number and its document can never disagree.
              for (const doc of f.documents) {
                const kind = getTemplate(doc.templateId).profileId;
                if (kind && doc.ownerId === id && ids[kind]) doc.number = ids[kind];
              }
              log(f, by, 'changed', `updated ${existing.fullName}'s profile`);
            } else {
              f.members.push({
                ...input, id, email, ids, createdAt: Date.now(), addedBy: by,
                status: input.kind === 'account' ? 'invited' : 'active',
              });
              log(f, by, 'member', input.kind === 'account' ? `invited ${input.fullName} (${email})` : `added ${input.fullName}`);
            }
          });
          return ok(id);
        },

        setMemorial(memberId, memorial) {
          onFamily((family, viewer) => {
            const member = findMember(family, memberId);
            if (!member || member.kind === 'account') return;
            member.status = memorial ? 'memorial' : 'active';
            log(family, viewer, 'member', memorial ? `marked ${member.fullName} as in loving memory` : `restored ${member.fullName}'s profile`);
          });
        },

        requestRemoval(memberId) {
          const s0 = get();
          const family = familyOf(s0);
          const viewer = viewerIdOf(s0);
          if (!family || !viewer) return fail('No family open');
          const check = checkRemoval(family, viewer, memberId);
          if (!check.ok) return fail(check.reason);
          if (!check.needsApproval) {
            onFamily((f, by) => {
              const member = findMember(f, memberId);
              dropPersonalItems(f, memberId);
              f.members = f.members.filter((m) => m.id !== memberId);
              log(f, by, 'member', `removed ${member?.fullName ?? 'a member'}`);
            });
            return ok('removed' as const);
          }
          onFamily((f, by) => {
            if (!f.removalRequests.some((r) => r.memberId === memberId)) {
              f.removalRequests.push({ memberId, requestedBy: by, at: Date.now() });
              log(f, by, 'member', `asked to remove ${nameOf(f, memberId)}; a second member must approve`);
            }
          });
          return ok('requested' as const);
        },

        approveRemoval(memberId) {
          const s0 = get();
          const family = familyOf(s0);
          const viewer = viewerIdOf(s0);
          if (!family || !viewer) return fail('No family open');
          if (!canApproveRemoval(family, viewer, memberId)) return fail('Another member, not the one who asked, must approve');
          set((s) => {
            const f = familyOf(s) as Family;
            const member = findMember(f, memberId);
            dropPersonalItems(f, memberId);
            f.members = f.members.filter((m) => m.id !== memberId);
            f.removalRequests = f.removalRequests.filter((r) => r.memberId !== memberId);
            log(f, viewer, 'member', `approved removing ${member?.fullName ?? 'a member'}`);
          });
          return ok(undefined);
        },

        cancelRemoval(memberId) {
          onFamily((family, viewer) => {
            family.removalRequests = family.removalRequests.filter((r) => r.memberId !== memberId);
            log(family, viewer, 'member', `cancelled the request to remove ${nameOf(family, memberId)}`);
          });
        },

        dropMember(memberId, by) {
          onFamily((family, viewer) => {
            const member = findMember(family, memberId);
            if (!member) return;
            dropPersonalItems(family, memberId);
            family.members = family.members.filter((m) => m.id !== memberId);
            family.removalRequests = family.removalRequests.filter((r) => r.memberId !== memberId);
            if (by) log(family, by ?? viewer, 'member', `${member.fullName} left the family`);
          });
        },

        // ---------------------------------------------------------- items
        saveDocument(input) {
          let id = input.id ?? '';
          onFamily((family, viewer) => {
            const template = getTemplate(input.templateId);
            const kind = template.profileId;
            const number = kind && input.number ? normaliseIdNumber(kind, input.number) : input.number?.trim() || undefined;
            const result = upsert(family.documents, { ...input, number }, viewer, { mutedBy: [] } as Partial<DocItem>);
            id = result.id;
            if (kind && number && input.ownerId) {
              const owner = findMember(family, input.ownerId);
              if (owner) owner.ids[kind] = number;
            }
            log(family, viewer, result.created ? 'added' : 'changed', `${result.created ? 'added' : 'updated'} ${input.title}`);
          });
          return id;
        },

        saveLogin(input) {
          let id = input.id ?? '';
          onFamily((family, viewer) => {
            const r = upsert(family.logins, input, viewer);
            id = r.id;
            log(family, viewer, r.created ? 'added' : 'changed', `${r.created ? 'added' : 'updated'} the login ${input.title}`);
          });
          return id;
        },

        saveBankAccount(input) {
          let id = input.id ?? '';
          onFamily((family, viewer) => {
            const r = upsert(family.bankAccounts, input, viewer);
            id = r.id;
            log(family, viewer, r.created ? 'added' : 'changed', `${r.created ? 'added' : 'updated'} a ${input.bank} account`);
          });
          return id;
        },

        saveCard(input) {
          let id = input.id ?? '';
          onFamily((family, viewer) => {
            const clean = input.type === 'credit' ? input : { ...input, creditLimit: undefined, statementDay: undefined, dueDay: undefined };
            const r = upsert(family.cards, clean, viewer, { mutedBy: [] } as Partial<CardItem>);
            id = r.id;
            log(family, viewer, r.created ? 'added' : 'changed', `${r.created ? 'added' : 'updated'} a ${input.bank} card`);
          });
          return id;
        },

        saveNote(input) {
          let id = input.id ?? '';
          onFamily((family, viewer) => {
            const r = upsert(family.notes, input, viewer);
            id = r.id;
            log(family, viewer, r.created ? 'added' : 'changed', `${r.created ? 'added' : 'updated'} the note ${input.title}`);
          });
          return id;
        },

        deleteItem(collection, id) {
          onFamily((family, viewer) => {
            const item = (family[collection] as { id: ID; deletedAt?: number; deletedBy?: ID }[]).find((i) => i.id === id);
            if (!item || item.deletedAt) return;
            item.deletedAt = Date.now();
            item.deletedBy = viewer;
            log(family, viewer, 'deleted', `deleted ${itemTitle(family, collection, id)}`);
          });
        },

        restoreItem(collection, id) {
          onFamily((family, viewer) => {
            const item = (family[collection] as { id: ID; deletedAt?: number; deletedBy?: ID }[]).find((i) => i.id === id);
            if (!item || !item.deletedAt) return;
            item.deletedAt = undefined;
            item.deletedBy = undefined;
            log(family, viewer, 'restored', `restored ${itemTitle(family, collection, id)}`);
          });
        },

        purgeDeleted(now = Date.now()) {
          const cutoff = now - RECENTLY_DELETED_DAYS * 86_400_000;
          set((s) => {
            for (const family of Object.values(s.families)) {
              for (const doc of family.documents) {
                if (doc.deletedAt && doc.deletedAt < cutoff) {
                  doc.files.forEach((f) => void removeFile(f).catch(() => undefined));
                }
              }
              const alive = <T extends { deletedAt?: number }>(items: T[]) => items.filter((i) => !i.deletedAt || i.deletedAt >= cutoff);
              family.documents = alive(family.documents);
              family.logins = alive(family.logins);
              family.bankAccounts = alive(family.bankAccounts);
              family.cards = alive(family.cards);
              family.notes = alive(family.notes);
              family.tasks = alive(family.tasks);
            }
          });
        },

        toggleMute(collection, id) {
          onFamily((family, viewer) => {
            const item = (family[collection] as (DocItem | CardItem)[]).find((i) => i.id === id);
            if (!item) return;
            item.mutedBy = item.mutedBy.includes(viewer) ? item.mutedBy.filter((m) => m !== viewer) : [...item.mutedBy, viewer];
          });
        },

        setReminderPrefs(patch) {
          onFamily((family, viewer) => {
            const current = family.reminderPrefs[viewer] ?? { familyMuted: false, mutedCategories: [] };
            family.reminderPrefs[viewer] = { ...current, ...patch };
          });
        },

        dismissNudge(key) {
          onFamily((family) => {
            const list = family.dismissedNudges ?? [];
            if (!list.includes(key)) family.dismissedNudges = [...list, key];
          });
        },

        // ---------------------------------------------------------- tasks and numbers
        saveTask(input) {
          const family = familyOf(get());
          if (!family) return fail('No family open');
          let id = input.id ?? '';
          onFamily((f, viewer) => {
            const existing = input.id ? f.tasks.find((t) => t.id === input.id) : undefined;
            if (existing) {
              Object.assign(existing, input);
              log(f, viewer, 'task', `updated the task ${input.title}`);
              return;
            }
            id = newId();
            f.tasks.push({ ...input, id, done: false, createdAt: Date.now(), createdBy: viewer });
            const who = input.assignees.length ? input.assignees.map((a) => nameOf(f, a)).join(', ') : 'anyone';
            log(f, viewer, 'task', `assigned ${who}: ${input.title}`);
          });
          return ok(id);
        },

        setTaskDone(id, done) {
          onFamily((family, viewer) => {
            const task = family.tasks.find((t) => t.id === id);
            if (!task) return;
            task.done = done;
            task.doneAt = done ? Date.now() : undefined;
            task.doneBy = done ? viewer : undefined;
            log(family, viewer, 'task', `${done ? 'finished' : 'reopened'} ${task.title}`);
          });
        },

        nudgeTask(id, now = Date.now()) {
          const task = familyOf(get())?.tasks.find((t) => t.id === id);
          if (!task) return fail('This task no longer exists');
          if (task.lastNudgedAt && now - task.lastNudgedAt < 86_400_000) return fail('Already nudged today. One polite reminder a day.');
          onFamily((family, viewer) => {
            const t = family.tasks.find((x) => x.id === id);
            if (t) t.lastNudgedAt = now;
            log(family, viewer, 'task', `sent a reminder about ${task.title}`);
          });
          return ok(undefined);
        },

        deleteTask(id) {
          onFamily((family, viewer) => {
            const task = family.tasks.find((t) => t.id === id);
            if (!task) return;
            task.deletedAt = Date.now();
            log(family, viewer, 'deleted', `deleted the task ${task.title}`);
          });
        },

        restoreTask(id) {
          onFamily((family) => {
            const task = family.tasks.find((t) => t.id === id);
            if (task) task.deletedAt = undefined;
          });
        },

        saveContact(input) {
          let id = input.id ?? '';
          onFamily((family, viewer) => {
            const existing = input.id ? family.contacts.find((c) => c.id === input.id) : undefined;
            if (existing) {
              Object.assign(existing, input);
              return;
            }
            id = newId();
            family.contacts.push({ ...input, id, createdAt: Date.now(), createdBy: viewer });
            log(family, viewer, 'added', `added ${input.name} to Kaam ke numbers`);
          });
          return id;
        },

        deleteContact(id) {
          onFamily((family) => {
            family.contacts = family.contacts.filter((c) => c.id !== id);
          });
        },

        // ---------------------------------------------------------- this device
        setTheme(theme) {
          set((s) => {
            s.device.theme = theme;
          });
        },

        async setPin(pin) {
          const salt = newSalt();
          const hash = await hashSecret(pin, salt);
          set((s) => {
            s.device.pinHash = hash;
            s.device.pinSalt = salt;
            s.device.pinFailures = 0;
          });
        },

        async verifyPin(pin) {
          const { device } = get();
          if (!device.pinHash || !device.pinSalt) return { status: 'ok' };
          const hash = await hashSecret(pin, device.pinSalt);
          if (hash === device.pinHash) {
            set((s) => {
              s.device.pinFailures = 0;
            });
            return { status: 'ok' };
          }
          const { failures, lockedOut } = afterWrongPin(device.pinFailures);
          set((s) => {
            s.device.pinFailures = lockedOut ? 0 : failures;
            if (lockedOut) s.device.lockedOut = true; // sign in again; nothing is wiped
          });
          return lockedOut ? { status: 'locked-out' } : { status: 'wrong', attemptsLeft: attemptsLeft(failures) };
        },

        setBiometrics(on) {
          set((s) => {
            s.device.biometrics = on;
          });
        },

        markPrototypeNoteSeen() {
          set((s) => {
            s.device.seenPrototypeNote = true;
          });
        },

        // ---------------------------------------------------------- sample family
        startSample() {
          set((s) => {
            s.families[SAMPLE_FAMILY_ID] = buildSampleFamily(new Date());
            s.session = { familyId: SAMPLE_FAMILY_ID, viewAs: SAMPLE_VIEWER_ID };
          });
        },

        setViewAs(memberId) {
          set((s) => {
            const family = familyOf(s);
            const member = family && findMember(family, memberId);
            if (family?.isSample && member?.kind === 'account') s.session.viewAs = memberId;
          });
        },

        exitSample() {
          set((s) => {
            delete s.families[SAMPLE_FAMILY_ID];
            const next = Object.keys(s.cloud?.memberships ?? {}).find((id) => s.families[id]);
            s.session = next ? { familyId: next } : {};
          });
        },
      };
    }),
    {
      name: 'almari-state',
      version: 2,
      storage: batchedStorage<PersistedState>(kv),
      partialize: (s): PersistedState => ({
        version: s.version, families: s.families, session: s.session, device: s.device, cloud: s.cloud,
      }),
      // Version 1 was the prototype: simulated accounts and test papers on this device only.
      // Real accounts start clean; only the theme carries over.
      migrate: (persisted, version) => {
        const old = (persisted ?? {}) as Partial<PersistedState> & { device?: Partial<Device> };
        if (version < 2) return { ...INITIAL, device: freshDevice(old.device?.theme ?? 'system') } as unknown as AppState;
        return persisted as AppState;
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('Could not read saved data', error);
        useApp.setState({ hydrated: true });
        state?.purgeDeleted();
      },
    },
  ),
);
