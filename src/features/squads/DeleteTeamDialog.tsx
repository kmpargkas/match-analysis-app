import { useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import type { Player, Team } from '@/domain/schemas';
import { t } from '@/i18n';
import { useRepositories } from '@/storage';
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

/** Only offered for teams without matches, so nothing that a report depends on is lost. */
export function DeleteTeamDialog({ open, onOpenChange, team, players }: { open: boolean; onOpenChange: (open: boolean) => void; team: Team; players: Player[] }) {
  const repos = useRepositories();
  const navigate = useNavigate();

  async function confirm() {
    // Re-check at the moment of deleting, in case a match was created meanwhile.
    if ((await repos.matches.countByTeam(team.id)) > 0) {
      toast.error(t('team.deleteBlocked'));
      return;
    }
    await Promise.all(players.map((p) => repos.players.softDelete(p.id)));
    await repos.teams.softDelete(team.id);
    toast.success(t('team.deleted'));
    navigate(paths.squads);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogTitle>{t('team.delete.title', { team: team.name })}</AlertDialogTitle>
        <AlertDialogDescription>{t('team.delete.body')}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>{t('team.delete.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
