import { useMemo, useState } from 'react';
import type { Exercise, Settings } from '../../types';
import { EXPORT_NUDGE_DAYS } from '../../config/constants';
import { allGroupStatus, computeHints } from '../../engine';
import { removeEntry, setEntryDone, deleteSession } from '../../db/db';
import { shouldNudgeExport } from '../../db/backup';
import { GROUP_LABEL, S } from '../../strings';
import { Badge, Button, CheckRow, ConfirmDialog, GroupHeader, IconButton, Progress, Toast } from '../components';
import { formatLongDate } from '../format';
import { useExerciseMap, useExercises, useSession, useSessions, useToday } from '../hooks';
import { displayGroup, groupBy } from '../grouping';
import { exportBackup } from '../backup-actions';
import { reportError } from '../errors';
import { SuggestSheet } from './SuggestSheet';
import { SessionPickSheet } from './SessionPickSheet';

export function TodayScreen({ settings }: { settings: Settings }) {
  const today = useToday();
  const exercises = useExercises();
  const sessions = useSessions();
  const session = useSession(today);
  const byId = useExerciseMap(exercises);
  const [sheet, setSheet] = useState<'none' | 'suggest' | 'pick'>('none');
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string>();

  const statuses = useMemo(
    () => (exercises && sessions ? allGroupStatus(today, sessions, exercises, settings) : undefined),
    [today, sessions, exercises, settings],
  );
  const hints = useMemo(() => (statuses && exercises ? computeHints(statuses, exercises) : []), [statuses, exercises]);
  const nudge = useMemo(() => (sessions ? shouldNudgeExport(settings, sessions, new Date(), EXPORT_NUDGE_DAYS) : false), [sessions, settings]);

  const entries = session?.entries ?? [];
  const hasSession = entries.length > 0;
  const doneCount = entries.filter((e) => e.done).length;

  const grouped = useMemo(() => {
    const items = entries.map((entry) => ({ entry, exercise: byId.get(entry.exerciseId) }));
    return groupBy(items, (i) => (i.exercise ? displayGroup(i.exercise) : 'kardio'));
  }, [entries, byId]);

  const onExport = async () => {
    try {
      const r = await exportBackup();
      if (r !== 'cancelled') setToast(S.settings.lastExport + ': ' + S.common.today.toLowerCase());
    } catch (e) {
      reportError('export', e);
      setToast(S.settings.exportFailed);
    }
  };

  const loading = exercises === undefined || sessions === undefined || session === undefined;

  return (
    <div className="screen fade-in">
      <div className="screen-header">
        <div>
          <h1>{S.tabs.today}</h1>
          <div className="subtitle">{formatLongDate(today)}</div>
        </div>
        {hasSession ? (
          <IconButton label={S.today.clearSession} onClick={() => setConfirmClear(true)}>
            🗑️
          </IconButton>
        ) : null}
      </div>

      <div className="stack-lg">
        {nudge ? (
          <div className="card-warning row-between">
            <span className="grow">{settings.lastExportAt ? S.today.exportNudge : S.today.exportNudgeNever}</span>
            <Button size="sm" variant="accent" onClick={() => void onExport()}>
              {S.today.exportNudgeAction}
            </Button>
          </div>
        ) : null}

        {hints.length > 0 ? (
          <div>
            <div className="section-title">{S.today.hintsTitle}</div>
            <div className="hints">
              {hints.map((h) => (
                <div className="hint" key={h.group}>
                  <span aria-hidden="true">⏳</span>
                  <span>{h.neverTrained ? S.today.hintNever(GROUP_LABEL[h.group]) : S.today.hint(GROUP_LABEL[h.group], h.daysSince ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? null : !hasSession ? (
          <div className="stack">
            <p className="muted">{S.today.noSession}</p>
            <Button size="big" block onClick={() => setSheet('suggest')}>
              {S.today.suggest}
              <span className="help">{S.today.suggestHelp}</span>
            </Button>
            <Button size="big" block variant="secondary" onClick={() => setSheet('pick')}>
              {S.today.manual}
              <span className="help">{S.today.manualHelp}</span>
            </Button>
          </div>
        ) : (
          <div className="stack">
            <div className="card stack" style={{ gap: 8 }}>
              <div className="row-between">
                <h2>{doneCount === entries.length ? S.today.allDone : S.today.progress(doneCount, entries.length)}</h2>
                <Badge tone={doneCount === entries.length ? 'success' : 'soft'}>{S.today.progress(doneCount, entries.length)}</Badge>
              </div>
              <Progress value={doneCount} max={entries.length} />
            </div>

            <div className="list">
              {grouped.map((g) => (
                <div key={g.group}>
                  <GroupHeader group={g.group} />
                  {g.items.map(({ entry, exercise }) => (
                    <CheckRow
                      key={entry.exerciseId}
                      checked={entry.done}
                      title={exercise?.name ?? S.today.missingExercise}
                      sub={exercise ? subLine(exercise) : undefined}
                      onToggle={() => void setEntryDone(today, entry.exerciseId, !entry.done)}
                      trailing={
                        <IconButton label={S.today.removeEntry} onClick={() => void removeEntry(today, entry.exerciseId)}>
                          <span style={{ fontSize: 18, color: 'var(--text-faint)' }}>✕</span>
                        </IconButton>
                      }
                    />
                  ))}
                </div>
              ))}
            </div>

            <Button variant="secondary" block onClick={() => setSheet('pick')}>
              {S.today.addExercise}
            </Button>
          </div>
        )}
      </div>

      {sheet === 'suggest' && exercises && sessions ? (
        <SuggestSheet
          today={today}
          settings={settings}
          exercises={exercises}
          sessions={sessions}
          onClose={() => setSheet('none')}
          onStarted={() => setSheet('none')}
        />
      ) : null}
      {sheet === 'pick' && settings ? <SessionPickSheet date={today} today={today} settings={settings} onClose={() => setSheet('none')} /> : null}

      {confirmClear ? (
        <ConfirmDialog
          title={S.today.clearSession}
          text={S.today.clearSessionConfirm}
          confirmLabel={S.common.delete}
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            void deleteSession(today);
          }}
        />
      ) : null}
      {toast ? <Toast text={toast} onDismiss={() => setToast(undefined)} /> : null}
    </div>
  );
}

function subLine(ex: Exercise): string {
  if (ex.type === 'kardio') return GROUP_LABEL.kardio;
  return ex.primary.map((g) => GROUP_LABEL[g]).join(' · ');
}
