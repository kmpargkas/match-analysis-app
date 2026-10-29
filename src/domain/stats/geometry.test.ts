import { describe, expect, it } from 'vitest';
import { inOpponentBox, intoFinalThird, isLongBall, isProgressive, lengthM } from './geometry';

describe('pitch geometry (105 × 68 m, we attack →)', () => {
  it('measures in metres, not in 0–100 units', () => {
    expect(lengthM({ x: 0, y: 50 }, { x: 100, y: 50 })).toBeCloseTo(105);
    expect(lengthM({ x: 50, y: 0 }, { x: 50, y: 100 })).toBeCloseTo(68);
  });

  it('a long ball is 30 m or more', () => {
    expect(isLongBall({ x: 50, y: 50 }, { x: 78.6, y: 50 })).toBe(true); // 30.03 m
    expect(isLongBall({ x: 50, y: 50 }, { x: 78.5, y: 50 })).toBe(false); // 29.9 m
  });

  it('into the final third: starts at or before x = 66.7 and ends beyond it', () => {
    expect(intoFinalThird({ x: 60, y: 50 }, { x: 70, y: 50 })).toBe(true);
    expect(intoFinalThird({ x: 70, y: 50 }, { x: 90, y: 50 })).toBe(false);
    expect(intoFinalThird({ x: 40, y: 50 }, { x: 66.7, y: 50 })).toBe(false);
  });

  it('progressive: ≥ 25 % and ≥ 10 m closer to the goal centre, not starting in our defensive 40 %', () => {
    expect(isProgressive({ x: 50, y: 50 }, { x: 80, y: 50 })).toBe(true);
    // 5.25 m closer: not enough metres.
    expect(isProgressive({ x: 60, y: 50 }, { x: 65, y: 50 })).toBe(false);
    // Long way forward but starts in our defensive 40 %.
    expect(isProgressive({ x: 30, y: 50 }, { x: 70, y: 50 })).toBe(false);
    // 10.5 m closer from 52.5 m away is only 20 %.
    expect(isProgressive({ x: 50, y: 50 }, { x: 60, y: 50 })).toBe(false);
    // Sideways never progresses.
    expect(isProgressive({ x: 70, y: 10 }, { x: 70, y: 90 })).toBe(false);
  });

  it('the opponent box is 16.5 m deep and 40.32 m wide', () => {
    expect(inOpponentBox({ x: 85, y: 50 })).toBe(true);
    expect(inOpponentBox({ x: 84, y: 50 })).toBe(false);
    expect(inOpponentBox({ x: 95, y: 21 })).toBe(true);
    expect(inOpponentBox({ x: 95, y: 20 })).toBe(false);
    expect(inOpponentBox({ x: 10, y: 50 })).toBe(false);
  });
});
