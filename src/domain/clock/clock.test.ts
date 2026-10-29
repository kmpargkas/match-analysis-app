import { describe, expect, it } from 'vitest';
import { clockAt, clockCommand, formatClock, parseClock, resumeTimelineS, runningSpans, type AnchorDraft } from '.';

const anchor = (videoTimeS: number, clockS: number, running: boolean, createdAt = '2026-10-13T10:00:00.000Z'): AnchorDraft => ({ videoTimeS, clockS, running, createdAt });

describe('clockAt', () => {
  it('shows a stopped 00:00 before the clock is started', () => {
    expect(clockAt(42, [])).toEqual({ clockS: 0, running: false });
  });

  it('follows the timeline while running, so pausing and jumping move it with the timeline', () => {
    const anchors = [anchor(30, 0, true)];
    expect(clockAt(30, anchors)).toEqual({ clockS: 0, running: true });
    expect(clockAt(95.5, anchors)).toEqual({ clockS: 65.5, running: true });
    expect(clockAt(10, anchors)).toEqual({ clockS: 0, running: false });
  });

  it('freezes when stopped and continues from the same value when started again', () => {
    // First half ends at 45:00, the second half starts later on the timeline.
    const anchors = [anchor(0, 0, true), anchor(2700, 2700, false), anchor(3600, 2700, true)];
    expect(clockAt(3000, anchors)).toEqual({ clockS: 2700, running: false });
    expect(clockAt(3660, anchors)).toEqual({ clockS: 2760, running: true });
  });

  it('goes past 45:00 without stoppage notation', () => {
    expect(formatClock(clockAt(2830, [anchor(0, 0, true)]).clockS)).toBe('47:10');
  });

  it('lets a later anchor at the same timeline time win', () => {
    const anchors = [anchor(100, 600, true, '2026-10-13T10:00:01.000Z'), anchor(100, 0, false, '2026-10-13T10:00:00.000Z')];
    expect(clockAt(110, anchors)).toEqual({ clockS: 610, running: true });
  });

  it('supports a partial clip that starts at 61:30', () => {
    expect(clockAt(12, [anchor(2, 3690, true)]).clockS).toBe(3700);
  });
});

describe('clockCommand', () => {
  const running = [anchor(10, 0, true)];

  it('starts from the value shown', () => {
    expect(clockCommand({ kind: 'start' }, 20, [anchor(5, 300, false)])).toEqual({ videoTimeS: 20, clockS: 300, running: true });
  });

  it('stops at the value shown', () => {
    expect(clockCommand({ kind: 'stop' }, 70, running)).toEqual({ videoTimeS: 70, clockS: 60, running: false });
  });

  it('sets a typed value and keeps running or stopped as it was', () => {
    expect(clockCommand({ kind: 'set', clockS: 1500 }, 70, running)).toEqual({ videoTimeS: 70, clockS: 1500, running: true });
    expect(clockCommand({ kind: 'set', clockS: 1500 }, 70, [])).toEqual({ videoTimeS: 70, clockS: 1500, running: false });
  });

  it('can set a value and stop the clock in one anchor, as at the start of the 2nd half', () => {
    expect(clockCommand({ kind: 'set', clockS: 2700, running: false }, 70, [anchor(10, 0, true)])).toEqual({ videoTimeS: 70, clockS: 2700, running: false });
  });

  it('ignores commands that change nothing', () => {
    expect(clockCommand({ kind: 'start' }, 70, running)).toBeNull();
    expect(clockCommand({ kind: 'stop' }, 70, [])).toBeNull();
  });
});

describe('runningSpans', () => {
  it('lists the timeline ranges in which the clock runs, up to the end given', () => {
    const anchors = [anchor(0, 0, true), anchor(100, 100, false), anchor(150, 100, true), anchor(180, 900, true)];
    expect(runningSpans(anchors, 200)).toEqual([
      [0, 100],
      [150, 200],
    ]);
    expect(runningSpans([], 200)).toEqual([]);
  });
});

describe('formatClock and parseClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(23 * 60 + 41.9)).toBe('23:41');
    expect(formatClock(93 * 60 + 5)).toBe('93:05');
  });

  it('reads mm:ss or whole minutes', () => {
    expect(parseClock('61:30')).toBe(3690);
    expect(parseClock(' 45 ')).toBe(2700);
    for (const text of ['', 'abc', '12:60', '-1', '1:2']) expect(parseClock(text)).toBeNull();
  });
});

describe('resumeTimelineS', () => {
  it('starts a new match at 0', () => {
    expect(resumeTimelineS([])).toBe(0);
  });

  it('carries on from the latest recorded time, so the timeline never goes back', () => {
    expect(resumeTimelineS([{ videoTimeS: 12 }, { videoTimeS: 340.5 }, { videoTimeS: 99 }])).toBe(340.5);
  });
});
