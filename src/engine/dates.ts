import type { DateString } from '../types';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateString(s: unknown): s is DateString {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Whole days since 1970-01-01 for a calendar date, computed in UTC so DST never matters. */
export function toDayNumber(date: DateString): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid date string: ${date}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

export function fromDayNumber(day: number): DateString {
  const dt = new Date(day * 86_400_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Signed whole-day difference `to - from`. */
export function daysBetween(from: DateString, to: DateString): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function addDays(date: DateString, days: number): DateString {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Local calendar date for a Date instance (defaults to now). */
export function todayLocal(now: Date = new Date()): DateString {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function compareDates(a: DateString, b: DateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(date: DateString): number {
  // 1970-01-01 was a Thursday (index 3).
  return (((toDayNumber(date) + 3) % 7) + 7) % 7;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
