import { paths } from '@/app/paths';
import type { MatchLogRow } from '@/domain/matches/matchLog';
import { t } from '@/i18n';

export function matchTitle(row: MatchLogRow): string {
  return `${row.teamName ?? t('home.unknownTeam')} ${t('home.vs')} ${row.opponentName}`;
}

export function matchHref(row: MatchLogRow): string {
  return row.status === 'in_progress' ? paths.collector(row.matchId) : paths.report(row.matchId);
}
