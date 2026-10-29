import { z } from 'zod';
import { actionCatalog } from '@/domain/catalog';
import {
  clockAnchorSchema,
  lineupEntrySchema,
  matchEventSchema,
  matchSchema,
  playerSchema,
  possessionChangeSchema,
  SCHEMA_VERSION,
  teamSchema,
  type ClockAnchor,
  type LineupEntry,
  type Match,
  type MatchEvent,
  type Player,
  type PossessionChange,
  type Team,
} from '@/domain/schemas';
import { migrations as sharedMigrations, type Migration } from '../migrations';

export const BACKUP_APP = 'match-analysis';
export const EXPORT_VERSION = 1;

export interface BackupRecords {
  teams: Team[];
  players: Player[];
  matches: Match[];
  lineupEntries: LineupEntry[];
  clockAnchors: ClockAnchor[];
  possessionChanges: PossessionChange[];
  events: MatchEvent[];
}

export interface BackupFile extends BackupRecords {
  app: typeof BACKUP_APP;
  exportVersion: number;
  exportedAt: string;
  catalogVersion: number;
}

const SCHEMAS = {
  teams: teamSchema,
  players: playerSchema,
  matches: matchSchema,
  lineupEntries: lineupEntrySchema,
  clockAnchors: clockAnchorSchema,
  possessionChanges: possessionChangeSchema,
  events: matchEventSchema,
} as const;

export const BACKUP_TABLES = Object.keys(SCHEMAS) as (keyof BackupRecords)[];

const live = <T extends { deletedAt?: string }>(rows: readonly T[]) => rows.filter((r) => !r.deletedAt);

/**
 * Soft-deleted records stay out, and so does everything of a deleted match, so
 * the file always passes its own link check. A deleted team or player that kept
 * data still points to goes in, still marked deleted.
 */
export function makeBackup(records: BackupRecords, exportedAt: string): BackupFile {
  const matches = live(records.matches);
  const matchIds = new Set(matches.map((m) => m.id));
  const ofLiveMatch = <T extends { matchId: string; deletedAt?: string }>(rows: readonly T[]) => live(rows).filter((r) => matchIds.has(r.matchId));

  const lineupEntries = ofLiveMatch(records.lineupEntries);
  const events = ofLiveMatch(records.events);

  const playerIds = new Set(lineupEntries.map((l) => l.playerId));
  const players = records.players.filter((p) => !p.deletedAt || playerIds.has(p.id));
  const teamIds = new Set([...matches.map((m) => m.teamId), ...players.map((p) => p.teamId)]);

  return {
    app: BACKUP_APP,
    exportVersion: EXPORT_VERSION,
    exportedAt,
    catalogVersion: actionCatalog.version,
    teams: records.teams.filter((t) => !t.deletedAt || teamIds.has(t.id)),
    players,
    matches,
    lineupEntries,
    clockAnchors: ofLiveMatch(records.clockAnchors),
    possessionChanges: ofLiveMatch(records.possessionChanges),
    events,
  };
}

/** One match with its team, that team's players and everything logged in the match. */
export function matchRecords(all: BackupRecords, matchId: string): BackupRecords {
  const matches = all.matches.filter((m) => m.id === matchId);
  const teamIds = new Set(matches.map((m) => m.teamId));
  const ofMatch = <T extends { matchId: string }>(rows: readonly T[]) => rows.filter((r) => r.matchId === matchId);
  return {
    teams: all.teams.filter((t) => teamIds.has(t.id)),
    players: all.players.filter((p) => teamIds.has(p.teamId)),
    matches,
    lineupEntries: ofMatch(all.lineupEntries),
    clockAnchors: ofMatch(all.clockAnchors),
    possessionChanges: ofMatch(all.possessionChanges),
    events: ofMatch(all.events),
  };
}

export type BackupError = 'notJson' | 'notBackup' | 'newerVersion' | 'invalid' | 'brokenLinks';
export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: BackupError };

const headerSchema = z.object({
  app: z.literal(BACKUP_APP),
  exportVersion: z.int().positive(),
  exportedAt: z.string(),
  catalogVersion: z.int().positive(),
  ...Object.fromEntries(BACKUP_TABLES.map((table) => [table, z.array(z.record(z.string(), z.unknown()))])),
});

