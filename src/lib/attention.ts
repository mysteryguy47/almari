import type { Href } from 'expo-router';

import type { StampTone } from '@/components/Bits';
import { formatShort } from '@/domain/dates';
import type { Attention } from '@/domain/reminders';

/** The rubber stamp for something due: EXPIRED, TODAY, TOMORROW, 5 DAYS, 12 DEC. */
export function stampFor(a: Pick<Attention, 'daysLeft' | 'kind' | 'date'>): { text: string; tone: StampTone } {
  if (a.daysLeft < 0) return { text: a.kind === 'task' ? 'Overdue' : 'Expired', tone: 'sindoor' };
  if (a.daysLeft === 0) return { text: 'Today', tone: 'sindoor' };
  if (a.daysLeft === 1) return { text: 'Tomorrow', tone: 'haldi' };
  if (a.daysLeft <= 7) return { text: `${a.daysLeft} days`, tone: 'haldi' };
  return { text: formatShort(a.date), tone: 'stamp' };
}

export function attentionHref(a: Attention): Href {
  if (a.kind === 'doc') return `/doc/${a.itemId}`;
  if (a.kind === 'task') return `/task/${a.itemId}`;
  return `/card/${a.itemId}`;
}
