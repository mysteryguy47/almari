/**
 * The app's state: accounts, families and this device's settings, saved on
 * the phone after every change. Every rule lives in src/domain; this file
 * only applies those rules and records what happened.
 *
 * Prototype note: sign-in is simulated on the device (there is no server yet),
 * and nothing is encrypted yet. Both arrive in the MVP.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { displayName, findMember } from '@/domain/access';
import {
  afterRightPassword, afterWrongPassword, afterWrongPin, attemptsLeft, canApproveRemoval, canJoinAnotherFamily,
  checkRemoval, isPasswordPaused, MAX_MEMBERS, normaliseIdNumber,
} from '@/domain/family-rules';
import { buildSampleFamily, SAMPLE_FAMILY_ID, SAMPLE_VIEWER_ID } from '@/domain/sample';
import { getTemplate } from '@/domain/templates';
import type {
  Account, ActivityKind, BankAccount, CardItem, Contact, DocItem, Family, ID, IdKind, LoginItem, Member,
  PersonalSharing, ReminderPrefs, SecureNote, Task, ThemePref,
} from '@/domain/types';
import { normaliseEmail } from '@/domain/validation';

import { removeFile } from './files';
import { kv } from './kv';
import { hashSecret, newId, newSalt } from './secrets';

export const RECENTLY_DELETED_DAYS = 30;

export interface Device {
  theme: ThemePref;
  pinHash?: string;
  pinSalt?: string;
  pinFailures: number;
  biometrics: boolean;
  /** Has seen the "this is a prototype" note. */
  seenPrototypeNote: boolean;
}

export interface Session {
  accountId?: ID;
  familyId?: ID;
  /** Sample family only: whose eyes we are looking through. */
  viewAs?: ID;
}

export interface PersistedState {
  version: 1;
  accounts: Record<ID, Account>;
  families: Record<ID, Family>;
  session: Session;
  device: Device;
}

export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

export type SignInResult =
  | { status: 'ok' }
  | { status: 'no-account' }
  | { status: 'google-only' }
  | { status: 'wrong'; attemptsLeft: number }
  | { status: 'paused'; until: number };

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

  // ---- sign-in (simulated on the device in the prototype)
  signUpWithEmail(name: string, email: string, password: string): Promise<Result>;
  signInWithEmail(email: string, password: string, now?: number): Promise<SignInResult>;
  continueWithGoogle(name: string, email: string): Result;
  resetPassword(email: string, newPassword: string): Promise<Result>;
  setPassword(newPassword: string, currentPassword?: string): Promise<Result>;
  signOut(): void;
  deleteAccount(): void;

  // ---- families
  createFamily(name: string, you: Pick<Member, 'fullName' | 'dob' | 'gender' | 'phone'>): Result<ID>;
  joinPendingInvites(): ID[];
  switchFamily(familyId: ID): void;
  renameFamily(name: string): void;
  setPersonalSharing(value: PersonalSharing): void;
  leaveFamily(): void;

  // ---- members
  saveMember(input: MemberInput): Result<ID>;
  setMemorial(memberId: ID, memorial: boolean): void;
  requestRemoval(memberId: ID): Result<'removed' | 'requested'>;
  approveRemoval(memberId: ID): Result;
  cancelRemoval(memberId: ID): void;

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

