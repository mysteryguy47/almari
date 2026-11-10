/**
 * Input rules. Required fields and limits block saving ("error"); format
 * checks on ID numbers only warn ("warn"), because real documents are messier
 * than any rule (old Voter IDs, state-specific licences).
 */

export type CheckLevel = 'ok' | 'warn' | 'error';
export interface Check {
  level: CheckLevel;
  message?: string;
}

export const OK: Check = { level: 'ok' };
const warn = (message: string): Check => ({ level: 'warn', message });
const error = (message: string): Check => ({ level: 'error', message });

export const LIMITS = {
  docTitle: 50,
  docDescription: 200,
  taskTitle: 80,
  taskNote: 300,
  familyName: 40,
  personName: 60,
  fileBytes: 10 * 1024 * 1024,
  passwordMin: 8,
} as const;

/** Length in characters as a person counts them (Hindi and emoji count once each). */
export function charLength(value: string): number {
  return Array.from(value).length;
}

export function checkRequiredText(value: string, label: string, max: number): Check {
  const trimmed = value.trim();
  if (!trimmed) return error(`${label} is required`);
  if (charLength(trimmed) > max) return error(`${label} can be up to ${max} characters`);
  return OK;
}

export function checkOptionalText(value: string | undefined, label: string, max: number): Check {
  if (!value || !value.trim()) return OK;
  if (charLength(value.trim()) > max) return error(`${label} can be up to ${max} characters`);
  return OK;
}

export const checkDocTitle = (v: string) => checkRequiredText(v, 'Title', LIMITS.docTitle);
export const checkDocDescription = (v: string | undefined) =>
  checkOptionalText(v, 'Description', LIMITS.docDescription);
export const checkTaskTitle = (v: string) => checkRequiredText(v, 'Task', LIMITS.taskTitle);
export const checkFamilyName = (v: string) => checkRequiredText(v, 'Family name', LIMITS.familyName);
export const checkPersonName = (v: string) => checkRequiredText(v, 'Name', LIMITS.personName);

// ---------------------------------------------------------------- Aadhaar

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

export function verhoeffValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
  }
  return c === 0;
}

/** The Verhoeff check digit to append to `digits`. */
export function verhoeffCheckDigit(digits: string): number {
  let c = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][Number(reversed[i])]];
  }
  return VERHOEFF_INV[c];
}

export const digitsOnly = (value: string) => value.replace(/\D/g, '');
export const compactUpper = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();

export function checkAadhaar(value: string): Check {
  const digits = digitsOnly(value);
  if (!digits) return OK;
  if (digits.length !== 12) return warn('Aadhaar numbers have 12 digits');
  if (digits[0] === '0' || digits[0] === '1') return warn('Aadhaar numbers never start with 0 or 1');
  if (!verhoeffValid(digits)) return warn('This number fails Aadhaar’s built-in check. Please look again');
  return OK;
}

/** "1234 5678 9012" */
export function formatAadhaar(value: string): string {
  const d = digitsOnly(value);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

// ---------------------------------------------------------------- PAN, passport, Voter ID, licence

export function checkPan(value: string): Check {
  const v = compactUpper(value);
  if (!v) return OK;
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v)) return warn('PAN looks like ABCDE1234F: 5 letters, 4 digits, 1 letter');
  return OK;
}

export function checkPassport(value: string): Check {
  const v = compactUpper(value);
  if (!v) return OK;
  if (!/^[A-Z][0-9]{7}$/.test(v)) return warn('Indian passport numbers are 1 letter and 7 digits');
  return OK;
}

export function checkVoterId(value: string): Check {
  const v = compactUpper(value);
  if (!v) return OK;
  if (!/^[A-Z]{3}[0-9]{7}$/.test(v)) return warn('Newer Voter IDs are 3 letters and 7 digits. Older ones vary, and that is fine');
  return OK;
}

export function checkDrivingLicence(value: string): Check {
  const v = compactUpper(value);
  if (!v) return OK;
  if (!/^[A-Z]{2}[0-9]{13}$/.test(v)) return warn('Most licences look like DL0420110012345. Older or state formats vary, and that is fine');
  return OK;
}

