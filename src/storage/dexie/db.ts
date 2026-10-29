import { Dexie, type Table } from 'dexie';
import type { ClockAnchor, LineupEntry, Match, MatchEvent, Player, PossessionChange, Team } from '@/domain/schemas';
import { DB_SCHEMA } from './schema';

export const DEFAULT_DB_NAME = 'match-analysis';

export class AppDb extends Dexie {
  teams!: Table<Team, string>;
  players!: Table<Player, string>;
  matches!: Table<Match, string>;
  lineupEntries!: Table<LineupEntry, string>;
  clockAnchors!: Table<ClockAnchor, string>;
  possessionChanges!: Table<PossessionChange, string>;
  events!: Table<MatchEvent, string>;

  constructor(name = DEFAULT_DB_NAME) {
    super(name);
    for (const { version, stores } of DB_SCHEMA) this.version(version).stores(stores);
  }
}
