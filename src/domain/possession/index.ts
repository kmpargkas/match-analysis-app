import type { PossessionChange, PossessionTeam } from '../schemas';

export type ChangeDraft = Pick<PossessionChange, 'id' | 'videoTimeS' | 'team'>;

/** Clicks closer together than this count as the same moment. */
const SAME_MOMENT_S = 0.1;

const byTime = <C extends ChangeDraft>(changes: readonly C[]) => [...changes].sort((a, b) => a.videoTimeS - b.videoTimeS);

export function possessionAt(t: number, changes: readonly ChangeDraft[]): PossessionTeam | null {
  let team: PossessionTeam | null = null;
  for (const change of byTime(changes)) {
    if (change.videoTimeS > t) break;
    team = change.team;
  }
  return team;
}

export type PossessionChangeAction = { kind: 'none' } | { kind: 'add' } | { kind: 'replace'; id: string };

export function possessionChangeFor(team: PossessionTeam, t: number, changes: readonly ChangeDraft[]): PossessionChangeAction {
  const same = changes.find((c) => Math.abs(c.videoTimeS - t) < SAME_MOMENT_S);
  if (same) return same.team === team ? { kind: 'none' } : { kind: 'replace', id: same.id };
  return possessionAt(t, changes) === team ? { kind: 'none' } : { kind: 'add' };
}

/** Seconds of known possession inside the clock's running spans; `us` is our share, null when nothing is known. */
export function possessionShare(changes: readonly ChangeDraft[], spans: readonly [number, number][]): { usS: number; themS: number; us: number | null } {
  const list = byTime(changes);
  let usS = 0;
  let themS = 0;
  for (const [from, to] of spans) {
    list.forEach((change, i) => {
      const a = Math.max(change.videoTimeS, from);
      const b = Math.min(list[i + 1]?.videoTimeS ?? Infinity, to);
      if (b <= a) return;
      if (change.team === 'us') usS += b - a;
      else themS += b - a;
    });
  }
  const total = usS + themS;
  return { usS, themS, us: total > 0 ? usS / total : null };
}
