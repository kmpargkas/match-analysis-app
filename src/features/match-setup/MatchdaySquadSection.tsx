import { CheckIcon } from 'lucide-react';
import type { Dispatch } from 'react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { validateLineup, type DraftAction, type LineupDraft } from '@/domain/lineup';
import { MAX_SHIRT_NUMBER, MIN_SHIRT_NUMBER, type Player, type Team } from '@/domain/schemas';
import { displayName, initials } from '@/domain/squads/players';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Avatar } from '@/ui/components/avatar';
import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/form';
import { PositionChips } from '@/ui/PositionChips';

export function MatchdaySquadSection({ team, players, draft, dispatch }: {
  team: Team;
  players: Player[];
  draft: LineupDraft;
  dispatch: Dispatch<DraftAction>;
}) {
  if (players.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-10 text-center">
        <p className="font-medium">{t('matchSetup.squad.empty.title')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('matchSetup.squad.empty.body')}</p>
        <Button asChild className="mt-5">
          <Link to={paths.team(team.id)}>{t('matchSetup.squad.empty.action')}</Link>
        </Button>
      </div>
    );
  }

  const picked = new Map(draft.squad.map((p) => [p.playerId, p]));
  const numberProblem = new Map<string, 'numberInvalid' | 'numberDuplicate'>();
  for (const problem of validateLineup(draft)) {
    if (problem.code === 'numberInvalid' || problem.code === 'numberDuplicate') numberProblem.set(problem.playerId, problem.code);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-medium tabular-nums">{t('matchSetup.squad.count', { count: draft.squad.length })}</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={picked.size === players.length}
          onClick={() => players.filter((p) => !picked.has(p.id)).forEach((p) => dispatch({ type: 'togglePlayer', playerId: p.id }))}
        >
          {t('matchSetup.squad.selectAll')}
        </Button>
        <Button variant="ghost" size="sm" disabled={picked.size === 0} onClick={() => draft.squad.forEach((p) => dispatch({ type: 'togglePlayer', playerId: p.playerId }))}>
          {t('matchSetup.squad.clear')}
        </Button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => {
          const entry = picked.get(player.id);
          const name = displayName(player, team);
          const problem = numberProblem.get(player.id);
          return (
            <li
              key={player.id}
              className={cn(
                'flex items-center gap-2 rounded-xl border bg-background py-2 pr-2 pl-2.5 transition-colors',
                entry && 'border-primary/60 bg-primary-soft/50',
                problem && 'border-destructive/70',
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={!!entry}
                aria-label={name}
                onClick={() => dispatch({ type: 'togglePlayer', playerId: player.id })}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    'inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                    entry ? 'border-primary bg-primary text-primary-foreground' : 'bg-surface',
                  )}
                >
                  {entry && <CheckIcon className="size-3.5" strokeWidth={3} />}
                </span>
                <Avatar src={player.photo} fallback={initials(player.name)} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{name}</span>
                  <PositionChips positions={player.positions} className="mt-0.5" />
                </span>
              </button>

              {entry && (
                <div className="grid justify-items-center">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={MIN_SHIRT_NUMBER}
                    max={MAX_SHIRT_NUMBER}
                    aria-label={t('matchSetup.squad.number', { name })}
                    aria-invalid={!!problem}
                    placeholder={t('matchSetup.squad.numberPlaceholder')}
                    value={entry.shirtNumber ?? ''}
                    onChange={(e) => dispatch({ type: 'setShirtNumber', playerId: player.id, shirtNumber: e.target.value === '' ? undefined : Number(e.target.value) })}
                    className="h-10 w-16 text-center text-base font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  {problem && (
                    <span className="mt-0.5 text-[10px] leading-tight text-destructive">
                      {problem === 'numberDuplicate' ? t('matchSetup.squad.duplicate') : t('matchSetup.squad.invalid')}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
