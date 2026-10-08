import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Exercise, Session, Settings } from '../types';
import { db } from '../db/db';
import { todayLocal } from '../engine/dates';

export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.toArray(), []);
}

export function useSessions(): Session[] | undefined {
  return useLiveQuery(() => db.sessions.toArray(), []);
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('settings'), []);
}

/** undefined while loading, null when there is no session for the date. */
export function useSession(date: string): Session | undefined | null {
  const s = useLiveQuery(async () => (await db.sessions.get(date)) ?? null, [date], 'loading' as const);
  return s === 'loading' ? undefined : s;
}

/** Today's local date, re-evaluated when the app becomes visible and at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayLocal());
  useEffect(() => {
    const refresh = () => setToday(todayLocal());
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
    const t = window.setTimeout(refresh, midnight.getTime() - now.getTime());
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.clearTimeout(t);
    };
  }, [today]);
  return today;
}

export function useExerciseMap(exercises: Exercise[] | undefined): Map<string, Exercise> {
  return useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises]);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/.test(ua);
}
