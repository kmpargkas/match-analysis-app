import { ArrowLeftIcon, FileChartColumnIcon } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '@/app/paths';
import type { PlayerMatch } from '@/domain/report';
import type { Match } from '@/domain/schemas';
import { displayName, initials } from '@/domain/squads/players';
import { t } from '@/i18n';
import { Avatar } from '@/ui/components/avatar';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { PositionChips } from '@/ui/PositionChips';
import { IncompleteMark, PlayerBadges } from '@/ui/report/PlayerBadges';
import { PlayerDialog } from '@/ui/report/PlayerDialog';
import { usePlayerProfileData } from './usePlayerProfileData';

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const matchDate = (match: Match) => dateFormat.format(new Date(`${match.date}T00:00:00Z`));

export function PlayerProfilePage() {
  const { teamId = '', playerId = '' } = useParams();
  const data = usePlayerProfileData(teamId, playerId);

  if (data === undefined) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground" role="status">
        {t('common.loading')}
      </p>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link to={data ? paths.team(data.team.id) : paths.squads} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" />
        {data ? t('playerPage.backToTeam', { team: data.team.name }) : t('team.backToSquads')}
      </Link>

      {!data ? (
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t('playerPage.notFound')}</h1>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-4">
            <Avatar src={data.player.photo} fallback={initials(data.player.name)} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{displayName(data.player, data.team)}</h1>
                {data.player.archived && <Badge>{t('playerPage.archived')}</Badge>}
              </div>
              <PositionChips positions={data.player.positions} className="mt-1.5" />
            </div>
          </div>
          <MatchHistory matches={data.matches} />
        </>
      )}
    </div>
  );
}

/** The player's matches; "See match report" opens the same player popup as the match report, stepping through the matches they played. */
function MatchHistory({ matches }: { matches: readonly PlayerMatch[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const played = matches.filter((m) => m.player.line.played);
  const index = played.findIndex((m) => m.data.match.id === selected);
  const open = played[index];
  // Newest first, so the previous (earlier) match is the next row down.
  const earlier = played[index + 1];
  const later = played[index - 1];

  return (
    <section aria-labelledby="player-matches" className="mt-8 flex flex-col gap-3">
      <div className="flex items-baseline gap-2.5">
        <h2 id="player-matches" className="text-lg font-semibold">
          {t('playerPage.matches')}
        </h2>
        <span className="text-sm text-muted-foreground">{t('playerPage.matchesHint')}</span>
      </div>

      {matches.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{t('playerPage.noMatches')}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-surface shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t('playerPage.col.date')}</TableHead>
                <TableHead>{t('playerPage.col.match')}</TableHead>
                <TableHead className="text-center">{t('playerPage.col.score')}</TableHead>
                <TableHead>{t('playerPage.col.role')}</TableHead>
                <TableHead className="text-right">{t('playerPage.col.number')}</TableHead>
                <TableHead className="text-right">{t('playerPage.col.minutes')}</TableHead>
                <TableHead>{t('playerPage.col.events')}</TableHead>
                <TableHead className="w-44">
                  <span className="sr-only">{t('playerPage.col.report')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => (
                <MatchRow key={m.data.match.id} item={m} onOpen={() => setSelected(m.data.match.id)} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PlayerDialog
        player={open?.player}
        events={open?.data.events ?? []}
        context={open && t('playerPage.matchContext', { opponent: open.data.match.opponentName, date: matchDate(open.data.match) })}
        previous={{ label: t('playerPage.previousMatch'), go: earlier && (() => setSelected(earlier.data.match.id)) }}
        next={{ label: t('playerPage.nextMatch'), go: later && (() => setSelected(later.data.match.id)) }}
        onClose={() => setSelected(null)}
      />
    </section>
  );
}

function MatchRow({ item, onOpen }: { item: PlayerMatch; onOpen: () => void }) {
  const { match } = item.data;
  const { line } = item.player;
  const role = !line.played ? 'unused' : line.role;

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">{matchDate(match)}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <span>
            <span className="pr-1.5 text-muted-foreground">{t('home.vs')}</span>
            {match.opponentName}
          </span>
          {match.status === 'in_progress' && (
            <Badge variant="primary">
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {t('status.in_progress')}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{[t(`home.venue.${match.homeAway}`), match.competition].filter(Boolean).join(' · ')}</div>
      </TableCell>
      <TableCell className="text-center">
        <span className="inline-block min-w-14 rounded-md bg-muted px-2 py-1 font-semibold tabular-nums">
          {match.score.us}
          <span className="px-1 text-muted-foreground">–</span>
          {match.score.them}
        </span>
      </TableCell>
      <TableCell className={role === 'unused' ? 'text-muted-foreground' : undefined}>{t(`playerPage.role.${role}`)}</TableCell>
      <TableCell className="text-right tabular-nums">{line.shirtNumber}</TableCell>
      <TableCell className="text-right tabular-nums">{line.played ? `${line.minutes}'` : '—'}</TableCell>
      <TableCell>
        <span className="flex items-center gap-1.5">
          <PlayerBadges badges={line.badges} className="gap-1" />
          {line.incompleteCount > 0 && <IncompleteMark />}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {line.played && (
          <Button variant="outline" size="sm" onClick={onOpen} aria-label={t('playerPage.seeReportFor', { opponent: match.opponentName, date: matchDate(match) })}>
            <FileChartColumnIcon />
            {t('playerPage.seeReport')}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