/** `migrations[n]` upgrades a record from schemaVersion n + 1 to n + 2. */
function migrate(record: Record<string, unknown>, list: readonly Migration[], target: number): Record<string, unknown> | null {
  const from = typeof record.schemaVersion === 'number' ? record.schemaVersion : 1;
  if (from > target) return null;
  let next = record;
  for (let v = from; v < target; v++) next = list[v - 1]?.(next) ?? next;
  return { ...next, schemaVersion: target };
}

/** Every reference inside the file points at a record in the file. */
function linksHold(r: BackupRecords): boolean {
  const ids = (rows: readonly { id: string }[]) => new Set(rows.map((x) => x.id));
  const teams = ids(r.teams);
  const players = ids(r.players);
  const matches = ids(r.matches);
  const entries = ids(r.lineupEntries);
  const optional = (set: Set<string>, id: string | undefined) => id === undefined || set.has(id);
  return (
    r.players.every((p) => teams.has(p.teamId)) &&
    r.matches.every((m) => teams.has(m.teamId)) &&
    r.lineupEntries.every((l) => matches.has(l.matchId) && players.has(l.playerId)) &&
    [...r.clockAnchors, ...r.possessionChanges].every((x) => matches.has(x.matchId)) &&
    r.events.every(
      (e) => matches.has(e.matchId) && optional(entries, e.lineupEntryId) && optional(entries, e.relatedLineupEntryId),
    )
  );
}

export function parseBackup(text: string, options: { migrations?: readonly Migration[]; schemaVersion?: number } = {}): ParseResult {
  const { migrations = sharedMigrations, schemaVersion = SCHEMA_VERSION } = options;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'notJson' };
  }
  const header = headerSchema.safeParse(json);
  if (!header.success) return { ok: false, error: 'notBackup' };
  const raw = header.data as unknown as Record<keyof BackupRecords, Record<string, unknown>[]> & { exportVersion: number; exportedAt: string; catalogVersion: number };
  if (raw.exportVersion > EXPORT_VERSION) return { ok: false, error: 'newerVersion' };

  const records = {} as Record<keyof BackupRecords, unknown[]>;
  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (const row of raw[table]) {
      const upgraded = migrate(row, migrations, schemaVersion);
      if (!upgraded) return { ok: false, error: 'newerVersion' };
      const parsed = SCHEMAS[table].safeParse(upgraded);
      if (!parsed.success) return { ok: false, error: 'invalid' };
      rows.push(parsed.data);
    }
    records[table] = rows;
  }
  const backup = records as unknown as BackupRecords;
  if (!linksHold(backup)) return { ok: false, error: 'brokenLinks' };
  return { ok: true, backup: { app: BACKUP_APP, exportVersion: raw.exportVersion, exportedAt: raw.exportedAt, catalogVersion: raw.catalogVersion, ...backup } };
}

export function countConflicts(records: BackupRecords, existingIds: ReadonlySet<string>): number {
  return BACKUP_TABLES.reduce((n, table) => n + records[table].filter((r) => existingIds.has(r.id)).length, 0);
}

/** "Keep both": the same data under new IDs, with every reference rewired. */
export function asCopy(records: BackupRecords, newId: () => string = () => crypto.randomUUID()): BackupRecords {
  const map = new Map<string, string>();
  for (const table of BACKUP_TABLES) for (const r of records[table]) map.set(r.id, newId());
  const to = (id: string) => map.get(id) ?? id;
  const maybe = (id: string | undefined) => (id === undefined ? undefined : to(id));
  const withoutUndefined = <T extends object>(r: T) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as T;

  return {
    teams: records.teams.map((r) => ({ ...r, id: to(r.id) })),
    players: records.players.map((r) => ({ ...r, id: to(r.id), teamId: to(r.teamId) })),
    matches: records.matches.map((r) => ({ ...r, id: to(r.id), teamId: to(r.teamId) })),
    lineupEntries: records.lineupEntries.map((r) => ({ ...r, id: to(r.id), matchId: to(r.matchId), playerId: to(r.playerId) })),
    clockAnchors: records.clockAnchors.map((r) => ({ ...r, id: to(r.id), matchId: to(r.matchId) })),
    possessionChanges: records.possessionChanges.map((r) => ({ ...r, id: to(r.id), matchId: to(r.matchId) })),
    events: records.events.map((r) =>
      withoutUndefined({
        ...r,
        id: to(r.id),
        matchId: to(r.matchId),
        lineupEntryId: maybe(r.lineupEntryId),
        relatedLineupEntryId: maybe(r.relatedLineupEntryId),
      }),
    ),
  };
}
