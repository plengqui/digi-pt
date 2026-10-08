import { registerSW } from 'virtual:pwa-register';

export interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
}

type Listener = (state: PwaState) => void;
const listeners = new Set<Listener>();
let state: PwaState = { needRefresh: false, offlineReady: false };
let update: ((reload?: boolean) => Promise<void>) | undefined;

function emit(next: Partial<PwaState>) {
  state = { ...state, ...next };
  for (const l of listeners) l(state);
}

/**
 * Registers the service worker. The worker uses skipWaiting + clientsClaim, so a new version
 * takes over as soon as it is downloaded; we also check for updates whenever the app is shown
 * again, which means an update reaches the phone within one app restart.
 */
export function setupPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      emit({ needRefresh: true });
    },
    onOfflineReady() {
      emit({ offlineReady: true });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        registration.update().catch(() => undefined);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      window.setInterval(check, 60 * 60 * 1000);
    },
  });
  // When a new worker takes control, reload so the new shell is used right away.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

export function applyUpdate(): void {
  if (update) void update(true);
  else window.location.reload();
}

export function subscribePwa(l: Listener): () => void {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

export async function serviceWorkerStatus(): Promise<'active' | 'missing' | 'unsupported'> {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg?.active ? 'active' : 'missing';
}
