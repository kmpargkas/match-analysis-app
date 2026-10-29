import type { MatchLogRow } from '@/domain/matches/matchLog';
import { t } from '@/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/ui/components/alert-dialog';
import { matchTitle } from './matchLinks';

export function DeleteMatchDialog({ row, onCancel, onConfirm }: { row: MatchLogRow | null; onCancel: () => void; onConfirm: (row: MatchLogRow) => void }) {
  return (
    <AlertDialog open={row !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('home.delete.title')}</AlertDialogTitle>
        <AlertDialogDescription>{row && t('home.delete.body', { match: matchTitle(row), count: row.eventCount })}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('home.delete.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => row && onConfirm(row)}>{t('home.delete.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
