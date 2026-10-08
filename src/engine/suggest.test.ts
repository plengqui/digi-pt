import { describe, expect, it } from 'vitest';
import type { Exercise, GroupId, Session } from '../types';
import { STRENGTH_GROUPS } from '../config/groups';
import { targetInterval } from '../config/constants';
import { addDays } from './dates';
import { allGroupStatus } from './status';
import { cardioDefault, splitEvenly, suggestSession, swapCandidate } from './suggest';
import { ex, fullLibrary, makeSettings, session } from './fixtures';

const byId = (lib: Exercise[]) => new Map(lib.map((e) => [e.id, e]));

describe('splitEvenly', () => {
  it('splits with extras first', () => {
    expect(splitEvenly(8, 3)).toEqual([3, 3, 2]);
    expect(splitEvenly(4, 4)).toEqual([1, 1, 1, 1]);
    expect(splitEvenly(5, 0)).toEqual([]);
  });
});

describe('suggestSession', () => {
  const settings = makeSettings();
  const lib = fullLibrary(4);

  it('fokus picks groupsPerSession rested groups and splits the count evenly', () => {
    const s = suggestSession({ today: '2026-10-08', sessions: [], exercises: lib, settings, count: 8, cardio: false, seed: 1 });
    expect(s.items).toHaveLength(8);
    const groups = new Set(s.items.map((i) => i.group));
    expect(groups.size).toBe(3);
    expect(s.items.every((i) => !i.shortRest)).toBe(true);
    expect(s.groups.every((g) => g.neverTrained)).toBe(true);
    // Never-trained groups tie; config order decides.
    expect([...groups]).toEqual(['vader', 'lar', 'rumpa']);
  });

  it('helkropp spreads one per group', () => {
    const s = suggestSession({
      today: '2026-10-08',
      sessions: [],
      exercises: lib,
      settings: makeSettings({ shape: 'helkropp' }),
      count: 8,
      cardio: false,
      seed: 1,
    });
    expect(s.items).toHaveLength(8);
    expect(new Set(s.items.map((i) => i.group)).size).toBe(8);
  });

  it('with two rested groups that can fill the session, no resting group is added', () => {
    const smallLib = [
      ...['a', 'b', 'c', 'd'].map((n) => ex(`rygg-${n}`, ['rygg'])),
      ...['a', 'b', 'c', 'd'].map((n) => ex(`brost-${n}`, ['brost'])),
      ...['a', 'b'].map((n) => ex(`lar-${n}`, ['lar'])),
    ];
    const sessions = [session('2026-10-07', ['lar-a'])]; // lår resting
    const s = suggestSession({ today: '2026-10-08', sessions, exercises: smallLib, settings, count: 8, cardio: false, seed: 1 });
    expect(s.items).toHaveLength(8);
    expect(s.items.some((i) => i.group === 'lar')).toBe(false);
    expect(s.items.every((i) => !i.shortRest)).toBe(true);
  });

  it('with nothing rested, still returns a suggestion from the most rested groups flagged shortRest', () => {
    // Train everything over the last 4 days so every group is resting.
    const sessions: Session[] = [
      session('2026-10-07', ['vader-1', 'lar-1', 'rumpa-1']),
      session('2026-10-06', ['rygg-1', 'skuldror-1', 'axlar-1', 'mage-1']),
      session('2026-10-05', ['biceps-1', 'triceps-1', 'brost-1']),
    ];
    const s = suggestSession({ today: '2026-10-08', sessions, exercises: lib, settings, count: 8, cardio: false, seed: 1 });
    expect(s.items.length).toBeGreaterThan(0);
    expect(s.items.every((i) => i.shortRest)).toBe(true);
    // Most rested first: trained 2026-10-05 (3 days) ranks before 2026-10-06 (2 days).
    expect(s.items[0]?.group).toBe('biceps');
    expect(s.groups.find((g) => g.group === 'biceps')).toMatchObject({ shortRest: true, daysSince: 3 });
  });

  it('mage is available after 2 days while other groups still rest', () => {
    // Everything trained 3 days ago: only mage (rest 2) is rested.
    const sessions: Session[] = [session('2026-10-05', STRENGTH_GROUPS.map((g) => `${g}-1`))];
    const s = suggestSession({ today: '2026-10-08', sessions, exercises: lib, settings, count: 8, cardio: false, seed: 1 });
    const mage = s.items.filter((i) => i.group === 'mage');
    expect(mage.length).toBe(4); // all mage exercises used before resting groups are added
    expect(mage.every((i) => !i.shortRest)).toBe(true);
    expect(s.items[0]?.group).toBe('mage');
    expect(s.items.filter((i) => i.group !== 'mage').every((i) => i.shortRest)).toBe(true);
  });

  it('a never-trained group ranks first', () => {
    const sessions: Session[] = STRENGTH_GROUPS.filter((g) => g !== 'triceps').map((g, i) =>
      session(addDays('2026-09-01', i), [`${g}-1`]),
    );
    const s = suggestSession({ today: '2026-10-08', sessions, exercises: lib, settings, count: 8, cardio: false, seed: 1 });
    expect(s.items[0]?.group).toBe('triceps');
  });

  it('ranks rested groups by urgency (days since / target)', () => {
    const settings2 = makeSettings();
    settings2.frequency.vader = 'sallan'; // 14
    settings2.frequency.brost = 'ofta'; // 5
    const sessions: Session[] = STRENGTH_GROUPS.map((g) => session('2026-09-20', [`${g}-1`])); // all 18 days ago
    const s = suggestSession({ today: '2026-10-08', sessions, exercises: lib, settings: settings2, count: 8, cardio: false, seed: 1 });
    const order = Array.from(new Set(s.items.map((i) => i.group)));
    expect(order[0]).toBe('brost');
    expect(order).not.toContain('vader');
  });

  it('never suggests exercises already in today\'s session', () => {
    const s = suggestSession({
      today: '2026-10-08',
      sessions: [],
      exercises: lib,
      settings,
      count: 8,
      cardio: false,
      seed: 1,
      excludeExerciseIds: ['vader-1', 'vader-2', 'vader-3', 'vader-4'],
    });
    expect(s.items.some((i) => i.exerciseId.startsWith('vader'))).toBe(false);
    expect(s.items).toHaveLength(8);
  });

  it('gives remainder to other groups when one group cannot fill its share', () => {
    const smallLib = [ex('vader-1', ['vader']), ...fullLibrary(4).filter((e) => !e.id.startsWith('vader'))];
    const s = suggestSession({ today: '2026-10-08', sessions: [], exercises: smallLib, settings, count: 8, cardio: false, seed: 1 });
    expect(s.items).toHaveLength(8);
    expect(s.items.filter((i) => i.group === 'vader')).toHaveLength(1);
  });

  it('prefers least recently done exercises, never done first', () => {
    const sessions = [session('2026-09-01', ['vader-1', 'vader-2']), session('2026-09-20', ['vader-3'])];
    const s = suggestSession({ today: '2026-10-08', sessions, exercises: lib, settings, count: 8, cardio: false, seed: 7, groups: ['vader'] });
    const ids = s.items.map((i) => i.exerciseId);
    expect(ids[0]).toBe('vader-4');
    expect(new Set(ids.slice(1, 3))).toEqual(new Set(['vader-1', 'vader-2']));
    expect(ids[3]).toBe('vader-3');
  });

  it('is deterministic for a seed and changes with the seed', () => {
    const run = (seed: number) =>
      suggestSession({ today: '2026-10-08', sessions: [], exercises: fullLibrary(8), settings, count: 8, cardio: false, seed })
        .items.map((i) => i.exerciseId)
        .join(',');
    expect(run(1)).toBe(run(1));
    const variants = new Set([1, 2, 3, 4, 5, 6].map(run));
    expect(variants.size).toBeGreaterThan(1);
  });

  it('prepends cardio when on and defaults cardio on when urgency >= 1', () => {
    const st = allGroupStatus('2026-10-08', [], lib, settings);
    expect(cardioDefault(st, lib)).toBe(true);
    const s = suggestSession({ today: '2026-10-08', sessions: [], exercises: lib, settings, count: 8, cardio: true, seed: 1 });
    expect(s.items).toHaveLength(9);
    expect(s.items[0]?.group).toBe('kardio');
    const st2 = allGroupStatus('2026-10-08', [session('2026-10-07', ['cardio-1'])], lib, settings);
    expect(cardioDefault(st2, lib)).toBe(false); // 1/5
    expect(cardioDefault(st, lib.filter((e) => e.type !== 'kardio'))).toBe(false);
  });

  it('respects an explicit group choice including resting groups', () => {
    const sessions = [session('2026-10-07', ['rygg-1'])];
    const s = suggestSession({ today: '2026-10-08', sessions, exercises: lib, settings, count: 4, cardio: false, seed: 1, groups: ['rygg', 'brost'] });
    expect(new Set(s.items.map((i) => i.group))).toEqual(new Set(['rygg', 'brost']));
    expect(s.items.find((i) => i.group === 'rygg')?.shortRest).toBe(true);
  });

  it('returns an empty list only when the library has no usable exercises', () => {
    const s = suggestSession({ today: '2026-10-08', sessions: [], exercises: [], settings, count: 8, cardio: true, seed: 1 });
    expect(s.items).toEqual([]);
  });

  it('swaps to the next candidate in the same group', () => {
    const input = { today: '2026-10-08', sessions: [], exercises: lib, settings, count: 8, cardio: false, seed: 1 };
    const s = suggestSession(input);
    const first = s.items[0]!;
    const used = s.items.map((i) => i.exerciseId);
    const next = swapCandidate(input, first.group, first.exerciseId, used);
    expect(next).toBeDefined();
    expect(next!.primary).toContain(first.group);
    expect(used).not.toContain(next!.id);
  });
});

