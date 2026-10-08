import { logError } from '../db/db';

let installed = false;

/** Captures uncaught errors and unhandled rejections into IndexedDB for the diagnostics screen. */
export function installErrorCapture(): void {
  if (installed) return;
  installed = true;
  window.addEventListener('error', (event) => {
    const err = event.error as unknown;
    const message = event.message || (err instanceof Error ? err.message : String(err));
    const stack = err instanceof Error ? err.stack : `${event.filename}:${event.lineno}:${event.colno}`;
    void logError(message, stack);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as unknown;
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : JSON.stringify(reason);
    void logError(`Unhandled rejection: ${message}`, reason instanceof Error ? reason.stack : undefined);
  });
}

export function reportError(context: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  void logError(`${context}: ${message}`, err instanceof Error ? err.stack : undefined);
}
