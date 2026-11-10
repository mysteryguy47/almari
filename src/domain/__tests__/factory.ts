/** Test helpers: a small family and item builders with sensible defaults. */
import type { CardItem, DocItem, Family, LoginItem, Member, Task } from '../types';

/** 10 Nov 2026, 10:00 local time. */
export const NOW = new Date(2026, 10, 10, 10, 0, 0);

export function member(id: string, extra: Partial<Member> = {}): Member {
  return {
    id, kind: 'account', fullName: `${id[0].toUpperCase()}${id.slice(1)} Sharma`, ids: {}, status: 'active',
    createdAt: 0, ...extra,
  };
}

/** Papa, Mummy, Ananya (account members), Kabir (child, profile-only), Dadi (memorial). */
export function family(extra: Partial<Family> = {}): Family {
  return {
    id: 'fam', name: "Sharma's", createdAt: 0, createdBy: 'acc-ananya', personalSharing: 'family',
    members: [
      member('papa', { relation: 'Papa', dob: '1966-05-02' }),
      member('mummy', { relation: 'Mummy', dob: '1970-08-15' }),
      member('ananya', { dob: '2000-01-20' }),
      member('kabir', { kind: 'profile', dob: '2014-06-10' }),
      member('dadi', { kind: 'profile', status: 'memorial', dob: '1944' }),
    ],
    documents: [], logins: [], bankAccounts: [], cards: [], notes: [], tasks: [], contacts: [], activity: [],
    reminderPrefs: {}, removalRequests: [],
    ...extra,
  };
}

export function doc(id: string, extra: Partial<DocItem> = {}): DocItem {
  return {
    id, templateId: 'custom', title: id, scope: 'personal', onlyMe: false, createdBy: 'ananya',
    createdAt: 0, updatedAt: 0, files: [], mutedBy: [], ...extra,
  };
}

export function card(id: string, extra: Partial<CardItem> = {}): CardItem {
  return {
    id, type: 'credit', bank: 'HDFC Bank', number: '4111111111111111', network: 'visa', onlyMe: false,
    createdBy: 'ananya', createdAt: 0, updatedAt: 0, mutedBy: [], ...extra,
  };
}

export function login(id: string, extra: Partial<LoginItem> = {}): LoginItem {
  return { id, title: id, kind: 'login', onlyMe: false, createdBy: 'ananya', createdAt: 0, updatedAt: 0, ...extra };
}

export function task(id: string, extra: Partial<Task> = {}): Task {
  return { id, title: id, assignees: [], repeat: 'none', done: false, createdBy: 'ananya', createdAt: 0, ...extra };
}
