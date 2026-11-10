/**
 * Reminders: who is told, and when.
 *
 * Documents (and card expiries) remind everyone who can see them, by default.
 * Each person can mute one item, a category, or all family reminders for
 * themselves; their own items still remind them unless they mute that item.
 * "Only me" and private personal items therefore remind only their owner,
 * because nobody else can see them. Credit-card bills remind the cardholder only.
 * A member in loving memory gets no reminders and causes none.
 */
import { activeAccountMembers, canSee, findMember } from './access';
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  parseISODate,
  toISODate,
  ymdFromDate,
  type YMD,
} from './dates';
import { DEFAULT_REMINDER, getTemplate, type CategoryId, type ReminderRule } from './templates';
import type { CardItem, DocItem, Family, ID, Member, Ownable, ReminderPrefs, Task } from './types';

export const DEFAULT_PREFS: ReminderPrefs = { familyMuted: false, mutedCategories: [] };

export function prefsFor(family: Family, memberId: ID): ReminderPrefs {
  return family.reminderPrefs[memberId] ?? DEFAULT_PREFS;
}

function isOwnItem(member: Member, item: Ownable): boolean {
  return item.ownerId === member.id || (item.onlyMe && item.createdBy === member.id);
}

/** Members who receive expiry reminders for an item they can see. */
export function expiryRecipients(
  family: Family,
  item: Ownable & { mutedBy: ID[] },
  categoryId: CategoryId | 'cards',
): ID[] {
  if (item.deletedAt) return [];
  const owner = findMember(family, item.ownerId);
  if (owner?.status === 'memorial') return [];
  return activeAccountMembers(family)
    .filter((m) => canSee(family, m.id, item))
    .filter((m) => !item.mutedBy.includes(m.id))
    .filter((m) => {
      if (isOwnItem(m, item)) return true;
      const prefs = prefsFor(family, m.id);
      if (prefs.familyMuted) return false;
      return !prefs.mutedCategories.includes(categoryId);
    })
    .map((m) => m.id);
}

/** The cardholder, if they open the app and have not muted the card. */
export function cardBillRecipients(family: Family, card: CardItem): ID[] {
  if (card.deletedAt || card.type !== 'credit') return [];
  const owner = findMember(family, card.ownerId);
  if (!owner || owner.kind !== 'account' || owner.status !== 'active') return [];
  return card.mutedBy.includes(owner.id) ? [] : [owner.id];
}

/** Assignees (or everyone, for "Anyone" tasks) who open the app. */
export function taskRecipients(family: Family, task: Task): ID[] {
  if (task.done || task.deletedAt) return [];
  const active = activeAccountMembers(family);
  if (task.assignees.length === 0) return active.map((m) => m.id);
  return active.filter((m) => task.assignees.includes(m.id)).map((m) => m.id);
}

/** The dates on which an expiry is announced, latest last. */
export function reminderDates(expiryISO: string, rule: ReminderRule = DEFAULT_REMINDER): string[] {
  const expiry = parseISODate(expiryISO);
  if (!expiry) return [];
  const dates: YMD[] = [];
  for (const months of rule.months ?? []) dates.push(addMonths(expiry, -months));
  for (const days of rule.days ?? []) dates.push(addDays(expiry, -days));
  return dates.map(toISODate).sort();
}

/** How far ahead the item starts showing in Needs attention, in days. */
export function attentionWindowDays(rule: ReminderRule = DEFAULT_REMINDER): number {
  const maxMonths = Math.max(0, ...(rule.months ?? []));
  const maxDays = Math.max(0, ...(rule.days ?? []));
  return Math.max(maxDays, Math.round(maxMonths * 30.44));
}

/** Last day of the card's expiry month, from "MM/YY". */
export function cardExpiryDate(expiry: string | undefined): string | undefined {
  const match = expiry ? /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim()) : null;
  if (!match) return undefined;
  const m = Number(match[1]);
  if (m < 1 || m > 12) return undefined;
  const y = 2000 + Number(match[2]);
  return toISODate({ y, m, d: daysInMonth(y, m) });
}

/** The next date (today or later) that falls on `day` of a month, clamped to short months. */
export function nextMonthlyDate(day: number, now: Date = new Date()): string {
  const today = ymdFromDate(now);
  const thisMonth = { y: today.y, m: today.m, d: Math.min(day, daysInMonth(today.y, today.m)) };
  if (daysBetween(today, thisMonth) >= 0) return toISODate(thisMonth);
  const next = addMonths({ y: today.y, m: today.m, d: 1 }, 1);
  return toISODate({ ...next, d: Math.min(day, daysInMonth(next.y, next.m)) });
}

export type Severity = 'expired' | 'soon' | 'upcoming';

export interface Attention {
  key: string;
  kind: 'doc' | 'card-bill' | 'card-expiry' | 'task';
  itemId: ID;
  title: string;
  date: string;
  daysLeft: number;
  severity: Severity;
  ownerId?: ID;
}

function severityOf(daysLeft: number): Severity {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 7) return 'soon';
  return 'upcoming';
}

