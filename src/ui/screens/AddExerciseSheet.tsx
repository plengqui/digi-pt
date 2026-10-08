import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CatalogEntry, Exercise, ExerciseType, GroupId } from '../../types';
import { GROUP_ORDER, STRENGTH_GROUPS } from '../../config/groups';
import { exerciseFromCatalog, loadCatalog } from '../../catalog';
import { catalogSearchable, exerciseSearchable, normalise, searchItems } from '../../catalog/search';
import { addExercise, updateExercise } from '../../db/db';
import { GROUP_ICON, GROUP_LABEL, S, TYPE_LABEL } from '../../strings';
import { Badge, Button, GroupChip, ListRow, SearchInput, Segmented, Sheet, Toast } from '../components';
import { useExercises } from '../hooks';
import { reportError } from '../errors';

type Mode = { kind: 'search' } | { kind: 'browse'; group?: GroupId } | { kind: 'create' };

/**
 * Add flow: one search field over the library and the catalog, "Bläddra i katalogen" by group,
 * and "Skapa egen". Adding from the catalog copies the entry into the library.
 */
export function AddExerciseSheet({ onClose, onAdded }: { onClose: () => void; onAdded?: (ex: Exercise) => void }) {
  const exercises = useExercises();
  const [catalog, setCatalog] = useState<CatalogEntry[]>();
  const [mode, setMode] = useState<Mode>({ kind: 'search' });
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string>();
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCatalog().then(setCatalog).catch((e) => reportError('loadCatalog', e));
  }, []);

  const inLibrary = useMemo(() => {
    const set = new Set<string>();
    for (const e of exercises ?? []) if (e.catalogId) set.add(e.catalogId);
    return set;
  }, [exercises]);
  const libraryByCatalogId = useMemo(() => new Map((exercises ?? []).filter((e) => e.catalogId).map((e) => [e.catalogId as string, e])), [exercises]);

  const libraryHits = useMemo(() => (exercises && query.trim() ? searchItems(query, exercises.filter((e) => !e.archived), exerciseSearchable, 10) : []), [exercises, query]);
  const catalogHits = useMemo(() => {
    if (!catalog || !query.trim()) return [];
    const hits = searchItems(query, catalog, (e) => catalogSearchable(e, inLibrary.has(e.id)), 40);
    // Catalog entries already in the library appear in the library list above; skip them here.
    return hits.filter((h) => !inLibrary.has(h.item.id));
  }, [catalog, query, inLibrary]);

  const addCatalog = async (entry: CatalogEntry) => {
    const existing = libraryByCatalogId.get(entry.id);
    if (existing) {
      onAdded?.(existing);
      setToast(`${existing.name}: ${S.add.inLibrary}`);
      return;
    }
    try {
      const ex = await addExercise(exerciseFromCatalog(entry));
      setJustAdded((prev) => new Set(prev).add(entry.id));
      onAdded?.(ex);
      setToast(`${S.add.added}: ${ex.name}`);
    } catch (e) {
      reportError('addCatalog', e);
    }
  };

  const title = mode.kind === 'create' ? S.add.createTitle : mode.kind === 'browse' ? S.add.catalogTitle : S.add.title;

  return (
    <Sheet
      title={title}
      onClose={onClose}
      full
      headerRight={
        mode.kind !== 'search' ? (
          <Button variant="ghost" size="sm" onClick={() => setMode({ kind: 'search' })}>
            {S.common.back}
          </Button>
        ) : undefined
      }
    >
      {mode.kind === 'search' ? (
        <div className="stack">
          <SearchInput value={query} onChange={setQuery} placeholder={S.add.searchPlaceholder} autoFocus />
          {!query.trim() ? (
            <>
              <p className="muted small">{S.add.typeToSearch}</p>
              <Button variant="secondary" block onClick={() => setMode({ kind: 'browse' })}>
                📚 {S.add.browse}
              </Button>
              <Button variant="secondary" block onClick={() => setMode({ kind: 'create' })}>
                ✏️ {S.add.create}
              </Button>
            </>
          ) : (
            <>
              {libraryHits.length > 0 ? (
                <div className="list">
                  {libraryHits.map((h) => (
                    <ListRow
                      key={h.item.id}
                      title={h.item.name}
                      sub={groupsLine(h.item)}
                      trailing={<Badge tone="muted">{S.add.inLibrary}</Badge>}
                      onClick={
                        onAdded
                          ? () => {
                              onAdded(h.item);
                              setToast(`${S.add.added}: ${h.item.name}`);
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : null}
              {catalogHits.length > 0 ? (
                <div className="list">
                  {catalogHits.map((h) => (
                    <CatalogRow key={h.item.id} entry={h.item} added={justAdded.has(h.item.id)} onAdd={() => void addCatalog(h.item)} />
                  ))}
                </div>
              ) : null}
              {libraryHits.length === 0 && catalogHits.length === 0 ? <p className="empty">{S.add.noResults}</p> : null}
              <Button variant="secondary" block onClick={() => setMode({ kind: 'create' })}>
                ✏️ {S.add.create}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {mode.kind === 'browse' ? (
        <BrowseCatalog
          catalog={catalog}
          group={mode.group}
          onGroup={(g) => setMode({ kind: 'browse', group: g })}
          inLibrary={inLibrary}
          justAdded={justAdded}
          onAdd={(e) => void addCatalog(e)}
        />
      ) : null}

      {mode.kind === 'create' ? (
        <ExerciseForm
          existing={exercises ?? []}
          onCancel={() => setMode({ kind: 'search' })}
          onSaved={(ex) => {
            onAdded?.(ex);
            setToast(`${S.add.added}: ${ex.name}`);
            setMode({ kind: 'search' });
            setQuery('');
          }}
        />
      ) : null}

      {toast ? <Toast text={toast} onDismiss={() => setToast(undefined)} timeout={2500} /> : null}
    </Sheet>
  );
}

function groupsLine(ex: Pick<Exercise, 'type' | 'primary'>): string {
  return ex.type === 'kardio' ? GROUP_LABEL.kardio : ex.primary.map((g) => GROUP_LABEL[g]).join(' · ');
}

function CatalogRow({ entry, added, onAdd }: { entry: CatalogEntry; added: boolean; onAdd: () => void }) {
  return (
    <ListRow
      title={entry.name}
      sub={`${groupsLine(entry)} · ${entry.equipment}`}
      onClick={added ? undefined : onAdd}
      trailing={added ? <Badge tone="success">{S.add.added}</Badge> : <span className="badge badge-soft">+ {S.add.addToLibrary}</span>}
    />
  );
}

function BrowseCatalog({
  catalog,
  group,
  onGroup,
  inLibrary,
  justAdded,
  onAdd,
}: {
  catalog?: CatalogEntry[];
  group?: GroupId;
  onGroup: (g: GroupId | undefined) => void;
  inLibrary: Set<string>;
  justAdded: Set<string>;
  onAdd: (e: CatalogEntry) => void;
}) {
  const entries = useMemo(() => {
    if (!catalog || !group) return [];
    return catalog.filter((e) => e.primary.includes(group)).sort((a, b) => a.common - b.common || a.name.localeCompare(b.name, 'sv'));
  }, [catalog, group]);

  if (!catalog) return <p className="muted">{S.common.loading}</p>;

  if (!group) {
    return (
      <div className="stack">
        <p className="muted small">{S.add.chooseGroup}</p>
        <div className="list">
          {GROUP_ORDER.map((g) => (
            <ListRow
              key={g}
              leading={<span style={{ fontSize: 24 }}>{GROUP_ICON[g]}</span>}
              title={GROUP_LABEL[g]}
              sub={S.exercises.count(catalog.filter((e) => e.primary.includes(g)).length)}
              onClick={() => onGroup(g)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="chips-scroll">
        {GROUP_ORDER.map((g) => (
          <GroupChip key={g} group={g} selected={g === group} onClick={() => onGroup(g)} />
        ))}
      </div>
      <p className="section-title">{S.add.allInGroup(GROUP_LABEL[group])}</p>
      <div className="list">
        {entries.map((e) =>
          inLibrary.has(e.id) && !justAdded.has(e.id) ? (
            <ListRow key={e.id} title={e.name} sub={`${groupsLine(e)} · ${e.equipment}`} trailing={<Badge tone="muted">{S.add.inLibrary}</Badge>} />
          ) : (
            <CatalogRow key={e.id} entry={e} added={justAdded.has(e.id)} onAdd={() => onAdd(e)} />
          ),
        )}
      </div>
    </div>
  );
}

/** Create or edit an exercise. */
export function ExerciseForm({
  initial,
  existing,
  onCancel,
  onSaved,
}: {
  initial?: Exercise;
  existing: Exercise[];
  onCancel: () => void;
  onSaved: (ex: Exercise) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<ExerciseType>(initial?.type ?? 'styrka');
  const [primary, setPrimary] = useState<GroupId[]>(initial?.type === 'kardio' ? [] : (initial?.primary ?? []));
  const [secondary, setSecondary] = useState<GroupId[]>(initial?.secondary ?? []);
  const [note, setNote] = useState(initial?.description ?? '');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const togglePrimary = (g: GroupId) => {
    setError(undefined);
    if (primary.includes(g)) setPrimary(primary.filter((x) => x !== g));
    else if (primary.length >= 2) setError(S.add.primaryMax);
    else {
      setPrimary([...primary, g]);
      setSecondary(secondary.filter((x) => x !== g));
    }
  };
  const toggleSecondary = (g: GroupId) => {
    if (secondary.includes(g)) setSecondary(secondary.filter((x) => x !== g));
    else if (!primary.includes(g)) setSecondary([...secondary, g]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError(S.add.nameRequired);
    const taken = existing.some((x) => x.id !== initial?.id && !x.archived && normalise(x.name) === normalise(trimmed));
    if (taken) return setError(S.add.nameTaken);
    if (type === 'styrka' && primary.length === 0) return setError(S.add.primaryRequired);
    setBusy(true);
    try {
      const data = {
        name: trimmed,
        type,
        primary: type === 'kardio' ? (['kardio'] as GroupId[]) : primary,
        secondary: type === 'kardio' ? [] : secondary,
        description: note.trim() || undefined,
      };
      if (initial) {
        const updated: Exercise = { ...initial, ...data };
        await updateExercise(updated);
        onSaved(updated);
      } else {
        const ex = await addExercise(data);
        onSaved(ex);
      }
    } catch (err) {
      reportError('saveExercise', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack-lg" onSubmit={(e) => void submit(e)}>
      <div className="field">
        <label htmlFor="ex-name">{S.add.name}</label>
        <input id="ex-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={S.add.namePlaceholder} autoComplete="off" />
      </div>
      <div className="field">
        <label>{S.add.type}</label>
        <Segmented
          value={type}
          options={[
            { value: 'styrka', label: TYPE_LABEL.styrka },
            { value: 'kardio', label: TYPE_LABEL.kardio },
          ]}
          onChange={(t) => {
            setType(t);
            setError(undefined);
          }}
        />
      </div>
      {type === 'styrka' ? (
        <>
          <div className="field">
            <label>{S.add.primaryGroups}</label>
            <div className="chips">
              {STRENGTH_GROUPS.map((g) => (
                <GroupChip key={g} group={g} selected={primary.includes(g)} onClick={() => togglePrimary(g)} />
              ))}
            </div>
          </div>
          <div className="field">
            <label>{S.add.secondaryGroups}</label>
            <div className="chips">
              {STRENGTH_GROUPS.filter((g) => !primary.includes(g)).map((g) => (
                <GroupChip key={g} group={g} selected={secondary.includes(g)} onClick={() => toggleSecondary(g)} />
              ))}
            </div>
          </div>
        </>
      ) : null}
      <div className="field">
        <label htmlFor="ex-note">{S.add.note}</label>
        <textarea id="ex-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={S.add.notePlaceholder} rows={3} />
      </div>
      {error ? (
        <p className="error" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
      <div className="row">
        <Button variant="secondary" onClick={onCancel} className="grow">
          {S.common.cancel}
        </Button>
        <Button type="submit" className="grow" disabled={busy}>
          {S.common.save}
        </Button>
      </div>
    </form>
  );
}
