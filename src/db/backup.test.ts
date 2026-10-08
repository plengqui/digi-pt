import { beforeEach, describe, expect, it } from 'vitest';
import { DigitalPtDb, addEntry, addExercise, deleteOrArchiveExercise, ensureSettings, setEntryDone, updateSettings } from './db';
import { BackupValidationError, buildBackup, parseBackup, restoreBackup, shouldNudgeExport } from './backup';

let db: DigitalPtDb;
let n = 0;

beforeEach(async () => {
  db = new DigitalPtDb(`test-${++n}`);
  await ensureSettings(db);
});

async function seed() {
  const a = await addExercise({ name: 'Knäböj', nameEn: 'Squat', type: 'styrka', primary: ['lar', 'rumpa'], secondary: [], catalogId: 'squat' }, db);
  const b = await addExercise({ name: 'Löpband', type: 'kardio', primary: ['kardio'], secondary: [], description: 'x' }, db);
  await addEntry('2026-10-01', a.id, 'suggested', true, db);
  await addEntry('2026-10-01', b.id, 'manual', false, db);
  await addEntry('2026-10-03', b.id, 'manual', true, db);
  await updateSettings({ exercisesPerSession: 6, frequency: { ...(await ensureSettings(db)).frequency, lar: 'ofta' } }, db);
  return { a, b };
}

describe('backup round trip', () => {
  it('export, wipe, import gives identical state', async () => {
    await seed();
    const before = await buildBackup(db, new Date('2026-10-08T10:00:00Z'));
    const text = JSON.stringify(before);

    await db.exercises.clear();
    await db.sessions.clear();
    await db.settings.clear();
    expect(await db.exercises.count()).toBe(0);

    const parsed = parseBackup(text);
    await restoreBackup(parsed, db);
    const after = await buildBackup(db, new Date('2026-10-08T10:00:00Z'));
    expect(after).toEqual(before);
  });

  it('rejects invalid files', () => {
    expect(() => parseBackup('nope')).toThrow(BackupValidationError);
    expect(() => parseBackup('{}')).toThrow(BackupValidationError);
    expect(() => parseBackup(JSON.stringify({ app: 'digital-pt', schemaVersion: 99, exercises: [], sessions: [] }))).toThrow(
      BackupValidationError,
    );
    expect(() =>
      parseBackup(JSON.stringify({ app: 'digital-pt', schemaVersion: 1, exercises: [{ id: 'x' }], sessions: [] })),
    ).toThrow(BackupValidationError);
    expect(() =>
      parseBackup(
        JSON.stringify({
          app: 'digital-pt',
          schemaVersion: 1,
          exercises: [],
          sessions: [{ date: '2026-13-01', entries: [] }],
        }),
      ),
    ).toThrow(BackupValidationError);
  });

  it('fills missing settings with defaults', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'digital-pt', schemaVersion: 1, exercises: [], sessions: [], settings: { firstUseDate: '2026-01-01' } }));
    expect(parsed.settings.restDays.mage).toBe(2);
    expect(parsed.settings.frequency.rygg).toBe('ibland');
    expect(parsed.settings.firstUseDate).toBe('2026-01-01');
  });
});

describe('db helpers', () => {
  it('archives exercises that appear in history and deletes others', async () => {
    const { a, b } = await seed();
    expect(await deleteOrArchiveExercise(a.id, db)).toBe('archived');
    expect((await db.exercises.get(a.id))?.archived).toBe(true);
    const c = await addExercise({ name: 'Ny', type: 'styrka', primary: ['brost'], secondary: [] }, db);
    await addEntry('2026-10-05', c.id, 'manual', false, db);
    expect(await deleteOrArchiveExercise(c.id, db)).toBe('deleted');
    expect(await db.exercises.get(c.id)).toBeUndefined();
    expect(await db.sessions.get('2026-10-05')).toBeUndefined();
    expect(await deleteOrArchiveExercise(b.id, db)).toBe('archived');
  });

  it('toggles entries and keeps one session per date', async () => {
    const { a } = await seed();
    await setEntryDone('2026-10-01', a.id, false, db);
    const s = await db.sessions.get('2026-10-01');
    expect(s?.entries.find((e) => e.exerciseId === a.id)?.done).toBe(false);
    expect(await db.sessions.count()).toBe(2);
  });
});

describe('shouldNudgeExport', () => {
  const sessions = [{ date: '2026-10-01', entries: [], updatedAt: '2026-10-01T10:00:00.000Z' }];
  it('nudges when never exported and sessions exist', async () => {
    const settings = await ensureSettings(db);
    expect(shouldNudgeExport(settings, [], new Date(), 30)).toBe(false);
    expect(shouldNudgeExport(settings, sessions, new Date(), 30)).toBe(true);
  });
  it('nudges only when the export is old and something changed since', async () => {
    const settings = await updateSettings({ lastExportAt: '2026-09-01T00:00:00.000Z' }, db);
    expect(shouldNudgeExport(settings, sessions, new Date('2026-09-20T00:00:00Z'), 30)).toBe(false); // too recent
    expect(shouldNudgeExport(settings, sessions, new Date('2026-10-08T00:00:00Z'), 30)).toBe(true);
    const old = [{ date: '2026-08-01', entries: [], updatedAt: '2026-08-01T10:00:00.000Z' }];
    expect(shouldNudgeExport(settings, old, new Date('2026-10-08T00:00:00Z'), 30)).toBe(false);
  });
});
