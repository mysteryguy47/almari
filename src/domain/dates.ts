/**
 * Small, dependency-free date helpers. All calendar maths happens on plain
 * year/month/day numbers through Date.UTC, so results never depend on the
 * phone's time zone or daylight saving.
 */

export interface YMD {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

const DAY_MS = 86_400_000;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Parses "2026-11-10" (or "2026-11-10T18:00"). Returns null for anything else, including year-only. */
export function parseISODate(value: string | undefined | null): YMD | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function toISODate({ y, m, d }: YMD): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function ymdFromDate(date: Date): YMD {
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() };
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(ymdFromDate(now));
}

function utc({ y, m, d }: YMD): number {
  return Date.UTC(y, m - 1, d);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: YMD, b: YMD): number {
  return Math.round((utc(b) - utc(a)) / DAY_MS);
}

export function addDays(date: YMD, days: number): YMD {
  const t = new Date(utc(date) + days * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Adds months, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: YMD, months: number): YMD {
  const index = date.y * 12 + (date.m - 1) + months;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

/** Days from today until an ISO date; null when the date is missing or invalid. */
export function daysUntil(iso: string | undefined, now: Date = new Date()): number | null {
  const target = parseISODate(iso);
  if (!target) return null;
  return daysBetween(ymdFromDate(now), target);
}

/** A date of birth may be a full date or a year only ("1944"). */
export function parseDob(dob: string | undefined): { ymd?: YMD; year?: number; approximate: boolean } | null {
  if (!dob) return null;
  const full = parseISODate(dob);
  if (full) return { ymd: full, year: full.y, approximate: false };
  if (/^\d{4}$/.test(dob.trim())) return { year: Number(dob.trim()), approximate: true };
  return null;
}

/** Age in completed years. Year-only birth dates give an approximate age. */
export function ageFrom(dob: string | undefined, now: Date = new Date()): { years: number; approximate: boolean } | null {
  const parsed = parseDob(dob);
  if (!parsed) return null;
  const today = ymdFromDate(now);
  if (parsed.ymd) {
    let years = today.y - parsed.ymd.y;
    if (today.m < parsed.ymd.m || (today.m === parsed.ymd.m && today.d < parsed.ymd.d)) years -= 1;
    return years >= 0 ? { years, approximate: false } : null;
  }
  const years = today.y - (parsed.year as number);
  return years >= 0 ? { years, approximate: true } : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Nov 2026"; "1944 (approx.)" for year-only values. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const ymd = parseISODate(iso);
  if (ymd) return `${ymd.d} ${MONTHS[ymd.m - 1]} ${ymd.y}`;
  if (/^\d{4}$/.test(iso.trim())) return `${iso.trim()} (approx.)`;
  return iso;
}

/** "12 Dec" — the short form used on rubber-stamp labels. */
export function formatShort(iso: string | undefined): string {
  const ymd = parseISODate(iso);
  return ymd ? `${ymd.d} ${MONTHS[ymd.m - 1]}` : '';
}

/** "Fri 14 Nov, 6:00 pm" for a local "2026-11-14T18:00". */
export function formatDateTime(isoDateTime: string | undefined): string {
  const ymd = parseISODate(isoDateTime);
  if (!ymd || !isoDateTime) return '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(utc(ymd)).getUTCDay()];
  const time = /T(\d{2}):(\d{2})/.exec(isoDateTime);
  let suffix = '';
  if (time) {
    const h = Number(time[1]);
    const min = time[2];
    const h12 = h % 12 === 0 ? 12 : h % 12;
    suffix = `, ${h12}:${min} ${h < 12 ? 'am' : 'pm'}`;
  }
  return `${weekday} ${ymd.d} ${MONTHS[ymd.m - 1]}${suffix}`;
}

/** Human phrasing for a day count: "today", "tomorrow", "in 12 days", "3 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 1) return `in ${days} days`;
  return `${-days} days ago`;
}
