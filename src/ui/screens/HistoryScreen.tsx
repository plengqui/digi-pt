import { useMemo, useState } from 'react';
import type { DateString, Session, Settings } from '../../types';
import { GROUP_ORDER } from '../../config/groups';
import { allGroupStatus } from '../../engine';
import { deleteSession, removeEntry, setEntryDone } from '../../db/db';
import { GROUP_ICON, GROUP_LABEL, S, STATE_LABEL } from '../../strings';
import { Badge, Button, CheckRow, ConfirmDialog, Empty, GroupHeader, IconButton, Sheet } from '../components';
import { useExerciseMap, useExercises, useSessions, useToday } from '../hooks';
import { displayGroup, groupBy } from '../grouping';
import { formatRelativeDate } from '../format';
import { SessionPickSheet } from './SessionPickSheet';

export function HistoryScreen({ settings }: { settings: Settings }) {
  const today = useToday();
  const exercises = useExercises();
  const sessions = useSessions();
  const byId = useExerciseMap(exercises);
  const [editDate, setEditDate] = useState<DateString>();
  const [pickDate, setPickDate] = useState<DateString>();
  const [datePicker, setDatePicker] = useState(false);
  const [dateValue, setDateValue] = useState(today);

  const statuses = useMemo(() => (exercises && sessions ? allGroupStatus(today, sessions, exercises, settings) : undefined), [today, sessions, exercises, settings]);

  const ordered = useMemo(() => [...(sessions ?? [])].filter((s) => s.date <= today).sort((a, b) => b.date.localeCompare(a.date)), [sessions, today]);
  const editing = editDate ? (sessions ?? []).find((s) => s.date === editDate) : undefined;

  return (
    <div className="screen fade-in">
      <div className="screen-header">
        <h1>{S.history.title}</h1>
      </div>
      <div className="stack-lg">
        {statuses ? (
          <div>
            <div className="section-title">{S.history.statusTitle}</div>
            <div className="status-grid">
              {GROUP_ORDER.map((g) => {
                const st = statuses[g];
                const restLeft = st.resting && st.daysSince !== undefined ? st.restDays - st.daysSince + 1 : 0;
                return (
                  <div key={g} className={`status-tile state-${st.state}`}>
                    <div className="name">
                      <span aria-hidden="true">{GROUP_ICON[g]}</span> {GROUP_LABEL[g]}
                    </div>
                    <div className="days">{st.daysSince === undefined ? '–' : st.daysSince === 0 ? S.common.today : S.common.daysAgo(st.daysSince)}</div>
                    <div className="state">{st.state === 'vilar' ? `${STATE_LABEL.vilar} · ${S.history.restingUntil(restLeft)}` : STATE_LABEL[st.state]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <div className="section-title" style={{ margin: 0 }}>
              {S.history.sessionsTitle}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDatePicker(true)}>
              {S.history.addPastSession}
            </Button>
          </div>
          {sessions && ordered.length === 0 ? <Empty icon="📖" title={S.history.empty} help={S.history.emptyHelp} /> : null}
          <div className="stack">
            {ordered.map((s) => {
              const done = s.entries.filter((e) => e.done);
              return (
                <button key={s.date} type="button" className="card" style={{ textAlign: 'left', width: '100%' }} onClick={() => setEditDate(s.date)}>
                  <div className="row-between">
                    <h3>{formatRelativeDate(s.date, today)}</h3>
                    <Badge tone={done.length > 0 ? 'soft' : 'muted'}>{done.length > 0 ? S.history.doneCount(done.length) : S.history.plannedOnly}</Badge>
                  </div>
                  <p className="muted small" style={{ marginTop: 6 }}>
                    {done.map((e) => byId.get(e.exerciseId)?.name ?? S.today.missingExercise).join(' · ')}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {editing ? (
        <SessionEditSheet
          session={editing}
          today={today}
          onClose={() => setEditDate(undefined)}
          onAdd={() => {
            setPickDate(editing.date);
          }}
        />
      ) : null}
      {pickDate ? <SessionPickSheet date={pickDate} today={today} settings={settings} onClose={() => setPickDate(undefined)} /> : null}

      {datePicker ? (
        <Sheet
          title={S.history.pickDate}
          onClose={() => setDatePicker(false)}
          footer={
            <Button
              block
              disabled={!dateValue || dateValue > today}
              onClick={() => {
                setDatePicker(false);
                setEditDate(undefined);
                setPickDate(dateValue);
              }}
            >
              {S.common.next}
            </Button>
          }
        >
          <div className="field">
            <label htmlFor="past-date">{S.history.pickDate}</label>
            <input id="past-date" className="input" type="date" value={dateValue} max={today} onChange={(e) => setDateValue(e.target.value)} />
            {dateValue > today ? <div className="error">{S.history.futureDate}</div> : null}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

function SessionEditSheet({ session, today, onClose, onAdd }: { session: Session; today: DateString; onClose: () => void; onAdd: () => void }) {
  const exercises = useExercises();
  const byId = useExerciseMap(exercises);
  const [confirm, setConfirm] = useState(false);
  const grouped = useMemo(() => {
    const items = session.entries.map((entry) => ({ entry, exercise: byId.get(entry.exerciseId) }));
    return groupBy(items, (i) => (i.exercise ? displayGroup(i.exercise) : 'kardio'));
  }, [session, byId]);

  return (
    <Sheet
      title={formatRelativeDate(session.date, today)}
      onClose={onClose}
      full
      footer={
        <div className="row">
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {S.history.deleteSession}
          </Button>
          <Button variant="secondary" className="grow" onClick={onAdd}>
            {S.history.addToSession}
          </Button>
        </div>
      }
    >
      <div className="list">
        {grouped.map((g) => (
          <div key={g.group}>
            <GroupHeader group={g.group} />
            {g.items.map(({ entry, exercise }) => (
              <CheckRow
                key={entry.exerciseId}
                checked={entry.done}
                title={exercise?.name ?? S.today.missingExercise}
                onToggle={() => void setEntryDone(session.date, entry.exerciseId, !entry.done)}
                trailing={
                  <IconButton label={S.history.removeFromSession} onClick={() => void removeEntry(session.date, entry.exerciseId)}>
                    <span style={{ fontSize: 18, color: 'var(--text-faint)' }}>✕</span>
                  </IconButton>
                }
              />
            ))}
          </div>
        ))}
      </div>
      {confirm ? (
        <ConfirmDialog
          title={S.history.deleteSession}
          text={S.history.deleteSessionConfirm}
          confirmLabel={S.common.delete}
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            void deleteSession(session.date);
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}
