import { useEffect, useMemo, useState } from 'react';
import type { CatalogEntry, GroupId } from '../../types';
import { GROUP_ORDER } from '../../config/groups';
import { exerciseFromCatalog, loadCatalog } from '../../catalog';
import { addExercise, db } from '../../db/db';
import { GROUP_ICON, GROUP_LABEL, S } from '../../strings';
import { Button, CheckRow, Progress } from '../components';
import { reportError } from '../errors';

type Step = { kind: 'welcome' } | { kind: 'group'; index: number } | { kind: 'done'; added: number };

export function Onboarding({ onDone }: { onDone: () => void | Promise<void> }) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>();
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>({ kind: 'welcome' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadCatalog().then(setCatalog).catch((e) => reportError('loadCatalog', e));
    db.exercises
      .toArray()
      .then((list) => setExisting(new Set(list.map((e) => e.catalogId).filter((x): x is string => Boolean(x)))))
      .catch((e) => reportError('exercises', e));
  }, []);

  const groups = GROUP_ORDER;
  const group: GroupId | undefined = step.kind === 'group' ? groups[step.index] : undefined;

  const entries = useMemo(() => {
    if (!catalog || !group) return [];
    const list = catalog.filter((e) => e.primary.includes(group)).sort((a, b) => a.common - b.common || a.name.localeCompare(b.name, 'sv'));
    return showAll ? list : list.filter((e) => e.common === 1).slice(0, 14);
  }, [catalog, group, showAll]);

  const next = () => {
    setShowAll(false);
    if (step.kind === 'welcome') setStep({ kind: 'group', index: 0 });
    else if (step.kind === 'group') {
      if (step.index + 1 < groups.length) setStep({ kind: 'group', index: step.index + 1 });
      else void finish();
    }
  };

  const finish = async () => {
    if (busy || !catalog) return;
    setBusy(true);
    let added = 0;
    try {
      for (const id of selected) {
        if (existing.has(id)) continue;
        const entry = catalog.find((e) => e.id === id);
        if (!entry) continue;
        await addExercise(exerciseFromCatalog(entry));
        added++;
      }
      setStep({ kind: 'done', added });
    } catch (e) {
      reportError('onboarding.finish', e);
    } finally {
      setBusy(false);
    }
  };

  if (step.kind === 'welcome') {
    return (
      <div className="gate fade-in">
        <img className="logo" src="/icons/icon-192.png" alt="" width={96} height={96} />
        <h1>{S.onboarding.welcome}</h1>
        <p className="muted">{S.onboarding.intro}</p>
        <Button block size="big" onClick={next} disabled={!catalog}>
          {S.onboarding.start}
        </Button>
        <Button variant="ghost" onClick={() => void onDone()}>
          {S.onboarding.skipAll}
        </Button>
      </div>
    );
  }

  if (step.kind === 'done') {
    return (
      <div className="gate fade-in">
        <div style={{ fontSize: 64 }} aria-hidden="true">
          🎉
        </div>
        <h1>{S.onboarding.doneTitle}</h1>
        <p className="muted">{S.onboarding.doneText(step.added + existing.size)}</p>
        <Button block size="big" onClick={() => void onDone()}>
          {S.onboarding.goToToday}
        </Button>
      </div>
    );
  }

  const g = group as GroupId;
  const count = [...selected].filter((id) => catalog?.find((e) => e.id === id)?.primary.includes(g)).length;

  return (
    <div className="app">
      <div className="screen" style={{ paddingBottom: 120 }}>
        <Progress value={step.index + 1} max={groups.length} />
        <div className="screen-header" style={{ marginTop: 16 }}>
          <div>
            <h1>
              <span aria-hidden="true">{GROUP_ICON[g]}</span> {GROUP_LABEL[g]}
            </h1>
            <div className="subtitle">{g === 'kardio' ? S.onboarding.groupStepKardio : S.onboarding.groupStep(GROUP_LABEL[g])}</div>
          </div>
        </div>
        <div className="list">
          {entries.map((e) => {
            const already = existing.has(e.id);
            const checked = already || selected.has(e.id);
            return (
              <CheckRow
                key={e.id}
                checked={checked}
                title={e.name}
                sub={already ? S.exercises.inLibrary : e.equipment}
                onToggle={() => {
                  if (already) return;
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (n.has(e.id)) n.delete(e.id);
                    else n.add(e.id);
                    return n;
                  });
                }}
              />
            );
          })}
        </div>
        {!showAll ? (
          <div style={{ marginTop: 12 }}>
            <Button variant="ghost" block onClick={() => setShowAll(true)}>
              {S.onboarding.showMore}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="sheet-footer" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <div className="row" style={{ maxWidth: 640, margin: '0 auto' }}>
          <span className="muted grow">{S.onboarding.selectedCount(count)}</span>
          <Button variant="secondary" onClick={next} disabled={busy}>
            {S.common.skip}
          </Button>
          <Button onClick={next} disabled={busy}>
            {step.index + 1 < groups.length ? S.common.next : S.onboarding.finish}
          </Button>
        </div>
      </div>
    </div>
  );
}
