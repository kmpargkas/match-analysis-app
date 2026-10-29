import { describe, expect, it } from 'vitest';
import { actionCatalog } from '../catalog';
import { completeness } from './completeness';

const complete = { lineupEntryId: 'p1', start: { x: 10, y: 10 }, end: { x: 30, y: 40 }, attributes: {} };

describe('completeness', () => {
  it('a pass needs a player and a start → end line', () => {
    expect(completeness({ ...complete, typeId: 'pass', outcome: 'complete' }, actionCatalog)).toEqual({ complete: true, missing: [] });
    expect(completeness({ ...complete, typeId: 'pass', outcome: 'complete', end: undefined }, actionCatalog).missing).toEqual(['location']);
    expect(completeness({ ...complete, typeId: 'pass', outcome: 'complete', lineupEntryId: undefined }, actionCatalog).missing).toEqual(['player']);
  });

  it('a point type only needs a start location', () => {
    expect(completeness({ ...complete, typeId: 'tackle', outcome: 'won', end: undefined }, actionCatalog).complete).toBe(true);
    expect(completeness({ ...complete, typeId: 'tackle', outcome: 'won', start: undefined, end: undefined }, actionCatalog).missing).toEqual(['location']);
  });

  it('a shot needs its required body part', () => {
    expect(completeness({ ...complete, typeId: 'shot', outcome: 'saved' }, actionCatalog).missing).toEqual(['bodyPart']);
    expect(completeness({ ...complete, typeId: 'shot', outcome: 'saved', attributes: { bodyPart: 'left' } }, actionCatalog).complete).toBe(true);
  });

  it('a card needs no location', () => {
    expect(completeness({ typeId: 'card', outcome: 'yellow', lineupEntryId: 'p1', attributes: {} }, actionCatalog).complete).toBe(true);
  });

  it('a substitution needs the player coming on', () => {
    const sub = { typeId: 'substitution', lineupEntryId: 'p1', attributes: {} };
    expect(completeness(sub, actionCatalog).missing).toEqual(['playerOn']);
    expect(completeness({ ...sub, relatedLineupEntryId: 'p2' }, actionCatalog).complete).toBe(true);
  });

  it('lists every missing field', () => {
    expect(completeness({ typeId: 'shot', attributes: {} }, actionCatalog).missing).toEqual(['outcome', 'player', 'location', 'bodyPart']);
  });

  it('an action with outcomes needs one, e.g. a claim left on "—"', () => {
    expect(completeness({ ...complete, typeId: 'gk_claim', end: undefined }, actionCatalog).missing).toEqual(['outcome']);
    expect(completeness({ ...complete, typeId: 'gk_claim', outcome: 'success', end: undefined }, actionCatalog).complete).toBe(true);
    expect(completeness({ ...complete, typeId: 'interception', end: undefined }, actionCatalog).complete).toBe(true);
  });

  it('never guesses: an unknown type is incomplete', () => {
    expect(completeness({ ...complete, typeId: 'carry' }, actionCatalog)).toEqual({ complete: false, missing: ['unknownType'] });
  });
});
