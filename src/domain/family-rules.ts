/**
 * Family-level rules: how many families a person can join, the no-boss
 * safeguards for removing someone, sign-in lockouts, readiness, and the
 * small helpers that keep a profile's ID numbers and its documents in step.
 */
import { activeAccountMembers, canSee, findMember } from './access';
import { ageFrom, parseDob } from './dates';
import { TEMPLATES } from './templates';
import { compactUpper, digitsOnly, formatAadhaar } from './validation';
import type { Account, Family, ID, IdKind, Member } from './types';

// ---------------------------------------------------------------- families per person

export const MAX_FAMILIES_PER_PERSON = 3;
export const MAX_MEMBERS = 20;

export function canJoinAnotherFamily(account: Pick<Account, 'familyIds'>): boolean {
  return account.familyIds.length < MAX_FAMILIES_PER_PERSON;
}

export function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? '';
  return last ? last[0].toUpperCase() + last.slice(1) : '';
}

/** "Khurana's", "Khurana Parivaar", "Khurana Family". */
export function familyNameSuggestions(fullName: string): string[] {
  const surname = surnameOf(fullName);
  if (!surname) return [];
  const possessive = surname.endsWith('s') ? `${surname}'` : `${surname}'s`;
  return [possessive, `${surname} Parivaar`, `${surname} Family`];
}

/** The earliest birth year in the family, for the nameplate's "Est." line. */
export function establishedYear(family: Family): number | undefined {
  const years = family.members
    .filter((m) => !m.isPet)
    .map((m) => parseDob(m.dob)?.year)
    .filter((y): y is number => typeof y === 'number');
  return years.length ? Math.min(...years) : undefined;
}

// ---------------------------------------------------------------- removing someone, with no admin

export type RemovalCheck =
  | { ok: true; needsApproval: boolean }
  | { ok: false; reason: string };

/**
 * Removing an account member needs a second member to approve. In a family
 * of two active members nobody can remove the other; either can leave.
 * Profile-only members can be removed by anyone (with the usual 30-day undo).
 */
export function checkRemoval(family: Family, requesterId: ID, memberId: ID): RemovalCheck {
  if (requesterId === memberId) return { ok: false, reason: 'To remove yourself, choose Leave this family' };
  const target = findMember(family, memberId);
  if (!target) return { ok: false, reason: 'This member is no longer in the family' };
  if (target.kind === 'profile') return { ok: true, needsApproval: false };
  if (activeAccountMembers(family).length <= 2) {
    return { ok: false, reason: 'In a family of two, either of you can leave, but neither can remove the other' };
  }
  return { ok: true, needsApproval: true };
}

/** A pending removal may be approved by anyone except the requester and the person being removed. */
export function canApproveRemoval(family: Family, approverId: ID, memberId: ID): boolean {
  const request = family.removalRequests.find((r) => r.memberId === memberId);
  if (!request) return false;
  if (approverId === request.requestedBy || approverId === memberId) return false;
  return activeAccountMembers(family).some((m) => m.id === approverId);
}

// ---------------------------------------------------------------- wrong PINs and passwords

export const MAX_ATTEMPTS = 5;
export const PASSWORD_PAUSE_MS = 30 * 60 * 1000;

export function attemptsLeft(failures: number): number {
  return Math.max(0, MAX_ATTEMPTS - failures);
}

export function isPasswordPaused(account: Pick<Account, 'passwordPausedUntil'>, now: number): boolean {
  return account.passwordPausedUntil !== undefined && now < account.passwordPausedUntil;
}

/**
 * After a wrong password. The fifth in a row pauses password sign-in for
 * 30 minutes (a pause, not a permanent lock, so a stranger cannot shut the
 * owner out); a reset link unlocks it at once.
 */
export function afterWrongPassword<T extends Pick<Account, 'failedPasswordAttempts' | 'passwordPausedUntil'>>(
  account: T,
  now: number,
): T {
  const failures = account.failedPasswordAttempts + 1;
  if (failures >= MAX_ATTEMPTS) {
    return { ...account, failedPasswordAttempts: 0, passwordPausedUntil: now + PASSWORD_PAUSE_MS };
  }
  return { ...account, failedPasswordAttempts: failures };
}

