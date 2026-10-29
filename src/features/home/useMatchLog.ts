import { actionCatalog } from '@/domain/catalog';
import { buildMatchLog, type MatchLogRow } from '@/domain/matches/matchLog';
import { useRepoQuery, useRepositories } from '@/storage';

export interface MatchLogState {
  rows: MatchLogRow[];
  hasTeams: boolean;
}

/** Live match log; `undefined` while loading. */
export function useMatchLog(): MatchLogState | undefined {
  const repos = useRepositories();
  return useRepoQuery(async () => {
    const [matches, teams] = await Promise.all([repos.matches.list(), repos.teams.list({ includeDeleted: true })]);
    const events = await repos.events.listByMatches(matches.map((m) => m.id));
    return {
      rows: buildMatchLog({ matches, teams, events, catalog: actionCatalog }),
      hasTeams: teams.some((team) => !team.deletedAt),
    };
  }, [repos]);
}
