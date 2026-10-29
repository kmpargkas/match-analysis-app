import { DownloadIcon, UploadIcon } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { t } from '@/i18n';
import { asCopy, countConflicts, exportAllData, lastBackupAt, parseBackup, useRepositories, type BackupFile, type BackupRecords } from '@/storage';
import { cn } from '@/ui/cn';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/ui/components/alert-dialog';
import { Button, buttonVariants } from '@/ui/components/button';
import { toast } from '@/ui/components/toaster';

const DAY_MS = 86_400_000;
const STALE_DAYS = 7;

function daysSince(iso: string, now = new Date()): number {
  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((midnight(now) - midnight(new Date(iso))) / DAY_MS);
}

function reminderText(at: string | null): string {
  if (!at) return t('backup.never');
  const days = daysSince(at);
  return days <= 0 ? t('backup.today') : days === 1 ? t('backup.yesterday') : t('backup.daysAgo', { count: days });
}

function importedText(records: BackupRecords): string {
  const matches = records.matches.length;
  if (matches === 1) return t('backup.imported.one');
  if (matches > 1) return t('backup.imported.many', { count: matches });
  return t('backup.imported.squads', { count: records.teams.length });
}

export function BackupControls({ hasData }: { hasData: boolean }) {
  const repos = useRepositories();
  const input = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState(lastBackupAt);
  const [pending, setPending] = useState<{ backup: BackupFile; conflicts: number } | null>(null);
  const stale = hasData && (!last || daysSince(last) >= STALE_DAYS);

  async function exportAll() {
    try {
      await exportAllData(repos);
      setLast(lastBackupAt());
      toast.success(t('backup.exported'));
    } catch {
      toast.error(t('backup.exportFailed'));
    }
  }

  async function write(records: BackupRecords) {
    setPending(null);
    try {
      await repos.backup.writeAll(records);
      toast.success(importedText(records));
    } catch {
      toast.error(t('backup.importFailed'));
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) return void toast.error(t(`backup.error.${result.error}`));
    const conflicts = countConflicts(result.backup, await repos.backup.existingIds());
    if (conflicts > 0) setPending({ backup: result.backup, conflicts });
    else await write(result.backup);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span title={t('backup.hint')} className={cn('mr-1 text-sm', stale ? 'font-medium text-warning-soft-foreground' : 'text-muted-foreground')}>
        {reminderText(last)}
      </span>
      <Button variant="outline" onClick={() => void exportAll()} disabled={!hasData}>
        <DownloadIcon />
        {t('home.exportAll')}
      </Button>
      <Button variant="outline" onClick={() => input.current?.click()}>
        <UploadIcon />
        {t('home.importJson')}
      </Button>
      <input ref={input} type="file" accept="application/json,.json" aria-label={t('backup.file')} className="sr-only" tabIndex={-1} onChange={(e) => void onFile(e)} />

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('backup.conflict.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('backup.conflict.body', { count: pending?.conflicts ?? 0 })}</AlertDialogDescription>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">{t('backup.conflict.keepBoth')}:</strong> {t('backup.conflict.keepBothHint')}
            </li>
            <li>
              <strong className="text-foreground">{t('backup.conflict.replace')}:</strong> {t('backup.conflict.replaceHint')}
            </li>
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => pending && void write(pending.backup)}>
              {t('backup.conflict.replace')}
            </AlertDialogAction>
            <AlertDialogAction className={buttonVariants({ variant: 'primary' })} onClick={() => pending && void write(asCopy(pending.backup))}>
              {t('backup.conflict.keepBoth')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
