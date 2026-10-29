import { describe, expect, it } from 'vitest';
import { mapPasses, mapShots, PASS_FILTERS, type MapEvent } from './maps';

const ev = (typeId: string, outcome: string | undefined, extra: Partial<MapEvent> = {}): MapEvent => ({ typeId, ...(outcome ? { outcome } : {}), attributes: {}, ...extra });
const line = (x1: number, y1: number, x2: number, y2: number) => ({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });

describe('mapShots', () => {
  const shots = [
    ev('shot', 'goal', { start: { x: 95, y: 50 } }),
    ev('shot', 'saved', { start: { x: 88, y: 40 } }),
    ev('shot', 'off_target', { start: { x: 80, y: 50 } }),
    ev('shot', 'woodwork', { start: { x: 90, y: 55 } }),
    ev('shot', 'blocked', { start: { x: 85, y: 45 } }),
    ev('shot', 'goal'), // penalty, no location
    ev('pass', 'complete', line(10, 10, 20, 20)), // not a shot
  ];

  it('marks goals and saved shots as on target, off target and woodwork as off target, and blocked shots', () => {
    const { markers } = mapShots(shots);
    expect(markers.map((m) => m.kind)).toEqual(['on_target', 'on_target', 'off_target', 'off_target', 'blocked']);
    expect(markers[0]!.at).toEqual({ x: 95, y: 50 });
  });

  it('counts shots it cannot place', () => {
    expect(mapShots(shots).withoutLocation).toBe(1);
  });
});

describe('mapPasses', () => {
  const passes = [
    ev('pass', 'complete', line(50, 50, 80, 50)), // long, into final third, progressive
    ev('pass', 'incomplete', line(30, 20, 70, 20)), // long, failed
    ev('pass', 'complete', { ...line(60, 50, 65, 50), attributes: { chance: 'key_pass' } }),
    ev('cross', 'complete', { ...line(90, 5, 95, 50), attributes: { chance: 'assist' } }),
    ev('cross', 'incomplete', line(88, 95, 97, 40)),
    ev('pass', 'complete'), // no location
    ev('shot', 'goal', { start: { x: 95, y: 50 } }), // not a pass
  ];
  const kept = (filter: (typeof PASS_FILTERS)[number]) => mapPasses(passes, filter).lines.map((l) => `${l.typeId}:${l.accurate ? 'ok' : 'x'}`);

  it('draws every pass and cross as accurate or not, whatever the type', () => {
    expect(kept('all')).toEqual(['pass:ok', 'pass:x', 'pass:ok', 'cross:ok', 'cross:x']);
  });

  it('filters with the same rules as the stats', () => {
    expect(kept('complete')).toEqual(['pass:ok', 'pass:ok', 'cross:ok']);
    expect(kept('failed')).toEqual(['pass:x', 'cross:x']);
    expect(kept('crosses')).toEqual(['cross:ok', 'cross:x']);
    expect(kept('long_balls')).toEqual(['pass:ok', 'pass:x']);
    expect(kept('final_third')).toEqual(['pass:ok']);
    expect(kept('progressive')).toEqual(['pass:ok']);
    expect(kept('key_passes')).toEqual(['pass:ok', 'cross:ok']);
  });

  it('counts passes it cannot draw for filters that do not need a location', () => {
    expect(mapPasses(passes, 'all').withoutLocation).toBe(1);
    expect(mapPasses(passes, 'complete').withoutLocation).toBe(1);
    expect(mapPasses(passes, 'failed').withoutLocation).toBe(0);
    // Long balls need a location to exist at all.
    expect(mapPasses(passes, 'long_balls').withoutLocation).toBe(0);
  });
});
