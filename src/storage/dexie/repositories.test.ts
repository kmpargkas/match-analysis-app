import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LineupEntry } from '@/domain/schemas';
import type { Repositories } from '../repositories';
import { AppDb } from './db';
import { createDexieRepositories } from './repositories';

let db: AppDb;
let repos: Repositories;
let tick: number;

beforeEach(() => {
  db = new AppDb(`test-${crypto.randomUUID()}`);
  tick = 0;
  // Deterministic clock: every call moves one second forward.
  const now = () => new Date(Date.UTC(2026, 9, 8, 10, 0, tick++)).toISOString();
  repos = createDexieRepositories(db, { now });
});

afterEach(async () => {
  await db.delete();
});

const matchInput = (teamId: string) => ({ teamId, opponentName: 'Atromitos', date: '2026-10-04', formationId: '4-3-3' });

describe('Dexie repositories', () => {
  it('creates a team with common fields and schema defaults', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    expect(team.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(team).toMatchObject({ name: 'U14', nameDisplay: 'full', schemaVersion: 1 });
    expect(team.createdAt).toBe(team.updatedAt);
    expect(await repos.teams.get(team.id)).toEqual(team);
  });

  it('rejects invalid input instead of storing it', async () => {
    await expect(repos.teams.create({ name: '' })).rejects.toThrow();
    expect(await repos.teams.list()).toEqual([]);
  });

  it('creates a match with defaults and the current catalog version', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const match = await repos.matches.create(matchInput(team.id));
    expect(match).toMatchObject({ status: 'in_progress', score: { us: 0, them: 0 }, catalogVersion: 1 });
  });

  it('soft-deletes a match: hidden from list, kept in storage, updatedAt bumped', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const keep = await repos.matches.create(matchInput(team.id));
    const drop = await repos.matches.create(matchInput(team.id));

    await repos.matches.softDelete(drop.id);

    expect((await repos.matches.list()).map((m) => m.id)).toEqual([keep.id]);
    const stored = await repos.matches.get(drop.id);
    expect(stored?.deletedAt).toBeDefined();
    expect(stored!.updatedAt > drop.updatedAt).toBe(true);
  });

  it('lists soft-deleted teams only when asked', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    await repos.teams.softDelete(team.id);
    expect(await repos.teams.list()).toEqual([]);
    expect(await repos.teams.list({ includeDeleted: true })).toHaveLength(1);
  });

  it('lists live events for the given matches only', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const a = await repos.matches.create(matchInput(team.id));
    const b = await repos.matches.create(matchInput(team.id));
    const base = { videoTimeS: 5, clockS: 5, typeId: 'pass', attackDir: 'ltr' as const };
    const e1 = await repos.events.create({ ...base, matchId: a.id });
    const e2 = await repos.events.create({ ...base, matchId: a.id });
    await repos.events.create({ ...base, matchId: b.id });
    await repos.events.softDelete(e2.id);

    expect((await repos.events.listByMatches([a.id])).map((e) => e.id)).toEqual([e1.id]);
  });

  it('throws when deleting a record that does not exist', async () => {
    await expect(repos.matches.softDelete(crypto.randomUUID())).rejects.toThrow();
  });

  it('updates a team: validates, keeps createdAt, bumps updatedAt', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const updated = await repos.teams.update(team.id, { name: 'U14 A', coachName: 'Coach' });
    expect(updated).toMatchObject({ id: team.id, name: 'U14 A', coachName: 'Coach', createdAt: team.createdAt });
    expect(updated.updatedAt > team.updatedAt).toBe(true);
    await expect(repos.teams.update(team.id, { name: '' })).rejects.toThrow();
    expect((await repos.teams.get(team.id))?.name).toBe('U14 A');
  });

  it('clears an optional field when updated with undefined', async () => {
    const team = await repos.teams.create({ name: 'U14', logo: 'data:image/png;base64,AAAA' });
    const updated = await repos.teams.update(team.id, { logo: undefined });
    expect(updated.logo).toBeUndefined();
  });

  it('refuses to update a deleted record', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    await repos.teams.softDelete(team.id);
    await expect(repos.teams.update(team.id, { name: 'Back' })).rejects.toThrow();
  });

  it('counts only live matches of a team', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const other = await repos.teams.create({ name: 'U16' });
    await repos.matches.create(matchInput(team.id));
    const gone = await repos.matches.create(matchInput(team.id));
    await repos.matches.create(matchInput(other.id));
    await repos.matches.softDelete(gone.id);
    expect(await repos.matches.countByTeam(team.id)).toBe(1);
  });
});

