import type { DateString, Exercise, GroupId, Session, Settings } from '../types';
import { GROUP_ORDER } from '../config/groups';
import { HINT_FACTOR, targetInterval } from '../config/constants';
import { daysBetween } from './dates';

export type GroupState = 'aldrig' | 'vilar' | 'redo' | 'lange-sedan';

export interface GroupStatus {
  group: GroupId;
  lastTrained?: DateString;
  /** Whole days from lastTrained to today; undefined when never trained. */
  daysSince?: number;
  resting: boolean;
  /** daysSince / targetInterval; Infinity when never trained. */
  urgency: number;
  overdue: boolean;
  state: GroupState;
  restDays: number;
  targetInterval: number;
}

export type LastTrainedMap = Partial<Record<GroupId, DateString>>;
export type LastDoneMap = Record<string, DateString>;

export function exercisesById(exercises: Exercise[]): Map<string, Exercise> {
  return new Map(exercises.map((e) => [e.id, e]));
}

/** Latest date per exercise with a done entry. Unticked entries are ignored. */
export function lastDoneByExercise(sessions: Session[], upTo?: DateString): LastDoneMap {
  const out: LastDoneMap = {};
  for (const s of sessions) {
    if (upTo !== undefined && s.date > upTo) continue;
    for (const e of s.entries) {
      if (!e.done) continue;
      const prev = out[e.exerciseId];
      if (prev === undefined || s.date > prev) out[e.exerciseId] = s.date;
    }
  }
  return out;
}

/** Latest date per group with a done entry whose exercise has the group as primary. */
export function lastTrainedByGroup(sessions: Session[], exercises: Exercise[], upTo?: DateString): LastTrainedMap {
  const byId = exercisesById(exercises);
  const out: LastTrainedMap = {};
  for (const s of sessions) {
    if (upTo !== undefined && s.date > upTo) continue;
    for (const e of s.entries) {
      if (!e.done) continue;
      const ex = byId.get(e.exerciseId);
      if (!ex) continue;
      for (const g of ex.primary) {
        const prev = out[g];
        if (prev === undefined || s.date > prev) out[g] = s.date;
      }
    }
  }
  return out;
}

export function groupStatus(
  group: GroupId,
  today: DateString,
  lastTrained: LastTrainedMap,
  settings: Pick<Settings, 'frequency' | 'restDays' | 'firstUseDate'>,
): GroupStatus {
  const restDays = settings.restDays[group];
  const target = targetInterval(group, settings.frequency[group]);
  const last = lastTrained[group];
  if (last === undefined) {
    const sinceFirstUse = daysBetween(settings.firstUseDate, today);
    const overdue = sinceFirstUse >= HINT_FACTOR * target;
    return {
      group,
      resting: false,
      urgency: Number.POSITIVE_INFINITY,
      overdue,
      state: 'aldrig',
      restDays,
      targetInterval: target,
    };
  }
  const daysSince = daysBetween(last, today);
  const resting = daysSince >= 1 && daysSince <= restDays;
  const urgency = daysSince / target;
  const overdue = daysSince >= HINT_FACTOR * target;
  const state: GroupState = resting ? 'vilar' : overdue ? 'lange-sedan' : 'redo';
  return { group, lastTrained: last, daysSince, resting, urgency, overdue, state, restDays, targetInterval: target };
}

export function allGroupStatus(
  today: DateString,
  sessions: Session[],
  exercises: Exercise[],
  settings: Pick<Settings, 'frequency' | 'restDays' | 'firstUseDate'>,
): Record<GroupId, GroupStatus> {
  const last = lastTrainedByGroup(sessions, exercises, today);
  return Object.fromEntries(GROUP_ORDER.map((g) => [g, groupStatus(g, today, last, settings)])) as Record<
    GroupId,
    GroupStatus
  >;
}

/** Groups that have at least one active exercise with the group as primary. */
export function groupsWithExercises(exercises: Exercise[]): Set<GroupId> {
  const set = new Set<GroupId>();
  for (const e of exercises) {
    if (e.archived) continue;
    for (const g of e.primary) set.add(g);
  }
  return set;
}
