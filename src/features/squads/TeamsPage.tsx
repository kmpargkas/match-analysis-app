import { ChevronRightIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { paths } from '@/app/paths';
import { t } from '@/i18n';
import { useRepoQuery, useRepositories } from '@/storage';
import { Avatar } from '@/ui/components/avatar';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Page } from '@/ui/components/page';
import { TeamFormDialog } from './TeamFormDialog';

export function TeamsPage() {
  const repos = useRepositories();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // Home's "Create a team" links here with ?new=team.
  const [creating, setCreating] = useState(params.get('new') === 'team');

  const teams = useRepoQuery(async () => {
    const [teams, players] = await Promise.all([repos.teams.list(), repos.players.list()]);
    const counts = new Map<string, number>();
    for (const p of players) if (!p.archived) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
    return teams.map((team) => ({ team, playerCount: counts.get(team.id) ?? 0 })).sort((a, b) => a.team.name.localeCompare(b.team.name));
  }, [repos]);

  function setCreatingOpen(open: boolean) {
    setCreating(open);
    if (!open && params.has('new')) setParams({}, { replace: true });
  }

  return (
    <Page
      title={t('squads.title')}
      subtitle={t('squads.subtitle')}
      actions={
        <Button onClick={() => setCreatingOpen(true)}>
          <PlusIcon />
          {t('squads.createTeam')}
        </Button>
      }
    >
      {teams === undefined ? (
        <p className="py-16 text-center text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      ) : teams.length === 0 ? (
        <div className="rounded-xl border bg-surface px-6 py-16 text-center">
          <h2 className="text-lg font-semibold">{t('squads.empty.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('squads.empty.body')}</p>
          <Button className="mt-6" onClick={() => setCreatingOpen(true)}>
            <PlusIcon />
            {t('squads.createTeam')}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-2">
          {teams.map(({ team, playerCount }) => (
            <li key={team.id} className="flex items-center gap-4 rounded-xl border bg-surface px-4 py-3 shadow-sm">
              <Avatar kind="team" src={team.logo} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{team.name}</span>
                  {team.nameDisplay === 'initials' && <Badge>{t('squads.initialsBadge')}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {playerCount === 0 ? t('squads.noPlayers') : playerCount === 1 ? t('squads.playerCountOne') : t('squads.playerCount', { count: playerCount })}
                  {team.coachName && ` · ${t('squads.coach', { name: team.coachName })}`}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to={paths.team(team.id)} aria-label={`${t('squads.accessTeam')}: ${team.name}`}>
                  {t('squads.accessTeam')}
                  <ChevronRightIcon />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <TeamFormDialog open={creating} onOpenChange={setCreatingOpen} onSaved={(team) => navigate(paths.team(team.id))} />
    </Page>
  );
}
