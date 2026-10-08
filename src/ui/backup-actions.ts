import { backupFileName, buildBackup, parseBackup, restoreBackup, type BackupFile } from '../db/backup';
import { updateSettings } from '../db/db';
import { todayLocal } from '../engine/dates';

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

/** Builds the backup and hands it to the share sheet, falling back to a download. */
export async function exportBackup(): Promise<ExportResult> {
  const backup = await buildBackup();
  const text = JSON.stringify(backup, null, 2);
  const name = backupFileName(todayLocal());
  const file = new File([text], name, { type: 'application/json' });

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      await updateSettings({ lastExportAt: new Date().toISOString() });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // Fall through to download on other failures.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await updateSettings({ lastExportAt: new Date().toISOString() });
  return 'downloaded';
}

export async function readBackupFile(file: File): Promise<BackupFile> {
  const text = await file.text();
  return parseBackup(text);
}

export async function importBackup(backup: BackupFile): Promise<void> {
  await restoreBackup(backup);
}