export function afterRightPassword<T extends Pick<Account, 'failedPasswordAttempts' | 'passwordPausedUntil'>>(account: T): T {
  return { ...account, failedPasswordAttempts: 0, passwordPausedUntil: undefined };
}

/** After a wrong app PIN: the fifth locks the app until the person signs in again. Nothing is wiped. */
export function afterWrongPin(failures: number): { failures: number; lockedOut: boolean } {
  const next = failures + 1;
  return { failures: next, lockedOut: next >= MAX_ATTEMPTS };
}

// ---------------------------------------------------------------- profile numbers

export function normaliseIdNumber(kind: IdKind, value: string): string {
  if (kind === 'aadhaar') return formatAadhaar(digitsOnly(value));
  return compactUpper(value);
}

// ---------------------------------------------------------------- e-Aadhaar password

/**
 * The widely published e-Aadhaar PDF password pattern: the first four letters
 * of the name in capitals, then the year of birth ("RAJE1966"). Published by
 * banks and fintechs; UIDAI's own page was not checked, so the app offers it
 * as a guess, never as fact.
 */
export function eAadhaarPasswordGuess(fullName: string, dob: string | undefined): { guess: string; certain: boolean } | null {
  const year = parseDob(dob)?.year;
  const letters = fullName.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (!year || letters.length === 0) return null;
  return { guess: `${letters.slice(0, 4)}${year}`, certain: letters.length >= 4 };
}

// ---------------------------------------------------------------- readiness check

export interface Essential {
  key: string;
  label: string;
  templateId: string;
  memberId?: ID;
  done: boolean;
  /** The viewer cannot see this member's personal papers. */
  hidden?: boolean;
}

function hasDoc(family: Family, viewerId: ID, templateIds: string[], ownerId?: ID): 'yes' | 'no' | 'hidden' {
  const docs = family.documents.filter(
    (d) => !d.deletedAt && templateIds.includes(d.templateId) && (ownerId === undefined || d.ownerId === ownerId),
  );
  if (docs.some((d) => canSee(family, viewerId, d))) return 'yes';
  const owner = findMember(family, ownerId);
  const hiddenFromViewer =
    owner && owner.id !== viewerId && owner.kind === 'account' && family.personalSharing === 'private';
  return hiddenFromViewer ? 'hidden' : 'no';
}

function essentialsForMember(member: Member): { templateId: string; label: string }[] {
  const list = [
    { templateId: 'aadhaar', label: 'Aadhaar' },
    { templateId: 'passport-photo', label: 'Passport-size photo' },
  ];
  const age = ageFrom(member.dob)?.years;
  const adult = age === undefined ? member.kind === 'account' : age >= 18;
  if (adult) {
    list.push({ templateId: 'pan', label: 'PAN card' });
    list.push({ templateId: 'signature', label: 'Signature' });
    list.push({ templateId: 'voter-id', label: 'Voter ID' });
  }
  return list;
}

/** "Sharma's: 9 of 14 essentials saved", with each gap per person. */
export function readiness(family: Family, viewerId: ID): { done: number; total: number; items: Essential[] } {
  const items: Essential[] = [];
  for (const member of family.members) {
    if (member.status === 'memorial' || member.isPet) continue;
    for (const e of essentialsForMember(member)) {
      const state = hasDoc(family, viewerId, [e.templateId], member.id);
      items.push({
        key: `${member.id}:${e.templateId}`, label: e.label, templateId: e.templateId, memberId: member.id,
        done: state === 'yes', hidden: state === 'hidden',
      });
    }
  }
  const healthTemplates = ['family-floater', 'health-insurance-card'];
  const healthDone = family.documents.some(
    (d) => !d.deletedAt && healthTemplates.includes(d.templateId) && canSee(family, viewerId, d),
  );
  items.push({ key: 'family:health', label: 'Health insurance', templateId: 'family-floater', done: healthDone });

  const counted = items.filter((i) => !i.hidden);
  return { done: counted.filter((i) => i.done).length, total: counted.length, items };
}

/** Templates with a profile number, for the person page's "numbers first" block. */
export const PROFILE_TEMPLATES = TEMPLATES.filter((t) => t.profileId);
