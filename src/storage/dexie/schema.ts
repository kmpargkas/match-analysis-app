/**
 * Dexie schema versions. Each new version that changes data needs a pure
 * migration in src/storage/migrations/ (shared with JSON import).
 */
export const DB_SCHEMA = [
  {
    version: 1,
    stores: {
      teams: 'id, updatedAt',
      players: 'id, teamId, updatedAt',
      matches: 'id, teamId, date, status, updatedAt',
      lineupEntries: 'id, matchId, playerId',
      clockAnchors: 'id, matchId, [matchId+videoTimeS]',
      possessionChanges: 'id, matchId, [matchId+videoTimeS]',
      events: 'id, matchId, [matchId+videoTimeS], updatedAt',
      fileHandles: 'key',
    },
  },
  { version: 2, stores: { fileHandles: null } },
] as const;