/** The member the person on this phone is, in the current family. */
export function viewerIdOf(s: PersistedState): ID | undefined {
  const family = familyOf(s);
  if (!family) return undefined;
  if (family.isSample) return s.session.viewAs ?? SAMPLE_VIEWER_ID;
  return family.members.find((m) => m.accountId && m.accountId === s.session.accountId)?.id;
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

function emptyFamily(id: ID, name: string, createdBy: ID): Family {
  return {
    id, name, createdAt: Date.now(), createdBy, personalSharing: 'family',
    members: [], documents: [], logins: [], bankAccounts: [], cards: [], notes: [], tasks: [], contacts: [],
    activity: [], reminderPrefs: {}, removalRequests: [],
  };
}

/** Removes a member's own items from a family (on leaving or removal); files are deleted too. */
function dropPersonalItems(family: Family, memberId: ID) {
  for (const doc of family.documents) {
    if (doc.ownerId === memberId || (doc.onlyMe && doc.createdBy === memberId)) {
      doc.files.forEach((f) => void removeFile(f.id, f.name).catch(() => undefined));
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

const INITIAL: PersistedState = {
  version: 1,
  accounts: {},
  families: {},
  session: {},
  device: { theme: 'system', pinFailures: 0, biometrics: false, seenPrototypeNote: false },
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

        // ---------------------------------------------------------- sign-in
        async signUpWithEmail(name, email, password) {
          const address = normaliseEmail(email);
          if (Object.values(get().accounts).some((a) => a.email === address)) {
            return fail('An account with this email already exists. Sign in instead.');
          }
          const salt = newSalt();
          const passwordHash = await hashSecret(password, salt);
          const id = newId();
          set((s) => {
            s.accounts[id] = {
              id, email: address, name: name.trim(), google: false, passwordHash, passwordSalt: salt,
              failedPasswordAttempts: 0, familyIds: [], createdAt: Date.now(),
            };
            s.session = { accountId: id };
          });
          return ok(undefined);
        },

        async signInWithEmail(email, password, now = Date.now()) {
          const address = normaliseEmail(email);
          const account = Object.values(get().accounts).find((a) => a.email === address);
          if (!account) return { status: 'no-account' };
          if (!account.passwordHash || !account.passwordSalt) return { status: 'google-only' };
          if (isPasswordPaused(account, now)) return { status: 'paused', until: account.passwordPausedUntil as number };
          const hash = await hashSecret(password, account.passwordSalt);
          if (hash !== account.passwordHash) {
            const next = afterWrongPassword(account, now);
            set((s) => {
              s.accounts[account.id] = next;
            });
            return next.passwordPausedUntil && next.passwordPausedUntil > now
              ? { status: 'paused', until: next.passwordPausedUntil }
              : { status: 'wrong', attemptsLeft: attemptsLeft(next.failedPasswordAttempts) };
          }
          set((s) => {
            s.accounts[account.id] = afterRightPassword(s.accounts[account.id]);
            s.session = { accountId: account.id, familyId: s.accounts[account.id].familyIds[0] };
            s.device.pinFailures = 0;
          });
          return { status: 'ok' };
        },

        continueWithGoogle(name, email) {
          const address = normaliseEmail(email);
          set((s) => {
            const existing = Object.values(s.accounts).find((a) => a.email === address);
            if (existing) {
              existing.google = true; // same email: linked to the same account
              s.session = { accountId: existing.id, familyId: existing.familyIds[0] };
            } else {
              const id = newId();
              s.accounts[id] = {
                id, email: address, name: name.trim(), google: true, failedPasswordAttempts: 0, familyIds: [], createdAt: Date.now(),
              };
              s.session = { accountId: id };
            }
            s.device.pinFailures = 0;
          });
          return ok(undefined);
        },

        async resetPassword(email, newPassword) {
          const account = Object.values(get().accounts).find((a) => a.email === normaliseEmail(email));
          if (!account) return fail('No account uses this email');
          const salt = newSalt();
          const hash = await hashSecret(newPassword, salt);
          set((s) => {
            const a = s.accounts[account.id];
            a.passwordHash = hash;
            a.passwordSalt = salt;
            a.failedPasswordAttempts = 0;
            a.passwordPausedUntil = undefined;
          });
          return ok(undefined);
        },

        async setPassword(newPassword, currentPassword) {
          const { session, accounts } = get();
          const account = session.accountId ? accounts[session.accountId] : undefined;
          if (!account) return fail('Sign in first');
          if (account.passwordHash && account.passwordSalt) {
            const current = await hashSecret(currentPassword ?? '', account.passwordSalt);
            if (current !== account.passwordHash) return fail('Your current password is not right');
          }
          const salt = newSalt();
          const hash = await hashSecret(newPassword, salt);
          set((s) => {
            const a = s.accounts[account.id];
            a.passwordHash = hash;
            a.passwordSalt = salt;
            a.failedPasswordAttempts = 0;
            a.passwordPausedUntil = undefined;
          });
          return ok(undefined);
        },

        signOut() {
          set((s) => {
            if (familyOf(s)?.isSample) delete s.families[SAMPLE_FAMILY_ID];
            s.session = {};
          });
        },

        deleteAccount() {
          set((s) => {
            const accountId = s.session.accountId;
            if (!accountId) return;
            for (const familyId of s.accounts[accountId]?.familyIds ?? []) {
              const family = s.families[familyId];
              if (!family) continue;
              const member = family.members.find((m) => m.accountId === accountId);
              if (member) {
                dropPersonalItems(family, member.id);
                family.members = family.members.filter((m) => m.id !== member.id);
                log(family, member.id, 'member', `${member.fullName} deleted their account and left`);
              }
              const othersRemain = family.members.some((m) => m.kind === 'account' && m.accountId);
              if (!othersRemain) delete s.families[familyId];
            }
            delete s.accounts[accountId];
            s.session = {};
            s.device.pinHash = undefined;
            s.device.pinSalt = undefined;
          });
        },

        // ---------------------------------------------------------- families
        createFamily(name, you) {
          const s0 = get();
          const account = s0.session.accountId ? s0.accounts[s0.session.accountId] : undefined;
          if (!account) return fail('Sign in first');
          if (!canJoinAnotherFamily(account)) return fail('You can be in up to 3 families. Leave one to start another.');
          const familyId = newId();
          set((s) => {
            const family = emptyFamily(familyId, name.trim(), account.id);
            const memberId = newId();
            family.members.push({
              id: memberId, kind: 'account', accountId: account.id, email: account.email, fullName: you.fullName.trim(),
              dob: you.dob, gender: you.gender, phone: you.phone, ids: {}, status: 'active', addedBy: memberId, createdAt: Date.now(),
            });
            log(family, memberId, 'member', `started ${family.name}`);
            s.families[familyId] = family;
            s.accounts[account.id].familyIds.push(familyId);
            s.accounts[account.id].name = you.fullName.trim();
            s.session.familyId = familyId;
          });
          return ok(familyId);
        },

        joinPendingInvites() {
          const joined: ID[] = [];
          set((s) => {
            const account = s.session.accountId ? s.accounts[s.session.accountId] : undefined;
            if (!account) return;
            for (const family of Object.values(s.families)) {
              if (family.isSample || account.familyIds.includes(family.id)) continue;
              const invite = family.members.find((m) => m.kind === 'account' && m.status === 'invited' && m.email === account.email);
              if (!invite || !canJoinAnotherFamily(account)) continue;
              invite.accountId = account.id;
              invite.status = 'active';
              account.familyIds.push(family.id);
              log(family, invite.id, 'member', 'joined the family');
              joined.push(family.id);
            }
            if (!s.session.familyId && joined[0]) s.session.familyId = joined[0];
          });
          return joined;
        },

        switchFamily(familyId) {
          set((s) => {
            const account = s.session.accountId ? s.accounts[s.session.accountId] : undefined;
            if (account?.familyIds.includes(familyId)) s.session.familyId = familyId;
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

        leaveFamily() {
          set((s) => {
            const family = familyOf(s);
            const viewer = viewerIdOf(s);
            const accountId = s.session.accountId;
            if (!family || !viewer || !accountId || family.isSample) return;
            const me = findMember(family, viewer);
            dropPersonalItems(family, viewer);
            family.members = family.members.filter((m) => m.id !== viewer);
            family.removalRequests = family.removalRequests.filter((r) => r.memberId !== viewer && r.requestedBy !== viewer);
            log(family, viewer, 'member', `${me?.fullName ?? 'Someone'} left the family`);
            const account = s.accounts[accountId];
            account.familyIds = account.familyIds.filter((id) => id !== family.id);
            if (!family.members.some((m) => m.kind === 'account' && m.accountId)) delete s.families[family.id];
            s.session.familyId = account.familyIds[0];
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
            if (member?.accountId) {
              const account = s.accounts[member.accountId];
              if (account) account.familyIds = account.familyIds.filter((id) => id !== f.id);
            }
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
                  doc.files.forEach((f) => void removeFile(f.id, f.name).catch(() => undefined));
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
            if (lockedOut) s.session = {}; // sign in again; nothing is wiped
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
            s.session = {};
          });
        },
      };
    }),
    {
      name: 'almari-state',
      version: 1,
      storage: createJSONStorage(() => kv),
      partialize: (s): PersistedState => ({
        version: s.version, accounts: s.accounts, families: s.families, session: s.session, device: s.device,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) console.warn('Could not read saved data', error);
        useApp.setState({ hydrated: true });
        state?.purgeDeleted();
      },
    },
  ),
);
