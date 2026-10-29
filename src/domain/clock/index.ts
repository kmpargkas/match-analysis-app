import type { ClockAnchor } from '../schemas';

export type AnchorDraft = Pick<ClockAnchor, 'videoTimeS' | 'clockS' | 'running'> & { createdAt?: string };

export interface ClockReading {
  clockS: number;
  running: boolean;
}

// Same timeline time: the anchor created last wins, e.g. a stop immediately followed by a typed value.
function sorted<A extends AnchorDraft>(anchors: readonly A[]): A[] {
  return [...anchors].sort((a, b) => a.videoTimeS - b.videoTimeS || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
}

export function clockAt(t: number, anchors: readonly AnchorDraft[]): ClockReading {
  let current: AnchorDraft | undefined;
  for (const anchor of sorted(anchors)) {
    if (anchor.videoTimeS > t) break;
    current = anchor;
  }
  if (!current) return { clockS: 0, running: false };
  return { clockS: current.running ? current.clockS + (t - current.videoTimeS) : current.clockS, running: current.running };
}

export type ClockCommand = { kind: 'start' } | { kind: 'stop' } | { kind: 'set'; clockS: number; running?: boolean };

/** The anchor a clock control adds at timeline time `t`, or null when it would change nothing. */
export function clockCommand(command: ClockCommand, t: number, anchors: readonly AnchorDraft[]): AnchorDraft | null {
  const now = clockAt(t, anchors);
  switch (command.kind) {
    case 'start':
      return now.running ? null : { videoTimeS: t, clockS: now.clockS, running: true };
    case 'stop':
      return now.running ? { videoTimeS: t, clockS: now.clockS, running: false } : null;
    case 'set':
      return { videoTimeS: t, clockS: Math.max(0, command.clockS), running: command.running ?? now.running };
  }
}

/** Timeline ranges [from, to) in which the clock runs, cut off at `endT`. */
export function runningSpans(anchors: readonly AnchorDraft[], endT: number): [number, number][] {
  const spans: [number, number][] = [];
  const list = sorted(anchors);
  list.forEach((anchor, i) => {
    if (!anchor.running) return;
    const from = anchor.videoTimeS;
    const to = Math.min(list[i + 1]?.videoTimeS ?? endT, endT);
    if (to <= from) return;
    const last = spans[spans.length - 1];
    if (last && last[1] === from) last[1] = to;
    else spans.push([from, to]);
  });
  return spans;
}

export function formatClock(clockS: number): string {
  const s = Math.max(0, Math.floor(clockS));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** "61:30" or "61" (minutes) → seconds; null if it isn't a clock value. */
export function parseClock(text: string): number | null {
  const match = /^\s*(\d{1,3})(?::([0-5]\d))?\s*$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2] ?? 0);
}

/** Where the collector timeline carries on when the match is reopened: the latest recorded time. */
export function resumeTimelineS(records: readonly { videoTimeS: number }[]): number {
  return Math.max(0, ...records.map((r) => r.videoTimeS));
}
