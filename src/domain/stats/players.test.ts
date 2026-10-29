import { describe, expect, it } from 'vitest';
import { actionCatalog } from '../catalog';
import { footballMinute, incompleteSummary, matchEndClockS, playerLines, type LineEvent, type LineupLine } from './players';

const m = (min: number, s = 0) => min * 60 + s;

const lineup: LineupLine[] = [
  { id: 'A', playerId: 'pA', shirtNumber: 1, role: 'starter', positionSlotId: 'GK' },
  { id: 'B', playerId: 'pB', shirtNumber: 9, role: 'starter', positionSlotId: 'ST' },
  { id: 'C', playerId: 'pC', shirtNumber: 8, role: 'starter', positionSlotId: 'CM' },
  { id: 'S2', playerId: 'pS2', shirtNumber: 15, role: 'sub' },
  { id: 'S1', playerId: 'pS1', shirtNumber: 14, role: 'sub' },
  { id: 'S3', playerId: 'pS3', shirtNumber: 17, role: 'sub' },
];
const slotOrder = ['GK', 'CM', 'ST'];

const ev = (typeId: string, clockS: number, extra: Partial<LineEvent> = {}): LineEvent => ({ typeId, clockS, attributes: {}, ...extra });

const events: LineEvent[] = [
  ev('pass', m(33, 5), { outcome: 'complete', lineupEntryId: 'C', start: { x: 70, y: 40 }, end: { x: 90, y: 50 }, attributes: { chance: 'assist' } }),
  ev('shot', m(33, 10), { outcome: 'goal', lineupEntryId: 'B', start: { x: 95, y: 50 }, attributes: { bodyPart: 'head' } }),
  ev('card', m(40), { outcome: 'yellow', lineupEntryId: 'B' }),
  ev('substitution', m(62, 30), { lineupEntryId: 'B', relatedLineupEntryId: 'S1' }),
  ev('card', m(80), { outcome: 'second_yellow', lineupEntryId: 'C' }),
  ev('substitution', m(85), { lineupEntryId: 'S1', relatedLineupEntryId: 'S3' }),
  ev('gk_save', m(50), { lineupEntryId: 'A' }), // no location: incomplete
  ev('pass', m(20), { outcome: 'complete', start: { x: 30, y: 30 }, end: { x: 40, y: 30 } }), // no player: team only
];

describe('playerLines', () => {
  const lines = playerLines({ lineup, events, catalog: actionCatalog, endClockS: m(90), slotOrder });
  const line = (id: string) => lines.find((l) => l.entryId === id)!;

  it('lists starters in formation order, then subs who came on by time, then unused subs', () => {
    expect(lines.map((l) => l.entryId)).toEqual(['A', 'C', 'B', 'S1', 'S3', 'S2']);
    expect(lines.map((l) => l.played)).toEqual([true, true, true, true, true, false]);
  });

  it('minutes played come from the clock: on at the start or the sub, off at a sub, a sending off or full time', () => {
    expect(line('A')).toMatchObject({ onClockS: 0, offClockS: null, offReason: null, minutes: 90 });
    expect(line('B')).toMatchObject({ onClockS: 0, offClockS: m(62, 30), offReason: 'sub', minutes: 63 });
    expect(line('C')).toMatchObject({ offClockS: m(80), offReason: 'sent_off', minutes: 80 });
    // Came on and went off again.
    expect(line('S1')).toMatchObject({ onClockS: m(62, 30), offClockS: m(85), offReason: 'sub', minutes: 23 });
    expect(line('S3')).toMatchObject({ onClockS: m(85), offClockS: null, minutes: 5 });
    expect(line('S2')).toMatchObject({ onClockS: null, minutes: 0 });
  });

  it('badges carry the football minute and come in time order', () => {
    expect(line('B').badges).toEqual([
      { kind: 'goal', minute: 34 },
      { kind: 'yellow', minute: 41 },
      { kind: 'sub_off', minute: 63 },
    ]);
    expect(line('C').badges).toEqual([
      { kind: 'assist', minute: 34 },
      { kind: 'second_yellow', minute: 81 },
    ]);
    expect(line('S1').badges).toEqual([
      { kind: 'sub_on', minute: 63 },
      { kind: 'sub_off', minute: 86 },
    ]);
    expect(line('A').badges).toEqual([]);
  });

  it("each player's stats are the stats engine on their own events", () => {
    expect(line('B').stats.goals).toEqual({ kind: 'count', value: 1 });
    expect(line('B').stats.yellow_cards).toEqual({ kind: 'count', value: 1 });
    expect(line('C').stats.assists).toEqual({ kind: 'count', value: 1 });
    expect(line('C').stats.red_cards).toEqual({ kind: 'count', value: 1 });
    // The pass without a player belongs to nobody.
    expect(lines.reduce((n, l) => n + (l.stats.passes.kind === 'ratio' ? l.stats.passes.total : 0), 0)).toBe(1);
  });

  it('counts incomplete events per player for the ⚠ mark', () => {
    expect(line('A').incompleteCount).toBe(1);
    expect(line('B').incompleteCount).toBe(0);
  });

  it('counts stoppage time: a sub in the 92nd minute of a match that ended at 95:00', () => {
    const late = playerLines({ lineup, events: [ev('substitution', m(92), { lineupEntryId: 'A', relatedLineupEntryId: 'S2' })], catalog: actionCatalog, endClockS: m(95), slotOrder });
    expect(late.find((l) => l.entryId === 'A')).toMatchObject({ minutes: 92, offReason: 'sub' });
    expect(late.find((l) => l.entryId === 'S2')).toMatchObject({ played: true, minutes: 3 });
    expect(late.find((l) => l.entryId === 'B')).toMatchObject({ minutes: 95 });
  });
});

describe('incompleteSummary', () => {
  it('counts incomplete events, those without a player and those without a location', () => {
    expect(incompleteSummary(events, actionCatalog)).toEqual({ total: 2, withoutPlayer: 1, withoutLocation: 1 });
  });
});

describe('matchEndClockS', () => {
  const running = (videoTimeS: number, clockS: number) => ({ videoTimeS, clockS, running: true });
  const stopped = (videoTimeS: number, clockS: number) => ({ videoTimeS, clockS, running: false });

  it('is wherever the clock got to, stoppage time included', () => {
    expect(matchEndClockS([running(0, 0), stopped(m(93, 20), m(93, 20))], [])).toBe(m(93, 20));
    expect(matchEndClockS([running(0, 0), stopped(m(96), m(96))], [{ videoTimeS: m(50), clockS: m(50) }])).toBe(m(96));
  });

  it('is the last clock time for a partial clip', () => {
    expect(matchEndClockS([running(100, m(45))], [{ videoTimeS: 1300, clockS: m(65) }])).toBe(m(65));
  });

  it('uses the latest event clock when that is later, e.g. a hand-corrected time', () => {
    expect(matchEndClockS([], [{ videoTimeS: 10, clockS: m(20) }])).toBe(m(20));
  });
});

describe('footballMinute', () => {
  it('counts the minute being played: 0:00–0:59 is the 1st minute', () => {
    expect(footballMinute(0)).toBe(1);
    expect(footballMinute(m(33, 10))).toBe(34);
    expect(footballMinute(m(62, 59))).toBe(63);
  });
});
