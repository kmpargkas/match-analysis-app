import { describe, expect, it } from 'vitest';
import { findFormation } from '../catalog';
import { benchOf, emptyDraft, lineupReducer, rankCandidates, toLineupEntries, validateLineup, type DraftAction, type LineupDraft } from '.';

const run = (...actions: DraftAction[]) => actions.reduce(lineupReducer, emptyDraft);
const pick = (playerId: string, shirtNumber?: number): DraftAction[] => [
  { type: 'togglePlayer', playerId },
  { type: 'setShirtNumber', playerId, shirtNumber },
];

/** A full, valid 4-3-3 draft: p1…p11 in the slots, p12 and p13 on the bench. */
function fullDraft(): LineupDraft {
  const slots = findFormation('4-3-3')!.slots.map((s) => s.id);
  return run(
    ...Array.from({ length: 13 }, (_, i) => pick(`p${i + 1}`, i + 1)).flat(),
    { type: 'setFormation', formationId: '4-3-3' },
    ...slots.map((slotId, i): DraftAction => ({ type: 'assign', slotId, playerId: `p${i + 1}` })),
  );
}

describe('matchday squad', () => {
  it('adds and removes players in pick order, numbers unset', () => {
    const draft = run({ type: 'togglePlayer', playerId: 'a' }, { type: 'togglePlayer', playerId: 'b' });
    expect(draft.squad).toEqual([{ playerId: 'a' }, { playerId: 'b' }]);
    expect(lineupReducer(draft, { type: 'togglePlayer', playerId: 'a' }).squad).toEqual([{ playerId: 'b' }]);
  });

  it('sets and clears shirt numbers', () => {
    const draft = run(...pick('a', 8));
    expect(draft.squad).toEqual([{ playerId: 'a', shirtNumber: 8 }]);
    expect(lineupReducer(draft, { type: 'setShirtNumber', playerId: 'a', shirtNumber: undefined }).squad).toEqual([{ playerId: 'a' }]);
  });

  it('ignores numbers for players outside the matchday squad', () => {
    expect(run({ type: 'setShirtNumber', playerId: 'ghost', shirtNumber: 9 })).toEqual(emptyDraft);
  });

  it('removing a player also clears their slot', () => {
    const draft = lineupReducer(fullDraft(), { type: 'togglePlayer', playerId: 'p1' });
    expect(draft.slots.GK).toBeUndefined();
    expect(draft.squad.some((p) => p.playerId === 'p1')).toBe(false);
  });

  it('does not change the previous draft', () => {
    const before = run(...pick('a', 8));
    const snapshot = structuredClone(before);
    lineupReducer(before, { type: 'togglePlayer', playerId: 'b' });
    lineupReducer(before, { type: 'setShirtNumber', playerId: 'a', shirtNumber: 9 });
    expect(before).toEqual(snapshot);
  });
});

describe('slot assignment', () => {
  const base = run(...pick('a', 1), ...pick('b', 2), { type: 'setFormation', formationId: '4-3-3' });

  it('assigns a matchday player to a slot', () => {
    expect(lineupReducer(base, { type: 'assign', slotId: 'ST', playerId: 'a' }).slots).toEqual({ ST: 'a' });
  });

  it('moves a player who already has a slot', () => {
    const draft = run(...pick('a', 1), { type: 'setFormation', formationId: '4-3-3' }, { type: 'assign', slotId: 'ST', playerId: 'a' }, { type: 'assign', slotId: 'LW', playerId: 'a' });
    expect(draft.slots).toEqual({ LW: 'a' });
  });

  it('replacing a slot sends the previous player to the bench', () => {
    const draft = [
      { type: 'assign', slotId: 'ST', playerId: 'a' },
      { type: 'assign', slotId: 'ST', playerId: 'b' },
    ].reduce<LineupDraft>((d, a) => lineupReducer(d, a as DraftAction), base);
    expect(draft.slots).toEqual({ ST: 'b' });
    expect(benchOf(draft).map((p) => p.playerId)).toEqual(['a']);
  });

  it('clears a slot', () => {
    const draft = lineupReducer(lineupReducer(base, { type: 'assign', slotId: 'ST', playerId: 'a' }), { type: 'unassign', slotId: 'ST' });
    expect(draft.slots).toEqual({});
  });

  it('ignores unknown slots, unknown players and assignment before a formation', () => {
    expect(lineupReducer(base, { type: 'assign', slotId: 'XX', playerId: 'a' })).toBe(base);
    expect(lineupReducer(base, { type: 'assign', slotId: 'ST', playerId: 'ghost' })).toBe(base);
    const noFormation = run(...pick('a', 1));
    expect(lineupReducer(noFormation, { type: 'assign', slotId: 'ST', playerId: 'a' })).toBe(noFormation);
  });
});

