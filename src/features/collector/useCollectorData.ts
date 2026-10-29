import type { ClockAnchor, LineupEntry, Match, MatchEvent, Player, PossessionChange, Team } from '@/domain/schemas';
import { useRepoQuery, useRepositories } from '@/storage';

export interface LineupPlayer {
  entry: LineupEntry;
  player: Player;
}

export interface CollectorData {
  match: Match;
  team: Team | null;
  lineup: LineupPlayer[];
  events: MatchEvent[];
  anchors: ClockAnchor[];
  possession: PossessionChange[];
}

/** Live match data; `undefined` while loading, `null` when the match doesn't exist. */
export function useCollectorData(matchId: string): CollectorData | null | undefined {
  const repos = useRepositories();
  return useRepoQuery(async () => {
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
  }, [repos, matchId]);
}
