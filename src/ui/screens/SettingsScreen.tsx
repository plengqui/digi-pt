import { useEffect, useRef, useState } from 'react';
import type { Frequency, GroupId, Settings } from '../../types';
import { GROUP_ORDER } from '../../config/groups';
import {
  DEFAULT_FREQUENCY,
  DEFAULT_REST_DAYS,
  EXERCISES_PER_SESSION,
  EXERCISES_PER_SESSION_RANGE,
  GROUPS_PER_SESSION,
  GROUPS_PER_SESSION_RANGE,
  REST_DAYS_RANGE,
} from '../../config/constants';
import { db, updateSettings } from '../../db/db';
import { BackupValidationError, type BackupFile } from '../../db/backup';
import { exportBackup, importBackup, readBackupFile } from '../backup-actions';
import { loadCatalog } from '../../catalog';
import { APP_NAME, FREQUENCY_LABEL, GROUP_ICON, GROUP_LABEL, S, SHAPE_HELP, SHAPE_LABEL } from '../../strings';
import { Button, ConfirmDialog, ListRow, SectionTitle, Segmented, Sheet, Stepper, Toast } from '../components';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatBytes, formatLongDate } from '../format';
import { isStandalone } from '../hooks';
import { reportError } from '../errors';
import { serviceWorkerStatus } from '../pwa';