describe('12-week simulation', () => {
  const freq: Record<string, 'ofta' | 'ibland' | 'sallan'> = {
    vader: 'sallan',
    lar: 'ofta',
    rumpa: 'ofta',
    rygg: 'ibland',
    mage: 'ibland',
    skuldror: 'sallan',
    axlar: 'ibland',
    biceps: 'sallan',
    triceps: 'ibland',
    brost: 'ofta',
  };

  function simulate(groupsPerSession: number): Record<string, number> {
    const lib = fullLibrary(6);
    const settings = makeSettings({ shape: 'fokus', groupsPerSession, exercisesPerSession: 8 });
    for (const [g, f] of Object.entries(freq)) settings.frequency[g as GroupId] = f;
    const sessions: Session[] = [];
    const counts: Record<string, number> = {};
    const start = '2026-01-05'; // Monday
    const trainingDays = [0, 1, 3, 5]; // Mon, Tue, Thu, Sat: 4 sessions a week
    for (let week = 0; week < 12; week++) {
      for (const offset of trainingDays) {
        const date = addDays(start, week * 7 + offset);
        const s = suggestSession({ today: date, sessions, exercises: lib, settings, count: 8, cardio: false, seed: week * 10 + offset });
        expect(s.items.length).toBe(8);
        for (const g of new Set(s.items.map((i) => i.group))) counts[g] = (counts[g] ?? 0) + 1;
        sessions.push({
          date,
          updatedAt: `${date}T10:00:00.000Z`,
          entries: s.items.map((i) => ({ exerciseId: i.exerciseId, done: true, source: 'suggested' as const })),
        });
      }
    }
    expect(byId(lib).size).toBe(lib.length);
    return counts;
  }

  const avg = (counts: Record<string, number>, f: 'ofta' | 'ibland' | 'sallan') => {
    const gs = Object.keys(freq).filter((g) => freq[g] === f);
    return gs.reduce((a, g) => a + (counts[g] ?? 0), 0) / gs.length;
  };

  it('with 2 groups per session, groups are chosen roughly in inverse proportion to their target intervals', () => {
    // Demand at target rates is ~9 group-slots a week; 4 sessions x 2 groups supply 8, so priorities decide.
    const counts = simulate(2);
    expect(avg(counts, 'ofta')).toBeGreaterThan(avg(counts, 'ibland'));
    expect(avg(counts, 'ibland')).toBeGreaterThan(avg(counts, 'sallan'));
    // Target ratio ofta:sällan is 14:5 = 2.8; the 4-day rest cap keeps ofta a little below that.
    const ratio = avg(counts, 'ofta') / avg(counts, 'sallan');
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(3.5);
    expect(avg(counts, 'ibland') / avg(counts, 'sallan')).toBeGreaterThan(1.3);
    for (const g of Object.keys(freq)) expect(counts[g] ?? 0).toBeGreaterThanOrEqual(4);
    expect(targetInterval('lar', 'ofta')).toBe(5);
  });

  it('with 3 groups per session the rest rule caps frequent groups, but sällan groups are still trained least', () => {
    // 12 group-slots a week exceed the ~9 demanded, so surplus goes to the most urgent groups.
    const counts = simulate(3);
    expect(avg(counts, 'sallan')).toBeLessThan(avg(counts, 'ofta'));
    expect(avg(counts, 'sallan')).toBeLessThan(avg(counts, 'ibland'));
    // Nothing is trained more often than the rest rule allows (every 5th day at most).
    for (const g of Object.keys(freq)) expect(counts[g] ?? 0).toBeLessThanOrEqual(Math.ceil(84 / 5) + 1);
  });
});
