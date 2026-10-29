import { describe, expect, it } from 'vitest';
import { actionCatalog } from '../catalog';
import { computeStats, STAT_CATEGORIES, STATS, type StatEvent } from '.';

const ev = (typeId: string, outcome?: string, extra: Partial<StatEvent> = {}): StatEvent => ({
  typeId,
  ...(outcome ? { outcome } : {}),
  attributes: {},
  ...extra,
});
const at = (x: number, y: number) => ({ start: { x, y } });
const line = (x1: number, y1: number, x2: number, y2: number) => ({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
const count = (value: number) => ({ kind: 'count', value });
const ratio = (made: number, total: number) => ({ kind: 'ratio', made, total });

/**
 * A hand-counted match. Each expectation below was counted from this list by
 * hand; the comments name the events behind every number.
 */
const FIXTURE: StatEvent[] = [
  ev('pass', 'complete', line(20, 50, 30, 50)), // P1: short, from our defensive 40 %
  ev('pass', 'complete', line(50, 50, 80, 50)), // P2: 31.5 m long, into final third, progressive
  ev('pass', 'incomplete', line(30, 20, 70, 20)), // P3: 42 m long, failed
  ev('pass', 'complete', { ...line(60, 50, 65, 50), attributes: { chance: 'key_pass' } }), // P4: key pass
  ev('pass', 'complete', { attributes: { chance: 'assist' } }), // P5: assist, no location
  ev('pass', 'complete', line(70, 10, 70, 90)), // P6: 54.4 m sideways, already in the final third
  ev('cross', 'complete', { ...line(90, 5, 95, 50), attributes: { chance: 'assist' } }), // C1
  ev('cross', 'incomplete', line(88, 95, 97, 40)), // C2
  ev('shot', 'goal', { ...at(95, 50), attributes: { bodyPart: 'head', bigChance: true } }), // S1: in the box
  ev('shot', 'saved', at(85, 40)), // S2: in the box
  ev('shot', 'off_target', at(75, 50)), // S3
  ev('shot', 'blocked', at(88, 45)), // S4: in the box
  ev('shot', 'woodwork', at(92, 55)), // S5: in the box
  ev('shot', 'goal', { attributes: { bodyPart: 'right', situation: 'penalty' } }), // S6: no location
  ev('dribble', 'success', at(60, 30)),
  ev('dribble', 'success', at(70, 40)),
  ev('dribble', 'fail', at(50, 50)),
  ev('offside', undefined, at(80, 50)),
  ev('error', 'error', at(50, 50)),
  ev('error', 'led_to_attempt', at(30, 50)),
  ev('error', 'led_to_goal', at(20, 50)),
  ev('own_goal', undefined, at(8, 50)),
  ev('tackle', 'won', at(30, 50)),
  ev('tackle', 'lost', at(35, 50)),
  ev('interception', undefined, at(40, 40)),
  ev('recovery', undefined, at(20, 20)),
  ev('recovery', undefined, at(25, 25)),
  ev('clearance', undefined, { ...at(10, 50), attributes: { clearance: 'ground' } }),
  ev('block', undefined, { ...at(12, 50), attributes: { blocked: 'shot' } }),
  ev('dribbled_past', undefined, at(30, 60)),
  ev('duel_ground', 'won', at(50, 40)),
  ev('duel_ground', 'lost', at(55, 40)),
  ev('duel_aerial', 'won', at(45, 50)),
  ev('duel_aerial', 'won', at(15, 50)),
  ev('duel_aerial', 'lost', at(60, 50)),
  ev('foul', 'won', { ...at(86, 50), attributes: { penalty: 'won' } }),
  ev('foul', 'won', at(60, 30)),
  ev('foul', 'committed', at(40, 50)),
  ev('card', 'yellow'),
  ev('card', 'second_yellow'),
  ev('gk_save', undefined, { ...at(3, 50), attributes: { handling: 'caught' } }),
  ev('gk_save', undefined, { ...at(4, 45), attributes: { handling: 'parried', penalty: true } }),
  ev('gk_save', undefined, at(5, 55)),
  ev('gk_claim', 'success', at(6, 50)),
  ev('gk_claim', 'fail', at(7, 50)),
  ev('gk_claim', undefined, at(6, 40)), // outcome not set yet
  ev('gk_punch', undefined, at(5, 50)),
  ev('gk_sweeper', 'success', at(25, 50)),
  // Not counted anywhere
  ev('substitution'),
  ev('touch', undefined, at(90, 50)), // removed type: ignored
];

describe('computeStats on the hand-counted fixture', () => {
  const s = computeStats(FIXTURE, actionCatalog);

  it('passing', () => {
    expect(s.passes).toEqual(ratio(5, 6)); // P1, P2, P4, P5, P6 of 6
    expect(s.crosses).toEqual(ratio(1, 2)); // C1 of C1, C2
    expect(s.long_balls).toEqual(ratio(2, 3)); // P2, P6 of P2, P3, P6 (located passes ≥ 30 m)
    expect(s.into_final_third).toEqual(count(1)); // P2
    expect(s.progressive_passes).toEqual(count(1)); // P2
    expect(s.key_passes).toEqual(count(1)); // P4
    expect(s.assists).toEqual(count(2)); // P5, C1
  });

  it('shooting', () => {
    expect(s.shots).toEqual(count(6));
    expect(s.shots_on_target).toEqual(ratio(3, 6)); // S1, S2, S6
    expect(s.goals).toEqual(count(2)); // S1, S6
    expect(s.shots_off_target).toEqual(count(1)); // S3
    expect(s.shots_blocked).toEqual(count(1)); // S4
    expect(s.shots_woodwork).toEqual(count(1)); // S5
    expect(s.big_chances).toEqual(count(1)); // S1
    expect(s.conversion).toEqual(ratio(2, 6));
  });

  it('on ball: touches are summed from actions that count as a touch', () => {
    expect(s.dribbles).toEqual(ratio(2, 3));
    // passes 6 + crosses 2 + shots 6 + dribbles 3 + errors 3 + own goal 1 + tackle won 1
    // + interception 1 + recoveries 2 + clearance 1 + block 1 + aerial won 2
    // + saves 3 + claims 3 + punch 1 + sweeper 1
    expect(s.touches).toEqual(count(37));
    expect(s.touches_in_box).toEqual(count(4)); // S1, S2, S4, S5
    expect(s.offsides).toEqual(count(1));
  });

  it('defending', () => {
    expect(s.tackles).toEqual(ratio(1, 2));
    expect(s.interceptions).toEqual(count(1));
    expect(s.recoveries).toEqual(count(2));
    expect(s.clearances).toEqual(count(1));
    expect(s.blocks).toEqual(count(1));
    expect(s.dribbled_past).toEqual(count(1));
  });

  it('duels: dribbles, tackles and dribbled past count as ground duels', () => {
    // won: ground ✓ 1 + dribble ✓ 2 + tackle ✓ 1; lost: ground ✗ 1 + dribble ✗ 1 + tackle ✗ 1 + dribbled past 1
    expect(s.ground_duels).toEqual(ratio(4, 8));
    expect(s.aerial_duels).toEqual(ratio(2, 3));
    expect(s.duels).toEqual(ratio(6, 11));
  });

  it('fouls and cards: a second yellow is a yellow card and a sending off', () => {
    expect(s.fouls_committed).toEqual(count(1));
    expect(s.fouls_won).toEqual(count(2));
    expect(s.penalties_won).toEqual(count(1));
    expect(s.penalties_conceded).toEqual(count(0));
    expect(s.yellow_cards).toEqual(count(2));
    expect(s.red_cards).toEqual(count(1));
  });

  it('errors', () => {
    expect(s.errors).toEqual(count(3));
    expect(s.errors_led_to_attempt).toEqual(count(1));
    expect(s.errors_led_to_goal).toEqual(count(1));
    expect(s.own_goals).toEqual(count(1));
  });

  it('goalkeeping: an outcome not set yet stays out of the ratio', () => {
    expect(s.saves).toEqual(count(3));
    expect(s.saves_caught).toEqual(count(1));
    expect(s.saves_parried).toEqual(count(1));
    expect(s.penalty_saves).toEqual(count(1));
    expect(s.claims).toEqual(ratio(1, 2));
    expect(s.punches).toEqual(count(1));
    expect(s.sweeper_actions).toEqual(ratio(1, 1));
  });
});

describe('computeStats edge cases', () => {
  it('gives zeros, never NaN, for a match without events', () => {
    const s = computeStats([], actionCatalog);
    expect(s.passes).toEqual(ratio(0, 0));
    expect(s.touches).toEqual(count(0));
  });

  it('counts only the events it is given, so a player is the same engine on their events', () => {
    const s = computeStats([ev('pass', 'complete'), ev('pass', 'incomplete')], actionCatalog);
    expect(s.passes).toEqual(ratio(1, 2));
    expect(s.shots).toEqual(count(0));
  });
});

describe('stat registry', () => {
  it('has unique IDs, each in a known category, and computeStats returns every one', () => {
    const ids = STATS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STATS.every((d) => STAT_CATEGORIES.includes(d.category))).toBe(true);
    expect(Object.keys(computeStats([], actionCatalog)).sort()).toEqual([...ids].sort());
  });

  it('only reads action types that exist in the catalog', () => {
    const known = new Set(actionCatalog.types.map((t) => t.id));
    expect(STATS.flatMap((d) => d.typeIds).filter((id) => !known.has(id))).toEqual([]);
  });

  it('every category has at least one stat', () => {
    expect(STAT_CATEGORIES.filter((c) => !STATS.some((d) => d.category === c))).toEqual([]);
  });
});
