import { z } from 'zod';
import { nonEmpty, recordBase } from './common';

/** Normalized pitch point: our team attacks left → right, 0–100 on both axes. */
export const pointSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const attackDirSchema = z.enum(['ltr', 'rtl']);

export const halfSchema = z.union([z.literal(1), z.literal(2)]);

export const matchEventSchema = recordBase.extend({
  matchId: z.string().min(1),
  /** Collector timeline when logged (video time in older matches); orders events, never shown. */
  videoTimeS: z.number().nonnegative(),
  /** The event's time: the match clock when logged; can be edited by hand. */
  clockS: z.number().nonnegative(),
  /** Absent in matches logged before halves were tracked. */
  half: halfSchema.optional(),
  typeId: nonEmpty,
  outcome: z.string().optional(),
  /** Keys are validated against the action catalog. */
  attributes: z.record(z.string(), z.union([z.string(), z.boolean()])).default({}),
  lineupEntryId: z.string().optional(),
  relatedLineupEntryId: z.string().optional(),
  start: pointSchema.optional(),
  end: pointSchema.optional(),
  /** Attack direction when logged; `start`/`end` are already normalized to left → right. */
  attackDir: attackDirSchema,
});

export type Point = z.infer<typeof pointSchema>;
export type AttackDir = z.infer<typeof attackDirSchema>;
export type Half = z.infer<typeof halfSchema>;
export type MatchEvent = z.infer<typeof matchEventSchema>;
