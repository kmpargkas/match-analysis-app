import type { Point } from '../schemas';
import type { StatEvent } from './engine';
import { intoFinalThird, isLongBall, isProgressive } from './geometry';

export type MapEvent = StatEvent;

/** All shots look the same size until xG exists; only the kind changes the marker. */
export type ShotMarkerKind = 'on_target' | 'off_target' | 'blocked';

export interface ShotMarker {
  kind: ShotMarkerKind;
  at: Point;
}

const SHOT_KIND: Record<string, ShotMarkerKind> = { goal: 'on_target', saved: 'on_target', off_target: 'off_target', woodwork: 'off_target', blocked: 'blocked' };

export function mapShots(events: readonly MapEvent[]): { markers: ShotMarker[]; withoutLocation: number } {
  const shots = events.filter((e) => e.typeId === 'shot' && e.outcome !== undefined && SHOT_KIND[e.outcome]);
  return {
    markers: shots.flatMap((e) => (e.start ? [{ kind: SHOT_KIND[e.outcome!]!, at: e.start }] : [])),
    withoutLocation: shots.filter((e) => !e.start).length,
  };
}

export const PASS_FILTERS = ['all', 'complete', 'failed', 'crosses', 'long_balls', 'final_third', 'progressive', 'key_passes'] as const;
export type PassFilter = (typeof PASS_FILTERS)[number];

export interface PassLine {
  typeId: string;
  accurate: boolean;
  start: Point;
  end: Point;
}

type Located = MapEvent & { start: Point; end: Point };
const located = (e: MapEvent): e is Located => !!e.start && !!e.end;

/** Filters that only make sense with a location: passes without one are not "missing" from them. */
const NEEDS_LOCATION = new Set<PassFilter>(['long_balls', 'final_third', 'progressive']);

/** Same definitions as the passing stats, so a filter shows exactly the passes a number counts. */
function keep(filter: PassFilter, e: MapEvent): boolean {
  const complete = e.outcome === 'complete';
  switch (filter) {
    case 'all':
      return true;
    case 'complete':
      return complete;
    case 'failed':
      return e.outcome === 'incomplete';
    case 'crosses':
      return e.typeId === 'cross';
    case 'long_balls':
      return e.typeId === 'pass' && located(e) && isLongBall(e.start, e.end);
    case 'final_third':
      return e.typeId === 'pass' && complete && located(e) && intoFinalThird(e.start, e.end);
    case 'progressive':
      return e.typeId === 'pass' && complete && located(e) && isProgressive(e.start, e.end);
    case 'key_passes':
      return e.attributes.chance === 'key_pass' || e.attributes.chance === 'assist';
  }
}

/** Passes and crosses for the pass map: green when accurate, red when not, whatever the type. */
export function mapPasses(events: readonly MapEvent[], filter: PassFilter): { lines: PassLine[]; withoutLocation: number } {
  const shown = events.filter((e) => (e.typeId === 'pass' || e.typeId === 'cross') && e.outcome !== undefined && keep(filter, e));
  return {
    lines: shown.filter(located).map((e) => ({ typeId: e.typeId, accurate: e.outcome === 'complete', start: e.start, end: e.end })),
    withoutLocation: NEEDS_LOCATION.has(filter) ? 0 : shown.filter((e) => !located(e)).length,
  };
}
