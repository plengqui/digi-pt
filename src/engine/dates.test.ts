import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isDateString, todayLocal, weekdayIndex } from './dates';

describe('dates', () => {
  it('computes whole-day differences across DST changes', () => {
    // Sweden: DST starts 2026-03-29 and ends 2026-10-25.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('handles month and year ends', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2); // leap year
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('is signed', () => {
    expect(daysBetween('2026-05-10', '2026-05-01')).toBe(-9);
  });

  it('validates date strings', () => {
    expect(isDateString('2026-02-29')).toBe(false);
    expect(isDateString('2024-02-29')).toBe(true);
    expect(isDateString('2026-1-1')).toBe(false);
    expect(isDateString(42)).toBe(false);
  });

  it('formats local dates', () => {
    expect(todayLocal(new Date(2026, 9, 8, 23, 59))).toBe('2026-10-08');
    expect(todayLocal(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('knows weekdays', () => {
    expect(weekdayIndex('2026-10-05')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-11')).toBe(6); // Sunday
  });
});
