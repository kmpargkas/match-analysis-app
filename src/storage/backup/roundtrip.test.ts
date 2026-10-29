import { afterEach, describe, expect, it } from 'vitest';
import { actionCatalog } from '@/domain/catalog';
import { computeStats } from '@/domain/stats';
import type { Repositories } from '@/storage';
import { createTestRepositories } from '@/test/repositories';
import { makeBackup, matchRecords, parseBackup } from '.';

const disposers: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (disposers.length) await disposers.pop()!();
});

function fresh(): Repositories {
  const { repos, dispose } = createTestRepositories();
  disposers.push(dispose);
  return repos;
}

async function seed(repos: Repositories) {
  const team = await repos.teams.create({ name: 'Lions U14' });
  const striker = await repos.players.create({ teamId: team.id, name: 'Stelios Striker', positions: ['ST'] });
  const match = await repos.matches.createWithLineup(
    { teamId: team.id, opponentName: 'Atromitos', date: '2026-10-12', formationId: '4-3-3', status: 'finished', score: { us: 1, them: 0 } },
    [{ playerId: striker.id, shirtNumber: 9, role: 'starter', positionSlotId: 'ST' }],
  );
  const [entry] = await repos.lineups.listByMatch(match.id);
  const base = { matchId: match.id, attackDir: 'ltr' as const };
  await repos.events.create({ ...base, typeId: 'shot', outcome: 'goal', videoTimeS: 50, clockS: 50, lineupEntryId: entry!.id, start: { x: 92, y: 50 }, attributes: { bodyPart: 'head' } });
  await repos.events.create({ ...base, typeId: 'pass', outcome: 'complete', videoTimeS: 40, clockS: 40, start: { x: 40, y: 50 }, end: { x: 60, y: 50 } });
  const gone = await repos.events.create({ ...base, typeId: 'pass', outcome: 'incomplete', videoTimeS: 45, clockS: 45 });
  await repos.events.softDelete(gone.id);
  await repos.clock.create({ matchId: match.id, videoTimeS: 0, clockS: 0, running: true });
  await repos.possession.create({ matchId: match.id, videoTimeS: 0, team: 'us' });
  return match;
}

describe('JSON backup round trip', () => {
  it('export → clear data → import gives identical records and an identical report', async () => {
    const source = fresh();
    const match = await seed(source);
    const text = JSON.stringify(makeBackup(await source.backup.readAll(), new Date().toISOString()));

    const target = fresh();
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await target.backup.writeAll(parsed.backup);

    const live = makeBackup(await source.backup.readAll(), parsed.backup.exportedAt);
    expect(makeBackup(await target.backup.readAll(), parsed.backup.exportedAt)).toEqual(live);
    expect(computeStats(await target.events.listByMatch(match.id), actionCatalog)).toEqual(computeStats(await source.events.listByMatch(match.id), actionCatalog));
    expect(await target.matches.get(match.id)).toEqual(await source.matches.get(match.id));
  });

  it('a deleted match and everything logged in it stay out of the backup, which still imports', async () => {
    const source = fresh();
    const kept = await seed(source);
    const deleted = await seed(source);
    await source.matches.softDelete(deleted.id);

    const parsed = parseBackup(JSON.stringify(makeBackup(await source.backup.readAll(), new Date().toISOString())));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const target = fresh();
    await target.backup.writeAll(parsed.backup);

    expect((await target.matches.list()).map((m) => m.id)).toEqual([kept.id]);
    expect(await target.events.listByMatch(deleted.id)).toEqual([]);
    expect(await target.lineups.listByMatch(deleted.id)).toEqual([]);
    expect(await target.clock.listByMatch(deleted.id)).toEqual([]);
    expect(await target.events.listByMatch(kept.id)).toHaveLength(2);
  });

  it('a per-match file carries its team and players, and Replace overwrites what is stored', async () => {
    const repos = fresh();
    const match = await seed(repos);
    const before = matchRecords(await repos.backup.readAll(), match.id);

    await repos.matches.update(match.id, { score: { us: 5, them: 5 } });
    expect(await repos.backup.existingIds()).toContain(match.id);
    await repos.backup.writeAll(before);
    expect((await repos.matches.get(match.id))?.score).toEqual({ us: 1, them: 0 });
    expect(before.teams).toHaveLength(1);
    expect(before.players).toHaveLength(1);
  });
});
