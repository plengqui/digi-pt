import type { DateString, Exercise, GroupId, Session, SessionShape, Settings } from '../types';
import { STRENGTH_GROUPS, groupRank } from '../config/groups';
import { allGroupStatus, groupsWithExercises, lastDoneByExercise, type GroupStatus } from './status';
import { hashString } from './random';

export interface SuggestInput {
  today: DateString;
  sessions: Session[];
  exercises: Exercise[];
  settings: Settings;
  /** Number of strength exercises wanted (cardio comes on top). */
  count: number;
  cardio: boolean;
  seed: number;
  /** Explicit group choice; when given, only these groups are used. */
  groups?: GroupId[];
  shape?: SessionShape;
  /** Exercise ids already in today's session; never suggested again. */
  excludeExerciseIds?: string[];
}

export interface SuggestedItem {
  exerciseId: string;
  /** The group this exercise was picked for ('kardio' for the cardio item). */
  group: GroupId;
  shortRest: boolean;
}

export interface GroupReason {
  group: GroupId;
  neverTrained: boolean;
  daysSince?: number;
  shortRest: boolean;
}

export interface Suggestion {
  items: SuggestedItem[];
  groups: GroupReason[];
  cardioOn: boolean;
}

export interface RankedGroup {
  group: GroupId;
  status: GroupStatus;
}

/** Candidate strength groups ranked: rested by urgency desc, then resting most-rested first. */
export function rankGroups(statuses: Record<GroupId, GroupStatus>, available: Set<GroupId>): RankedGroup[] {
  const cands = STRENGTH_GROUPS.filter((g) => available.has(g)).map((g) => ({ group: g, status: statuses[g] }));
  const rested = cands.filter((c) => !c.status.resting);
  const resting = cands.filter((c) => c.status.resting);
  rested.sort((a, b) => {
    if (a.status.urgency !== b.status.urgency) return b.status.urgency - a.status.urgency;
    return groupRank(a.group) - groupRank(b.group);
  });
  resting.sort((a, b) => {
    const da = a.status.daysSince ?? 0;
    const db = b.status.daysSince ?? 0;
    if (da !== db) return db - da;
    return groupRank(a.group) - groupRank(b.group);
  });
  return [...rested, ...resting];
}

export function cardioDefault(statuses: Record<GroupId, GroupStatus>, exercises: Exercise[]): boolean {
  const hasCardio = exercises.some((e) => !e.archived && e.type === 'kardio');
  return hasCardio && statuses.kardio.urgency >= 1;
}

function compareLastDone(la: DateString | undefined, lb: DateString | undefined): number {
  if (la === undefined && lb !== undefined) return -1;
  if (la !== undefined && lb === undefined) return 1;
  if (la !== undefined && lb !== undefined && la !== lb) return la < lb ? -1 : 1;
  return 0;
}

/** Ordered candidate exercises for a group: other primaries rested first, least recently done, seed tiebreak. */
export function rankCandidates(
  group: GroupId,
  exercises: Exercise[],
  statuses: Record<GroupId, GroupStatus>,
  lastDone: Record<string, DateString>,
  seed: number,
  exclude: Set<string>,
): Exercise[] {
  const cands = exercises.filter(
    (e) => !e.archived && e.type === 'styrka' && e.primary.includes(group) && !exclude.has(e.id),
  );
  const othersResting = (e: Exercise) => (e.primary.some((g) => g !== group && statuses[g].resting) ? 1 : 0);
  cands.sort((a, b) => {
    const ra = othersResting(a);
    const rb = othersResting(b);
    if (ra !== rb) return ra - rb;
    const c = compareLastDone(lastDone[a.id], lastDone[b.id]);
    if (c !== 0) return c;
    return hashString(seed, a.id) - hashString(seed, b.id);
  });
  return cands;
}

export function rankCardioCandidates(
  exercises: Exercise[],
  lastDone: Record<string, DateString>,
  seed: number,
  exclude: Set<string>,
): Exercise[] {
  const cands = exercises.filter((e) => !e.archived && e.type === 'kardio' && !exclude.has(e.id));
  cands.sort((a, b) => {
    const c = compareLastDone(lastDone[a.id], lastDone[b.id]);
    if (c !== 0) return c;
    return hashString(seed, a.id) - hashString(seed, b.id);
  });
  return cands;
}

