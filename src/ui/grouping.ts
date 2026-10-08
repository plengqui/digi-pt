import type { Exercise, GroupId } from '../types';
import { GROUP_ORDER, groupRank } from '../config/groups';

export interface Grouped<T> {
  group: GroupId;
  items: T[];
}

/** Groups items by a group id, in config order (kardio first when `cardioFirst`). */
export function groupBy<T>(items: T[], groupOf: (item: T) => GroupId, cardioFirst = true): Grouped<T>[] {
  const map = new Map<GroupId, T[]>();
  for (const item of items) {
    const g = groupOf(item);
    const list = map.get(g);
    if (list) list.push(item);
    else map.set(g, [item]);
  }
  const order = cardioFirst ? ['kardio' as GroupId, ...GROUP_ORDER.filter((g) => g !== 'kardio')] : GROUP_ORDER;
  return order.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g) ?? [] }));
}

/** Primary group used for display: kardio for cardio, else the first primary in config order. */
export function displayGroup(ex: Exercise): GroupId {
  if (ex.type === 'kardio') return 'kardio';
  const sorted = [...ex.primary].sort((a, b) => groupRank(a) - groupRank(b));
  return sorted[0] ?? 'kardio';
}

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}
