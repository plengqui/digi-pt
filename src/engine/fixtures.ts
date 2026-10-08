import type { Exercise, GroupId, Session, Settings } from '../types';
import { DEFAULT_FREQUENCY, DEFAULT_REST_DAYS, SCHEMA_VERSION } from '../config/constants';

export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 'settings',
    frequency: { ...DEFAULT_FREQUENCY },
    restDays: { ...DEFAULT_REST_DAYS },
    exercisesPerSession: 8,
    groupsPerSession: 3,
    shape: 'fokus',
    firstUseDate: '2026-01-01',
    onboardingDone: true,
    schemaVersion: SCHEMA_VERSION,
    ...overrides,
  };
}

export function ex(id: string, primary: GroupId[], extra: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: id,
    type: primary[0] === 'kardio' ? 'kardio' : 'styrka',
    primary,
    secondary: [],
    archived: false,
    ...extra,
  };
}

export function session(date: string, doneIds: string[], plannedIds: string[] = []): Session {
  return {
    date,
    updatedAt: `${date}T12:00:00.000Z`,
    entries: [
      ...doneIds.map((exerciseId) => ({ exerciseId, done: true, source: 'manual' as const })),
      ...plannedIds.map((exerciseId) => ({ exerciseId, done: false, source: 'suggested' as const })),
    ],
  };
}

/** A library with several exercises per strength group plus two cardio exercises. */
export function fullLibrary(perGroup = 4): Exercise[] {
  const groups: GroupId[] = ['vader', 'lar', 'rumpa', 'rygg', 'mage', 'skuldror', 'axlar', 'biceps', 'triceps', 'brost'];
  const out: Exercise[] = [];
  for (const g of groups) {
    for (let i = 1; i <= perGroup; i++) out.push(ex(`${g}-${i}`, [g]));
  }
  out.push(ex('cardio-1', ['kardio']), ex('cardio-2', ['kardio']));
  return out;
}
