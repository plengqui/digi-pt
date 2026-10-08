import type { Exercise, GroupId } from '../types';
import { GROUP_ORDER, groupRank } from '../config/groups';
import { MAX_HINTS } from '../config/constants';
import { groupsWithExercises, type GroupStatus } from './status';

export interface Hint {
  group: GroupId;
  neverTrained: boolean;
  daysSince?: number;
}

/** Up to MAX_HINTS overdue groups with at least one active exercise, most urgent first. */
export function computeHints(statuses: Record<GroupId, GroupStatus>, exercises: Exercise[]): Hint[] {
  const available = groupsWithExercises(exercises);
  const overdue = GROUP_ORDER.filter((g) => available.has(g) && statuses[g].overdue);
  overdue.sort((a, b) => {
    const ua = statuses[a].urgency;
    const ub = statuses[b].urgency;
    if (ua !== ub) return ub - ua;
    return groupRank(a) - groupRank(b);
  });
  return overdue.slice(0, MAX_HINTS).map((g) => ({
    group: g,
    neverTrained: statuses[g].daysSince === undefined,
    daysSince: statuses[g].daysSince,
  }));
}
