import { describe, expect, it } from 'vitest';
import { actionCatalog } from '../catalog';
import type { Match, MatchEvent, Team } from '../schemas';
import { buildMatchLog } from './matchLog';

const stamp = { createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z', schemaVersion: 1 };

const team = (id: string, name: string, extra: Partial<Team> = {}): Team => ({ ...stamp, id, name, nameDisplay: 'full', ...extra });

const match = (id: string, date: string, extra: Partial<Match> = {}): Match => ({
  ...stamp,
  id,
  teamId: 't1',
  opponentName: `Opp ${id}`,
  date,
  homeAway: 'home',
  halfLengthMin: 45,
  formationId: '4-3-3',
  score: { us: 0, them: 0 },
  status: 'in_progress',
  catalogVersion: 1,
  settings: { autoOpenPlayerSearch: true },
  ...extra,
});

const event = (matchId: string, extra: Partial<MatchEvent> = {}): MatchEvent => ({
  ...stamp,
  id: crypto.randomUUID(),
  matchId,
  videoTimeS: 1,
  clockS: 1,
  typeId: 'tackle',
  outcome: 'won',
  attributes: {},
  lineupEntryId: 'p1',
  start: { x: 50, y: 50 },
  attackDir: 'ltr',
  ...extra,
});

const teams = [team('t1', 'U14'), team('t2', 'U16')];

describe('buildMatchLog', () => {
  it('lists matches newest first, by date then kick-off then creation', () => {
    const rows = buildMatchLog({
      teams,
      events: [],
      catalog: actionCatalog,
      matches: [
        match('a', '2026-09-01'),
        match('b', '2026-10-04', { kickoffTime: '10:00' }),
        match('c', '2026-10-04', { kickoffTime: '16:30' }),
        match('d', '2026-09-01', { createdAt: '2026-10-02T10:00:00.000Z' }),
      ],
    });
    expect(rows.map((r) => r.matchId)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('hides soft-deleted matches and ignores soft-deleted events', () => {
    const rows = buildMatchLog({
      teams,
      catalog: actionCatalog,
      matches: [match('a', '2026-10-01'), match('b', '2026-10-02', { deletedAt: '2026-10-03T00:00:00.000Z' })],
      events: [event('a'), event('a', { deletedAt: '2026-10-03T00:00:00.000Z' })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventCount).toBe(1);
  });

  it('counts events and incomplete events per match', () => {
    const rows = buildMatchLog({
      teams,
      catalog: actionCatalog,
      matches: [match('a', '2026-10-01'), match('b', '2026-10-02')],
      events: [
        event('a'),
        event('a', { lineupEntryId: undefined }),
        event('a', { typeId: 'shot', outcome: 'saved' }), // missing body part
        event('b'),
      ],
    });
    const a = rows.find((r) => r.matchId === 'a');
    const b = rows.find((r) => r.matchId === 'b');
    expect(a).toMatchObject({ eventCount: 3, incompleteCount: 2 });
    expect(b).toMatchObject({ eventCount: 1, incompleteCount: 0 });
  });

  it('shows the manual score, status and team name as stored', () => {
    const [row] = buildMatchLog({
      teams,
      events: [],
      catalog: actionCatalog,
      matches: [match('a', '2026-10-01', { teamId: 't2', score: { us: 2, them: 1 }, status: 'finished', competition: 'League' })],
    });
    expect(row).toMatchObject({ teamName: 'U16', opponentName: 'Opp a', score: { us: 2, them: 1 }, status: 'finished', competition: 'League' });
  });

  it('keeps the name of a deleted team and leaves an unknown team empty', () => {
    const rows = buildMatchLog({
      teams: [team('t1', 'U14', { deletedAt: '2026-10-03T00:00:00.000Z' })],
      events: [],
      catalog: actionCatalog,
      matches: [match('a', '2026-10-01'), match('b', '2026-10-02', { teamId: 'missing' })],
    });
    expect(rows.find((r) => r.matchId === 'a')?.teamName).toBe('U14');
    expect(rows.find((r) => r.matchId === 'b')?.teamName).toBeNull();
  });
});
