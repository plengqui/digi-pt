import { useMemo, useState } from 'react';
import type { DateString, Exercise, GroupId, Session, Settings } from '../../types';
import { GROUP_ORDER } from '../../config/groups';
import { allGroupStatus, lastDoneByExercise } from '../../engine';
import { addEntry, removeEntry } from '../../db/db';
import { exerciseSearchable, searchItems } from '../../catalog/search';
import { GROUP_LABEL, S } from '../../strings';
import { Badge, Button, CheckRow, GroupChip, GroupHeader, SearchInput, Sheet } from '../components';
import { useExercises, useSession, useSessions } from '../hooks';
import { displayGroup, groupBy, sortByName } from '../grouping';
import { formatDaysAgo } from '../format';
import { daysBetween } from '../../engine/dates';
import { AddExerciseSheet } from './AddExerciseSheet';

/**
 * Library picker used by "Välj själv", "+ Lägg till övning" and history editing.
 * Ticking an exercise logs it as done for `date`; unticking removes it from that session.
 */
export function SessionPickSheet({ date, today, settings, onClose }: { date: DateString; today: DateString; settings: Settings; onClose: () => void }) {
  const exercises = useExercises();
  const sessions = useSessions();
  const session = useSession(date);
  const entries = session?.entries ?? [];
  const done = useMemo(() => new Set(entries.filter((e) => e.done).map((e) => e.exerciseId)), [entries]);
  const [adding, setAdding] = useState(false);

  if (!exercises || !sessions) return null;

  const toggle = async (ex: Exercise) => {
    if (done.has(ex.id)) await removeEntry(date, ex.id);
    else await addEntry(date, ex.id, 'manual', true);
  };

  return (
    <Sheet
      title={S.manual.title}
      onClose={onClose}
      full
      footer={
        <div className="row">
          <Button variant="secondary" onClick={() => setAdding(true)}>
            {S.exercises.newExercise}
          </Button>
          <Button className="grow" onClick={onClose}>
            {S.common.done} ({done.size})
          </Button>
        </div>
      }
    >
      <LibraryList
        today={date}
        settings={settings}
        exercises={exercises}
        sessions={sessions}
        selectedIds={done}
        onToggle={(ex) => void toggle(ex)}
        help={S.manual.help}
        statusDate={today}
      />
      {adding ? (
        <AddExerciseSheet
          onClose={() => setAdding(false)}
          onAdded={(ex) => {
            void addEntry(date, ex.id, 'manual', true);
          }}
        />
      ) : null}
    </Sheet>
  );
}

/** Picker that only reports picks (used when building a suggestion). */
export function LibraryPickerSheet({
  today,
  settings,
  exercises,
  sessions,
  selectedIds,
  onPick,
  onClose,
}: {
  today: DateString;
  settings: Settings;
  exercises: Exercise[];
  sessions: Session[];
  selectedIds: Set<string>;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={S.add.title} onClose={onClose} full>
      <LibraryList
        today={today}
        settings={settings}
        exercises={exercises}
        sessions={sessions}
        selectedIds={selectedIds}
        onToggle={(ex) => {
          if (!selectedIds.has(ex.id)) {
            onPick(ex);
            onClose();
          }
        }}
        statusDate={today}
      />
    </Sheet>
  );
}

function LibraryList({
  today,
  statusDate,
  settings,
  exercises,
  sessions,
  selectedIds,
  onToggle,
  help,
}: {
  today: DateString;
  statusDate: DateString;
  settings: Settings;
  exercises: Exercise[];
  sessions: Session[];
  selectedIds: Set<string>;
  onToggle: (ex: Exercise) => void;
  help?: string;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<GroupId | undefined>();
  const statuses = useMemo(() => allGroupStatus(statusDate, sessions, exercises, settings), [statusDate, sessions, exercises, settings]);
  const lastDone = useMemo(() => lastDoneByExercise(sessions), [sessions]);
  const active = useMemo(() => exercises.filter((e) => !e.archived), [exercises]);

  const visible = useMemo(() => {
    let list = active;
    if (query.trim()) list = searchItems(query, active, exerciseSearchable, 100).map((h) => h.item);
    if (group) list = list.filter((e) => (group === 'kardio' ? e.type === 'kardio' : e.primary.includes(group)));
    return sortByName(list);
  }, [active, query, group]);

  const grouped = useMemo(() => groupBy(visible, displayGroup), [visible]);
  const groupsPresent = useMemo(() => {
    const set = new Set<GroupId>();
    for (const e of active) {
      if (e.type === 'kardio') set.add('kardio');
      else for (const g of e.primary) set.add(g);
    }
    return GROUP_ORDER.filter((g) => set.has(g));
  }, [active]);

  if (active.length === 0) return <p className="empty">{S.manual.emptyLibrary}</p>;

  return (
    <div className="stack">
      {help ? <p className="muted small">{help}</p> : null}
      <SearchInput value={query} onChange={setQuery} placeholder={S.manual.search} />
      <div className="chips-scroll">
        {groupsPresent.map((g) => (
          <GroupChip
            key={g}
            group={g}
            selected={group === g}
            resting={statuses[g].resting}
            tag={statuses[g].resting ? S.manual.resting : undefined}
            onClick={() => setGroup(group === g ? undefined : g)}
          />
        ))}
      </div>
      {visible.length === 0 ? <p className="empty">{S.manual.noMatches}</p> : null}
      <div className="list">
        {grouped.map((g) => (
          <div key={g.group}>
            <GroupHeader group={g.group} trailing={statuses[g.group].resting ? <Badge tone="muted">{S.manual.resting}</Badge> : undefined} />
            {g.items.map((ex) => {
              const last = lastDone[ex.id];
              const days = last ? daysBetween(last, today) : undefined;
              return (
                <CheckRow
                  key={ex.id}
                  strike={false}
                  checked={selectedIds.has(ex.id)}
                  title={ex.name}
                  sub={`${ex.type === 'kardio' ? GROUP_LABEL.kardio : ex.primary.map((p) => GROUP_LABEL[p]).join(' · ')} · ${formatDaysAgo(days)}`}
                  onToggle={() => onToggle(ex)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
