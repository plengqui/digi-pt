import Dexie, { type EntityTable } from 'dexie';
import type { CapturedError, Exercise, Session, Settings } from '../types';
import { DEFAULT_FREQUENCY, DEFAULT_REST_DAYS, EXERCISES_PER_SESSION, GROUPS_PER_SESSION, SCHEMA_VERSION } from '../config/constants';
import { todayLocal } from '../engine/dates';

export class DigitalPtDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  sessions!: EntityTable<Session, 'date'>;
  settings!: EntityTable<Settings, 'id'>;
  errors!: EntityTable<CapturedError, 'id'>;

  constructor(name = 'digital-pt') {
    super(name);
    this.version(1).stores({
      exercises: 'id, type, archived, catalogId',
      sessions: 'date',
      settings: 'id',
      errors: '++id, at',
    });
  }
}

export const db = new DigitalPtDb();

export function defaultSettings(today = todayLocal()): Settings {
  return {
    id: 'settings',
    frequency: { ...DEFAULT_FREQUENCY },
    restDays: { ...DEFAULT_REST_DAYS },
    exercisesPerSession: EXERCISES_PER_SESSION,
    groupsPerSession: GROUPS_PER_SESSION,
    shape: 'fokus',
    firstUseDate: today,
    onboardingDone: false,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Loads settings, creating defaults on first run. Fills in any keys missing from older records. */
export async function ensureSettings(database: DigitalPtDb = db): Promise<Settings> {
  const existing = await database.settings.get('settings');
  if (existing) {
    const merged = mergeSettings(existing);
    if (JSON.stringify(merged) !== JSON.stringify(existing)) await database.settings.put(merged);
    return merged;
  }
  const fresh = defaultSettings();
  await database.settings.put(fresh);
  return fresh;
}

export function mergeSettings(partial: Partial<Settings>): Settings {
  const d = defaultSettings(partial.firstUseDate);
  return {
    ...d,
    ...partial,
    id: 'settings',
    frequency: { ...d.frequency, ...(partial.frequency ?? {}) },
    restDays: { ...d.restDays, ...(partial.restDays ?? {}) },
    schemaVersion: SCHEMA_VERSION,
  };
}

export async function updateSettings(patch: Partial<Settings>, database: DigitalPtDb = db): Promise<Settings> {
  const current = await ensureSettings(database);
  const next = mergeSettings({ ...current, ...patch });
  await database.settings.put(next);
  return next;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function addExercise(
  data: Omit<Exercise, 'id' | 'archived'> & { id?: string },
  database: DigitalPtDb = db,
): Promise<Exercise> {
  const exercise: Exercise = { ...data, id: data.id ?? newId(), archived: false };
  await database.exercises.put(exercise);
  return exercise;
}

export async function updateExercise(exercise: Exercise, database: DigitalPtDb = db): Promise<void> {
  await database.exercises.put(exercise);
}

/** Deletes an exercise, or archives it when it appears in history. Returns 'archived' or 'deleted'. */
export async function deleteOrArchiveExercise(id: string, database: DigitalPtDb = db): Promise<'archived' | 'deleted'> {
  return database.transaction('rw', database.exercises, database.sessions, async () => {
    const sessions = await database.sessions.toArray();
    const inHistory = sessions.some((s) => s.entries.some((e) => e.exerciseId === id && e.done));
    if (inHistory) {
      await database.exercises.update(id, { archived: true });
      return 'archived';
    }
    // Remove unticked plan entries referring to it, then delete.
    for (const s of sessions) {
      if (s.entries.some((e) => e.exerciseId === id)) {
        const entries = s.entries.filter((e) => e.exerciseId !== id);
        if (entries.length === 0) await database.sessions.delete(s.date);
        else await database.sessions.put({ ...s, entries, updatedAt: new Date().toISOString() });
      }
    }
    await database.exercises.delete(id);
    return 'deleted';
  });
}

export async function restoreExercise(id: string, database: DigitalPtDb = db): Promise<void> {
  await database.exercises.update(id, { archived: false });
}

/** Adds an entry to a session (creating the session), or does nothing if already present. */
export async function addEntry(
  date: string,
  exerciseId: string,
  source: Session['entries'][number]['source'],
  done: boolean,
  database: DigitalPtDb = db,
): Promise<void> {
  await database.transaction('rw', database.sessions, async () => {
    const s = (await database.sessions.get(date)) ?? { date, entries: [], updatedAt: '' };
    if (s.entries.some((e) => e.exerciseId === exerciseId)) {
      if (done) await setEntryDone(date, exerciseId, true, database);
      return;
    }
    s.entries.push({ exerciseId, source, done });
    s.updatedAt = new Date().toISOString();
    await database.sessions.put(s);
  });
}

export async function addEntries(
  date: string,
  exerciseIds: string[],
  source: Session['entries'][number]['source'],
  database: DigitalPtDb = db,
): Promise<void> {
  await database.transaction('rw', database.sessions, async () => {
    const s = (await database.sessions.get(date)) ?? { date, entries: [], updatedAt: '' };
    const have = new Set(s.entries.map((e) => e.exerciseId));
    for (const id of exerciseIds) {
      if (!have.has(id)) {
        s.entries.push({ exerciseId: id, source, done: false });
        have.add(id);
      }
    }
    s.updatedAt = new Date().toISOString();
    await database.sessions.put(s);
  });
}

export async function setEntryDone(date: string, exerciseId: string, done: boolean, database: DigitalPtDb = db): Promise<void> {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(date);
    if (!s) return;
    const entry = s.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) return;
    entry.done = done;
    s.updatedAt = new Date().toISOString();
    await database.sessions.put(s);
  });
}

export async function removeEntry(date: string, exerciseId: string, database: DigitalPtDb = db): Promise<void> {
  await database.transaction('rw', database.sessions, async () => {
    const s = await database.sessions.get(date);
    if (!s) return;
    const entries = s.entries.filter((e) => e.exerciseId !== exerciseId);
    if (entries.length === 0) await database.sessions.delete(date);
    else await database.sessions.put({ ...s, entries, updatedAt: new Date().toISOString() });
  });
}

export async function deleteSession(date: string, database: DigitalPtDb = db): Promise<void> {
  await database.sessions.delete(date);
}

export async function logError(message: string, stack?: string, database: DigitalPtDb = db): Promise<void> {
  try {
    await database.errors.add({ at: new Date().toISOString(), message, stack });
    const count = await database.errors.count();
    if (count > 20) {
      const oldest = await database.errors.orderBy('id').limit(count - 20).primaryKeys();
      await database.errors.bulkDelete(oldest);
    }
  } catch {
    // Diagnostics must never throw.
  }
}
