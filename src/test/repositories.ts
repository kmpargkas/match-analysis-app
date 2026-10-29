import type { Repositories } from '@/storage';
import { AppDb } from '@/storage/dexie/db';
import { createDexieRepositories } from '@/storage/dexie/repositories';

/** Real repositories on a fresh fake-IndexedDB database. Call `dispose` after each test. */
export function createTestRepositories() {
  const db = new AppDb(`test-${crypto.randomUUID()}`);
  const repos: Repositories = createDexieRepositories(db);
  return {
    repos,
    /** Puts a player in a match lineup (as a sub) without creating the match. */
    addLineupEntry: (playerId: string, matchId = 'm1') => {
      const at = new Date().toISOString();
      return db.lineupEntries.add({ id: crypto.randomUUID(), createdAt: at, updatedAt: at, schemaVersion: 1, matchId, playerId, shirtNumber: 1, role: 'sub' });
    },
    dispose: () => db.delete(),
  };
}
