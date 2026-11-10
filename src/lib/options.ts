import type { BankAccountType, CardType, Gender, Repeat } from '@/domain/types';

export const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => ({ value: g, label: g }));

export const ACCOUNT_TYPES: { value: BankAccountType; label: string }[] = [
  { value: 'savings', label: 'Savings' },
  { value: 'salary', label: 'Salary' },
  { value: 'current', label: 'Current' },
  { value: 'nre', label: 'NRE' },
  { value: 'nro', label: 'NRO' },
  { value: 'other', label: 'Other' },
];

export const CARD_TYPES: { value: CardType; label: string }[] = [
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'prepaid', label: 'Prepaid' },
  { value: 'forex', label: 'Forex' },
];

export const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'monthly', label: 'Every month' },
  { value: 'half-yearly', label: 'Every 6 months' },
  { value: 'yearly', label: 'Every year' },
];

export const TIMES = [
  { value: '09:00', label: 'Morning 9' },
  { value: '13:00', label: 'Afternoon 1' },
  { value: '18:00', label: 'Evening 6' },
  { value: '21:00', label: 'Night 9' },
];

export const ORIGINAL_PLACES = ['Steel almari', 'Almari locker', 'Bank locker', 'Wallet', 'Office', 'With a relative', 'Not sure'];
