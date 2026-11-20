/**
 * Bank and card helpers: network detection, masking, IFSC to bank name,
 * and the "share account details" text (which never includes secrets).
 */
import { bankFromIfsc as bankByIfsc, POPULAR_BANKS } from './banks';
import { getTemplate } from './templates';
import { compactUpper, digitsOnly } from './validation';
import type { BankAccount, BankAccountType, CardItem, CardNetwork, CardType, Credential, SecretEntry } from './types';

/** Best guess from the number's first digits; the person can always change it. */
export function detectNetwork(number: string): CardNetwork {
  const d = digitsOnly(number);
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(36|30[0-5]|38|39)/.test(d)) return 'diners';
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5])/.test(d)) return 'mastercard';
  const first4 = Number(d.slice(0, 4));
  if (d.length >= 4 && first4 >= 2221 && first4 <= 2720) return 'mastercard';
  if (/^(60|65|81|82|508|353|356)/.test(d)) return 'rupay';
  if (/^35/.test(d)) return 'jcb';
  return 'other';
}

export const NETWORK_LABELS: Record<CardNetwork, string> = {
  visa: 'Visa', mastercard: 'Mastercard', rupay: 'RuPay', amex: 'Amex', diners: 'Diners', jcb: 'JCB', other: 'Card',
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  debit: 'Debit card', credit: 'Credit card', prepaid: 'Prepaid card', forex: 'Forex card',
};

export const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  savings: 'Savings', current: 'Current', salary: 'Salary', nre: 'NRE', nro: 'NRO', other: 'Other',
};

/** "•••• 1111" */
export function maskTail(value: string, visible = 4): string {
  const d = digitsOnly(value) || value;
  return `•••• ${d.slice(-visible)}`;
}

/** "4111 1111 1111 1111" (Amex: 4-6-5). */
export function groupCardNumber(number: string): string {
  const d = digitsOnly(number);
  if (detectNetwork(d) === 'amex' && d.length === 15) return `${d.slice(0, 4)} ${d.slice(4, 10)} ${d.slice(10)}`;
  return d.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "XXXX XXXX 1234": how Aadhaar shows until it is revealed. */
export function maskAadhaar(value: string): string {
  const d = digitsOnly(value);
  if (d.length < 4) return 'XXXX XXXX XXXX';
  return `XXXX XXXX ${d.slice(-4)}`;
}

/** A document number as lists show it: Aadhaar stays masked everywhere outside its own reveal. */
export function listNumber(templateId: string, number: string | undefined): string | undefined {
  if (!number) return undefined;
  return getTemplate(templateId).profileId === 'aadhaar' ? maskAadhaar(number) : number;
}

/** The bank's full name from an IFSC ("SBIN0001234" → State Bank of India). */
export function bankFromIfsc(ifsc: string | undefined): string | undefined {
  return bankByIfsc(ifsc)?.name;
}

/** Common Indian banks, for the bank picker before anything is typed. */
export const COMMON_BANKS = POPULAR_BANKS;

/**
 * Clean text for "send me your account details". Name, account number, IFSC
 * and bank only: never passwords, net-banking IDs, PIN or CVV.
 */
export function shareAccountText(account: BankAccount, holderName: string): string {
  const lines = [
    `Name: ${account.holder?.trim() || holderName}`,
    `Account number: ${account.accountNumber}`,
  ];
  if (account.ifsc) lines.push(`IFSC: ${compactUpper(account.ifsc)}`);
  lines.push(`Bank: ${account.bank}${account.branch ? `, ${account.branch}` : ''}`);
  return lines.join('\n');
}

/** "₹2,50,000" in the Indian grouping. */
export function formatRupees(amount: number | undefined): string {
  if (amount === undefined || Number.isNaN(amount)) return '';
  const negative = amount < 0;
  const [whole] = Math.abs(Math.round(amount)).toString().split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `${negative ? '-' : ''}₹${grouped}`;
}

/** "1st", "2nd", "23rd". */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---------------------------------------------------------------- sharing a card

export type CardShareField = 'name' | 'number' | 'expiry' | 'cvv';

export const CARD_SHARE_LABELS: Record<CardShareField, string> = {
  name: 'Name on card', number: 'Card number', expiry: 'Valid till', cvv: 'CVV',
};

/**
 * The card's details as a message, the bank's name on top. Only the fields
 * chosen; never the PIN. Sharing the CVV is the person's choice, made on the
 * share sheet with a warning.
 */
export function shareCardText(card: CardItem, fields: CardShareField[], holderName?: string): string {
  const lines = [card.bank + (card.nickname ? ` ${card.nickname}` : '')];
  lines.push(`${CARD_TYPE_LABELS[card.type]}${card.network !== 'other' ? ` · ${NETWORK_LABELS[card.network]}` : ''}`);
  const name = card.nameOnCard?.trim() || holderName?.trim();
  if (fields.includes('name') && name) lines.push(`Name on card: ${name}`);
  if (fields.includes('number')) lines.push(`Card number: ${groupCardNumber(card.number)}`);
  if (fields.includes('expiry') && card.expiry) lines.push(`Valid till: ${card.expiry}`);
  if (fields.includes('cvv') && card.cvv) lines.push(`CVV: ${card.cvv}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------- net banking and app logins

/** Labels a bank login's passwords usually carry, offered as one-tap choices. */
export const SECRET_LABELS = ['Login password', 'Profile password', 'Transaction password', 'MPIN', 'TPIN', 'Security answer'] as const;
/** Kinds of bank login. */
export const CREDENTIAL_LABELS = ['Net banking', 'Mobile app', 'Corporate login', 'Phone banking'] as const;

/** A bank account's logins, reading accounts saved before there could be more than one. */
export function bankCredentials(account: Pick<BankAccount, 'id' | 'credentials' | 'netbankingId' | 'netbankingPassword'>): Credential[] {
  if (account.credentials?.length) return account.credentials;
  if (!account.netbankingId && !account.netbankingPassword) return [];
  const secrets: SecretEntry[] = account.netbankingPassword ? [{ id: `${account.id}-pw`, label: 'Login password', value: account.netbankingPassword }] : [];
  return [{ id: `${account.id}-nb`, label: 'Net banking', username: account.netbankingId, secrets }];
}

/** Drops empty rows: a login with neither a user ID nor a password, a password with no value. */
export function cleanCredentials(list: Credential[]): Credential[] {
  return list
    .map((c) => ({
      ...c,
      label: c.label.trim() || 'Login',
      username: c.username?.trim() || undefined,
      secrets: c.secrets.filter((x) => x.value).map((x) => ({ ...x, label: x.label.trim() || 'Password' })),
    }))
    .filter((c) => c.username || c.secrets.length);
}
