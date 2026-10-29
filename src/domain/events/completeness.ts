import type { ActionCatalog } from '../catalog';
import type { MatchEvent } from '../schemas';

/** 'outcome' | 'player' | 'location' | 'playerOn' | 'unknownType' | a required attribute key. */
export type MissingField = string;

export interface Completeness {
  complete: boolean;
  missing: MissingField[];
}

type EventFields = Pick<MatchEvent, 'typeId' | 'attributes'> &
  Partial<Pick<MatchEvent, 'outcome' | 'lineupEntryId' | 'relatedLineupEntryId' | 'start' | 'end'>>;

/**
 * Derived, never stored. An event is complete when it has an outcome (for types
 * that have outcomes), a player, a location (for point/line types) and its required attributes. Unknown types are
 * reported as incomplete rather than guessed.
 */
export function completeness(event: EventFields, catalog: ActionCatalog): Completeness {
  const type = catalog.types.find((t) => t.id === event.typeId);
  if (!type) return { complete: false, missing: ['unknownType'] };

  const missing: MissingField[] = [];
  if (type.outcomes.length > 0 && !event.outcome) missing.push('outcome');
  if (type.needsPlayer && !event.lineupEntryId) missing.push('player');
  if (type.needsRelatedPlayer && !event.relatedLineupEntryId) missing.push('playerOn');

  const needsStart = type.location !== 'none';
  const needsEnd = type.location === 'line';
  if ((needsStart && !event.start) || (needsEnd && !event.end)) missing.push('location');

  for (const attr of type.attributes) {
    if (attr.required && event.attributes[attr.key] === undefined) missing.push(attr.key);
  }

  return { complete: missing.length === 0, missing };
}
