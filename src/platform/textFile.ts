export function downloadTextFile(fileName: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const LAST_BACKUP_KEY = 'match-analysis:lastBackupAt';

/** Browser-only convenience: losing it just means the reminder says "never". */
export function readLastBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function writeLastBackupAt(at: string) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, at);
  } catch {
    // Storage blocked: the reminder keeps asking, which is safe.
  }
}
