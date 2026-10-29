import { describe, expect, it } from 'vitest';
import { fromScreen, isDrag, toScreen } from '.';

describe('coordinates', () => {
  it('stores points as clicked while we attack left → right', () => {
    expect(fromScreen({ x: 80, y: 20 }, 'ltr')).toEqual({ x: 80, y: 20 });
  });

  it('mirrors points logged while we attack right → left, so every map shows us attacking →', () => {
    // A shot near the left goal while attacking ← is a shot near the opponent's goal.
    expect(fromScreen({ x: 10, y: 30 }, 'rtl')).toEqual({ x: 90, y: 70 });
  });

  it('shows a stored point back where it was clicked', () => {
    const clicked = { x: 12.5, y: 33 };
    expect(toScreen(fromScreen(clicked, 'rtl'), 'rtl')).toEqual(clicked);
  });

  it('clamps to the pitch', () => {
    expect(fromScreen({ x: -3, y: 104 }, 'ltr')).toEqual({ x: 0, y: 100 });
  });

  it('treats a short press as a click and a longer one as a drag', () => {
    expect(isDrag({ x: 50, y: 50 }, { x: 50.8, y: 50.5 })).toBe(false);
    expect(isDrag({ x: 50, y: 50 }, { x: 60, y: 52 })).toBe(true);
  });
});
