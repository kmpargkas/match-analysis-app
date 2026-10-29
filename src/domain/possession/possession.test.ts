import { describe, expect, it } from 'vitest';
import { possessionAt, possessionChangeFor, possessionShare, type ChangeDraft } from '.';

const change = (videoTimeS: number, team: ChangeDraft['team'], id = `${team}@${videoTimeS}`): ChangeDraft => ({ id, videoTimeS, team });

describe('possessionAt', () => {
  it('is unknown before the first change', () => {
    expect(possessionAt(5, [change(10, 'us')])).toBeNull();
  });

  it('holds from each change until the next, in any stored order', () => {
    const changes = [change(30, 'them'), change(10, 'us')];
    expect(possessionAt(10, changes)).toBe('us');
    expect(possessionAt(29.9, changes)).toBe('us');
    expect(possessionAt(30, changes)).toBe('them');
  });
});

describe('possessionChangeFor', () => {
  it('adds a change when the team differs', () => {
    expect(possessionChangeFor('them', 40, [change(10, 'us')])).toEqual({ kind: 'add' });
  });

  it('does nothing when that team already has the ball', () => {
    expect(possessionChangeFor('us', 40, [change(10, 'us')])).toEqual({ kind: 'none' });
  });

  it('replaces a change at the same moment instead of stacking two', () => {
    expect(possessionChangeFor('them', 10.02, [change(10, 'us', 'c1')])).toEqual({ kind: 'replace', id: 'c1' });
  });
});

describe('possessionShare', () => {
  it('counts only time while the clock runs, and leaves out unknown time', () => {
    // Clock runs 0–100 and 150–200. Unknown until 20, us until 60, them from 60.
    const changes = [change(20, 'us'), change(60, 'them')];
    const share = possessionShare(changes, [
      [0, 100],
      [150, 200],
    ]);
    expect(share).toEqual({ usS: 40, themS: 90, us: 40 / 130 });
  });

  it('is null with no known possession time', () => {
    expect(possessionShare([], [[0, 100]]).us).toBeNull();
  });
});
