import { findFormation, type FormationSlot } from '../catalog';
import { MAX_SHIRT_NUMBER, MIN_SHIRT_NUMBER, type LineupRole } from '../schemas';

/**
 * The lineup while it is being set up for a match, in the order the page asks
 * for it: pick the matchday squad, give each player a shirt number, choose a
 * formation, then put players in its slots. Matchday players without a slot
 * are the subs. Not every squad member has to be picked.
 */
export interface LineupDraft {
  /** Picked players, in pick order. */
  squad: MatchdayPlayer[];
  formationId?: string;
  /** Formation slot ID → player ID. */
  slots: Record<string, string>;
}

export interface MatchdayPlayer {
  playerId: string;
  shirtNumber?: number;
}

export const emptyDraft: LineupDraft = { squad: [], slots: {} };

export type DraftAction =
  | { type: 'togglePlayer'; playerId: string }
  | { type: 'setShirtNumber'; playerId: string; shirtNumber: number | undefined }
  | { type: 'setFormation'; formationId: string }
  | { type: 'assign'; slotId: string; playerId: string }
  | { type: 'unassign'; slotId: string }
  | { type: 'reset' };

export function lineupReducer(draft: LineupDraft, action: DraftAction): LineupDraft {
  switch (action.type) {
    case 'togglePlayer': {
      if (!draft.squad.some((p) => p.playerId === action.playerId)) return { ...draft, squad: [...draft.squad, { playerId: action.playerId }] };
      return { ...draft, squad: draft.squad.filter((p) => p.playerId !== action.playerId), slots: withoutPlayer(draft.slots, action.playerId) };
    }
    case 'setShirtNumber': {
      if (!draft.squad.some((p) => p.playerId === action.playerId)) return draft;
      const squad = draft.squad.map((p) => {
        if (p.playerId !== action.playerId) return p;
        return action.shirtNumber === undefined ? { playerId: p.playerId } : { ...p, shirtNumber: action.shirtNumber };
      });
      return { ...draft, squad };
    }
    case 'setFormation':
      return changeFormation(draft, action.formationId);
    case 'assign': {
      const formation = draft.formationId ? findFormation(draft.formationId) : undefined;
      if (!formation?.slots.some((s) => s.id === action.slotId)) return draft;
      if (!draft.squad.some((p) => p.playerId === action.playerId)) return draft;
      // A player stands in one slot only; whoever was in this slot goes to the bench.
      return { ...draft, slots: { ...withoutPlayer(draft.slots, action.playerId), [action.slotId]: action.playerId } };
    }
    case 'unassign': {
      const slots = { ...draft.slots };
      delete slots[action.slotId];
      return { ...draft, slots };
    }
    case 'reset':
      return emptyDraft;
  }
}

function withoutPlayer(slots: Record<string, string>, playerId: string): Record<string, string> {
  return Object.fromEntries(Object.entries(slots).filter(([, id]) => id !== playerId));
}

/**
 * Keep as much of the lineup as the new shape allows: first players whose
 * slot ID also exists (RCB stays RCB), then players whose old slot plays the
 * same position (ST → RST). Everyone else goes to the bench.
 */
function changeFormation(draft: LineupDraft, formationId: string): LineupDraft {
  const next = findFormation(formationId);
  if (!next) return { ...draft, formationId: undefined, slots: {} };
  const previous = draft.formationId ? findFormation(draft.formationId) : undefined;

  const slots: Record<string, string> = {};
  const leftover: { position: string; playerId: string }[] = [];
  for (const old of previous?.slots ?? []) {
    const playerId = draft.slots[old.id];
    if (!playerId) continue;
    if (next.slots.some((s) => s.id === old.id)) slots[old.id] = playerId;
    else leftover.push({ position: old.position, playerId });
  }
  for (const { position, playerId } of leftover) {
    const free = next.slots.find((s) => s.position === position && !slots[s.id]);
    if (free) slots[free.id] = playerId;
  }
  return { ...draft, formationId, slots };
}

/** Matchday players without a slot, in pick order. */
export function benchOf(draft: LineupDraft): MatchdayPlayer[] {
  const placed = new Set(Object.values(draft.slots));
  return draft.squad.filter((p) => !placed.has(p.playerId));
}

/**
 * Candidates for a slot, split for the slot widget: players who list the
 * slot's position (main position before secondary ones), then the rest. The
 * caller passes only the players who may go there, in the order to show.
 */
export function rankCandidates<P extends { positions: readonly string[] }>(slot: FormationSlot, players: readonly P[]): { naturalFits: P[]; others: P[] } {
  const naturalFits = players
    .map((player, order) => ({ player, order, rank: player.positions.indexOf(slot.position) }))
    .filter((c) => c.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((c) => c.player);
  return { naturalFits, others: players.filter((p) => !p.positions.includes(slot.position)) };
}

export type LineupProblem =
  | { code: 'formationMissing' }
  | { code: 'numberMissing' | 'numberInvalid' | 'numberDuplicate'; playerId: string }
  | { code: 'slotEmpty'; slotId: string };

export function validateLineup(draft: LineupDraft): LineupProblem[] {
  const problems: LineupProblem[] = [];
  const formation = draft.formationId ? findFormation(draft.formationId) : undefined;
  if (!formation) problems.push({ code: 'formationMissing' });

  const counts = new Map<number, number>();
  for (const { shirtNumber } of draft.squad) if (shirtNumber !== undefined) counts.set(shirtNumber, (counts.get(shirtNumber) ?? 0) + 1);
  for (const { playerId, shirtNumber } of draft.squad) {
    if (shirtNumber === undefined) problems.push({ code: 'numberMissing', playerId });
    else if (!isShirtNumber(shirtNumber)) problems.push({ code: 'numberInvalid', playerId });
    else if (counts.get(shirtNumber)! > 1) problems.push({ code: 'numberDuplicate', playerId });
  }

  for (const slot of formation?.slots ?? []) if (!draft.slots[slot.id]) problems.push({ code: 'slotEmpty', slotId: slot.id });
  return problems;
}

export function isShirtNumber(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_SHIRT_NUMBER && n <= MAX_SHIRT_NUMBER;
}

export interface LineupEntryDraft {
  playerId: string;
  shirtNumber: number;
  role: LineupRole;
  positionSlotId?: string;
}

/** Starters in formation order, then subs in pick order. Throws if the draft isn't valid. */
export function toLineupEntries(draft: LineupDraft): LineupEntryDraft[] {
  if (validateLineup(draft).length > 0) throw new Error('Lineup is not complete');
  const formation = findFormation(draft.formationId!)!;
  const numberOf = new Map(draft.squad.map((p) => [p.playerId, p.shirtNumber!]));
  const starters = formation.slots.map((slot) => {
    const playerId = draft.slots[slot.id]!;
    return { playerId, shirtNumber: numberOf.get(playerId)!, role: 'starter' as const, positionSlotId: slot.id };
  });
  const subs = benchOf(draft).map((p) => ({ playerId: p.playerId, shirtNumber: p.shirtNumber!, role: 'sub' as const }));
  return [...starters, ...subs];
}
