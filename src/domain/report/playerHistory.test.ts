import { describe, expect, it } from 'vitest';
import type { LineupEntry, Match, MatchEvent, Player } from '../schemas';
import type { ReportData } from '.';
import { playerMatchHistory } from './playerHistory';

const stamp = { createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', schemaVersion: 1 };

const player = (id: string, name: string): Player => ({ ...stamp, id, teamId: 't1', name, positions: ['CM'], archived: false });
const gio = player('gio', 'Giorgos Mid');
const nikos = player('nikos', 'Nikos Wing');

const match = (id: string, date: string): Match => ({
  ...stamp,
  id,
  teamId: 't1',
  opponentName: `Opp ${id}`,
  date,
  homeAway: 'home',
  halfLengthMin: 45,
  formationId: '4-3-3',
  score: { us: 1, them: 0 },
  status: 'finished',
  catalogVersion: 1,
  settings: { autoOpenPlayerSearch: true },
});

const entry = (matchId: string, p: Player, extra: Partial<LineupEntry> = {}): { entry: LineupEntry; player: Player } => ({
  entry: { ...stamp, id: `${matchId}-${p.id}`, matchId, playerId: p.id, shirtNumber: 8, role: 'starter', positionSlotId: 'RCM', ...extra },
  player: p,
});

const event = (matchId: string, extra: Partial<MatchEvent>): MatchEvent => ({
  ...stamp,
  id: crypto.randomUUID(),
  matchId,
  videoTimeS: 1,
  clockS: 1,
  typeId: 'pass',
  outcome: 'complete',
  attributes: {},
  attackDir: 'ltr',
  ...extra,
});

const report = (m: Match, lineup: ReportData['lineup'], events: MatchEvent[] = []): ReportData => ({
  match: m,
  team: { ...stamp, id: 't1', name: 'Lions U14', nameDisplay: 'full' },
  lineup,
  events,
  anchors: [{ ...stamp, id: crypto.randomUUID(), matchId: m.id, videoTimeS: 0, clockS: 0, running: true }, { ...stamp, id: crypto.randomUUID(), matchId: m.id, videoTimeS: 5400, clockS: 5400, running: false }],
  possession: [],
});

describe('playerMatchHistory', () => {
  it("gives the player's own report line from each match, newest first", () => {
    const early = match('m1', '2026-09-20');
    const late = match('m2', '2026-10-04');
    const history = playerMatchHistory('gio', [
      report(early, [entry('m1', gio), entry('m1', nikos)], [event('m1', { lineupEntryId: 'm1-gio' }), event('m1', { lineupEntryId: 'm1-nikos' })]),
      report(late, [entry('m2', gio, { shirtNumber: 6 })]),
    ]);

    expect(history.map((h) => h.data.match.id)).toEqual(['m2', 'm1']);
    expect(history[0]!.player.line.shirtNumber).toBe(6);
    expect(history[1]!.player.player.id).toBe('gio');
    expect(history[1]!.player.line.stats.passes).toEqual({ kind: 'ratio', made: 1, total: 1 });
    expect(history[1]!.player.line.minutes).toBe(90);
  });

  it('leaves out matches the player was not in', () => {
    const history = playerMatchHistory('gio', [report(match('m1', '2026-09-20'), [entry('m1', nikos)])]);
    expect(history).toEqual([]);
  });

  it('keeps unused-sub matches, marked as not played', () => {
    const history = playerMatchHistory('gio', [report(match('m1', '2026-09-20'), [entry('m1', gio, { role: 'sub', positionSlotId: undefined })])]);
    expect(history).toHaveLength(1);
    expect(history[0]!.player.line).toMatchObject({ played: false, minutes: 0 });
  });

  it('counts a sub appearance from the minute they came on', () => {
    const m = match('m1', '2026-09-20');
    const history = playerMatchHistory('gio', [
      report(m, [entry('m1', nikos), entry('m1', gio, { role: 'sub', positionSlotId: undefined })], [
        event('m1', { typeId: 'substitution', outcome: undefined, clockS: 60 * 60, videoTimeS: 3600, lineupEntryId: 'm1-nikos', relatedLineupEntryId: 'm1-gio' }),
      ]),
    ]);
    expect(history[0]!.player.line).toMatchObject({ played: true, role: 'sub', minutes: 30 });
  });
});
