import { ArrowRightIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import type { Team } from '@/domain/schemas';
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
import { Avatar } from '@/ui/components/avatar';
import { Button } from '@/ui/components/button';

interface TeamOption {
  team: Team;
  playerCount: number;
}

export function TeamSection({ teams, team, hasLineup, onPick, onChange }: {
  teams: TeamOption[] | undefined;
  team: Team | undefined;
  /** Changing team clears the matchday squad, so ask first when there is one. */
  hasLineup: boolean;
  onPick: (teamId: string) => void;
  onChange: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (teams === undefined) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('common.loading')}
      </p>
    );
  }

  if (team) {
    const count = teams.find((x) => x.team.id === team.id)?.playerCount ?? 0;
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Avatar kind="team" src={team.logo} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold">{team.name}</p>
          <p className="text-sm text-muted-foreground">
            {count === 1 ? t('squads.playerCountOne') : t('squads.playerCount', { count })}
            {team.coachName && ` · ${t('squads.coach', { name: team.coachName })}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => (hasLineup ? setConfirming(true) : onChange())}>
          <RefreshCwIcon />
          {t('matchSetup.team.change')}
        </Button>

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogTitle>{t('matchSetup.team.change.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('matchSetup.team.change.body')}</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onChange}>{t('matchSetup.team.change.confirm')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="font-medium">{t('matchSetup.team.none.title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('matchSetup.team.none.body')}</p>
        <Button asChild className="mt-5">
          <Link to={paths.newTeam}>{t('matchSetup.team.none.action')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map(({ team: option, playerCount }) => (
        <li key={option.id}>
          <button
            type="button"
            onClick={() => onPick(option.id)}
            aria-label={t('matchSetup.team.pick', { team: option.name })}
            className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-background px-4 py-3 text-left transition-colors outline-none hover:border-primary hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Avatar kind="team" src={option.logo} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{option.name}</span>
              <span className="block text-xs text-muted-foreground">
                {playerCount === 1 ? t('squads.playerCountOne') : t('squads.playerCount', { count: playerCount })}
              </span>
            </span>
            <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        </li>
      ))}
    </ul>
  );
}