export function SettingsScreen({ settings, onShowOnboarding }: { settings: Settings; onShowOnboarding: () => void }) {
  const [toast, setToast] = useState<string>();
  const [about, setAbout] = useState(false);
  const [pendingImport, setPendingImport] = useState<BackupFile>();
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<Settings>) => void updateSettings(patch).catch((e) => reportError('updateSettings', e));

  const onExport = async () => {
    try {
      const r = await exportBackup();
      if (r !== 'cancelled') setToast(r === 'shared' ? S.common.done : S.common.done);
    } catch (e) {
      reportError('export', e);
      setToast(S.settings.exportFailed);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      setPendingImport(backup);
    } catch (e) {
      if (!(e instanceof BackupValidationError)) reportError('import', e);
      setToast(S.settings.importInvalid);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doImport = async () => {
    if (!pendingImport) return;
    try {
      await importBackup(pendingImport);
      setToast(S.settings.importDone);
    } catch (e) {
      reportError('restore', e);
      setToast(S.settings.importInvalid);
    } finally {
      setPendingImport(undefined);
    }
  };

  const freqOptions = (['ofta', 'ibland', 'sallan'] as Frequency[]).map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }));

  return (
    <div className="screen fade-in">
      <div className="screen-header">
        <h1>{S.settings.title}</h1>
      </div>
      <div className="stack-lg">
        <section>
          <SectionTitle>{S.settings.sessionTitle}</SectionTitle>
          <div className="list">
            <div className="setting-row">
              <div>
                <div className="label">{S.settings.exercisesPerSession}</div>
              </div>
              <Stepper
                value={settings.exercisesPerSession}
                min={EXERCISES_PER_SESSION_RANGE.min}
                max={EXERCISES_PER_SESSION_RANGE.max}
                onChange={(v) => set({ exercisesPerSession: v })}
                label={S.settings.exercisesPerSession}
              />
            </div>
            <div className="setting-row">
              <div>
                <div className="label">{S.settings.groupsPerSession}</div>
                <div className="help">{S.settings.groupsPerSessionHelp}</div>
              </div>
              <Stepper
                value={settings.groupsPerSession}
                min={GROUPS_PER_SESSION_RANGE.min}
                max={GROUPS_PER_SESSION_RANGE.max}
                onChange={(v) => set({ groupsPerSession: v })}
                label={S.settings.groupsPerSession}
              />
            </div>
            <div className="freq-row">
              <div className="label" style={{ fontWeight: 600 }}>
                {S.settings.shape}
              </div>
              <Segmented
                value={settings.shape}
                options={[
                  { value: 'fokus', label: SHAPE_LABEL.fokus },
                  { value: 'helkropp', label: SHAPE_LABEL.helkropp },
                ]}
                onChange={(v) => set({ shape: v })}
              />
              <div className="help muted small">{SHAPE_HELP[settings.shape]}</div>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>{S.settings.frequencyTitle}</SectionTitle>
          <p className="muted small" style={{ marginBottom: 8 }}>
            {S.settings.frequencyHelp}
          </p>
          <div className="list">
            {GROUP_ORDER.map((g) => (
              <div className="freq-row" key={g}>
                <div style={{ fontWeight: 600 }}>
                  <span aria-hidden="true">{GROUP_ICON[g]}</span> {GROUP_LABEL[g]}
                </div>
                <Segmented value={settings.frequency[g]} options={freqOptions} onChange={(f) => set({ frequency: { ...settings.frequency, [g]: f } })} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>{S.settings.restTitle}</SectionTitle>
          <p className="muted small" style={{ marginBottom: 8 }}>
            {S.settings.restHelp}
          </p>
          <div className="list">
            {GROUP_ORDER.map((g) => (
              <div className="setting-row" key={g}>
                <div className="label">
                  <span aria-hidden="true">{GROUP_ICON[g]}</span> {GROUP_LABEL[g]}
                </div>
                <Stepper
                  value={settings.restDays[g]}
                  min={REST_DAYS_RANGE.min}
                  max={REST_DAYS_RANGE.max}
                  onChange={(v) => set({ restDays: { ...settings.restDays, [g]: v } })}
                  label={`${GROUP_LABEL[g]} ${S.settings.restTitle}`}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <Button variant="ghost" block onClick={() => setConfirmReset(true)}>
              {S.settings.resetDefaults}
            </Button>
          </div>
        </section>

        <section>
          <SectionTitle>{S.settings.backupTitle}</SectionTitle>
          <p className="muted small" style={{ marginBottom: 8 }}>
            {S.settings.backupHelp}
          </p>
          <div className="stack">
            <Button block onClick={() => void onExport()}>
              📤 {S.settings.export}
            </Button>
            <Button block variant="secondary" onClick={() => fileRef.current?.click()}>
              📥 {S.settings.import}
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => void onFile(e.target.files?.[0])} />
            <p className="muted small">
              {S.settings.lastExport}: {settings.lastExportAt ? formatLongDate(settings.lastExportAt.slice(0, 10)) : S.settings.lastExportNever}
            </p>
          </div>
        </section>

        <section>
          <div className="list">
            <ListRow title={S.settings.about} sub={`${APP_NAME} ${__APP_VERSION__}`} onClick={() => setAbout(true)} />
            <ListRow title={S.settings.onboardingAgain} onClick={onShowOnboarding} />
          </div>
        </section>
      </div>

      {about ? <DiagnosticsSheet settings={settings} onClose={() => setAbout(false)} /> : null}
      {pendingImport ? (
        <ConfirmDialog
          title={S.settings.importConfirmTitle}
          text={`${S.settings.importSummary(pendingImport.exercises.length, pendingImport.sessions.length)} ${S.settings.importConfirm}`}
          confirmLabel={S.settings.import}
          danger
          onCancel={() => setPendingImport(undefined)}
          onConfirm={() => void doImport()}
        />
      ) : null}
      {confirmReset ? (
        <ConfirmDialog
          title={S.settings.resetDefaults}
          confirmLabel={S.common.ok}
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            set({
              frequency: { ...DEFAULT_FREQUENCY },
              restDays: { ...DEFAULT_REST_DAYS },
              exercisesPerSession: EXERCISES_PER_SESSION,
              groupsPerSession: GROUPS_PER_SESSION,
              shape: 'fokus',
            });
          }}
        />
      ) : null}
      {toast ? <Toast text={toast} onDismiss={() => setToast(undefined)} /> : null}
    </div>
  );
}

function DiagnosticsSheet({ settings, onClose }: { settings: Settings; onClose: () => void }) {
  const errors = useLiveQuery(() => db.errors.orderBy('id').reverse().limit(20).toArray(), []);
  const exerciseCount = useLiveQuery(() => db.exercises.count(), []);
  const sessionCount = useLiveQuery(() => db.sessions.count(), []);
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number }>();
  const [persisted, setPersisted] = useState<boolean | undefined>(settings.storagePersisted);
  const [sw, setSw] = useState<string>('…');
  const [catalogSize, setCatalogSize] = useState<number>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setEstimate({ usage: e.usage, quota: e.quota }))
      .catch(() => undefined);
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => undefined);
    serviceWorkerStatus()
      .then((s) => setSw(s === 'active' ? S.settings.swActive : S.settings.swMissing))
      .catch(() => setSw(S.settings.swMissing));
    loadCatalog()
      .then((c) => setCatalogSize(c.length))
      .catch(() => undefined);
  }, []);

  const standalone = isStandalone();
  const rows: [string, string][] = [
    [S.settings.version, __APP_VERSION__],
    [S.settings.buildDate, __BUILD_DATE__.slice(0, 16).replace('T', ' ')],
    [S.settings.displayMode, standalone ? S.settings.standalone : S.settings.browser],
    [S.settings.persisted, persisted === undefined ? S.settings.persistedUnknown : persisted ? S.settings.persistedYes : S.settings.persistedNo],
    [S.settings.storage, estimate?.usage !== undefined && estimate.quota !== undefined ? S.settings.storageUsage(formatBytes(estimate.usage), formatBytes(estimate.quota)) : '–'],
    [S.settings.serviceWorker, sw],
    [S.settings.counts, S.settings.countsText(exerciseCount ?? 0, sessionCount ?? 0)],
    [S.settings.catalogSize, catalogSize !== undefined ? S.settings.catalogEntries(catalogSize) : '–'],
    [S.settings.firstUse, settings.firstUseDate],
    [S.settings.lastExport, settings.lastExportAt ?? S.settings.lastExportNever],
  ];

  const diagnosticsText = () =>
    [
      `${APP_NAME} diagnostics`,
      ...rows.map(([k, v]) => `${k}: ${v}`),
      `UA: ${navigator.userAgent}`,
      `Lang: ${navigator.language}`,
      `Screen: ${window.screen.width}x${window.screen.height} @${window.devicePixelRatio}`,
      `Settings: ${JSON.stringify(settings)}`,
      '',
      `${S.settings.errors}:`,
      ...(errors ?? []).map((e) => `[${e.at}] ${e.message}${e.stack ? `\n${e.stack}` : ''}`),
    ].join('\n');

  const copy = async () => {
    const text = diagnosticsText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Sheet
      title={S.settings.aboutTitle}
      onClose={onClose}
      full
      footer={
        <Button block onClick={() => void copy()}>
          {copied ? S.settings.copied : S.settings.copyDiagnostics}
        </Button>
      }
    >
      <div className="stack-lg">
        <div className="list">
          {rows.map(([k, v]) => (
            <div className="setting-row" key={k}>
              <span className="label">{k}</span>
              <span className="muted" style={{ textAlign: 'right' }}>
                {v}
              </span>
            </div>
          ))}
        </div>
        <div>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <SectionTitle>{S.settings.errors}</SectionTitle>
            {(errors?.length ?? 0) > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => void db.errors.clear()}>
                {S.settings.clearErrors}
              </Button>
            ) : null}
          </div>
          {errors && errors.length === 0 ? <p className="muted small">{S.settings.noErrors}</p> : null}
          {errors && errors.length > 0 ? (
            <pre className="diag">{errors.map((e) => `[${e.at.slice(0, 19).replace('T', ' ')}] ${e.message}${e.stack ? `\n${e.stack}` : ''}`).join('\n\n')}</pre>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

export type { GroupId };
