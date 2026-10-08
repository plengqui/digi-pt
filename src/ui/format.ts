import type { DateString } from '../types';
import { daysBetween, weekdayIndex } from '../engine/dates';
import { MONTHS, S, WEEKDAYS } from '../strings';

export function formatLongDate(date: DateString): string {
  const [, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[weekdayIndex(date)] ?? '';
  return S.format.date(capitalize(weekday), d ?? 0, MONTHS[(m ?? 1) - 1] ?? '');
}

export function formatShortDate(date: DateString): string {
  const [, m, d] = date.split('-').map(Number);
  return S.format.dateShort(d ?? 0, MONTHS[(m ?? 1) - 1] ?? '');
}

/** "Idag", "Igår", or "torsdag 8 oktober" (with year when not the current year). */
export function formatRelativeDate(date: DateString, today: DateString): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return S.common.today;
  if (diff === 1) return S.common.yesterday;
  const long = formatLongDate(date);
  return date.slice(0, 4) === today.slice(0, 4) ? long : `${long} ${date.slice(0, 4)}`;
}

export function formatDaysAgo(days: number | undefined): string {
  if (days === undefined) return S.common.neverDone;
  if (days === 0) return S.common.today;
  if (days === 1) return S.common.yesterday;
  return S.common.daysAgo(days);
}

export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