/** Split `total` slots over `n` groups as evenly as possible, extras to the first (higher ranked). */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export function suggestSession(input: SuggestInput): Suggestion {
  const { today, sessions, exercises, settings, seed } = input;
  const shape = input.shape ?? settings.shape;
  const count = Math.max(0, input.count);
  const statuses = allGroupStatus(today, sessions, exercises, settings);
  const lastDone = lastDoneByExercise(sessions, today);
  const available = groupsWithExercises(exercises);
  const ranked = rankGroups(statuses, available);
  const exclude = new Set(input.excludeExerciseIds ?? []);
  const picked: SuggestedItem[] = [];
  const perGroup = new Map<GroupId, Exercise[]>();

  const candidatesFor = (g: GroupId): Exercise[] => {
    let list = perGroup.get(g);
    if (!list) {
      list = rankCandidates(g, exercises, statuses, lastDone, seed, exclude);
      perGroup.set(g, list);
    }
    return list;
  };
  const takeFrom = (g: GroupId): boolean => {
    const next = candidatesFor(g).find((e) => !exclude.has(e.id));
    if (!next) return false;
    exclude.add(next.id);
    picked.push({ exerciseId: next.id, group: g, shortRest: statuses[g].resting });
    return true;
  };

  // Choose groups.
  let chosen: GroupId[];
  let pool: GroupId[]; // groups that may be added when the chosen ones cannot fill the session
  if (input.groups && input.groups.length > 0) {
    const set = new Set(input.groups);
    chosen = ranked.filter((r) => set.has(r.group)).map((r) => r.group);
    pool = [];
  } else {
    const rested = ranked.filter((r) => !r.status.resting).map((r) => r.group);
    const resting = ranked.filter((r) => r.status.resting).map((r) => r.group);
    const n = shape === 'fokus' ? settings.groupsPerSession : Math.max(1, count);
    chosen = rested.slice(0, n);
    pool = [...rested.slice(n), ...resting];
  }

  const fill = () => {
    if (chosen.length === 0) return;
    if (shape === 'fokus') {
      const shares = splitEvenly(count - picked.length, chosen.length);
      chosen.forEach((g, i) => {
        for (let k = 0; k < (shares[i] ?? 0); k++) {
          if (!takeFrom(g)) break;
        }
      });
    }
    // Helkropp: round robin. Fokus: the same loop hands any remainder to groups with spare candidates.
    let progress = true;
    while (picked.length < count && progress) {
      progress = false;
      for (const g of chosen) {
        if (picked.length >= count) break;
        if (takeFrom(g)) progress = true;
      }
    }
  };

  fill();
  while (picked.length < count && pool.length > 0) {
    const next = pool.shift() as GroupId;
    chosen = [...chosen, next];
    fill();
  }
  // Never return an empty list while the library has usable exercises.
  if (picked.length === 0 && count > 0) {
    for (const r of ranked) {
      if (takeFrom(r.group)) break;
    }
  }

  // Keep groups together, in chosen order.
  const order = new Map(chosen.map((g, i) => [g, i]));
  picked.sort((a, b) => (order.get(a.group) ?? 99) - (order.get(b.group) ?? 99));

  const items: SuggestedItem[] = [];
  if (input.cardio) {
    const c = rankCardioCandidates(exercises, lastDone, seed, exclude)[0];
    if (c) items.push({ exerciseId: c.id, group: 'kardio', shortRest: false });
  }
  items.push(...picked);

  const usedGroups = Array.from(new Set(picked.map((p) => p.group)));
  const groups: GroupReason[] = usedGroups.map((g) => {
    const st = statuses[g];
    return { group: g, neverTrained: st.daysSince === undefined, daysSince: st.daysSince, shortRest: st.resting };
  });

  return { items, groups, cardioOn: input.cardio };
}

/** Next candidate in the same group that is not already used; undefined when none. */
export function swapCandidate(
  input: SuggestInput,
  group: GroupId,
  currentExerciseId: string,
  usedExerciseIds: string[],
): Exercise | undefined {
  const statuses = allGroupStatus(input.today, input.sessions, input.exercises, input.settings);
  const lastDone = lastDoneByExercise(input.sessions, input.today);
  const exclude = new Set<string>([...usedExerciseIds, ...(input.excludeExerciseIds ?? [])]);
  exclude.delete(currentExerciseId);
  const list =
    group === 'kardio'
      ? rankCardioCandidates(input.exercises, lastDone, input.seed, exclude)
      : rankCandidates(group, input.exercises, statuses, lastDone, input.seed, exclude);
  if (list.length <= 1) return undefined;
  const idx = list.findIndex((e) => e.id === currentExerciseId);
  return list[(idx + 1) % list.length];
}
