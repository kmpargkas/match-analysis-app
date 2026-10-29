import type { ReportData } from '@/domain/report';
import type { Repositories } from './repositories';

/** One match's data for the report and the player popup; `null` when the match doesn't exist. */
export async function loadReportData(repos: Repositories, matchId: string): Promise<ReportData | null> {
  const match = await repos.matches.get(matchId);
  if (!match || match.deletedAt) return null;
  const [team, entries, players, events, anchors, possession] = await Promise.all([
    repos.teams.get(match.teamId),
    repos.lineups.listByMatch(matchId),
    repos.players.listByTeam(match.teamId),
    repos.events.listByMatch(matchId),
    repos.clock.listByMatch(matchId),
    repos.possession.listByMatch(matchId),
  ]);
  const byId = new Map(players.map((p) => [p.id, p]));
  const lineup = entries.flatMap((entry) => {
    const player = byId.get(entry.playerId);
    return player ? [{ entry, player }] : [];
  });
  return { match, team: team ?? null, lineup, events, anchors, possession };
}
