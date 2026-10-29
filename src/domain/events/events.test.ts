import { describe, expect, it } from 'vitest';
import { actionCatalog } from '../catalog';
import { newEvent, onPitchAt, sortForLog } from '.';

const type = (id: string) => actionCatalog.types.find((t) => t.id === id)!;

describe('newEvent', () => {
  const ctx = { timeS: 100.25, half: 1 as const, anchors: [{ videoTimeS: 10, clockS: 0, running: true }], attackDir: 'rtl' as const };

  it('takes the clock reading at the moment of logging, and the current half', () => {
    expect(newEvent(type('pass'), 'complete', ctx)).toEqual({ typeId: 'pass', outcome: 'complete', videoTimeS: 100.25, clockS: 90.25, half: 1, attackDir: 'rtl', attributes: {} });
    expect(newEvent(type('pass'), 'complete', { ...ctx, half: 2 }).half).toBe(2);
  });

  it('keeps the stopped clock value when the clock is not running', () => {
    expect(newEvent(type('tackle'), 'won', { ...ctx, anchors: [] }).clockS).toBe(0);
  });

  it('fills attribute defaults from the catalog', () => {
    expect(newEvent(type('clearance'), undefined, ctx).attributes).toEqual({ clearance: 'ground' });
    expect(newEvent(type('interception'), undefined, ctx)).not.toHaveProperty('outcome');
  });
});

describe('onPitchAt', () => {
  const lineup = [
    { id: 'a', role: 'starter' as const },
    { id: 'b', role: 'starter' as const },
    { id: 's1', role: 'sub' as const },
    { id: 's2', role: 'sub' as const },
  ];
  const sub = (videoTimeS: number, off: string, on: string) => ({ typeId: 'substitution', videoTimeS, lineupEntryId: off, relatedLineupEntryId: on });
  const card = (videoTimeS: number, player: string, outcome: string) => ({ typeId: 'card', outcome, videoTimeS, lineupEntryId: player });

  it('starts with the starters', () => {
    expect(onPitchAt(0, lineup, [])).toEqual(new Set(['a', 'b']));
  });

  it('applies substitutions up to the given time, in time order', () => {
    const events = [sub(200, 's1', 's2'), sub(100, 'a', 's1')];
    expect(onPitchAt(99, lineup, events)).toEqual(new Set(['a', 'b']));
    expect(onPitchAt(150, lineup, events)).toEqual(new Set(['b', 's1']));
    expect(onPitchAt(250, lineup, events)).toEqual(new Set(['b', 's2']));
  });

  it('removes players sent off; a yellow card changes nothing', () => {
    const events = [card(50, 'a', 'yellow'), card(60, 'b', 'red'), card(70, 'a', 'second_yellow')];
    expect(onPitchAt(55, lineup, events)).toEqual(new Set(['a', 'b']));
    expect(onPitchAt(80, lineup, events)).toEqual(new Set());
  });

  it('ignores substitutions that are not filled in yet', () => {
    expect(onPitchAt(150, lineup, [{ typeId: 'substitution', videoTimeS: 100, lineupEntryId: 'a' }])).toEqual(new Set(['a', 'b']));
  });
});

describe('sortForLog', () => {
  it('puts the last logged event first, whatever its timeline time', () => {
    const events = [
      { id: '1', videoTimeS: 50, createdAt: '2026-10-13T10:00:00.000Z' },
      { id: '2', videoTimeS: 30, createdAt: '2026-10-13T10:00:01.000Z' },
      { id: '3', videoTimeS: 10, createdAt: '2026-10-13T10:00:02.000Z' },
    ];
    expect(sortForLog(events).map((e) => e.id)).toEqual(['3', '2', '1']);
  });
});
