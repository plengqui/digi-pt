import { useEffect, useState } from 'react';
import { ensureSettings, updateSettings } from './db/db';
import { S } from './strings';
import { useSettings } from './ui/hooks';
import { isIos, isStandalone } from './ui/hooks';
import { Toast } from './ui/components';
import { applyUpdate, subscribePwa, type PwaState } from './ui/pwa';
import { InstallGate } from './ui/screens/InstallGate';
import { Onboarding } from './ui/screens/Onboarding';
import { TodayScreen } from './ui/screens/TodayScreen';
import { ExercisesScreen } from './ui/screens/ExercisesScreen';
import { HistoryScreen } from './ui/screens/HistoryScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { reportError } from './ui/errors';

export type Tab = 'today' | 'exercises' | 'history' | 'settings';

const TAB_ICONS: Record<Tab, string> = { today: '📅', exercises: '💪', history: '📖', settings: '⚙️' };
const TABS: Tab[] = ['today', 'exercises', 'history', 'settings'];
const TAB_LABEL: Record<Tab, string> = {
  today: S.tabs.today,
  exercises: S.tabs.exercises,
  history: S.tabs.history,
  settings: S.tabs.settings,
};

const GATE_BYPASS_KEY = 'digital-pt-gate-bypass';

function gateBypassed(): boolean {
  try {
    if (new URLSearchParams(window.location.search).has('debug')) {
      sessionStorage.setItem(GATE_BYPASS_KEY, '1');
      return true;
    }
    return sessionStorage.getItem(GATE_BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}

export function App() {
  const [standalone] = useState(() => isStandalone());
  const [bypass, setBypass] = useState(() => gateBypassed());
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>('today');
  const [pwa, setPwa] = useState<PwaState>({ needRefresh: false, offlineReady: false });
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => subscribePwa(setPwa), []);

  useEffect(() => {
    ensureSettings()
      .then(async (s) => {
        if (s.storagePersisted === undefined && navigator.storage && 'persist' in navigator.storage) {
          try {
            const persisted = await navigator.storage.persist();
            await updateSettings({ storagePersisted: persisted });
          } catch (err) {
            reportError('storage.persist', err);
          }
        }
      })
      .catch((err) => reportError('ensureSettings', err));
  }, []);

  if (!standalone && !bypass) {
    return (
      <InstallGate
        allowContinue={!isIos()}
        onContinue={() => {
          try {
            sessionStorage.setItem(GATE_BYPASS_KEY, '1');
          } catch {
            // ignore
          }
          setBypass(true);
        }}
      />
    );
  }

  if (!settings) {
    return (
      <div className="gate">
        <p className="muted">{S.common.loading}</p>
      </div>
    );
  }

  if (!settings.onboardingDone || showOnboarding) {
    return (
      <Onboarding
        onDone={async () => {
          await updateSettings({ onboardingDone: true });
          setShowOnboarding(false);
          setTab('today');
        }}
      />
    );
  }

  return (
    <div className="app">
      {tab === 'today' && <TodayScreen settings={settings} />}
      {tab === 'exercises' && <ExercisesScreen />}
      {tab === 'history' && <HistoryScreen settings={settings} />}
      {tab === 'settings' && <SettingsScreen settings={settings} onShowOnboarding={() => setShowOnboarding(true)} />}

      <nav className="tabbar" aria-label="Flikar">
        {TABS.map((t) => (
          <button key={t} type="button" className={t === tab ? 'active' : ''} onClick={() => setTab(t)} aria-current={t === tab ? 'page' : undefined}>
            <span className="tab-icon" aria-hidden="true">
              {TAB_ICONS[t]}
            </span>
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {pwa.needRefresh ? (
        <Toast text={S.update.ready} action={S.update.reload} onAction={applyUpdate} onDismiss={() => setPwa((p) => ({ ...p, needRefresh: false }))} timeout={0} />
      ) : pwa.offlineReady ? (
        <Toast text={S.update.offlineReady} onDismiss={() => setPwa((p) => ({ ...p, offlineReady: false }))} />
      ) : null}
    </div>
  );
}
