import type { z } from 'zod';
import type {
  ClockAnchor,
  clockAnchorSchema,
  LineupEntry,
  lineupEntrySchema,
  Match,
  MatchEvent,
  matchEventSchema,
  matchSchema,
  Player,
  playerSchema,
  PossessionChange,
  possessionChangeSchema,
  RecordBase,
  Team,
  teamSchema,
} from '@/domain/schemas';
import type { BackupRecords } from './backup';

/** What callers pass in: the schema input minus the fields the repository stamps. */
type CreateInput<S extends z.ZodType> = Omit<z.input<S>, keyof RecordBase>;

export type TeamInput = CreateInput<typeof teamSchema>;
export type MatchInput = Omit<CreateInput<typeof matchSchema>, 'catalogVersion'>;
export type MatchEventInput = CreateInput<typeof matchEventSchema>;
export type PlayerInput = Omit<CreateInput<typeof playerSchema>, 'archived'>;
/** A lineup entry for a match being created; the repository fills in matchId. */
export type NewLineupEntry = Omit<CreateInput<typeof lineupEntrySchema>, 'matchId'>;
export type ClockAnchorInput = CreateInput<typeof clockAnchorSchema>;
export type PossessionChangeInput = CreateInput<typeof possessionChangeSchema>;

export interface ListOptions {
  includeDeleted?: boolean;
}

interface RecordRepo<T, Input> {
  get(id: string): Promise<T | undefined>;
  list(options?: ListOptions): Promise<T[]>;
  create(input: Input): Promise<T>;
  /** Validated merge; passing `undefined` clears an optional field. */
  update(id: string, changes: Partial<Input>): Promise<T>;
  /** Sets deletedAt; the record stays in storage for history and future sync. */
  softDelete(id: string): Promise<void>;
}

export type TeamRepo = RecordRepo<Team, TeamInput>;

export interface MatchRepo extends RecordRepo<Match, MatchInput> {
  /** Live (not deleted) matches of a team. */
  countByTeam(teamId: string): Promise<number>;
  /** Saves a new match and its lineup in one transaction: both or nothing. */
  createWithLineup(match: MatchInput, lineup: NewLineupEntry[]): Promise<Match>;
}

export interface LineupRepo {
  /** Live entries of a match: starters first, then by shirt number. */
  listByMatch(matchId: string): Promise<LineupEntry[]>;
  /** Live entries of one player, across all matches. */
  listByPlayer(playerId: string): Promise<LineupEntry[]>;
}

export interface EventRepo extends RecordRepo<MatchEvent, MatchEventInput> {
  /** Live (not deleted) events of the given matches. */
  listByMatches(matchIds: string[]): Promise<MatchEvent[]>;
  listByMatch(matchId: string): Promise<MatchEvent[]>;
}

export interface PlayerRepo extends RecordRepo<Player, PlayerInput> {
  /** Live players of a team, archived ones included (check `archived`). */
  listByTeam(teamId: string): Promise<Player[]>;
  /** True when the player appears in any match lineup, so their stats must be kept. */
  hasMatchData(playerId: string): Promise<boolean>;
  /** Archives a player with match data, soft-deletes one without. */
  remove(playerId: string): Promise<'archived' | 'deleted'>;
  restore(playerId: string): Promise<void>;
}

interface MatchRecordRepo<T, Input> extends RecordRepo<T, Input> {
  /** Live records of one match. */
  listByMatch(matchId: string): Promise<T[]>;
}

export type ClockRepo = MatchRecordRepo<ClockAnchor, ClockAnchorInput>;
export type PossessionRepo = MatchRecordRepo<PossessionChange, PossessionChangeInput>;

/** Raw access for JSON backup: records keep their own IDs and timestamps. */
export interface BackupRepo {
  /** Every stored record, soft-deleted ones included. */
  readAll(): Promise<BackupRecords>;
  /** IDs already stored in any table, soft-deleted ones included. */
  existingIds(): Promise<Set<string>>;
  /** Writes all records in one transaction; a stored record with the same ID is replaced. */
  writeAll(records: BackupRecords): Promise<void>;
}

export interface Repositories {
  backup: BackupRepo;
  teams: TeamRepo;
  matches: MatchRepo;
  events: EventRepo;
  players: PlayerRepo;
  lineups: LineupRepo;
  clock: ClockRepo;
  possession: PossessionRepo;
}
