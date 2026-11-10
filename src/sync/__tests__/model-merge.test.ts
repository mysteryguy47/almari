import { produce } from 'immer';

import { NOW } from '@/domain/__tests__/factory';
import { buildSampleFamily } from '@/domain/sample';
import type { DocItem, Family } from '@/domain/types';

import { deepEqual, mergeRecords, mergeSet } from '../merge';
import { allRecords, applyRecord, desiredVisibility, diffFamily, emptyFamily, FAMILY_RECORD_ID, readRecord } from '../model';

const sample = (): Family => ({ ...buildSampleFamily(NOW), isSample: undefined });

describe('family ↔ records', () => {
  it('rebuilds a whole family from its records', () => {
    const family = sample();
    const rebuilt = produce(emptyFamily(family.id), (draft) => {
      for (const r of allRecords(family)) applyRecord(draft, r.kind, r.id, JSON.parse(JSON.stringify(r.data)));
    });
    expect(rebuilt.name).toBe(family.name);
    for (const key of ['members', 'documents', 'logins', 'bankAccounts', 'cards', 'notes', 'tasks', 'contacts'] as const) {
      const byId = (list: { id: string }[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));
      expect(byId(rebuilt[key] as { id: string }[])).toEqual(byId(family[key] as { id: string }[]));
    }
    expect(rebuilt.activity.map((a) => a.id)).toEqual(family.activity.map((a) => a.id));
    expect(rebuilt.reminderPrefs).toEqual(family.reminderPrefs);
  });

  it('finds exactly what an edit changed', () => {
    const family = sample();
    const docId = family.documents[0].id;
    const next = produce(family, (d) => {
      d.documents[0].title = 'Renamed';
      d.contacts = d.contacts.filter((c, i) => i !== 0);
      d.activity.unshift({ id: 'act-new', at: NOW.getTime(), by: d.members[0].id, kind: 'changed', text: 'renamed' });
    });
    const changes = diffFamily(family, next);
    expect(changes).toEqual(expect.arrayContaining([
      { id: docId, kind: 'document', data: next.documents[0] },
      { id: family.contacts[0].id, kind: 'contact', data: null },
      { id: 'act-new', kind: 'activity', data: next.activity[0] },
    ]));
    expect(changes).toHaveLength(3);
  });

  it('does not treat trimming old activity as deleting it', () => {
    const family = sample();
    const next = produce(family, (d) => {
      d.activity.length = 1;
    });
    expect(diffFamily(family, next)).toEqual([]);
  });

  it('notices the family record when its fields change', () => {
    const family = sample();
    const next = produce(family, (d) => {
      d.personalSharing = 'private';
    });
    expect(diffFamily(family, next)).toEqual([expect.objectContaining({ id: FAMILY_RECORD_ID, kind: 'family' })]);
  });

  it('keeps activity newest first and capped', () => {
    const f = produce(emptyFamily('f'), (d) => {
      for (let i = 0; i < 305; i++) applyRecord(d, 'activity', `a${i}`, { id: `a${i}`, at: i, by: 'm', kind: 'added', text: '' });
    });
    expect(f.activity).toHaveLength(300);
    expect(f.activity[0].at).toBe(304);
    expect(readRecord(f, 'activity', 'a304')).toBeDefined();
  });
});

describe('who can read a record on the server', () => {
  const family = sample();
  const users: Record<string, string> = Object.fromEntries(
    family.members.filter((m) => m.kind === 'account').map((m) => [m.id, `user-${m.id}`]),
  );
  const userOf = (id: string) => users[id];
  const account = family.members.find((m) => m.kind === 'account') as Family['members'][number];
  const profile = family.members.find((m) => m.kind === 'profile') as Family['members'][number];
  const doc = (over: Partial<DocItem>): DocItem => ({ ...family.documents[0], onlyMe: false, ...over });

  it('keeps Only me with the account that saved it', () => {
    expect(desiredVisibility(family, 'document', doc({ onlyMe: true, createdBy: account.id }), userOf)).toBe(users[account.id]);
  });

  it('shares common items, profile-only members’ items and tasks with everyone', () => {
    expect(desiredVisibility(family, 'document', doc({ ownerId: undefined }), userOf)).toBeNull();
    expect(desiredVisibility(family, 'document', doc({ ownerId: profile.id }), userOf)).toBeNull();
    expect(desiredVisibility(family, 'task', family.tasks[0], userOf)).toBeNull();
  });

  it('follows the family setting for an account member’s personal items', () => {
    expect(desiredVisibility({ ...family, personalSharing: 'family' }, 'document', doc({ ownerId: account.id }), userOf)).toBeNull();
    expect(desiredVisibility({ ...family, personalSharing: 'private' }, 'document', doc({ ownerId: account.id }), userOf)).toBe(users[account.id]);
  });

  it('shares an invited owner’s items with the family until they join', () => {
    expect(desiredVisibility({ ...family, personalSharing: 'private' }, 'document', doc({ ownerId: account.id }), () => undefined)).toBeNull();
  });
});

describe('merging two edits', () => {
  const base = { id: 'd', title: 'PAN', number: 'A', original: 'Almari', mutedBy: ['m1'], updatedAt: 1 };

  it('keeps both sides when they changed different fields', () => {
    const { merged, overwritten } = mergeRecords(base, { ...base, title: 'Papa ka PAN', updatedAt: 3 }, { ...base, number: 'B', updatedAt: 2 });
    expect(merged).toMatchObject({ title: 'Papa ka PAN', number: 'B', original: 'Almari', updatedAt: 3 });
    expect(overwritten).toEqual([]);
  });

  it('lets the later edit win a clash and keeps the other in history', () => {
    const { merged, overwritten } = mergeRecords(base, { ...base, original: 'Bank locker' }, { ...base, original: 'Steel almari' }, 99);
    expect(merged.original).toBe('Bank locker');
    expect(overwritten).toEqual([{ field: 'original', value: 'Steel almari' }]);
    expect(merged.history).toEqual([{ at: 99, field: 'original', value: 'Steel almari' }]);
  });

  it('merges sets item by item', () => {
    const { merged } = mergeRecords(base, { ...base, mutedBy: ['m1', 'm2'] }, { ...base, mutedBy: ['m3'] });
    expect([...(merged.mutedBy as string[])].sort()).toEqual(['m2', 'm3']);
  });

  it('merges file lists by id', () => {
    const f = (id: string) => ({ id, name: `${id}.jpg` });
    expect(mergeSet([f('a')], [f('a'), f('b')], [f('a'), f('c')]).map((x) => (x as { id: string }).id)).toEqual(['a', 'c', 'b']);
    expect(mergeSet([f('a'), f('b')], [f('b')], [f('a'), f('b')]).map((x) => (x as { id: string }).id)).toEqual(['b']);
  });

  it('restores an item one side deleted while the other edited it', () => {
    const deleted = { ...base, deletedAt: 5, deletedBy: 'm1' };
    const edited = { ...base, title: 'Updated' };
    expect(mergeRecords(base, edited, deleted).merged).not.toHaveProperty('deletedAt');
    const other = mergeRecords(base, deleted, edited);
    expect(other.restored).toBe(true);
    expect(other.merged).toMatchObject({ title: 'Updated' });
    expect(other.merged).not.toHaveProperty('deletedAt');
  });

  it('keeps a delete when nobody edited', () => {
    expect(mergeRecords(base, { ...base, deletedAt: 5 }, base).merged.deletedAt).toBe(5);
  });

  it('treats missing, undefined and null alike', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: null }, {})).toBe(true);
    expect(deepEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});