describe('Player repository', () => {
  const playerInput = (teamId: string, name: string, positions = ['CB']) => ({ teamId, name, positions });

  it('lists live players of one team, including archived ones', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const other = await repos.teams.create({ name: 'U16' });
    const a = await repos.players.create(playerInput(team.id, 'Al'));
    const b = await repos.players.create(playerInput(team.id, 'Bo'));
    await repos.players.create(playerInput(other.id, 'Cy'));
    await repos.players.softDelete(b.id);
    expect((await repos.players.listByTeam(team.id)).map((p) => p.id)).toEqual([a.id]);
  });

  it('rejects invalid positions', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    await expect(repos.players.create(playerInput(team.id, 'Al', ['GK', 'CB']))).rejects.toThrow();
  });

  it('deletes a player without match data', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const p = await repos.players.create(playerInput(team.id, 'Al'));
    expect(await repos.players.hasMatchData(p.id)).toBe(false);
    expect(await repos.players.remove(p.id)).toBe('deleted');
    expect(await repos.players.listByTeam(team.id)).toEqual([]);
  });

  it('archives a player who appears in a lineup, and restores them', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const p = await repos.players.create(playerInput(team.id, 'Al'));
    await repos.matches.createWithLineup(matchInput(team.id), [{ playerId: p.id, shirtNumber: 4, role: 'sub' }]);

    expect(await repos.players.hasMatchData(p.id)).toBe(true);
    expect(await repos.players.remove(p.id)).toBe('archived');
    expect((await repos.players.get(p.id))?.archived).toBe(true);
    expect(await repos.players.listByTeam(team.id)).toHaveLength(1);

    await repos.players.restore(p.id);
    expect((await repos.players.get(p.id))?.archived).toBe(false);
  });

  it('ignores deleted lineup entries when checking match data', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const p = await repos.players.create(playerInput(team.id, 'Al'));
    await db.lineupEntries.add(lineupRow(p.id, { deletedAt: '2026-10-08T00:00:00.000Z' }));
    expect(await repos.players.remove(p.id)).toBe('deleted');
  });
});

describe('Matches with a lineup', () => {
  it('saves the match and its lineup together, starters first, then by shirt number', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    const match = await repos.matches.createWithLineup(matchInput(team.id), [
      { playerId: 'p9', shirtNumber: 9, role: 'starter', positionSlotId: 'ST' },
      { playerId: 'p1', shirtNumber: 1, role: 'starter', positionSlotId: 'GK' },
      { playerId: 'p12', shirtNumber: 12, role: 'sub' },
    ]);

    expect(await repos.matches.get(match.id)).toMatchObject({ teamId: team.id, formationId: '4-3-3', status: 'in_progress' });
    const lineup = await repos.lineups.listByMatch(match.id);
    expect(lineup.map((e) => [e.playerId, e.role, e.positionSlotId])).toEqual([
      ['p1', 'starter', 'GK'],
      ['p9', 'starter', 'ST'],
      ['p12', 'sub', undefined],
    ]);
    expect(lineup.every((e) => e.matchId === match.id && e.schemaVersion === 1)).toBe(true);
  });

  it('saves nothing when any lineup entry is invalid', async () => {
    const team = await repos.teams.create({ name: 'U14' });
    await expect(
      repos.matches.createWithLineup(matchInput(team.id), [
        { playerId: 'p1', shirtNumber: 1, role: 'starter', positionSlotId: 'GK' },
        { playerId: 'p2', shirtNumber: 100, role: 'sub' },
      ]),
    ).rejects.toThrow();
    expect(await repos.matches.list()).toEqual([]);
    expect(await db.lineupEntries.count()).toBe(0);
  });

  it('leaves deleted entries and other matches out of a lineup', async () => {
    await db.lineupEntries.bulkAdd([lineupRow('a'), lineupRow('b', { deletedAt: '2026-10-08T00:00:00.000Z' }), lineupRow('c', { matchId: 'm2' })]);
    expect((await repos.lineups.listByMatch('m1')).map((e) => e.playerId)).toEqual(['a']);
  });

  it("lists one player's live entries across matches", async () => {
    await db.lineupEntries.bulkAdd([lineupRow('a'), lineupRow('a', { matchId: 'm2' }), lineupRow('a', { matchId: 'm3', deletedAt: '2026-10-08T00:00:00.000Z' }), lineupRow('b')]);
    expect((await repos.lineups.listByPlayer('a')).map((e) => e.matchId).sort()).toEqual(['m1', 'm2']);
  });
});

describe('Collector records', () => {
  it('lists live clock anchors, possession changes and events of one match only', async () => {
    const a1 = await repos.clock.create({ matchId: 'm1', videoTimeS: 10, clockS: 0, running: true });
    await repos.clock.create({ matchId: 'm2', videoTimeS: 10, clockS: 0, running: true });
    const a3 = await repos.clock.create({ matchId: 'm1', videoTimeS: 20, clockS: 10, running: false });
    await repos.clock.softDelete(a3.id);
    expect((await repos.clock.listByMatch('m1')).map((a) => a.id)).toEqual([a1.id]);

    const p = await repos.possession.create({ matchId: 'm1', videoTimeS: 5, team: 'us' });
    await repos.possession.update(p.id, { team: 'them' });
    expect((await repos.possession.listByMatch('m1')).map((c) => c.team)).toEqual(['them']);

    const e = await repos.events.create({ matchId: 'm1', videoTimeS: 5, clockS: 5, typeId: 'interception', attackDir: 'ltr' });
    await repos.events.create({ matchId: 'm2', videoTimeS: 5, clockS: 5, typeId: 'interception', attackDir: 'ltr' });
    expect((await repos.events.listByMatch('m1')).map((x) => x.id)).toEqual([e.id]);
  });

  it('rejects a negative clock value', async () => {
    await expect(repos.clock.create({ matchId: 'm1', videoTimeS: 10, clockS: -1, running: true })).rejects.toThrow();
  });
});

function lineupRow(playerId: string, extra: Partial<LineupEntry> = {}): LineupEntry {
  const at = '2026-10-08T00:00:00.000Z';
  return { id: crypto.randomUUID(), createdAt: at, updatedAt: at, schemaVersion: 1, matchId: 'm1', playerId, shirtNumber: 5, role: 'sub', ...extra };
}