/** Everything the viewer should be reminded of now, soonest first. */
export function attentionFor(family: Family, viewerId: ID, now: Date = new Date()): Attention[] {
  const today = ymdFromDate(now);
  const out: Attention[] = [];

  for (const doc of family.documents) {
    if (!doc.expiryDate) continue;
    const expiry = parseISODate(doc.expiryDate);
    if (!expiry) continue;
    const template = getTemplate(doc.templateId);
    if (!expiryRecipients(family, doc, template.category).includes(viewerId)) continue;
    const daysLeft = daysBetween(today, expiry);
    const window = attentionWindowDays(template.expiry?.rule);
    if (daysLeft > window || daysLeft < -365) continue;
    out.push({
      key: `doc:${doc.id}`, kind: 'doc', itemId: doc.id, title: doc.title, date: doc.expiryDate,
      daysLeft, severity: severityOf(daysLeft), ownerId: doc.ownerId,
    });
  }

  for (const card of family.cards) {
    if (card.deletedAt) continue;
    if (card.type === 'credit' && card.dueDay && cardBillRecipients(family, card).includes(viewerId)) {
      const due = nextMonthlyDate(card.dueDay, now);
      const daysLeft = daysBetween(today, parseISODate(due) as YMD);
      if (daysLeft <= 7) {
        out.push({
          key: `bill:${card.id}`, kind: 'card-bill', itemId: card.id, title: `${card.bank} ${card.nickname ?? 'card'} bill`,
          date: due, daysLeft, severity: severityOf(daysLeft), ownerId: card.ownerId,
        });
      }
    }
    const expiry = cardExpiryDate(card.expiry);
    if (expiry && expiryRecipients(family, card, 'cards').includes(viewerId)) {
      const daysLeft = daysBetween(today, parseISODate(expiry) as YMD);
      if (daysLeft <= 30 && daysLeft >= -60) {
        out.push({
          key: `cardexp:${card.id}`, kind: 'card-expiry', itemId: card.id, title: `${card.bank} card expires`,
          date: expiry, daysLeft, severity: severityOf(daysLeft), ownerId: card.ownerId,
        });
      }
    }
  }

  for (const task of family.tasks) {
    if (!task.dueAt || !taskRecipients(family, task).includes(viewerId)) continue;
    const due = parseISODate(task.dueAt);
    if (!due) continue;
    const daysLeft = daysBetween(today, due);
    if (daysLeft > 3) continue;
    out.push({
      key: `task:${task.id}`, kind: 'task', itemId: task.id, title: task.title, date: task.dueAt,
      daysLeft, severity: severityOf(daysLeft),
    });
  }

  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

export interface PlannedNotification {
  at: string; // local "YYYY-MM-DDTHH:mm"
  title: string;
  body: string;
  key: string;
}

/**
 * The notifications a phone should schedule for its owner. Times sit outside
 * quiet hours (10 pm to 8 am): 9 am for expiries and bills, 7 pm the evening
 * before a task and 9 am on its day.
 */
export function plannedNotifications(family: Family, viewerId: ID, now: Date = new Date()): PlannedNotification[] {
  const todayISO = toISODate(ymdFromDate(now));
  const out: PlannedNotification[] = [];
  const familyName = family.name;

  for (const doc of family.documents as DocItem[]) {
    if (!doc.expiryDate) continue;
    const template = getTemplate(doc.templateId);
    if (!expiryRecipients(family, doc, template.category).includes(viewerId)) continue;
    for (const date of reminderDates(doc.expiryDate, template.expiry?.rule)) {
      if (date < todayISO) continue;
      out.push({
        at: `${date}T09:00`,
        title: `${doc.title} ${template.expiry?.label === 'Valid till' ? 'expires' : 'is due'} soon`,
        body: `${familyName}: due on ${doc.expiryDate}. Tap to see it.`,
        key: `doc:${doc.id}:${date}`,
      });
    }
  }

  for (const card of family.cards) {
    if (card.type !== 'credit' || !card.dueDay || !cardBillRecipients(family, card).includes(viewerId)) continue;
    const due = nextMonthlyDate(card.dueDay, now);
    const dueYmd = parseISODate(due) as YMD;
    for (const daysBefore of [3, 1]) {
      const date = toISODate(addDays(dueYmd, -daysBefore));
      if (date < todayISO) continue;
      out.push({
        at: `${date}T09:00`,
        title: `${card.bank} card bill due ${daysBefore === 1 ? 'tomorrow' : `in ${daysBefore} days`}`,
        body: `Due on ${due}.`,
        key: `bill:${card.id}:${date}`,
      });
    }
  }

  for (const task of family.tasks) {
    if (!task.dueAt || !taskRecipients(family, task).includes(viewerId)) continue;
    const due = parseISODate(task.dueAt);
    if (!due) continue;
    const eveningBefore = `${toISODate(addDays(due, -1))}T19:00`;
    const morningOf = `${toISODate(due)}T09:00`;
    if (eveningBefore.slice(0, 10) >= todayISO) {
      out.push({ at: eveningBefore, title: `Tomorrow: ${task.title}`, body: familyName, key: `task:${task.id}:eve` });
    }
    if (morningOf.slice(0, 10) >= todayISO) {
      out.push({ at: morningOf, title: `Today: ${task.title}`, body: familyName, key: `task:${task.id}:day` });
    }
  }

  return out.sort((a, b) => a.at.localeCompare(b.at));
}
