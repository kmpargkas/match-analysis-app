import { playerMatchHistory, type PlayerMatch } from '@/domain/report';
import type { Player, Team } from '@/domain/schemas';
import { loadReportData, useRepoQuery, useRepositories } from '@/storage';

export interface PlayerProfileData {
  team: Team;
  player: Player;
  /** Newest first. */
  matches: PlayerMatch[];
}

/** Live profile data; `undefined` while loading, `null` when the player isn't in that team. */
export function usePlayerProfileData(teamId: string, playerId: string): PlayerProfileData | null | undefined {
  const repos = useRepositories();
  return useRepoQuery(async () => {
    const [team, player, entries] = await Promise.all([repos.teams.get(teamId), repos.players.get(playerId), repos.lineups.listByPlayer(playerId)]);
    if (!team || team.deletedAt || !player || player.deletedAt || player.teamId !== team.id) return null;
    const matchIds = [...new Set(entries.map((e) => e.matchId))];
    const reports = await Promise.all(matchIds.map((id) => loadReportData(repos, id)));
    const live = reports.flatMap((r) => (r && r.match.teamId === team.id ? [r] : []));
    return { team, player, matches: playerMatchHistory(player.id, live) };
  }, [repos, teamId, playerId]);
}
