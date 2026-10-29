import { describe, expect, it } from 'vitest';
import { asCopy, BACKUP_APP, countConflicts, EXPORT_VERSION, makeBackup, matchRecords, parseBackup, type BackupRecords } from '.';

const at = '2026-10-20T10:00:00.000Z';
const base = (id: string) => ({ id, createdAt: at, updatedAt: at, schemaVersion: 1 });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const T1 = uuid(1);
const T2 = uuid(2);
const P1 = uuid(11);
const P2 = uuid(12);
const M1 = uuid(21);
const M2 = uuid(22);
const L1 = uuid(31);
const L2 = uuid(32);
const E1 = uuid(41);
const E2 = uuid(42);

const match = (id: string, teamId: string) => ({
  ...base(id), teamId, opponentName: 'Atromitos', date: '2026-10-12', homeAway: 'home', halfLengthMin: 45,
  formationId: '4-3-3', score: { us: 2, them: 1 }, status: 'finished', catalogVersion: 1,
  settings: { autoOpenPlayerSearch: true },
});

function records(): BackupRecords {
  return {
    teams: [{ ...base(T1), name: 'Lions U14', nameDisplay: 'full' }, { ...base(T2), name: 'Eagles U16', nameDisplay: 'full' }] as BackupRecords['teams'],
    players: [
      { ...base(P1), teamId: T1, name: 'Stelios Striker', positions: ['ST'], archived: false },
      { ...base(P2), teamId: T2, name: 'Other Player', positions: ['CM'], archived: false },
    ] as BackupRecords['players'],
    matches: [match(M1, T1), match(M2, T2)] as BackupRecords['matches'],
    lineupEntries: [
      { ...base(L1), matchId: M1, playerId: P1, shirtNumber: 9, role: 'starter', positionSlotId: 'ST' },
      { ...base(L2), matchId: M2, playerId: P2, shirtNumber: 8, role: 'starter', positionSlotId: 'RCM' },
    ] as BackupRecords['lineupEntries'],
    clockAnchors: [{ ...base(uuid(51)), matchId: M1, videoTimeS: 0, clockS: 0, running: true }] as BackupRecords['clockAnchors'],
    possessionChanges: [{ ...base(uuid(61)), matchId: M1, videoTimeS: 0, team: 'us' }] as BackupRecords['possessionChanges'],
    events: [
      { ...base(E1), matchId: M1, videoTimeS: 10, clockS: 10, typeId: 'shot', outcome: 'goal', attributes: { bodyPart: 'head' }, lineupEntryId: L1, attackDir: 'ltr', start: { x: 90, y: 50 } },
      { ...base(E2), matchId: M1, videoTimeS: 12, clockS: 12, typeId: 'pass', outcome: 'complete', attributes: {}, attackDir: 'ltr', deletedAt: at },
    ] as BackupRecords['events'],
  };
}

const file = (r: BackupRecords = records()) => JSON.stringify(makeBackup(r, at));

describe('makeBackup', () => {
  it('writes the agreed header and leaves soft-deleted records out', () => {
    const backup = makeBackup(records(), at);
    expect(backup).toMatchObject({ app: BACKUP_APP, exportVersion: EXPORT_VERSION, exportedAt: at, catalogVersion: 1 });
    expect(backup.events.map((e) => e.id)).toEqual([E1]);
  });

  it("leaves a deleted match's lineup, clock, possession and events out, so the file still imports", () => {
    const r = records();
    r.matches[0]!.deletedAt = at;
    const backup = makeBackup(r, at);
    expect(backup.matches.map((m) => m.id)).toEqual([M2]);
    expect(backup.lineupEntries.map((l) => l.id)).toEqual([L2]);
    expect(backup.clockAnchors).toEqual([]);
    expect(backup.possessionChanges).toEqual([]);
    expect(backup.events).toEqual([]);
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(true);
  });

  it('keeps a deleted team or player that live data still points to, still marked deleted', () => {
    const r = records();
    r.teams[0]!.deletedAt = at;
    r.players[0]!.deletedAt = at;
    const backup = makeBackup(r, at);
    expect(backup.teams.find((t) => t.id === T1)?.deletedAt).toBe(at);
    expect(backup.players.find((p) => p.id === P1)?.deletedAt).toBe(at);
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(true);
  });
});

