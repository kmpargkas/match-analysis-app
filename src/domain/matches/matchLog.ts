import type { ActionCatalog } from '../catalog';
import { completeness } from '../events/completeness';
import type { Match, MatchEvent, MatchStatus, Team } from '../schemas';

export interface MatchLogRow {
  matchId: string;
  date: string;
  kickoffTime?: string;
  /** null when the team record can't be found. */
  teamName: string | null;
  opponentName: string;
  homeAway: Match['homeAway'];
  competition?: string;
  score: Match['score'];
  status: MatchStatus;
  eventCount: number;
  incompleteCount: number;
}

interface MatchLogInput {
  matches: Match[];
  teams: Team[];
  events: MatchEvent[];
  catalog: ActionCatalog;
}

/** Home match log: live matches, newest first, with event and ⚠ counts. */
export function buildMatchLog({ matches, teams, events, catalog }: MatchLogInput): MatchLogRow[] {
  // Deleted teams keep their name so past matches still read correctly.
  const teamNames = new Map(teams.map((t) => [t.id, t.name]));

  const counts = new Map<string, { total: number; incomplete: number }>();
  for (const event of events) {
    if (event.deletedAt) continue;
    const c = counts.get(event.matchId) ?? { total: 0, incomplete: 0 };
    c.total += 1;
    if (!completeness(event, catalog).complete) c.incomplete += 1;
    counts.set(event.matchId, c);
  }

  return matches
    .filter((m) => !m.deletedAt)
    .sort(newestFirst)
    .map((m) => ({
      matchId: m.id,
      date: m.date,
      kickoffTime: m.kickoffTime,
      teamName: teamNames.get(m.teamId) ?? null,
      opponentName: m.opponentName,
      homeAway: m.homeAway,
      competition: m.competition,
      score: m.score,
      status: m.status,
      eventCount: counts.get(m.id)?.total ?? 0,
      incompleteCount: counts.get(m.id)?.incomplete ?? 0,
    }));
}

/** Newest first: by date, then kickoff time, then creation. */
export function newestFirst(a: Match, b: Match): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.kickoffTime ?? '').localeCompare(a.kickoffTime ?? '') ||
    b.createdAt.localeCompare(a.createdAt)
  );
}
