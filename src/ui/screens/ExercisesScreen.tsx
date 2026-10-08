import { useMemo, useState } from 'react';
import type { Exercise, ExerciseType } from '../../types';
import { lastDoneByExercise } from '../../engine';
import { daysBetween } from '../../engine/dates';
import { deleteOrArchiveExercise, restoreExercise } from '../../db/db';
import { exerciseSearchable, searchItems, youtubeUrl } from '../../catalog/search';
import { GROUP_LABEL, S, TYPE_LABEL } from '../../strings';
import { Badge, Button, ConfirmDialog, Empty, GroupHeader, ListRow, SearchInput, Segmented, Sheet, Toast } from '../components';
import { useExercises, useSessions, useToday } from '../hooks';
import { groupBy, sortByName } from '../grouping';
import { formatDaysAgo } from '../format';
import { AddExerciseSheet, ExerciseForm } from './AddExerciseSheet';

type Filter = 'all' | ExerciseType;

export function ExercisesScreen() {
  const exercises = useExercises();
  const sessions = useSessions();
  const today = useToday();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [showArchived, setShowArchived] = useState(false);

  const lastDone = useMemo(() => lastDoneByExercise(sessions ?? []), [sessions]);
  const active = useMemo(() => (exercises ?? []).filter((e) => !e.archived), [exercises]);
  const archived = useMemo(() => (exercises ?? []).filter((e) => e.archived), [exercises]);

  const visible = useMemo(() => {
    let list = active;
    if (filter !== 'all') list = list.filter((e) => e.type === filter);
    if (query.trim()) list = searchItems(query, list, exerciseSearchable, 200).map((h) => h.item);
    return sortByName(list);
  }, [active, filter, query]);

  // An exercise with two primary groups is listed under both.
  const grouped = useMemo(() => {
    const pairs = visible.flatMap((e) => (e.type === 'kardio' ? [{ g: 'kardio' as const, e }] : e.primary.map((g) => ({ g, e }))));
    return groupBy(pairs, (p) => p.g);
  }, [visible]);

  const detail = detailId ? exercises?.find((e) => e.id === detailId) : undefined;

  return (
    <div className="screen fade-in">
      <div className="screen-header">
        <div>
          <h1>{S.exercises.title}</h1>
          <div className="subtitle">{S.exercises.count(active.length)}</div>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}>
          {S.exercises.newExercise}
        </Button>
      </div>

      {exercises && active.length === 0 ? (
        <Empty icon="🏋️" title={S.exercises.empty} help={S.exercises.emptyHelp} action={<Button onClick={() => setAdding(true)}>{S.exercises.newExercise}</Button>} />
      ) : (
        <div className="stack">
          <SearchInput value={query} onChange={setQuery} placeholder={S.exercises.search} />
          <Segmented
            value={filter}
            options={[
              { value: 'all', label: S.exercises.filterAll },
              { value: 'styrka', label: TYPE_LABEL.styrka },
              { value: 'kardio', label: TYPE_LABEL.kardio },
            ]}
            onChange={setFilter}
          />
          {visible.length === 0 ? <p className="empty">{S.exercises.noMatches}</p> : null}
          <div className="list">
            {grouped.map((g) => (
              <div key={g.group}>
                <GroupHeader group={g.group} />
                {g.items.map(({ e }) => {
                  const last = lastDone[e.id];
                  return (
                    <ListRow
                      key={e.id}
                      title={e.name}
                      sub={`${e.type === 'kardio' ? TYPE_LABEL.kardio : e.primary.map((p) => GROUP_LABEL[p]).join(' · ')} · ${formatDaysAgo(last ? daysBetween(last, today) : undefined)}`}
                      onClick={() => setDetailId(e.id)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {archived.length > 0 ? (
            <div>
              <Button variant="ghost" block onClick={() => setShowArchived((s) => !s)}>
                {S.exercises.archived} ({archived.length}) {showArchived ? '▴' : '▾'}
              </Button>
              {showArchived ? (
                <div className="list">
                  {sortByName(archived).map((e) => (
                    <ListRow key={e.id} title={e.name} sub={S.exercises.archivedBadge} onClick={() => setDetailId(e.id)} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {adding ? <AddExerciseSheet onClose={() => setAdding(false)} /> : null}
      {detail ? <ExerciseDetailSheet exercise={detail} exercises={exercises ?? []} lastDone={lastDone[detail.id]} today={today} onClose={() => setDetailId(undefined)} /> : null}
    </div>
  );
}

export function ExerciseDetailSheet({
  exercise,
  exercises,
  lastDone,
  today,
  onClose,
}: {
  exercise: Exercise;
  exercises: Exercise[];
  lastDone?: string;
  today: string;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState<string>();
  const sessions = useSessions();
  const inHistory = useMemo(() => (sessions ?? []).some((s) => s.entries.some((e) => e.exerciseId === exercise.id && e.done)), [sessions, exercise.id]);

  const onDelete = async () => {
    setConfirm(false);
    await deleteOrArchiveExercise(exercise.id);
    onClose();
  };

  if (editing) {
    return (
      <Sheet title={S.common.edit} onClose={() => setEditing(false)} full>
        <ExerciseForm
          initial={exercise}
          existing={exercises}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setToast(S.common.save);
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={exercise.name}
      onClose={onClose}
      footer={
        <div className="row">
          {exercise.archived ? (
            <Button
              className="grow"
              onClick={() => {
                void restoreExercise(exercise.id);
                onClose();
              }}
            >
              {S.exercises.restore}
            </Button>
          ) : (
            <>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                {S.common.delete}
              </Button>
              <Button variant="secondary" className="grow" onClick={() => setEditing(true)}>
                {S.common.edit}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="stack-lg">
        <div className="row wrap">
          <Badge tone="accent">{TYPE_LABEL[exercise.type]}</Badge>
          {exercise.archived ? <Badge tone="muted">{S.exercises.archivedBadge}</Badge> : null}
          <Badge tone="muted">{exercise.catalogId ? S.exercises.fromCatalog : S.exercises.own}</Badge>
        </div>
        {exercise.type === 'styrka' ? (
          <div className="stack" style={{ gap: 6 }}>
            <div>
              <span className="section-title">{S.exercises.primary}</span>
              <div>{exercise.primary.map((g) => GROUP_LABEL[g]).join(', ')}</div>
            </div>
            {exercise.secondary.length > 0 ? (
              <div>
                <span className="section-title">{S.exercises.secondary}</span>
                <div className="muted">{exercise.secondary.map((g) => GROUP_LABEL[g]).join(', ')}</div>
              </div>
            ) : null}
          </div>
        ) : null}
        {exercise.description ? (
          <div>
            <span className="section-title">{S.exercises.description}</span>
            <p>{exercise.description}</p>
          </div>
        ) : null}
        <div>
          <span className="section-title">{S.common.lastDone}</span>
          <div>{formatDaysAgo(lastDone ? daysBetween(lastDone, today) : undefined)}</div>
        </div>
        <a className="btn btn-secondary btn-block" href={youtubeUrl(exercise)} target="_blank" rel="noopener noreferrer">
          ▶️ {S.exercises.youtube}
        </a>
      </div>
      {confirm ? (
        <ConfirmDialog
          title={S.exercises.deleteConfirm}
          text={inHistory ? S.exercises.deleteArchivedNote : S.exercises.deleteForever}
          confirmLabel={S.common.delete}
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={() => void onDelete()}
        />
      ) : null}
      {toast ? <Toast text={toast} onDismiss={() => setToast(undefined)} timeout={1500} /> : null}
    </Sheet>
  );
}
