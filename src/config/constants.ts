import type { Frequency, GroupId } from '../types';
import { GROUP_ORDER } from './groups';

/** Days of rest after training a group. Strength groups rest 4 days, mage 2, kardio 0. */
export const DEFAULT_REST_DAYS: Record<GroupId, number> = {
  vader: 4,
  lar: 4,
  rumpa: 4,
  rygg: 4,
  mage: 2,
  skuldror: 4,
  axlar: 4,
  biceps: 4,
  triceps: 4,
  brost: 4,
  kardio: 0,
};

export const REST_DAYS_RANGE = { min: 0, max: 7 };

/** Target interval in days between sessions for a group, per frequency. */
export const TARGET_INTERVAL_STRENGTH: Record<Frequency, number> = { ofta: 5, ibland: 8, sallan: 14 };
export const TARGET_INTERVAL_CARDIO: Record<Frequency, number> = { ofta: 2, ibland: 5, sallan: 10 };

export function targetInterval(group: GroupId, frequency: Frequency): number {
  return group === 'kardio' ? TARGET_INTERVAL_CARDIO[frequency] : TARGET_INTERVAL_STRENGTH[frequency];
}

/** Hint when days since last trained >= HINT_FACTOR x target interval. */
export const HINT_FACTOR = 2;

export const EXERCISES_PER_SESSION = 8;
export const EXERCISES_PER_SESSION_RANGE = { min: 4, max: 12 };

export const GROUPS_PER_SESSION = 3;
export const GROUPS_PER_SESSION_RANGE = { min: 2, max: 4 };

export const MAX_HINTS = 3;

export const DEFAULT_FREQUENCY: Record<GroupId, Frequency> = Object.fromEntries(
  GROUP_ORDER.map((g) => [g, 'ibland' as Frequency]),
) as Record<GroupId, Frequency>;

export const SCHEMA_VERSION = 1;

/** Nudge to export when the last export is older than this and sessions were logged since. */
export const EXPORT_NUDGE_DAYS = 30;

export const MAX_CAPTURED_ERRORS = 20;