describe('changing formation', () => {
  it('keeps players whose slot exists in the new shape', () => {
    // 4-3-3 → 4-1-4-1: GK, back four, DM, RCM, LCM and ST all exist in both.
    const draft = lineupReducer(fullDraft(), { type: 'setFormation', formationId: '4-1-4-1' });
    expect(draft.slots).toMatchObject({ GK: 'p1', RB: 'p2', RCB: 'p3', LCB: 'p4', LB: 'p5', DM: 'p6', RCM: 'p7', LCM: 'p8', ST: 'p10' });
  });

  it('then places the rest by position, and benches whoever has no place', () => {
    // 4-3-3 → 3-5-2. Kept by slot ID: GK, RCB, LCB, DM, RCM, LCM. By position: ST → RST.
    const draft = lineupReducer(fullDraft(), { type: 'setFormation', formationId: '3-5-2' });
    expect(draft.slots).toEqual({ GK: 'p1', RCB: 'p3', LCB: 'p4', DM: 'p6', RCM: 'p7', LCM: 'p8', RST: 'p10' });
    expect(benchOf(draft).map((p) => p.playerId)).toEqual(['p2', 'p5', 'p9', 'p11', 'p12', 'p13']);
  });

  it('clears everything for an unknown formation', () => {
    const draft = lineupReducer(fullDraft(), { type: 'setFormation', formationId: 'nope' });
    expect(draft.formationId).toBeUndefined();
    expect(draft.slots).toEqual({});
  });
});

describe('rankCandidates', () => {
  const players = [
    { id: 'gk', name: 'Keeper', positions: ['GK'] },
    { id: 'cb1', name: 'Zed Back', positions: ['CB'] },
    { id: 'cb2', name: 'Al Back', positions: ['DM', 'CB'] },
    { id: 'st', name: 'Striker', positions: ['ST'] },
    { id: 'cm', name: 'Mid', positions: ['CM', 'DM'] },
  ];

  it('lists natural fits first (main position before secondary), then everyone else', () => {
    const { naturalFits, others } = rankCandidates({ id: 'RCB', position: 'CB', x: 0, y: 0 }, players);
    expect(naturalFits.map((p) => p.id)).toEqual(['cb1', 'cb2']);
    expect(others.map((p) => p.id)).toEqual(['gk', 'st', 'cm']);
  });

  it('keeps the given order within each group', () => {
    const { naturalFits } = rankCandidates({ id: 'DM', position: 'DM', x: 0, y: 0 }, players);
    expect(naturalFits.map((p) => p.id)).toEqual(['cb2', 'cm']);
  });
});

describe('validateLineup', () => {
  it('passes a full lineup with unique numbers; subs are optional', () => {
    expect(validateLineup(fullDraft())).toEqual([]);
    const noBench = [12, 13].reduce((d, n) => lineupReducer(d, { type: 'togglePlayer', playerId: `p${n}` }), fullDraft());
    expect(validateLineup(noBench)).toEqual([]);
  });

  it('needs a formation', () => {
    expect(validateLineup(run(...pick('a', 1)))).toEqual([{ code: 'formationMissing' }]);
  });

  it('reports empty slots', () => {
    const draft = lineupReducer(fullDraft(), { type: 'unassign', slotId: 'ST' });
    expect(validateLineup(draft)).toEqual([{ code: 'slotEmpty', slotId: 'ST' }]);
  });

  it('reports missing, out-of-range and duplicate numbers, bench included', () => {
    let draft = fullDraft();
    draft = lineupReducer(draft, { type: 'setShirtNumber', playerId: 'p2', shirtNumber: undefined });
    draft = lineupReducer(draft, { type: 'setShirtNumber', playerId: 'p3', shirtNumber: 100 });
    draft = lineupReducer(draft, { type: 'setShirtNumber', playerId: 'p13', shirtNumber: 4 });
    expect(validateLineup(draft)).toEqual([
      { code: 'numberMissing', playerId: 'p2' },
      { code: 'numberInvalid', playerId: 'p3' },
      { code: 'numberDuplicate', playerId: 'p4' },
      { code: 'numberDuplicate', playerId: 'p13' },
    ]);
  });
});

describe('toLineupEntries', () => {
  it('turns slotted players into starters and the rest into subs', () => {
    const entries = toLineupEntries(fullDraft());
    expect(entries).toHaveLength(13);
    expect(entries[0]).toEqual({ playerId: 'p1', shirtNumber: 1, role: 'starter', positionSlotId: 'GK' });
    expect(entries.filter((e) => e.role === 'sub')).toEqual([
      { playerId: 'p12', shirtNumber: 12, role: 'sub' },
      { playerId: 'p13', shirtNumber: 13, role: 'sub' },
    ]);
  });

  it('refuses an invalid draft', () => {
    expect(() => toLineupEntries(lineupReducer(fullDraft(), { type: 'unassign', slotId: 'ST' }))).toThrow();
  });
});
