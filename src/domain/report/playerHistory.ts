import { newestFirst } from '../matches/matchLog';
import { buildReport, type ReportData, type ReportPlayer } from './model';

export interface PlayerMatch {
  data: ReportData;
  /** The player's line in that match's report: the same one its player popup shows. */
  player: ReportPlayer;
}

/** The matches a player was in the matchday squad for, newest first, each with their report line. */
export function playerMatchHistory(playerId: string, reports: readonly ReportData[]): PlayerMatch[] {
  return reports
    .flatMap((data) => {
      const player = buildReport(data).players.find((p) => p.player.id === playerId);
      return player ? [{ data, player }] : [];
    })
    .sort((a, b) => newestFirst(a.data.match, b.data.match));
}
