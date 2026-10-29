import { Dexie } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDb } from './db';
import { createDexieRepositories } from './repositories';
import { DB_SCHEMA } from './schema';

const name = `test-${crypto.randomUUID()}`;
const at = '2026-10-08T10:00:00.000Z';
const oldMatch = {
  id: '0b6c1c64-3f1e-4c47-9d8f-2f1d2c7a5e01',
  createdAt: at,
  updatedAt: at,
  schemaVersion: 1,
  teamId: '5f0e9a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b',
  opponentName: 'Atromitos',
  date: '2026-10-04',
  formationId: '4-3-3',
  catalogVersion: 1,
  video: { kind: 'file', fileName: 'u14.mp4', sizeBytes: 1000, lastModified: 1, durationS: 600, handleKey: 'h1' },
  settings: { reactionLagS: 0.8, seekStepS: 10, autoOpenPlayerSearch: true },
};

afterEach(() => Dexie.delete(name));

describe('AppDb upgrade', () => {
  it('drops the old video file handles and keeps every match, which loses its video on the next save', async () => {
    const v1 = new Dexie(name);
    v1.version(1).stores(DB_SCHEMA[0].stores);
    await v1.table('matches').add(oldMatch);
    await v1.table('fileHandles').put({ key: 'h1', handle: { name: 'u14.mp4' } });
    v1.close();

    const db = new AppDb(name);
    await db.open();
    expect(db.verno).toBe(2);
    expect(db.tables.map((t) => t.name)).not.toContain('fileHandles');

    const repos = createDexieRepositories(db);
    expect(await repos.matches.get(oldMatch.id)).toMatchObject({ opponentName: 'Atromitos' });
    const saved = await repos.matches.update(oldMatch.id, { notes: 'Rainy' });
    expect(saved).not.toHaveProperty('video');
    expect(saved.settings).toEqual({ autoOpenPlayerSearch: true });
    db.close();
  });
});
