import { useEffect, useMemo, useState } from 'react';
import type { DateString, Exercise, GroupId, Session, SessionShape, Settings } from '../../types';
import { EXERCISES_PER_SESSION_RANGE } from '../../config/constants';
import { STRENGTH_GROUPS } from '../../config/groups';
import { allGroupStatus, cardioDefault, groupsWithExercises, newSeed, suggestSession, swapCandidate, type SuggestedItem, type SuggestInput } from '../../engine';
import { addEntries } from '../../db/db';
import { GROUP_LABEL, S, SHAPE_LABEL } from '../../strings';
import { Badge, Button, Chip, GroupChip, GroupHeader, IconButton, ListRow, Segmented, Sheet, Stepper, Toast } from '../components';
import { groupBy } from '../grouping';
import { LibraryPickerSheet } from './SessionPickSheet';

export function SuggestSheet({
  today,
  settings,
  exercises,
  sessions,
  onClose,
  onStarted,
}: {
  today: DateString;
  settings: Settings;
  exercises: Exercise[];
  sessions: Session[];
  onClose: () => void;
  onStarted: () => void;
}) {
  const statuses = useMemo(() => allGroupStatus(today, sessions, exercises, settings), [today, sessions, exercises, settings]);
  const available = useMemo(() => groupsWithExercises(exercises), [exercises]);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const [seed, setSeed] = useState(() => newSeed());
  const [count, setCount] = useState(settings.exercisesPerSession);
  const [shape, setShape] = useState<SessionShape>(settings.shape);
  const [cardio, setCardio] = useState(() => cardioDefault(statuses, exercises));
  const [groups, setGroups] = useState<GroupId[] | undefined>(undefined);
  const [items, setItems] = useState<SuggestedItem[]>([]);
  const [toast, setToast] = useState<string>();
  const [picker, setPicker] = useState(false);

  const input: SuggestInput = useMemo(
    () => ({ today, sessions, exercises, settings, count, cardio, seed, groups, shape }),
    [today, sessions, exercises, settings, count, cardio, seed, groups, shape],
  );
  const suggestion = useMemo(() => suggestSession(input), [input]);

  // Any change of the controls produces a fresh list; swaps/removals edit the list locally.
  useEffect(() => setItems(suggestion.items), [suggestion]);

  const usedGroups = useMemo(() => Array.from(new Set(items.filter((i) => i.group !== 'kardio').map((i) => i.group))), [items]);
  const selectedGroups = groups ?? usedGroups;

  const toggleGroup = (g: GroupId) => {
    const base = groups ?? usedGroups;
    const next = base.includes(g) ? base.filter((x) => x !== g) : [...base, g];
    setGroups(next.length === 0 ? undefined : next);
  };

  const swap = (item: SuggestedItem) => {
    const next = swapCandidate(
      input,
      item.group,
      item.exerciseId,
      items.map((i) => i.exerciseId),
    );
    if (!next) {
      setToast(S.suggest.noSwap);
      return;
    }
    setItems((prev) => prev.map((i) => (i.exerciseId === item.exerciseId ? { ...i, exerciseId: next.id } : i)));
  };

  const remove = (item: SuggestedItem) => setItems((prev) => prev.filter((i) => i.exerciseId !== item.exerciseId));

  const addFromLibrary = (ex: Exercise) => {
    if (items.some((i) => i.exerciseId === ex.id)) return;
    const group: GroupId = ex.type === 'kardio' ? 'kardio' : (ex.primary[0] ?? 'kardio');
    setItems((prev) => [...prev, { exerciseId: ex.id, group, shortRest: statuses[group]?.resting ?? false }]);
  };

  const start = async () => {
    await addEntries(
      today,
      items.map((i) => i.exerciseId),
      'suggested',
    );
    onStarted();
  };

  const grouped = groupBy(items, (i) => i.group);
  const groupReason = (g: GroupId): string => {
    const st = statuses[g];
    if (g === 'kardio') return st.daysSince === undefined ? S.suggest.reasonNever : S.suggest.reasonDays(st.daysSince);
    if (st.daysSince === undefined) return S.suggest.reasonNever;
    if (st.resting) return S.suggest.reasonShortRest(st.daysSince);
    return S.suggest.reasonDays(st.daysSince);
  };

  const noUsable = !exercises.some((e) => !e.archived);

  return (
    <Sheet
      title={S.suggest.title}
      onClose={onClose}
      full
      footer={
        <div className="row">
          <Button variant="secondary" onClick={() => setSeed(newSeed())}>
            🔀 {S.suggest.newSuggestion}
          </Button>
          <Button className="grow" onClick={() => void start()} disabled={items.length === 0}>
            {S.suggest.start} ({items.length})
          </Button>
        </div>
      }
    >
      {noUsable ? (
        <p className="card-warning">{S.suggest.noExercises}</p>
      ) : (
        <div className="stack-lg">
          <div className="stack" style={{ gap: 8 }}>
            <div className="row-between">
              <span className="section-title" style={{ margin: 0 }}>
                {S.suggest.shape}
              </span>
              <Segmented
                value={shape}
                options={[
                  { value: 'fokus', label: SHAPE_LABEL.fokus },
                  { value: 'helkropp', label: SHAPE_LABEL.helkropp },
                ]}
                onChange={setShape}
              />
            </div>
            <div className="row-between">
              <span className="section-title" style={{ margin: 0 }}>
                {S.suggest.count}
              </span>
              <Stepper value={count} min={EXERCISES_PER_SESSION_RANGE.min} max={EXERCISES_PER_SESSION_RANGE.max} onChange={setCount} label={S.suggest.count} />
            </div>
            <div className="row-between">
              <span className="section-title" style={{ margin: 0 }}>
                {S.suggest.cardio}
              </span>
              <Chip selected={cardio} onClick={() => setCardio((c) => !c)}>
                ❤️ {cardio ? S.suggest.cardioOn : S.suggest.cardioOff}
              </Chip>
            </div>
          </div>

          <div>
            <div className="section-title">{S.suggest.groups}</div>
            <div className="chips">
              {STRENGTH_GROUPS.filter((g) => available.has(g)).map((g) => (
                <GroupChip
                  key={g}
                  group={g}
                  selected={selectedGroups.includes(g)}
                  resting={statuses[g].resting}
                  tag={statuses[g].resting ? S.suggest.restingLabel : undefined}
                  onClick={() => toggleGroup(g)}
                />
              ))}
            </div>
          </div>

          <div className="list">
            {items.length === 0 ? <p className="empty">{S.suggest.empty}</p> : null}
            {grouped.map((g) => (
              <div key={g.group}>
                <GroupHeader
                  group={g.group}
                  trailing={
                    <span className="row" style={{ gap: 6 }}>
                      <span className="faint" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                        {groupReason(g.group)}
                      </span>
                      {statuses[g.group].resting && g.group !== 'kardio' ? <Badge tone="warning">{S.today.shortRestBadge}</Badge> : null}
                    </span>
                  }
                />
                {g.items.map((item) => {
                  const ex = byId.get(item.exerciseId);
                  return (
                    <ListRow
                      key={item.exerciseId}
                      title={ex?.name ?? item.exerciseId}
                      sub={ex ? ex.primary.map((p) => GROUP_LABEL[p]).join(' · ') : undefined}
                      trailing={
                        <span className="row" style={{ gap: 0 }}>
                          <IconButton label={S.suggest.swap} onClick={() => swap(item)}>
                            🔁
                          </IconButton>
                          <IconButton label={S.suggest.remove} onClick={() => remove(item)}>
                            <span style={{ fontSize: 18, color: 'var(--text-faint)' }}>✕</span>
                          </IconButton>
                        </span>
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <Button variant="secondary" block onClick={() => setPicker(true)}>
            {S.suggest.addAny}
          </Button>
        </div>
      )}

      {picker ? (
        <LibraryPickerSheet
          today={today}
          settings={settings}
          exercises={exercises}
          sessions={sessions}
          selectedIds={new Set(items.map((i) => i.exerciseId))}
          onPick={(ex) => addFromLibrary(ex)}
          onClose={() => setPicker(false)}
        />
      ) : null}
      {toast ? <Toast text={toast} onDismiss={() => setToast(undefined)} /> : null}
    </Sheet>
  );
}
