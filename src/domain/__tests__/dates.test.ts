import {
  addDays, addMonths, ageFrom, daysUntil, formatDate, formatDateTime, parseISODate, relativeDays,
} from '../dates';
import { NOW } from './factory';

describe('dates', () => {
  it('parses ISO dates and rejects impossible ones', () => {
    expect(parseISODate('2026-02-29')).toBeNull();
    expect(parseISODate('2028-02-29')).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseISODate('1944')).toBeNull();
    expect(parseISODate('2026-11-14T18:00')).toEqual({ y: 2026, m: 11, d: 14 });
  });

  it('computes age in completed years', () => {
    expect(ageFrom('1966-05-02', NOW)).toEqual({ years: 60, approximate: false });
    expect(ageFrom('2000-11-11', NOW)).toEqual({ years: 25, approximate: false }); // birthday tomorrow
    expect(ageFrom('2000-11-10', NOW)).toEqual({ years: 26, approximate: false }); // birthday today
  });

  it('allows year-only birth dates, marked approximate', () => {
    expect(ageFrom('1944', NOW)).toEqual({ years: 82, approximate: true });
    expect(formatDate('1944')).toBe('1944 (approx.)');
  });

  it('adds months, clamping to short months and leap years', () => {
    expect(addMonths({ y: 2027, m: 1, d: 31 }, 1)).toEqual({ y: 2027, m: 2, d: 28 });
    expect(addMonths({ y: 2028, m: 1, d: 31 }, 1)).toEqual({ y: 2028, m: 2, d: 29 });
    expect(addMonths({ y: 2026, m: 11, d: 10 }, -9)).toEqual({ y: 2026, m: 2, d: 10 });
    expect(addDays({ y: 2026, m: 12, d: 31 }, 1)).toEqual({ y: 2027, m: 1, d: 1 });
  });

  it('counts days until a date', () => {
    expect(daysUntil('2026-11-10', NOW)).toBe(0);
    expect(daysUntil('2026-11-22', NOW)).toBe(12);
    expect(daysUntil('2026-11-07', NOW)).toBe(-3);
    expect(daysUntil(undefined, NOW)).toBeNull();
  });

  it('formats for people', () => {
    expect(formatDate('2026-11-10')).toBe('10 Nov 2026');
    expect(formatDateTime('2026-11-14T18:00')).toBe('Sat 14 Nov, 6:00 pm');
    expect(formatDateTime('2026-11-16T00:30')).toBe('Mon 16 Nov, 12:30 am');
    expect(relativeDays(0)).toBe('today');
    expect(relativeDays(12)).toBe('in 12 days');
    expect(relativeDays(-3)).toBe('3 days ago');
  });
});
