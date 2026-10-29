import type { ActionCatalog } from '../catalog';
import { clockAt, type AnchorDraft } from '../clock';
import { completeness } from '../events/completeness';
import type { LineupEntry, MatchEvent } from '../schemas';
import { computeStats, type StatEvent, type StatValues } from './engine';

export type LineupLine = Pick<LineupEntry, 'id' | 'playerId' | 'shirtNumber' | 'role' | 'positionSlotId'>;
export type LineEvent = StatEvent & Pick<MatchEvent, 'clockS'> & Partial<Pick<MatchEvent, 'relatedLineupEntryId'>>;

export type BadgeKind = 'goal' | 'assist' | 'own_goal' | 'yellow' | 'second_yellow' | 'red' | 'sub_on' | 'sub_off';
export interface Badge {
  kind: BadgeKind;
  minute: number;
}

export interface PlayerLine {
  entryId: string;
  playerId: string;
  shirtNumber: number;
  role: LineupLine['role'];
  slotId?: string;
  /** Started, or came on from the bench. */
  played: boolean;
  /** Clock time the player came on: 0 for starters, null for an unused sub. */
  onClockS: number | null;
  offClockS: number | null;
  offReason: 'sub' | 'sent_off' | null;
  minutes: number;
  badges: Badge[];
  incompleteCount: number;
  stats: StatValues;
}

/** The minute being played, as football counts it: 0:00–0:59 is the 1st minute. */
export const footballMinute = (clockS: number) => Math.floor(clockS / 60) + 1;

/**
 * Full time for minutes played: wherever the clock got to (93', 96'…), from
 * the clock anchors or a later hand-corrected event time. Never capped at 90'.
 */
export function matchEndClockS(anchors: readonly AnchorDraft[], events: readonly Pick<MatchEvent, 'videoTimeS' | 'clockS'>[]): number {
  const lastVideoT = Math.max(0, ...anchors.map((a) => a.videoTimeS), ...events.map((e) => e.videoTimeS));
  return Math.max(anchors.length ? clockAt(lastVideoT, anchors).clockS : 0, ...events.map((e) => e.clockS));
}

const SENT_OFF = new Set(['red', 'second_yellow']);
const CARD_BADGE: Record<string, BadgeKind> = { yellow: 'yellow', second_yellow: 'second_yellow', red: 'red' };

function badgeOf(e: LineEvent, entryId: string): BadgeKind | null {
  if (e.typeId === 'substitution') return e.relatedLineupEntryId === entryId ? 'sub_on' : e.lineupEntryId === entryId ? 'sub_off' : null;
  if (e.lineupEntryId !== entryId) return null;
  if (e.typeId === 'shot' && e.outcome === 'goal') return 'goal';
  if ((e.typeId === 'pass' || e.typeId === 'cross') && e.attributes.chance === 'assist') return 'assist';
  if (e.typeId === 'own_goal') return 'own_goal';
  if (e.typeId === 'card' && e.outcome) return CARD_BADGE[e.outcome] ?? null;
  return null;
}

/**
 * One line per matchday player for the report: who played and for how long,
 * badges for the pitch, ⚠ count and their own stats. Starters come in
 * formation order, then subs who came on (by time), then unused subs.
 */
export function playerLines(input: {
  lineup: readonly LineupLine[];
  events: readonly LineEvent[];
  catalog: ActionCatalog;
  endClockS: number;
  /** Formation slot IDs in display order. */
  slotOrder: readonly string[];
}): PlayerLine[] {
  const { lineup, catalog, endClockS, slotOrder } = input;
  const events = [...input.events].sort((a, b) => a.clockS - b.clockS);

  const lines = lineup.map((entry): PlayerLine => {
    const own = events.filter((e) => e.lineupEntryId === entry.id);
    const cameOn = events.find((e) => e.typeId === 'substitution' && e.relatedLineupEntryId === entry.id);
    const onClockS = entry.role === 'starter' ? 0 : (cameOn?.clockS ?? null);
    const leaving =
      onClockS === null
        ? undefined
        : own.find((e) => e.clockS >= onClockS && (e.typeId === 'substitution' || (e.typeId === 'card' && e.outcome !== undefined && SENT_OFF.has(e.outcome))));
    const offClockS = leaving?.clockS ?? null;
    const minutes = onClockS === null ? 0 : Math.max(0, Math.round((Math.min(offClockS ?? endClockS, endClockS) - Math.min(onClockS, endClockS)) / 60));

    const badges = events.flatMap((e) => {
      const kind = badgeOf(e, entry.id);
      return kind ? [{ kind, minute: footballMinute(e.clockS) }] : [];
    });

    return {
      entryId: entry.id,
      playerId: entry.playerId,
      shirtNumber: entry.shirtNumber,
      role: entry.role,
      ...(entry.positionSlotId ? { slotId: entry.positionSlotId } : {}),
      played: onClockS !== null,
      onClockS,
      offClockS,
      offReason: leaving ? (leaving.typeId === 'substitution' ? 'sub' : 'sent_off') : null,
      minutes,
      badges,
      incompleteCount: own.filter((e) => !completeness(e, catalog).complete).length,
      stats: computeStats(own, catalog),
    };
  });

  const slotRank = (l: PlayerLine) => {
    const i = l.slotId ? slotOrder.indexOf(l.slotId) : -1;
    return i === -1 ? slotOrder.length : i;
  };
  const group = (l: PlayerLine) => (l.role === 'starter' ? 0 : l.played ? 1 : 2);
  return lines.sort((a, b) => group(a) - group(b) || (group(a) === 0 ? slotRank(a) - slotRank(b) : 0) || (a.onClockS ?? 0) - (b.onClockS ?? 0) || a.shirtNumber - b.shirtNumber);
}

export interface IncompleteSummary {
  total: number;
  withoutPlayer: number;
  withoutLocation: number;
}

/** For the report banner: how many events still need data, and what is missing. */
export function incompleteSummary(events: readonly LineEvent[], catalog: ActionCatalog): IncompleteSummary {
  const missing = events.map((e) => completeness(e, catalog).missing);
  return {
    total: missing.filter((m) => m.length > 0).length,
    withoutPlayer: missing.filter((m) => m.includes('player')).length,
    withoutLocation: missing.filter((m) => m.includes('location')).length,
  };
}
