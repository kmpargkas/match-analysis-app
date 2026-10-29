import { describe, expect, it } from 'vitest';
import { positionCatalog } from '../catalog';
import { isSelectable, MAX_POSITIONS, togglePosition, validatePositions } from './positions';

describe('position catalog', () => {
  it('ships each position once, GK first and ST last, with pitch spots in range', () => {
    const ids = positionCatalog.positions.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe('GK');
    expect(ids.at(-1)).toBe('ST');
    for (const p of positionCatalog.positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });
});

describe('togglePosition', () => {
  it('adds in click order and removes on a second click', () => {
    expect(togglePosition([], 'CB')).toEqual(['CB']);
    expect(togglePosition(['CB'], 'DM')).toEqual(['CB', 'DM']);
    expect(togglePosition(['CB', 'DM'], 'CB')).toEqual(['DM']);
  });

  it(`allows at most ${MAX_POSITIONS} positions`, () => {
    expect(togglePosition(['CB', 'DM', 'CM'], 'AM')).toEqual(['CB', 'DM', 'CM']);
    expect(isSelectable(['CB', 'DM', 'CM'], 'AM')).toBe(false);
    // A selected position can always be clicked again to remove it.
    expect(isSelectable(['CB', 'DM', 'CM'], 'DM')).toBe(true);
  });

  it('never combines GK with an outfield position', () => {
    expect(togglePosition(['GK'], 'CB')).toEqual(['GK']);
    expect(togglePosition(['CB'], 'GK')).toEqual(['CB']);
    expect(isSelectable(['GK'], 'ST')).toBe(false);
    expect(isSelectable(['ST'], 'GK')).toBe(false);
    expect(togglePosition(['GK'], 'GK')).toEqual([]);
  });

  it('ignores unknown positions', () => {
    expect(togglePosition([], 'SW')).toEqual([]);
  });
});

describe('validatePositions', () => {
  it('accepts 1–3 known positions', () => {
    expect(validatePositions(['GK'])).toBeNull();
    expect(validatePositions(['LB', 'LWB', 'LM'])).toBeNull();
  });

  it('names the problem otherwise', () => {
    expect(validatePositions([])).toBe('required');
    expect(validatePositions(['CB', 'DM', 'CM', 'AM'])).toBe('tooMany');
    expect(validatePositions(['GK', 'CB'])).toBe('goalkeeperAlone');
    expect(validatePositions(['CB', 'CB'])).toBe('duplicate');
    expect(validatePositions(['SW'])).toBe('unknown');
  });
});
