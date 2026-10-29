import { ArchiveIcon, ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, RotateCcwIcon, Trash2Icon, UserMinusIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '@/app/paths';
import type { Player, Team } from '@/domain/schemas';
import { displayName, initials, sortSquad } from '@/domain/squads/players';
import { t } from '@/i18n';
import { useRepoQuery, useRepositories } from '@/storage';
import { cn } from '@/ui/cn';
import { Avatar } from '@/ui/components/avatar';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';
import { Page } from '@/ui/components/page';
import { toast } from '@/ui/components/toaster';
import { DeleteTeamDialog } from './DeleteTeamDialog';
import { PlayerFormDialog } from './PlayerFormDialog';
import { PositionChips } from '@/ui/PositionChips';
import { RemovePlayerDialog } from './RemovePlayerDialog';
import { TeamFormDialog } from './TeamFormDialog';

type PlayerDialog = { mode: 'add' } | { mode: 'edit'; player: Player } | null;

export function TeamPage() {
  const { teamId = '' } = useParams();
  const repos = useRepositories();

  const data = useRepoQuery(async () => {
    const [team, players, matchCount] = await Promise.all([repos.teams.get(teamId), repos.players.listByTeam(teamId), repos.matches.countByTeam(teamId)]);
    return { team: team && !team.deletedAt ? team : null, players: sortSquad(players), matchCount };
  }, [repos, teamId]);

  const [playerDialog, setPlayerDialog] = useState<PlayerDialog>(null);
  const [removing, setRemoving] = useState<Player | null>(null);
  const [editingTeam, setEditingTeam] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (data === undefined) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground" role="status">
        {t('common.loading')}
      </p>
    );
  }

  if (!data.team) {
    return (
      <Page title={t('team.notFound')} subtitle={t('team.notFoundBody')}>
        <BackLink to={paths.squads} label={t('team.backToSquads')} />
      </Page>
    );
  }

  const { team, players, matchCount } = data;
  const active = players.filter((p) => !p.archived);
  const archived = players.filter((p) => p.archived);
  const nameOf = (p: Player) => displayName(p, team);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <BackLink to={paths.squads} label={t('team.backToSquads')} />

      <div className="mt-3 mb-8 flex flex-wrap items-center gap-4">
        <Avatar kind="team" src={team.logo} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{team.name}</h1>
            {team.nameDisplay === 'initials' && <Badge>{t('squads.initialsBadge')}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length === 1 ? t('squads.playerCountOne') : t('squads.playerCount', { count: active.length })}
            {team.coachName && ` · ${t('squads.coach', { name: team.coachName })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setPlayerDialog({ mode: 'add' })}>
            <PlusIcon />
            {t('team.addPlayer')}
          </Button>
          <TeamMenu matchCount={matchCount} onEdit={() => setEditingTeam(true)} onDelete={() => setDeletingTeam(true)} />
        </div>
      </div>

      <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('team.players')}</h2>
      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <p className="font-medium">{t('team.noPlayers.title')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('team.noPlayers.body')}</p>
          <Button className="mt-5" onClick={() => setPlayerDialog({ mode: 'add' })}>
            <PlusIcon />
            {t('team.addPlayer')}
          </Button>
        </div>
      ) : (
        <ul className="grid gap-2">
          {active.map((player) => (
            <PlayerRow key={player.id} player={player} team={team} name={nameOf(player)}>
              <PlayerMenu name={nameOf(player)} onEdit={() => setPlayerDialog({ mode: 'edit', player })} onRemove={() => setRemoving(player)} />
            </PlayerRow>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setArchiveOpen((o) => !o)}
            aria-expanded={archiveOpen}
            className="flex cursor-pointer items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-foreground"
          >
            <ArchiveIcon className="size-4" />
            {t('team.archive')} ({archived.length})
            <ChevronDownIcon className={cn('size-4 transition-transform', !archiveOpen && '-rotate-90')} />
          </button>
          {archiveOpen && (
            <>
              <p className="mt-2 mb-3 text-sm text-muted-foreground">{t('team.archiveHint')}</p>
              <ul className="grid gap-2">
                {archived.map((player) => (
                  <PlayerRow key={player.id} player={player} team={team} name={nameOf(player)} muted>
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        await repos.players.restore(player.id);
                        toast.success(t('team.restored'));
                      }}
                    >
                      <RotateCcwIcon />
                      {t('team.restore')}
                    </Button>
                  </PlayerRow>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <PlayerFormDialog
        open={playerDialog !== null}
        onOpenChange={(open) => !open && setPlayerDialog(null)}
        teamId={team.id}
        teamName={team.name}
        player={playerDialog?.mode === 'edit' ? playerDialog.player : undefined}
      />
      <RemovePlayerDialog player={removing} name={removing ? nameOf(removing) : ''} onClose={() => setRemoving(null)} />
      <TeamFormDialog open={editingTeam} onOpenChange={setEditingTeam} team={team} />
      <DeleteTeamDialog open={deletingTeam} onOpenChange={setDeletingTeam} team={team} players={players} />
    </div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" />
      {label}
    </Link>
  );
}

function PlayerRow({ player, team, name, muted, children }: { player: Player; team: Team; name: string; muted?: boolean; children: ReactNode }) {
  return (
    <li className={cn('flex items-center gap-4 rounded-xl border bg-surface px-4 py-3 shadow-sm', muted && 'bg-muted/40 shadow-none')}>
      <Avatar src={player.photo} fallback={initials(player.name)} className={cn(muted && 'opacity-60 grayscale')} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-medium', muted && 'text-muted-foreground')}>{name}</p>
        <PositionChips positions={player.positions} className="mt-1" />
      </div>
      <Button asChild variant="outline">
        <Link to={paths.player(team.id, player.id)} aria-label={`${t('player.access')}: ${name}`}>
          {t('player.access')}
          <ChevronRightIcon />
        </Link>
      </Button>
      {children}
    </li>
  );
}

function PlayerMenu({ name, onEdit, onRemove }: { name: string; onEdit: () => void; onRemove: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('player.menu', { name })}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon />
          {t('player.edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <UserMinusIcon />
          {t('player.remove')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TeamMenu({ matchCount, onEdit, onDelete }: { matchCount: number; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label={t('common.more')}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon />
          {t('team.edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={matchCount > 0} onSelect={onDelete}>
          <Trash2Icon />
          <span className="grid">
            {t('team.delete')}
            {matchCount > 0 && <span className="text-xs text-muted-foreground">{t('team.deleteBlocked')}</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
