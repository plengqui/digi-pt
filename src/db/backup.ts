import type { Exercise, GroupId, Session, Settings } from '../types';
import { GROUP_ORDER } from '../config/groups';
import { SCHEMA_VERSION } from '../config/constants';
import { isDateString } from '../engine/dates';
import { db, mergeSettings, type DigitalPtDb } from './db';

export interface BackupFile {
  app: 'digital-pt';
  schemaVersion: number;
  exportedAt: string;
  exercises: Exercise[];
  sessions: Session[];
  settings: Settings;
}

export function backupFileName(date: string): string {
  return `digital-pt-${date}.json`;
}

export async function buildBackup(database: DigitalPtDb = db, now = new Date()): Promise<BackupFile> {
  const [exercises, sessions, settings] = await Promise.all([
    database.exercises.toArray(),
    database.sessions.toArray(),
    database.settings.get('settings'),
  ]);
  exercises.sort((a, b) => a.id.localeCompare(b.id));
  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return {
    app: 'digital-pt',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    exercises,
    sessions,
    settings: mergeSettings(settings ?? {}),
  };
}

export class BackupValidationError extends Error {}

const GROUPS = new Set<string>(GROUP_ORDER);
const isGroupList = (v: unknown): v is GroupId[] => Array.isArray(v) && v.every((g) => typeof g === 'string' && GROUPS.has(g));

/** Parses and validates a backup file. Applies migrations from older schema versions. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupValidationError('not json');
  }
  if (!raw || typeof raw !== 'object') throw new BackupValidationError('not an object');
  const obj = raw as Record<string, unknown>;
  if (obj.app !== 'digital-pt') throw new BackupValidationError('wrong app');
  const version = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 0;
  if (version > SCHEMA_VERSION) throw new BackupValidationError('newer schema');
  const migrated = migrate(obj, version);

  if (!Array.isArray(migrated.exercises)) throw new BackupValidationError('exercises');
  if (!Array.isArray(migrated.sessions)) throw new BackupValidationError('sessions');
  const exercises: Exercise[] = migrated.exercises.map((e: unknown, i: number) => {
    const x = e as Record<string, unknown>;
    if (typeof x.id !== 'string' || typeof x.name !== 'string') throw new BackupValidationError(`exercise ${i}`);
    if (x.type !== 'styrka' && x.type !== 'kardio') throw new BackupValidationError(`exercise ${i} type`);
    if (!isGroupList(x.primary) || !isGroupList(x.secondary ?? [])) throw new BackupValidationError(`exercise ${i} groups`);
    const out: Exercise = {
      id: x.id,
      name: x.name,
      type: x.type,
      primary: x.primary,
      secondary: (x.secondary as GroupId[] | undefined) ?? [],
      archived: Boolean(x.archived),
    };
    if (typeof x.nameEn === 'string') out.nameEn = x.nameEn;
    if (typeof x.description === 'string') out.description = x.description;
    if (typeof x.catalogId === 'string') out.catalogId = x.catalogId;
    return out;
  });
  const ids = new Set(exercises.map((e) => e.id));
  if (ids.size !== exercises.length) throw new BackupValidationError('duplicate exercise ids');

  const sessions: Session[] = migrated.sessions.map((s: unknown, i: number) => {
    const x = s as Record<string, unknown>;
    if (!isDateString(x.date)) throw new BackupValidationError(`session ${i} date`);
    if (!Array.isArray(x.entries)) throw new BackupValidationError(`session ${i} entries`);
    const entries = x.entries.map((en: unknown, j: number) => {
      const y = en as Record<string, unknown>;
      if (typeof y.exerciseId !== 'string') throw new BackupValidationError(`session ${i} entry ${j}`);
      return {
        exerciseId: y.exerciseId,
        done: Boolean(y.done),
        source: y.source === 'suggested' ? ('suggested' as const) : ('manual' as const),
      };
    });
    return { date: x.date, entries, updatedAt: typeof x.updatedAt === 'string' ? x.updatedAt : '' };
  });
  const dates = new Set(sessions.map((s) => s.date));
  if (dates.size !== sessions.length) throw new BackupValidationError('duplicate session dates');

  const settingsRaw = (migrated.settings ?? {}) as Record<string, unknown>;
  if (typeof settingsRaw !== 'object') throw new BackupValidationError('settings');
  const settings = mergeSettings(settingsRaw as Partial<Settings>);
  if (!isDateString(settings.firstUseDate)) throw new BackupValidationError('settings.firstUseDate');

  return {
    app: 'digital-pt',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof migrated.exportedAt === 'string' ? migrated.exportedAt : '',
    exercises,
    sessions,
    settings,
  };
}

/** Schema migrations, applied in order. Version 1 is the first release, so nothing to do yet. */
function migrate(obj: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  let data = obj;
  let v = fromVersion;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new BackupValidationError(`no migration from ${v}`);
    data = step(data);
    v++;
  }
  return data;
}

const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  // 0 -> 1: files without a version are treated as version 1 shaped.
  0: (d) => ({ ...d, schemaVersion: 1 }),
};

/** Replaces all data with the backup contents. */
export async function restoreBackup(backup: BackupFile, database: DigitalPtDb = db): Promise<void> {
  await database.transaction('rw', database.exercises, database.sessions, database.settings, async () => {
    await database.exercises.clear();
    await database.sessions.clear();
    await database.settings.clear();
    await database.exercises.bulkAdd(backup.exercises);
    await database.sessions.bulkAdd(backup.sessions);
    await database.settings.put({ ...backup.settings, id: 'settings', schemaVersion: SCHEMA_VERSION });
  });
}

/**
 * Whether to nudge: the last export (or, before any export, the first use) is older than `days`
 * and a session with done entries changed since.
 */
export function shouldNudgeExport(settings: Settings, sessions: Session[], now: Date, days: number): boolean {
  const logged = sessions.filter((s) => s.entries.some((e) => e.done));
  if (logged.length === 0) return false;
  const reference = settings.lastExportAt ?? `${settings.firstUseDate}T00:00:00.000Z`;
  const ageMs = now.getTime() - new Date(reference).getTime();
  if (ageMs < days * 86_400_000) return false;
  return logged.some((s) => s.updatedAt > reference);
}
