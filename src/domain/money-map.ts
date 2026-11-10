/**
 * The money map: every account, deposit, policy and investment the viewer can
 * see, with its nominee, and which ones have none. Families often learn what
 * existed only after a death; this list is the answer to "what did Papa have?".
 */
import { visibleTo } from './access';
import { ACCOUNT_TYPE_LABELS, maskTail } from './money';
import { getTemplate } from './templates';
import type { Family, ID } from './types';

export interface MoneyEntry {
  kind: 'bank' | 'doc';
  id: ID;
  ownerId?: ID;
  title: string;
  subtitle: string;
  nominee?: string;
}

export function moneyMap(family: Family, viewerId: ID): { entries: MoneyEntry[]; withoutNominee: number } {
  const entries: MoneyEntry[] = [];
  for (const a of visibleTo(family, viewerId, family.bankAccounts)) {
    entries.push({
      kind: 'bank', id: a.id, ownerId: a.ownerId, title: a.bank,
      subtitle: `${ACCOUNT_TYPE_LABELS[a.type]} account · ${maskTail(a.accountNumber)}`, nominee: a.nominee?.trim() || undefined,
    });
  }
  for (const d of visibleTo(family, viewerId, family.documents)) {
    const template = getTemplate(d.templateId);
    if (!template.nominee) continue;
    entries.push({
      kind: 'doc', id: d.id, ownerId: d.ownerId, title: d.title,
      subtitle: [template.name, d.number].filter(Boolean).join(' · '), nominee: d.nominee?.trim() || undefined,
    });
  }
  return { entries, withoutNominee: entries.filter((e) => !e.nominee).length };
}
