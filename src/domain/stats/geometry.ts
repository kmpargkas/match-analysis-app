import type { Point } from '../schemas';

/** Reference pitch in metres. Stored points are 0–100 on both axes, our team attacking →. */
export const PITCH_LENGTH_M = 105;
export const PITCH_WIDTH_M = 68;

const BOX_DEPTH_M = 16.5;
const BOX_WIDTH_M = 40.32;
const LONG_BALL_M = 30;
const FINAL_THIRD_X = 66.7;
/** Progressive passes may not start in our defensive 40 % of the pitch. */
const PROGRESSIVE_MIN_START_X = 40;
const PROGRESSIVE_MIN_GAIN_M = 10;
const PROGRESSIVE_MIN_GAIN_SHARE = 0.25;

const toMetres = (p: Point) => ({ x: (p.x / 100) * PITCH_LENGTH_M, y: (p.y / 100) * PITCH_WIDTH_M });

export function lengthM(a: Point, b: Point): number {
  const from = toMetres(a);
  const to = toMetres(b);
  return Math.hypot(to.x - from.x, to.y - from.y);
}

const toGoalM = (p: Point) => {
  const m = toMetres(p);
  return Math.hypot(PITCH_LENGTH_M - m.x, PITCH_WIDTH_M / 2 - m.y);
};

export const isLongBall = (start: Point, end: Point) => lengthM(start, end) >= LONG_BALL_M;

export const intoFinalThird = (start: Point, end: Point) => start.x <= FINAL_THIRD_X && end.x > FINAL_THIRD_X;

export function isProgressive(start: Point, end: Point): boolean {
  if (start.x < PROGRESSIVE_MIN_START_X) return false;
  const before = toGoalM(start);
  const gain = before - toGoalM(end);
  return gain >= PROGRESSIVE_MIN_GAIN_M && gain >= before * PROGRESSIVE_MIN_GAIN_SHARE;
}

export function inOpponentBox(p: Point): boolean {
  const m = toMetres(p);
  return m.x >= PITCH_LENGTH_M - BOX_DEPTH_M && Math.abs(m.y - PITCH_WIDTH_M / 2) <= BOX_WIDTH_M / 2;
}
