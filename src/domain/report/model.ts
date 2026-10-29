import { actionCatalog, findFormation } from '../catalog';
import { runningSpans } from '../clock';
import { possessionShare } from '../possession';
import type { ClockAnchor, LineupEntry, Match, MatchEvent, Player, PossessionChange, Team } from '../schemas';
import { displayName, pitchName } from '../squads/players';
import { computeStats, incompleteSummary, matchEndClockS, playerLines, type IncompleteSummary, type PlayerLine, type StatValues } from '../stats';

/** One match's stored data, as the report reads it. */
export interface ReportData {
  match: Match;
  team: Team | null;
  lineup: { entry: LineupEntry; player: Player }[];
  events: MatchEvent[];
  anchors: ClockAnchor[];
  possession: PossessionChange[];
}

export interface Scorer {
  name: string;
  minute: number;
}

/** A matchday player with their report line and the names to show (initials when the team uses them). */
export interface ReportPlayer {
  line: PlayerLine;
  player: Player;
  /** Surname or initials, for crowded places. */
  shortName: string;
  name: string;
  /** Positions-catalog ID: the formation slot's for starters, the player's main position for subs. */
  position: string | undefined;
}

export interface ReportModel {
  team: StatValues;
  /** In report order: starters by formation slot, subs who came on, unused subs. */
  players: ReportPlayer[];
  scorers: Scorer[];
  /** Our share of possession, 0–1, or null when it wasn't recorded. */
  possessionUs: number | null;
  incomplete: IncompleteSummary;
  hasEvents: boolean;
}

export function buildReport(data: ReportData): ReportModel {
  const { match, team, lineup, events, anchors, possession } = data;
  const endClockS = matchEndClockS(anchors, events);
  const slots = findFormation(match.formationId)?.slots ?? [];
  const slotOrder = slots.map((s) => s.id);
  const lines = playerLines({ lineup: lineup.map((l) => l.entry), events, catalog: actionCatalog, endClockS, slotOrder });

  const nameDisplay = team ?? { nameDisplay: 'full' as const };
  const playerOf = new Map(lineup.map((l) => [l.entry.id, l.player]));
  const players = lines.flatMap((line): ReportPlayer[] => {
    const player = playerOf.get(line.entryId);
    if (!player) return [];
    const position = slots.find((s) => s.id === line.slotId)?.position ?? player.positions[0];
    return [{ line, player, shortName: pitchName(player, nameDisplay), name: displayName(player, nameDisplay), position }];
  });
  const scorers = players
    .flatMap((p) => p.line.badges.filter((b) => b.kind === 'goal').map((b) => ({ name: p.shortName, minute: b.minute })))
    .sort((a, b) => a.minute - b.minute);

  const endT = Math.max(0, ...events.map((e) => e.videoTimeS), ...anchors.map((a) => a.videoTimeS), ...possession.map((c) => c.videoTimeS));

  return {
    team: computeStats(events, actionCatalog),
    players,
    scorers,
    possessionUs: possessionShare(possession, runningSpans(anchors, endT)).us,
    incomplete: incompleteSummary(events, actionCatalog),
    hasEvents: events.length > 0,
  };
}