describe('matchRecords', () => {
  it('keeps one match with its team, the team players and the match data', () => {
    const one = matchRecords(records(), M1);
    expect(one.matches.map((m) => m.id)).toEqual([M1]);
    expect(one.teams.map((t) => t.id)).toEqual([T1]);
    expect(one.players.map((p) => p.id)).toEqual([P1]);
    expect(one.lineupEntries.map((l) => l.id)).toEqual([L1]);
    expect(one.events.map((e) => e.id)).toEqual([E1, E2]);
    expect(one.clockAnchors).toHaveLength(1);
    expect(one.possessionChanges).toHaveLength(1);
  });
});

describe('parseBackup', () => {
  it('reads back exactly what was exported', () => {
    const result = parseBackup(file());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup).toEqual(makeBackup(records(), at));
  });

  it('names what is wrong with a file it cannot use', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: 'notJson' });
    expect(parseBackup(JSON.stringify({ hello: 'world' }))).toEqual({ ok: false, error: 'notBackup' });
    expect(parseBackup(JSON.stringify({ ...makeBackup(records(), at), exportVersion: EXPORT_VERSION + 1 }))).toEqual({ ok: false, error: 'newerVersion' });

    const future = records();
    future.teams[0]!.schemaVersion = 99;
    expect(parseBackup(file(future))).toEqual({ ok: false, error: 'newerVersion' });

    const bad = records();
    (bad.events[0] as { typeId: string }).typeId = '';
    expect(parseBackup(file(bad))).toEqual({ ok: false, error: 'invalid' });
  });

  it('refuses a file whose records point at records it does not contain', () => {
    const broken = records();
    broken.teams = broken.teams.slice(0, 1);
    expect(parseBackup(file(broken))).toEqual({ ok: false, error: 'brokenLinks' });

    const orphan = records();
    orphan.events[0]!.lineupEntryId = uuid(999);
    expect(parseBackup(file(orphan))).toEqual({ ok: false, error: 'brokenLinks' });
  });

  it('upgrades older records with the shared migrations before validating them', () => {
    const old = records();
    const team = old.teams[0]! as Record<string, unknown>;
    team.schemaVersion = 1;
    team.title = team.name;
    delete team.name;
    const renameTitle = (r: Record<string, unknown>) => ('title' in r ? { ...r, name: r.title, title: undefined } : r);

    const result = parseBackup(file(old), { migrations: [renameTitle], schemaVersion: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.teams[0]).toMatchObject({ name: 'Lions U14', schemaVersion: 2 });
  });

  it('reads a file from before unused fields were removed, and drops them', () => {
    const old = makeBackup(records(), at);
    Object.assign(old.teams[0]!, { shortName: 'LIO', colour: '#0a0' });
    Object.assign(old.matches[0]!, {
      pitch: { lengthM: 105, widthM: 68 },
      video: { kind: 'youtube', videoId: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' },
      settings: { reactionLagS: 0.8, seekStepS: 10, autoOpenPlayerSearch: true },
    });
    Object.assign(old.events[0]!, { relatedEventId: uuid(999) });

    const result = parseBackup(JSON.stringify(old));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup).toEqual(makeBackup(records(), at));
  });
});

describe('countConflicts', () => {
  it('counts records whose ID is already stored', () => {
    expect(countConflicts(records(), new Set([T1, E1, uuid(777)]))).toBe(2);
  });
});

describe('asCopy', () => {
  it('gives every record a new ID and rewires every reference to it', () => {
    let n = 1000;
    const copy = asCopy(records(), () => uuid(n++));
    const original = new Set(Object.values(records()).flat().map((r) => r.id));
    const ids = Object.values(copy).flat().map((r) => r.id);
    expect(ids.some((id) => original.has(id))).toBe(false);

    const team = copy.teams[0]!.id;
    const player = copy.players[0]!.id;
    const m1 = copy.matches[0]!.id;
    const entry = copy.lineupEntries[0]!.id;
    expect(copy.players[0]!.teamId).toBe(team);
    expect(copy.matches[0]!.teamId).toBe(team);
    expect(copy.lineupEntries[0]).toMatchObject({ matchId: m1, playerId: player });
    expect(copy.events[0]).toMatchObject({ matchId: m1, lineupEntryId: entry });
    expect(copy.clockAnchors[0]!.matchId).toBe(m1);
    expect(copy.possessionChanges[0]!.matchId).toBe(m1);
    // A copy is still a valid file.
    expect(parseBackup(JSON.stringify(makeBackup(copy, at))).ok).toBe(true);
  });
});
