/**
 * Reading numbers from a scan. Text recognition (on the phone) produces raw
 * text; this finds the ID numbers and dates in it, forgiving the usual OCR
 * mix-ups (O for 0, I for 1, S for 5, B for 8) where the pattern makes the
 * intended character certain. The person always confirms before anything is saved.
 */
import { parseISODate, toISODate } from './dates';
import type { NumberKind } from './templates';
import { formatAadhaar, verhoeffValid } from './validation';

export interface Extracted {
  aadhaar: string[];
  pan: string[];
  passport: string[];
  voter: string[];
  dl: string[];
  ifsc: string[];
  vehicle: string[];
  dates: string[];
  dob?: string;
  yearOfBirth?: number;
}

const TO_DIGIT: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6', T: '7' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G', '7': 'T' };

/** Forces each position to a letter (L) or digit (D) where a common OCR swap makes it certain. */
function coerce(raw: string, shape: string): string | null {
  if (raw.length !== shape.length) return null;
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (shape[i] === 'D') {
      const d = /\d/.test(c) ? c : TO_DIGIT[c];
      if (!d) return null;
      out += d;
    } else {
      const l = /[A-Z]/.test(c) ? c : TO_LETTER[c];
      if (!l) return null;
      out += l;
    }
  }
  return out;
}

const uniq = (list: string[]) => Array.from(new Set(list));

function findDates(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) {
    const iso = toISODate({ y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) });
    if (parseISODate(iso)) out.push(iso);
  }
  return uniq(out);
}

export function extractFromText(raw: string): Extracted {
  const text = raw.replace(/\r/g, '');
  const upper = text.toUpperCase();
  const tokens = upper.split(/[^A-Z0-9]+/).filter(Boolean);

  // Aadhaar: 12 digits, often printed 4-4-4; real numbers never start with 0 or 1 and pass Verhoeff.
  // A run of digit groups is read as one number, so a 16-digit VID is never mistaken for an Aadhaar.
  const aadhaar: string[] = [];
  for (const m of text.matchAll(/\d+(?:[ \t]\d+)*/g)) {
    const digits = m[0].replace(/[ \t]/g, '');
    if (digits.length === 12 && /^[2-9]/.test(digits) && verhoeffValid(digits)) aadhaar.push(formatAadhaar(digits));
  }

  const pan: string[] = [];
  const passport: string[] = [];
  const voter: string[] = [];
  for (const t of tokens) {
    if (t.length === 10) {
      const p = coerce(t, 'LLLLLDDDDL');
      if (p && /^[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]$/.test(p)) pan.push(p);
      const v = coerce(t, 'LLLDDDDDDD');
      if (v && !p) voter.push(v);
    }
    if (t.length === 8) {
      const pp = coerce(t, 'LDDDDDDD');
      if (pp && /[0-9]/.test(t.slice(1))) passport.push(pp);
    }
  }

  const dl: string[] = [];
  for (const m of upper.matchAll(/\b([A-Z]{2})[ -]?(\d{2})[ -]?((?:19|20)\d{2})[ -]?(\d{7})\b/g)) dl.push(m[1] + m[2] + m[3] + m[4]);

  const ifsc = uniq([...upper.matchAll(/\b([A-Z]{4}0[A-Z0-9]{6})\b/g)].map((m) => m[1]));
  // Registration numbers: state, RTO (digits, sometimes with a letter: DL 3C), series, number.
  const vehicle = uniq([...upper.matchAll(/\b([A-Z]{2})[ -]?(\d{1,2}[A-Z]?)[ -]?([A-Z]{1,3})[ -]?(\d{4})\b/g)].map((m) => `${m[1]} ${m[2]} ${m[3]} ${m[4]}`));

  const dates = findDates(text);
  let dob: string | undefined;
  for (const line of text.split('\n')) {
    if (/(dob|d\.o\.b|date of birth|birth|जन्म)/i.test(line)) {
      const found = findDates(line);
      if (found[0]) {
        dob = found[0];
        break;
      }
    }
  }
  const yob = /(?:year of birth|yob|जन्म वर्ष)\D{0,6}((?:19|20)\d{2})/i.exec(text);

  return {
    aadhaar: uniq(aadhaar), pan: uniq(pan), passport: uniq(passport), voter: uniq(voter), dl: uniq(dl), ifsc, vehicle,
    dates, dob, yearOfBirth: yob ? Number(yob[1]) : undefined,
  };
}

export interface Suggestion {
  number?: string;
  expiryDate?: string;
  issueDate?: string;
  dob?: string;
}

/** The likeliest values for one template's fields. Expiry is the latest date; issue is the earliest that is not the birth date. */
export function suggestFor(kind: NumberKind | undefined, found: Extracted, hasExpiry: boolean): Suggestion {
  const pick: Record<string, string[]> = {
    aadhaar: found.aadhaar, pan: found.pan, passport: found.passport, voter: found.voter, dl: found.dl, ifsc: found.ifsc,
    vehicle: found.vehicle,
  };
  const number = kind ? pick[kind]?.[0] : undefined;
  const sorted = [...found.dates].filter((d) => d !== found.dob).sort();
  return {
    number,
    dob: found.dob,
    expiryDate: hasExpiry ? sorted[sorted.length - 1] : undefined,
    issueDate: sorted.length > 1 ? sorted[0] : undefined,
  };
}

export interface WordBox {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where to put the black bar on an Aadhaar image: over the first 8 digits of
 * the 12-digit number (as printed 4-4-4, or as one 12-digit word), padded a
 * little so no digit edge shows. Null when no valid Aadhaar is found; the
 * person then places the bar by hand.
 */
export function aadhaarMaskRect(words: WordBox[], pad = 0.15): Rect | null {
  const digits = words.map((w) => w.text.replace(/\D/g, ''));
  const grow = (x0: number, y0: number, x1: number, y1: number): Rect => {
    const h = y1 - y0;
    const p = Math.round(h * pad);
    return { x: Math.max(0, x0 - p), y: Math.max(0, y0 - p), width: x1 - x0 + 2 * p, height: h + 2 * p };
  };
  for (let i = 0; i < words.length; i++) {
    if (digits[i].length === 12 && /^[2-9]/.test(digits[i]) && verhoeffValid(digits[i])) {
      const b = words[i].bbox;
      return grow(b.x0, b.y0, b.x0 + ((b.x1 - b.x0) * 8) / 12, b.y1);
    }
    if (i + 2 < words.length && digits[i].length === 4 && digits[i + 1].length === 4 && digits[i + 2].length === 4) {
      const all = digits[i] + digits[i + 1] + digits[i + 2];
      if (/^[2-9]/.test(all) && verhoeffValid(all)) {
        const a = words[i].bbox;
        const b = words[i + 1].bbox;
        return grow(Math.min(a.x0, b.x0), Math.min(a.y0, b.y0), Math.max(a.x1, b.x1), Math.max(a.y1, b.y1));
      }
    }
  }
  return null;
}
