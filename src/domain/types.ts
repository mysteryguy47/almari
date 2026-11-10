/**
 * The data model. Pure types: no React, no platform code.
 *
 * Dates are stored as ISO strings ("2026-11-10") or, for an approximate birth
 * date, a year only ("1952"). Timestamps (createdAt and similar) are epoch ms.
 */

export type ID = string;
export type Gender = 'female' | 'male' | 'other';
export type ThemePref = 'system' | 'light' | 'dark';

/** The ID numbers a profile keeps. Each fills itself in when that document is added. */
export type IdKind = 'aadhaar' | 'pan' | 'voter' | 'dl' | 'passport';

export const ID_KINDS: readonly IdKind[] = ['aadhaar', 'pan', 'voter', 'dl', 'passport'];

export const ID_LABELS: Record<IdKind, string> = {
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  voter: 'Voter ID',
  dl: 'Driving licence',
  passport: 'Passport',
};

/** A signed-in person. Prototype only: real accounts live on the server. */
export interface Account {
  id: ID;
  email: string; // always lower-case
  name: string;
  /** Signed up with Google (mocked in the prototype). */
  google: boolean;
  /** Salted SHA-256 of the password, never the password itself. */
  passwordHash?: string;
  passwordSalt?: string;
  failedPasswordAttempts: number;
  /** Password sign-in is paused until this time (epoch ms). */
  passwordPausedUntil?: number;
  familyIds: ID[];
  createdAt: number;
}

export type MemberKind = 'account' | 'profile';
export type MemberStatus = 'active' | 'invited' | 'memorial';

export interface EmergencyInfo {
  allergies?: string;
  conditions?: string;
  medicines?: string;
  doctor?: string;
  contacts?: string;
}

export interface Member {
  id: ID;
  kind: MemberKind;
  /** Set once an account member has signed in and joined. */
  accountId?: ID;
  email?: string;
  fullName: string;
  /** What the family calls them: "Papa", "Dadi". Optional. */
  relation?: string;
  gender?: Gender;
  /** "1958-03-21" or a year only ("1944") when the exact date is unknown. */
  dob?: string;
  phone?: string;
  bloodGroup?: string;
  ids: Partial<Record<IdKind, string>>;
  emergency?: EmergencyInfo;
  status: MemberStatus;
  isPet?: boolean;
  addedBy?: ID;
  createdAt: number;
}

export type Scope = 'personal' | 'common';

/** Fields every private-able item shares, so one visibility rule covers them all. */
export interface Ownable {
  id: ID;
  /** The member it belongs to. Undefined for common (whole-family) items. */
  ownerId?: ID;
  /** "Only me": visible only to the member who saved it. */
  onlyMe: boolean;
  createdBy: ID;
  createdAt: number;
  updatedAt: number;
  /** Soft delete: kept for 30 days in Recently deleted. */
  deletedAt?: number;
  deletedBy?: ID;
}

export type FileKind = 'image' | 'pdf' | 'doc' | 'sample';

export interface FileRef {
  id: ID;
  name: string;
  mime: string;
  size: number;
  kind: FileKind;
}

export interface DocItem extends Ownable {
  templateId: string;
  title: string;
  description?: string;
  scope: Scope;
  number?: string;
  issueDate?: string;
  expiryDate?: string;
  /** Where the paper original is kept: "Steel almari, top shelf". */
  original?: string;
  /** For accounts, deposits, policies and investments: who is the nominee. */
  nominee?: string;
  files: FileRef[];
  /** Members who muted reminders for this document. */
  mutedBy: ID[];
}

export interface LoginItem extends Ownable {
  title: string;
  username?: string;
  password?: string;
  website?: string;
  notes?: string;
  kind: 'login' | 'wifi';
}

export type BankAccountType = 'savings' | 'current' | 'salary' | 'nre' | 'nro' | 'other';

export interface BankAccount extends Ownable {
  bank: string;
  holder?: string;
  type: BankAccountType;
  accountNumber: string;
  ifsc?: string;
  branch?: string;
  customerId?: string;
  netbankingId?: string;
  netbankingPassword?: string;
  registeredMobile?: string;
  nominee?: string;
  upiIds?: string;
  notes?: string;
}

export type CardType = 'debit' | 'credit' | 'prepaid' | 'forex';
export type CardNetwork = 'visa' | 'mastercard' | 'rupay' | 'amex' | 'diners' | 'jcb' | 'other';

export interface CardItem extends Ownable {
  type: CardType;
  bank: string;
  /** "Shopping card", "Travel card". */
  nickname?: string;
  nameOnCard?: string;
  number: string;
  network: CardNetwork;
  /** "MM/YY" */
  expiry?: string;
  cvv?: string;
  pin?: string;
  /** Debit cards may point at one of the owner's accounts. */
  linkedAccountId?: ID;
  /** Credit cards only. */
  creditLimit?: number;
  statementDay?: number;
  dueDay?: number;
  mutedBy: ID[];
}

export interface SecureNote extends Ownable {
  title: string;
  body: string;
}

export type Repeat = 'none' | 'monthly' | 'half-yearly' | 'yearly';

export interface Task {
  id: ID;
  title: string;
  note?: string;
  /** Empty = anyone in the family. */
  assignees: ID[];
  /** ISO date-time, local: "2026-11-14T18:00". */
  dueAt?: string;
  repeat: Repeat;
  linkedDocId?: ID;
  done: boolean;
  doneAt?: number;
  doneBy?: ID;
  createdBy: ID;
  createdAt: number;
  lastNudgedAt?: number;
  deletedAt?: number;
}

export interface Contact {
  id: ID;
  name: string;
  role: string;
  phone: string;
  notes?: string;
  createdBy: ID;
  createdAt: number;
}

export type ActivityKind =
  | 'added'
  | 'changed'
  | 'deleted'
  | 'restored'
  | 'shared'
  | 'privacy'
  | 'member'
  | 'task';

export interface ActivityEntry {
  id: ID;
  at: number;
  by: ID; // member id
  kind: ActivityKind;
  text: string;
}

export interface ReminderPrefs {
  /** Mute reminders about other people's and common documents. */
  familyMuted: boolean;
  /** Category ids muted for other people's and common documents. */
  mutedCategories: string[];
}

export type PersonalSharing = 'family' | 'private';

export interface RemovalRequest {
  memberId: ID;
  requestedBy: ID;
  at: number;
}

export interface Family {
  id: ID;
  name: string;
  createdAt: number;
  createdBy: ID; // account id
  personalSharing: PersonalSharing;
  members: Member[];
  documents: DocItem[];
  logins: LoginItem[];
  bankAccounts: BankAccount[];
  cards: CardItem[];
  notes: SecureNote[];
  tasks: Task[];
  contacts: Contact[];
  activity: ActivityEntry[];
  reminderPrefs: Record<ID, ReminderPrefs>;
  removalRequests: RemovalRequest[];
  /** Life-stage suggestions someone dismissed ("memberId:rule:year"). */
  dismissedNudges?: string[];
  /** True for the built-in sample family. */
  isSample?: boolean;
}
