import type { Player } from '@/domain/schemas';
import { t } from '@/i18n';
import { useRepoQuery, useRepositories } from '@/storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/ui/components/alert-dialog';
import { toast } from '@/ui/components/toaster';

export function RemovePlayerDialog({ player, name, onClose }: { player: Player | null; name: string; onClose: () => void }) {
  const repos = useRepositories();
  const hasMatchData = useRepoQuery(() => (player ? repos.players.hasMatchData(player.id) : Promise.resolve(false)), [repos, player?.id]);

  async function confirm() {
    if (!player) return;
    onClose();
    const result = await repos.players.remove(player.id);
    toast.success(result === 'archived' ? t('player.archived') : t('player.deleted'));
  }

  return (
    <AlertDialog open={player !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('player.remove.title', { name })}</AlertDialogTitle>
        <AlertDialogDescription>
          {hasMatchData === undefined ? t('common.loading') : hasMatchData ? t('player.remove.archive', { name }) : t('player.remove.delete', { name })}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction disabled={hasMatchData === undefined} onClick={confirm}>
            {t('player.remove.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
