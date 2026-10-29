/**
 * Pure record migrations, shared by Dexie upgrades and JSON import.
 * `migrations[n]` upgrades a record from schemaVersion n + 1 to n + 2.
 */
export type Migration = (record: Record<string, unknown>) => Record<string, unknown>;

export const migrations: Migration[] = [];
