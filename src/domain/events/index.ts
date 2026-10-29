import type { ActionType } from '../catalog';
import { clockAt, type AnchorDraft } from '../clock';
import type { AttackDir, Half, LineupRole, MatchEvent } from '../schemas';

export * from './completeness';

export interface NewEventContext {
  timeS: number;
  half: Half;
  anchors: readonly AnchorDraft[];
  attackDir: AttackDir;
}

export type NewEvent = Pick<MatchEvent, 'typeId' | 'videoTimeS' | 'clockS' | 'half' | 'attackDir' | 'attributes'> & { outcome?: string };

/** The event's time is the match clock when it is logged. */
export function newEvent(type: ActionType, outcome: string | undefined, ctx: NewEventContext): NewEvent {
  const videoTimeS = Math.round(ctx.timeS * 1000) / 1000;
  const attributes = Object.fromEntries(type.attributes.filter((a) => a.default !== undefined).map((a) => [a.key, a.default!]));
  return {
    typeId: type.id,
    ...(outcome ? { outcome } : {}),
    videoTimeS,
    clockS: Math.round(clockAt(videoTimeS, ctx.anchors).clockS * 1000) / 1000,
    half: ctx.half,
    attackDir: ctx.attackDir,
    attributes,
  };
}

type PitchEvent = Pick<MatchEvent, 'typeId' | 'videoTimeS'> & Partial<Pick<MatchEvent, 'outcome' | 'lineupEntryId' | 'relatedLineupEntryId'>>;

const SENT_OFF = new Set(['red', 'second_yellow']);

/** Lineup entry IDs on the pitch at timeline time `t`: starters, then substitutions and red cards in time order. */
export function onPitchAt(t: number, lineup: readonly { id: string; role: LineupRole }[], events: readonly PitchEvent[]): Set<string> {
  const on = new Set(lineup.filter((e) => e.role === 'starter').map((e) => e.id));
  const changes = events.filter((e) => e.videoTimeS <= t).sort((a, b) => a.videoTimeS - b.videoTimeS);
  for (const event of changes) {
    if (event.typeId === 'substitution' && event.lineupEntryId && event.relatedLineupEntryId) {
      on.delete(event.lineupEntryId);
      on.add(event.relatedLineupEntryId);
    } else if (event.typeId === 'card' && event.lineupEntryId && event.outcome && SENT_OFF.has(event.outcome)) {
      on.delete(event.lineupEntryId);
    }
  }
  return on;
}

/** Event log order: the last logged event first, so a new event always lands at the front even if its time is earlier. */
export function sortForLog<E extends Pick<MatchEvent, 'createdAt'>>(events: readonly E[]): E[] {
  return [...events].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
