import { z } from 'zod';

/** Current record schema version. Bump together with a migration in src/storage/migrations/. */
export const SCHEMA_VERSION = 1;

export const uuid = z.uuid();
export const isoDateTime = z.iso.datetime();
export const nonEmpty = z.string().trim().min(1);

/** Images (logos, faces) are stored inline as small resized data URLs, so backups stay one JSON file. */
export const MAX_IMAGE_DATA_URL_LENGTH = 300_000;
export const imageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)
  .max(MAX_IMAGE_DATA_URL_LENGTH);

/** Fields every stored record has. */
export const recordBase = z.object({
  id: uuid,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  deletedAt: isoDateTime.optional(),
  schemaVersion: z.int().positive(),
});

export type RecordBase = z.infer<typeof recordBase>;
