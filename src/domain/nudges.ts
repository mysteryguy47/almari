/**
 * Life-stage nudges: what is coming, worked out from each date of birth,
 * before the family has to remember it.
 *
 * - Aadhaar biometric update at 5 and again at 15 (fingerprints and iris are
 *   captured once a child grows).
 * - Voter ID at 18, and a login of their own.
 * - Senior-citizen benefits at 60.
 * - Life certificate for pensioners every November; from 1 October at 80+.
 *
 * Each nudge can become a task in one tap, or be dismissed for the year.
 */
import { displayName } from './access';
import { addDays, ageFrom, daysBetween, daysInMonth, parseDob, toISODate, ymdFromDate, type YMD } from './dates';
import type { Family, ID, Member } from './types';

export type NudgeRule = 'aadhaar-5' | 'aadhaar-15' | 'voter-18' | 'own-login-18' | 'senior-60' | 'life-certificate';

export interface Nudge {
  key: string;
  rule: NudgeRule;
  memberId: ID;
  title: string;
  detail: string;
  /** Suggested deadline for the task, ISO date. */
  dueDate?: string;
  taskTitle: string;
  /** A template to add once it is done (e.g. the new Voter ID). */
  templateId?: string;
}

const LOOKAHEAD_DAYS = 60;

/** Days until the member's next birthday at which they turn `age`, or null if not knowable. */
function daysUntilTurning(member: Member, age: number, today: YMD): number | null {
  const dob = parseDob(member.dob)?.ymd;
  if (!dob) return null;
  const y = dob.y + age;
  const birthday = { y, m: dob.m, d: Math.min(dob.d, daysInMonth(y, dob.m)) };
  return daysBetween(today, birthday);
}

/** Within a band of ages, or turning the first age soon. */
function inStage(member: Member, from: number, to: number, now: Date): { due: string } | null {
  const today = ymdFromDate(now);
  const age = ageFrom(member.dob, now);
  if (!age) return null;
  if (age.years >= from && age.years < to) return { due: toISODate(addDays(today, 30)) };
  const days = daysUntilTurning(member, from, today);
  if (days !== null && days > 0 && days <= LOOKAHEAD_DAYS) return { due: toISODate(addDays(today, days)) };
  return null;
}

function hasPaper(family: Family, memberId: ID, templateId: string): boolean {
  return family.documents.some((d) => !d.deletedAt && d.ownerId === memberId && d.templateId === templateId);
}

function hasTaskLike(family: Family, words: string, year: number): boolean {
  return family.tasks.some(
    (t) => !t.deletedAt && t.title.toLowerCase().includes(words) && (!t.done || new Date(t.doneAt ?? 0).getFullYear() === year),
  );
}

export function lifeStageNudges(family: Family, now: Date = new Date()): Nudge[] {
  const today = ymdFromDate(now);
  const year = today.y;
  const out: Nudge[] = [];
  const dismissed = new Set(family.dismissedNudges ?? []);
  const push = (n: Omit<Nudge, 'key'>) => {
    const key = `${n.memberId}:${n.rule}:${year}`;
    if (!dismissed.has(key)) out.push({ ...n, key });
  };

  for (const m of family.members) {
    if (m.status === 'memorial' || m.isPet) continue;
    const name = displayName(m);
    const possessive = `${name}’s`;

    const five = inStage(m, 5, 7, now);
    if (five) {
      push({
        rule: 'aadhaar-5', memberId: m.id, dueDate: five.due,
        title: `${possessive} Aadhaar biometric update`,
        detail: 'Due once a child turns 5: fingerprints, iris and a new photo are added at an Aadhaar centre.',
        taskTitle: `Aadhaar biometric update for ${name}`,
      });
    }
    const fifteen = inStage(m, 15, 17, now);
    if (fifteen) {
      push({
        rule: 'aadhaar-15', memberId: m.id, dueDate: fifteen.due,
        title: `${possessive} Aadhaar biometric update`,
        detail: 'Due again at 15. Book it at an Aadhaar centre; take the Aadhaar card along.',
        taskTitle: `Aadhaar biometric update for ${name} (age 15)`,
      });
    }
    const eighteen = inStage(m, 18, 20, now);
    if (eighteen && !m.ids.voter && !hasPaper(family, m.id, 'voter-id')) {
      push({
        rule: 'voter-18', memberId: m.id, dueDate: eighteen.due, templateId: 'voter-id',
        title: `${name} can register to vote`,
        detail: 'At 18 they can apply for a Voter ID. Once it arrives, add it here.',
        taskTitle: `Apply for ${possessive} Voter ID`,
      });
    }
    if (eighteen && m.kind === 'profile') {
      push({
        rule: 'own-login-18', memberId: m.id,
        title: `Give ${name} a login of their own`,
        detail: 'They can claim their profile with their own email, and their papers come with them.',
        taskTitle: `Set up ${possessive} own Almari login`,
      });
    }
    const sixty = inStage(m, 60, 61, now);
    if (sixty) {
      push({
        rule: 'senior-60', memberId: m.id, dueDate: sixty.due,
        title: `Senior-citizen benefits for ${name}`,
        detail: 'Ask the bank about senior-citizen deposit rates, and check the income-tax rules for seniors.',
        taskTitle: `Senior-citizen benefits for ${name}`,
      });
    }

    if (hasPaper(family, m.id, 'ppo') && !hasTaskLike(family, 'life certificate', year)) {
      const age = ageFrom(m.dob, now)?.years ?? 0;
      const start: YMD = { y: year, m: age >= 80 ? 10 : 11, d: 1 };
      const end: YMD = { y: year, m: 11, d: 30 };
      const untilStart = daysBetween(today, start);
      const untilEnd = daysBetween(today, end);
      if (untilStart <= 30 && untilEnd >= 0) {
        push({
          rule: 'life-certificate', memberId: m.id, dueDate: toISODate(end),
          title: `${possessive} life certificate`,
          detail: age >= 80
            ? 'Pensioners aged 80 and above can submit it from 1 October. Due by 30 November.'
            : 'Pensioners submit it every November, at the bank or through Jeevan Pramaan. Due by 30 November.',
          taskTitle: `Submit ${possessive} life certificate`,
        });
      }
    }
  }
  return out.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
}
