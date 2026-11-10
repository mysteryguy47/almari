/**
 * Bank and card helpers: network detection, masking, IFSC to bank name,
 * and the "share account details" text (which never includes secrets).
 */
import { getTemplate } from './templates';
import { compactUpper, digitsOnly } from './validation';
import type { BankAccount, BankAccountType, CardNetwork, CardType } from './types';

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

/** Banks by the first four letters of the IFSC. Branch lookup needs the RBI list (server, MVP). */
const IFSC_BANKS: Record<string, string> = {
  SBIN: 'State Bank of India', HDFC: 'HDFC Bank', ICIC: 'ICICI Bank', UTIB: 'Axis Bank',
  PUNB: 'Punjab National Bank', BARB: 'Bank of Baroda', CNRB: 'Canara Bank', UBIN: 'Union Bank of India',
  KKBK: 'Kotak Mahindra Bank', IDIB: 'Indian Bank', BKID: 'Bank of India', IOBA: 'Indian Overseas Bank',
  YESB: 'Yes Bank', INDB: 'IndusInd Bank', IDFB: 'IDFC FIRST Bank', MAHB: 'Bank of Maharashtra',
  CBIN: 'Central Bank of India', UCBA: 'UCO Bank', PSIB: 'Punjab & Sind Bank', FDRL: 'Federal Bank',
  KARB: 'Karnataka Bank', SIBL: 'South Indian Bank', RATN: 'RBL Bank', AUBL: 'AU Small Finance Bank',
  IPOS: 'India Post Payments Bank', DBSS: 'DBS Bank India', HSBC: 'HSBC', SCBL: 'Standard Chartered',
  JAKA: 'J&K Bank', TMBL: 'Tamilnad Mercantile Bank', CIUB: 'City Union Bank', KVBL: 'Karur Vysya Bank',
  DLXB: 'Dhanlaxmi Bank', CSBK: 'CSB Bank', BDBL: 'Bandhan Bank', ESFB: 'Equitas Small Finance Bank',
};

export function bankFromIfsc(ifsc: string | undefined): string | undefined {
  if (!ifsc) return undefined;
  const code = compactUpper(ifsc).slice(0, 4);
  return IFSC_BANKS[code];
}

/** Common Indian banks, for the bank picker. */
export const COMMON_BANKS = Array.from(new Set(Object.values(IFSC_BANKS)));

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
