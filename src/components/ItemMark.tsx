/**
 * The mark for anything in the almari that has one: a paper's issuer logo,
 * an account's or card's bank logo. Lists use it in place of a plain icon,
 * so "Papa's PAN" shows the Income Tax logo and an HDFC bill shows HDFC.
 */
import type { DocItem, Family, ID } from '@/domain/types';

import { BankMark, DocMark } from './Marks';

/** A paper's mark; a cheque or passbook filed under an account shows that bank. */
export function PaperMark({ doc, family, size = 40 }: { doc: Pick<DocItem, 'templateId' | 'accountId'>; family: Family; size?: number }) {
  const bank = doc.accountId ? family.bankAccounts.find((a) => a.id === doc.accountId)?.bank : undefined;
  return <DocMark templateId={doc.templateId} bank={bank} size={size} />;
}

export type MarkedKind = 'doc' | 'bank' | 'card' | 'card-bill' | 'card-expiry' | 'template';

/** The mark for an item by kind and id, or undefined when it has none (people, tasks, notes). */
export function itemMark(family: Family, kind: string, id: ID, size = 40) {
  switch (kind) {
    case 'doc': {
      const doc = family.documents.find((d) => d.id === id);
      return doc ? <PaperMark doc={doc} family={family} size={size} /> : undefined;
    }
    case 'bank': {
      const account = family.bankAccounts.find((a) => a.id === id);
      return account ? <BankMark bank={account.bank} size={size} /> : undefined;
    }
    case 'card':
    case 'card-bill':
    case 'card-expiry': {
      const card = family.cards.find((c) => c.id === id);
      return card ? <BankMark bank={card.bank} size={size} /> : undefined;
    }
    case 'template':
      return <DocMark templateId={id} size={size} />;
    default:
      return undefined;
  }
}
