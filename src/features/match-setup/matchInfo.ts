import type { Match } from '@/domain/schemas';

/** The match info form as typed. Empty strings become undefined when the match is saved. */
export interface MatchInfo {
  opponentName: string;
  date: string;
  kickoffTime: string;
  competition: string;
  venue: string;
  homeAway: Match['homeAway'];
  /** Undefined until edited: the team's coach is shown and saved. */
  coachName?: string;
  notes: string;
}

export const emptyInfo: MatchInfo = { opponentName: '', date: '', kickoffTime: '', competition: '', venue: '', homeAway: 'home', notes: '' };
