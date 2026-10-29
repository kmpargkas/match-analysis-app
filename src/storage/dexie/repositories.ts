import type { Table, UpdateSpec } from 'dexie';
import type { z } from 'zod';
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
  type Match,
  type MatchEvent,
  type Player,
  type PossessionChange,
  type RecordBase,
  type Team,
} from '@/domain/schemas';
import type {
  ClockAnchorInput,
  ListOptions,
  MatchEventInput,
  MatchInput,
  PlayerInput,
  PossessionChangeInput,
  Repositories,
  TeamInput,
} from '../repositories';
import { BACKUP_TABLES } from '../backup';
import type { AppDb } from './db';

interface RepoDeps {
  now?: () => string;
  newId?: () => string;
}

/** Drop keys set to undefined, so clearing an optional field removes it from the stored record. */
function withoutUndefined<T extends object>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as T;
}

export function createDexieRepositories(db: AppDb, deps: RepoDeps = {}): Repositories {
  const now = deps.now ?? (() => new Date().toISOString());
  const newId = deps.newId ?? (() => crypto.randomUUID());

  /** Sets a few fields directly (no full validation) and bumps updatedAt. */
  async function touch<T extends RecordBase>(table: Table<T, string>, id: string, changes: Partial<T>) {
    const changed = await table.update(id, { ...changes, updatedAt: now() } as unknown as UpdateSpec<T>);
    if (!changed) throw new Error(`Record ${id} not found`);
  }

  /** A new, validated record with its common fields stamped. Throws on invalid input. */
  function newRecord<T>(schema: z.ZodType<T>, input: object): T {
    const at = now();
    return withoutUndefined(schema.parse({ ...input, id: newId(), createdAt: at, updatedAt: at, schemaVersion: SCHEMA_VERSION }) as T & object);
  }

  function recordRepo<T extends RecordBase, Input>(table: Table<T, string>, schema: z.ZodType<T>, prepare: (input: Input) => unknown = (i) => i) {
    return {
      get: (id: string) => table.get(id),

      list: async ({ includeDeleted = false }: ListOptions = {}) => {
        const all = await table.toArray();
        return includeDeleted ? all : all.filter((r) => !r.deletedAt);
      },

      create: async (input: Input) => {
        const record = newRecord(schema, prepare(input) as object);
        await table.add(record);
        return record;
      },

      update: async (id: string, changes: Partial<Input>) => {
        const existing = await table.get(id);
        if (!existing || existing.deletedAt) throw new Error(`Record ${id} not found`);
        // Identity and audit fields can't be changed by callers.
        const record = withoutUndefined(
          schema.parse({ ...existing, ...changes, id, createdAt: existing.createdAt, schemaVersion: existing.schemaVersion, updatedAt: now() }),
        );
        await table.put(record);
        return record;
      },

      softDelete: (id: string) => touch(table, id, { deletedAt: now() } as Partial<T>),
    };
  }

  const events = recordRepo<MatchEvent, MatchEventInput>(db.events, matchEventSchema);
  const teams = recordRepo<Team, TeamInput>(db.teams, teamSchema);
  const prepareMatch = (input: MatchInput) => ({ ...input, catalogVersion: actionCatalog.version });
  const matches = recordRepo<Match, MatchInput>(db.matches, matchSchema, prepareMatch);
  const players = recordRepo<Player, PlayerInput>(db.players, playerSchema);

  async function liveByMatch<T extends RecordBase & { matchId: string }>(table: Table<T, string>, matchId: string): Promise<T[]> {
    const found = await table.where('matchId').equals(matchId).toArray();
    return found.filter((r) => !r.deletedAt);
  }

  const hasMatchData = async (playerId: string) => {
    const entries = await db.lineupEntries.where('playerId').equals(playerId).toArray();
    return entries.some((e) => !e.deletedAt);
  };

  const backupTables = BACKUP_TABLES.map((name) => db[name] as Table<RecordBase, string>);

  return {
    backup: {
      readAll: async () => Object.fromEntries(await Promise.all(BACKUP_TABLES.map(async (name) => [name, await db[name].toArray()]))),
      existingIds: async () => new Set((await Promise.all(backupTables.map((table) => table.toCollection().primaryKeys()))).flat()),
      writeAll: (records) =>
        db.transaction('rw', backupTables, async () => {
          for (const name of BACKUP_TABLES) await (db[name] as Table<RecordBase, string>).bulkPut(records[name]);
        }),
    },
    teams,
    matches: {
      ...matches,
      countByTeam: async (teamId) => {
        const found = await db.matches.where('teamId').equals(teamId).toArray();
        return found.filter((m) => !m.deletedAt).length;
      },
      createWithLineup: async (input, lineup) => {
        // Validate everything before writing, so a bad entry never leaves a match without its lineup.
        const match = newRecord(matchSchema, prepareMatch(input));
        const entries = lineup.map((entry) => newRecord(lineupEntrySchema, { ...entry, matchId: match.id }));
        await db.transaction('rw', db.matches, db.lineupEntries, async () => {
          await db.matches.add(match);
          await db.lineupEntries.bulkAdd(entries);
        });
        return match;
      },
    },
    lineups: {
      listByMatch: async (matchId) => {
        const found = await db.lineupEntries.where('matchId').equals(matchId).toArray();
        const roleOrder = { starter: 0, sub: 1 };
        return found.filter((e) => !e.deletedAt).sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.shirtNumber - b.shirtNumber);
      },
      listByPlayer: async (playerId) => {
        const found = await db.lineupEntries.where('playerId').equals(playerId).toArray();
        return found.filter((e) => !e.deletedAt);
      },
    },
    events: {
      ...events,
      listByMatches: async (matchIds) => {
        const found = await db.events.where('matchId').anyOf(matchIds).toArray();
        return found.filter((e) => !e.deletedAt);
      },
      listByMatch: (matchId) => liveByMatch(db.events, matchId),
    },
    clock: { ...recordRepo<ClockAnchor, ClockAnchorInput>(db.clockAnchors, clockAnchorSchema), listByMatch: (matchId) => liveByMatch(db.clockAnchors, matchId) },
    possession: {
      ...recordRepo<PossessionChange, PossessionChangeInput>(db.possessionChanges, possessionChangeSchema),
      listByMatch: (matchId) => liveByMatch(db.possessionChanges, matchId),
    },
    players: {
      ...players,
      listByTeam: async (teamId) => {
        const found = await db.players.where('teamId').equals(teamId).toArray();
        return found.filter((p) => !p.deletedAt);
      },
      hasMatchData,
      remove: async (id) => {
        if (await hasMatchData(id)) {
          await touch(db.players, id, { archived: true });
          return 'archived';
        }
        await players.softDelete(id);
        return 'deleted';
      },
      restore: (id) => touch(db.players, id, { archived: false }),
    },
  };
}
