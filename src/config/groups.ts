import type { GroupId } from '../types';

/** Fixed muscle-group list in display and tie-break order. */
export const GROUP_ORDER: GroupId[] = [
  'vader',
  'lar',
  'rumpa',
  'rygg',
  'mage',
  'skuldror',
  'axlar',
  'biceps',
  'triceps',
  'brost',
  'kardio',
];

export const STRENGTH_GROUPS: GroupId[] = GROUP_ORDER.filter((g) => g !== 'kardio');

export function isStrengthGroup(g: GroupId): boolean {
  return g !== 'kardio';
}

export function groupRank(g: GroupId): number {
  return GROUP_ORDER.indexOf(g);
}
