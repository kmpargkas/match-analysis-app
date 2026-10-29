import { CheckIcon, DownloadIcon, ExternalLinkIcon, FileChartColumnIcon, FlagIcon, MoreHorizontalIcon, RotateCcwIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import type { MatchLogRow } from '@/domain/matches/matchLog';
import { t } from '@/i18n';
import { exportMatchData, useRepositories } from '@/storage';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';
import { toast } from '@/ui/components/toaster';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/table';
import { matchHref, matchTitle } from './matchLinks';

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function MatchLogTable({ rows, onDelete }: { rows: MatchLogRow[]; onDelete: (row: MatchLogRow) => void }) {
  const navigate = useNavigate();

  return (
    <div className="overflow-hidden rounded-xl border bg-surface shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>{t('home.col.date')}</TableHead>
            <TableHead>{t('home.col.match')}</TableHead>
            <TableHead className="text-center">{t('home.col.score')}</TableHead>
            <TableHead>{t('home.col.competition')}</TableHead>
            <TableHead>{t('home.col.status')}</TableHead>
            <TableHead className="text-right">{t('home.col.events')}</TableHead>
            <TableHead>{t('home.col.incomplete')}</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">{t('home.col.actions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.matchId} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate(matchHref(row))}>
              <TableCell className="whitespace-nowrap">
                <div className="font-medium">{dateFormat.format(new Date(`${row.date}T00:00:00Z`))}</div>
                {row.kickoffTime && <div className="text-xs text-muted-foreground tabular-nums">{row.kickoffTime}</div>}
              </TableCell>

              <TableCell>
                {/* The link keeps rows reachable by keyboard; the row click is a mouse shortcut. */}
                <Link to={matchHref(row)} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline focus-visible:underline focus-visible:outline-none">
                  <span className={row.teamName ? undefined : 'text-muted-foreground italic'}>{row.teamName ?? t('home.unknownTeam')}</span>
                  <span className="px-1.5 text-muted-foreground">{t('home.vs')}</span>
                  {row.opponentName}
                </Link>
                <div className="text-xs text-muted-foreground">{t(`home.venue.${row.homeAway}`)}</div>
              </TableCell>

              <TableCell className="text-center">
                <span className="inline-block min-w-14 rounded-md bg-muted px-2 py-1 text-base font-semibold tabular-nums">
                  {row.score.us}
                  <span className="px-1 text-muted-foreground">–</span>
                  {row.score.them}
                </span>
              </TableCell>

              <TableCell className="text-muted-foreground">{row.competition || '—'}</TableCell>

              <TableCell>
                {row.status === 'in_progress' ? (
                  <Badge variant="primary">
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                    {t('status.in_progress')}
                  </Badge>
                ) : (
                  <Badge variant="muted">{t('status.finished')}</Badge>
                )}
              </TableCell>

              <TableCell className="text-right tabular-nums">{row.eventCount}</TableCell>

              <TableCell>
                <IncompleteCell row={row} />
              </TableCell>

              {/* Menus are portaled, but React events still bubble here: keep them off the row. */}
              <TableCell onClick={(e) => e.stopPropagation()}>
                <RowMenu row={row} onDelete={() => onDelete(row)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function IncompleteCell({ row }: { row: MatchLogRow }) {
  if (row.eventCount === 0) return <span className="text-muted-foreground">—</span>;
  if (row.incompleteCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CheckIcon className="size-3.5 text-primary" />
        {t('home.allComplete')}
      </span>
    );
  }
  return (
    <Badge variant="warning">
      <TriangleAlertIcon className="size-3.5" />
      {t('home.incompleteCount', { count: row.incompleteCount })}
    </Badge>
  );
}

function RowMenu({ row, onDelete }: { row: MatchLogRow; onDelete: () => void }) {
  const navigate = useNavigate();
  const repos = useRepositories();
  const finished = row.status === 'finished';
  const setStatus = (status: MatchLogRow['status']) => void repos.matches.update(row.matchId, { status }).catch(() => toast.error(t('common.saveFailed')));

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${t('home.row.menu')}: ${matchTitle(row)}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {finished ? (
          <DropdownMenuItem onSelect={() => navigate(paths.report(row.matchId))}>
            <FileChartColumnIcon />
            {t('home.row.report')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => navigate(paths.collector(row.matchId))}>
            <ExternalLinkIcon />
            {t('home.row.open')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => setStatus(finished ? 'in_progress' : 'finished')}>
          {finished ? <RotateCcwIcon /> : <FlagIcon />}
          {finished ? t('home.row.reopen') : t('home.row.markFinished')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportMatchData(repos, row.matchId).catch(() => toast.error(t('backup.exportFailed')))}>
          <DownloadIcon />
          {t('home.row.exportJson')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon />
          {t('home.row.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