export function checkIfsc(value: string): Check {
  const v = compactUpper(value);
  if (!v) return OK;
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v)) return warn('IFSC is 11 characters: 4 letters, a zero, then 6 letters or digits');
  return OK;
}

// ---------------------------------------------------------------- contact details

export function checkEmail(value: string, required = false): Check {
  const v = value.trim();
  if (!v) return required ? error('Email is required') : OK;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return error('This email does not look right');
  return OK;
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Indian mobiles by default (+91, 10 digits from 6–9); any country allowed with a leading +. */
export function checkPhone(value: string): Check {
  const v = value.trim();
  if (!v) return OK;
  const digits = digitsOnly(v);
  if (v.startsWith('+') && !v.startsWith('+91')) {
    return digits.length >= 8 && digits.length <= 15 ? OK : warn('This number looks too short or too long');
  }
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length !== 10) return warn('Indian mobile numbers have 10 digits');
  if (!/^[6-9]/.test(local)) return warn('Indian mobile numbers start with 6, 7, 8 or 9');
  return OK;
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', '1234567890', 'qwerty123', 'iloveyou', 'india123', 'abcd1234',
]);

export function checkNewPassword(value: string): Check {
  if (value.length < LIMITS.passwordMin) return error(`Use at least ${LIMITS.passwordMin} characters`);
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return error('This password is too common');
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return warn('Stronger with both letters and numbers');
  return OK;
}

// ---------------------------------------------------------------- cards

export function luhnValid(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function checkCardNumber(value: string): Check {
  const digits = digitsOnly(value);
  if (!digits) return error('Card number is required');
  if (digits.length < 12 || digits.length > 19) return warn('Card numbers have 12 to 19 digits');
  if (!luhnValid(digits)) return warn('One digit may be mistyped. Please look again');
  return OK;
}

/** "MM/YY" */
export function checkCardExpiry(value: string | undefined): Check {
  if (!value || !value.trim()) return OK;
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim());
  if (!match) return warn('Write the expiry as MM/YY');
  const month = Number(match[1]);
  if (month < 1 || month > 12) return warn('The month should be 01 to 12');
  return OK;
}

export function checkDayOfMonth(value: number | undefined, label: string): Check {
  if (value === undefined) return OK;
  if (!Number.isInteger(value) || value < 1 || value > 31) return error(`${label} should be a day from 1 to 31`);
  return OK;
}

// ---------------------------------------------------------------- files

export type AllowedFileKind = 'image' | 'pdf' | 'doc';

const EXTENSIONS: Record<string, AllowedFileKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', heic: 'image', heif: 'image', webp: 'image',
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', xls: 'doc', xlsx: 'doc', ppt: 'doc', pptx: 'doc', odt: 'doc', rtf: 'doc', txt: 'doc',
};

const MIME_KINDS: Record<string, AllowedFileKind> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/heic': 'image', 'image/heif': 'image', 'image/webp': 'image',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'application/vnd.ms-excel': 'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'doc',
  'application/vnd.ms-powerpoint': 'doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'doc',
  'application/vnd.oasis.opendocument.text': 'doc',
  'application/rtf': 'doc', 'text/rtf': 'doc', 'text/plain': 'doc',
};

/** The picker's MIME filter: every type we accept. */
export const ACCEPTED_MIME_TYPES = Object.keys(MIME_KINDS);

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Extension first (MIME types from pickers are often missing or generic), then MIME. */
export function fileKindOf(name: string, mime?: string): AllowedFileKind | null {
  return EXTENSIONS[extensionOf(name)] ?? (mime ? MIME_KINDS[mime.toLowerCase()] : undefined) ?? null;
}

export function checkFile(file: { name: string; size?: number; mime?: string } | null | undefined): Check {
  if (!file) return error('Add a photo or file');
  if (!fileKindOf(file.name, file.mime)) {
    return error('Use a photo (JPG, PNG, HEIC, WebP) or a document (PDF, Word, Excel, PowerPoint, ODT, RTF, TXT)');
  }
  if (file.size !== undefined && file.size > LIMITS.fileBytes) {
    return error(`This file is ${formatBytes(file.size)}. The limit is 10 MB`);
  }
  return OK;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
