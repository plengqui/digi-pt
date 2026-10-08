import { describe, expect, it } from 'vitest';
import { allGroupStatus, groupStatus, lastTrainedByGroup } from './status';
import { computeHints } from './hints';
import { ex, fullLibrary, makeSettings, session } from './fixtures';

describe('resting', () => {
  const lib = [ex('row', ['rygg']), ex('curl', ['biceps'], { secondary: ['rygg'] })];
  const settings = makeSettings();

  it('rygg trained on a Monday rests Tuesday to Friday and is available Saturday', () => {
    const sessions = [session('2026-10-05', ['row'])]; // Monday
    const last = lastTrainedByGroup(sessions, lib);
    expect(groupStatus('rygg', '2026-10-05', last, settings).resting).toBe(false); // same day
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      expect(groupStatus('rygg', d, last, settings).resting).toBe(true);
    }
    expect(groupStatus('rygg', '2026-10-10', last, settings).resting).toBe(false); // Saturday
    expect(groupStatus('rygg', '2026-10-10', last, settings).daysSince).toBe(5);
  });

  it('mage rests only 2 days by default', () => {
    const sessions = [session('2026-10-05', ['plank'])];
    const last = lastTrainedByGroup(sessions, [ex('plank', ['mage'])]);
    expect(groupStatus('mage', '2026-10-07', last, settings).resting).toBe(true);
    expect(groupStatus('mage', '2026-10-08', last, settings).resting).toBe(false);
  });

  it('kardio never rests', () => {
    const sessions = [session('2026-10-05', ['run'])];
    const last = lastTrainedByGroup(sessions, [ex('run', ['kardio'])]);
    expect(groupStatus('kardio', '2026-10-06', last, settings).resting).toBe(false);
  });

  it('ignores unticked planned entries', () => {
    const sessions = [session('2026-10-05', [], ['row'])];
    const last = lastTrainedByGroup(sessions, lib);
    expect(last.rygg).toBeUndefined();
    expect(groupStatus('rygg', '2026-10-06', last, settings).state).toBe('aldrig');
  });

  it('secondary groups never affect resting state or urgency', () => {
    const sessions = [session('2026-10-05', ['curl'])];
    const last = lastTrainedByGroup(sessions, lib);
    expect(last.rygg).toBeUndefined();
    expect(last.biceps).toBe('2026-10-05');
    const st = groupStatus('rygg', '2026-10-06', last, settings);
    expect(st.resting).toBe(false);
    expect(st.urgency).toBe(Number.POSITIVE_INFINITY);
  });

  it('ignores sessions after today', () => {
    const sessions = [session('2026-10-20', ['row'])];
    const st = allGroupStatus('2026-10-10', sessions, lib, settings);
    expect(st.rygg.state).toBe('aldrig');
  });
});

describe('urgency and hints', () => {
  it('is daysSince / target interval', () => {
    const settings = makeSettings();
    const last = { rygg: '2026-10-01' as const };
    expect(groupStatus('rygg', '2026-10-09', last, settings).urgency).toBe(1); // ibland = 8
    settings.frequency.rygg = 'ofta';
    expect(groupStatus('rygg', '2026-10-11', last, settings).urgency).toBe(2); // ofta = 5
  });

  it('a never-trained group gives no hint until HINT_FACTOR x target after firstUseDate', () => {
    const settings = makeSettings({ firstUseDate: '2026-10-01' });
    const lib = fullLibrary(1).filter((e) => e.type !== 'kardio');
    // ibland strength target 8 -> hint from day 16.
    expect(computeHints(allGroupStatus('2026-10-16', [], lib, settings), lib)).toHaveLength(0);
    const hints = computeHints(allGroupStatus('2026-10-17', [], lib, settings), lib);
    expect(hints.length).toBe(3);
    expect(hints[0]?.neverTrained).toBe(true);
    // Kardio (ibland target 5) hints from day 10.
    const withCardio = fullLibrary(1);
    expect(computeHints(allGroupStatus('2026-10-10', [], withCardio, settings), withCardio)).toHaveLength(0);
    expect(computeHints(allGroupStatus('2026-10-11', [], withCardio, settings), withCardio).map((h) => h.group)).toEqual(['kardio']);
  });

  it('lists at most MAX_HINTS overdue groups, most urgent first, only groups with exercises', () => {
    const settings = makeSettings({ firstUseDate: '2026-01-01' });
    const lib = [ex('v', ['vader']), ex('l', ['lar']), ex('r', ['rumpa']), ex('b', ['brost'])];
    const sessions = [
      session('2026-08-01', ['v']), // 60 days
      session('2026-09-01', ['l']), // 29 days
      session('2026-09-20', ['r']), // 10 days -> not overdue (needs 16)
      session('2026-09-10', ['b']), // 20 days
    ];
    const hints = computeHints(allGroupStatus('2026-09-30', sessions, lib, settings), lib);
    expect(hints.map((h) => h.group)).toEqual(['vader', 'lar', 'brost']);
    expect(hints[0]?.daysSince).toBe(60);
  });

  it('skips archived exercises when deciding which groups have exercises', () => {
    const settings = makeSettings({ firstUseDate: '2026-01-01' });
    const lib = [ex('v', ['vader'], { archived: true })];
    expect(computeHints(allGroupStatus('2026-09-30', [], lib, settings), lib)).toHaveLength(0);
  });
});
