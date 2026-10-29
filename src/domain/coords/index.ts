import type { AttackDir, Point } from '../schemas';

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const mirror = (p: Point): Point => ({ x: 100 - p.x, y: 100 - p.y });

/** A point clicked on the minimap → stored, normalized so we always attack left → right. */
export function fromScreen(p: Point, dir: AttackDir): Point {
  const clamped = { x: clamp(p.x), y: clamp(p.y) };
  return dir === 'rtl' ? mirror(clamped) : clamped;
}

/** A stored point → where it sits on a minimap drawn with the given attack direction. */
export function toScreen(p: Point, dir: AttackDir): Point {
  return dir === 'rtl' ? mirror(p) : p;
}

/** Movement (in 0–100 units) beyond which a press on the minimap is a drag (a pass line), not a click. */
const DRAG_THRESHOLD = 2.5;

export function isDrag(from: Point, to: Point): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) > DRAG_THRESHOLD;
}
