/**
 * Merging two edits of the same record made apart (one offline, say).
 *
 * The rule from the plan: fields only one side changed are kept; when both
 * changed the same field, the later edit wins (the one reaching the server
 * later, which is the device merging now), and the other value is kept in the
 * item's history. Lists that are sets merge as sets. An edit restores an
 * item the other side deleted.
 */
import type { EditHistory } from '@/domain/types';

type Obj = Record<string, unknown>;

/** Fields that hold sets, merged item by item rather than replaced whole. */
const SET_FIELDS = new Set(['mutedBy', 'dismissedNudges', 'assignees', 'files', 'removalRequests']);
/** Bookkeeping fields: never a conflict of their own. */
const QUIET_FIELDS = new Set(['updatedAt', 'history']);
const DELETE_FIELDS = new Set(['deletedAt', 'deletedBy']);
const MAX_HISTORY = 20;

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // A missing field, undefined and null all mean "no value" once stored as JSON.
  if (a == null && b == null) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]));
  }
  const ao = a as Obj;
  const bo = b as Obj;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!deepEqual(ao[k], bo[k])) return false;
  return true;
}

function keyOf(x: unknown): string {
  if (x && typeof x === 'object') {
    const o = x as Obj;
    if (typeof o.id === 'string') return `id:${o.id}`;
    if (typeof o.memberId === 'string') return `member:${o.memberId}`;
    return JSON.stringify(o);
  }
  return `v:${String(x)}`;
}

/** Three-way set merge: keeps what either side added, drops what either side removed. */
export function mergeSet(base: unknown[] | undefined, local: unknown[] | undefined, remote: unknown[] | undefined): unknown[] {
  const b = new Map((base ?? []).map((x) => [keyOf(x), x]));
  const l = new Map((local ?? []).map((x) => [keyOf(x), x]));
  const r = new Map((remote ?? []).map((x) => [keyOf(x), x]));
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const [k, x] of r) {
    const removedLocally = b.has(k) && !l.has(k);
    if (removedLocally) continue;
    // Both have it: prefer the local version when only the local side changed it.
    const lx = l.get(k);
    out.push(lx !== undefined && !deepEqual(lx, b.get(k)) ? lx : x);
    seen.add(k);
  }
  for (const [k, x] of l) {
    if (seen.has(k)) continue;
    const removedRemotely = b.has(k) && !r.has(k);
    if (!removedRemotely) out.push(x);
  }
  return out;
}

export interface MergeResult {
  merged: Obj;
  /** Fields both sides changed, with the remote value that lost. */
  overwritten: { field: string; value: unknown }[];
  /** An edit brought back something the other side had deleted. */
  restored: boolean;
}

export function mergeRecords(base: unknown, local: unknown, remote: unknown, now = Date.now()): MergeResult {
  const b = (base ?? {}) as Obj;
  const l = (local ?? {}) as Obj;
  const r = (remote ?? {}) as Obj;
  const merged: Obj = {};
  const overwritten: { field: string; value: unknown }[] = [];
  const keys = new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]);
  let localEditedOther = false;
  let remoteEditedOther = false;

  for (const k of keys) {
    if (QUIET_FIELDS.has(k)) continue;
    const lc = !deepEqual(l[k], b[k]);
    const rc = !deepEqual(r[k], b[k]);
    if (!DELETE_FIELDS.has(k)) {
      if (lc) localEditedOther = true;
      if (rc) remoteEditedOther = true;
    }
    let value: unknown;
    if (!lc) value = r[k];
    else if (!rc) value = l[k];
    else if (deepEqual(l[k], r[k])) value = l[k];
    else if (SET_FIELDS.has(k) && (Array.isArray(l[k]) || Array.isArray(r[k]))) {
      value = mergeSet(b[k] as unknown[], l[k] as unknown[], r[k] as unknown[]);
    } else {
      value = l[k];
      overwritten.push({ field: k, value: r[k] });
    }
    if (value !== undefined) merged[k] = value;
  }

  // "The edit restores the item": a delete on one side and an edit on the other.
  const localDeleted = !!l.deletedAt && !b.deletedAt;
  const remoteDeleted = !!r.deletedAt && !b.deletedAt;
  let restored = false;
  if ((localDeleted && remoteEditedOther && !remoteDeleted) || (remoteDeleted && localEditedOther && !localDeleted)) {
    delete merged.deletedAt;
    delete merged.deletedBy;
    restored = true;
  }

  const stamps = [l.updatedAt, r.updatedAt].filter((x): x is number => typeof x === 'number');
  if (stamps.length) merged.updatedAt = Math.max(...stamps);

  const history = mergeSet(b.history as unknown[], l.history as unknown[], r.history as unknown[]) as EditHistory[];
  for (const o of overwritten) history.push({ at: now, field: o.field, value: o.value });
  if (history.length) merged.history = history.slice(-MAX_HISTORY);

  return { merged, overwritten, restored };
}
