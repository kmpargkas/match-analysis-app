import { z } from 'zod';
import { nonEmpty, recordBase } from './common';
import { attackDirSchema, halfSchema } from './event';

export const matchStatusSchema = z.enum(['in_progress', 'finished']);

export const matchSchema = recordBase.extend({
  teamId: z.string().min(1),
  opponentName: nonEmpty,
  date: z.iso.date(),
  kickoffTime: z.iso.time({ precision: -1 }).optional(),
  competition: z.string().trim().optional(),
  venue: z.string().trim().optional(),
  homeAway: z.enum(['home', 'away', 'neutral']).default('home'),
  halfLengthMin: z.int().positive().default(45),
  formationId: nonEmpty,
  coachName: z.string().trim().optional(),
  /** Entered manually; never derived from events. */
  score: z.object({ us: z.int().nonnegative(), them: z.int().nonnegative() }).default({ us: 0, them: 0 }),
  status: matchStatusSchema.default('in_progress'),
  catalogVersion: z.int().positive(),
  /** Matches saved before video was removed may still store `video` and other settings; parsing drops them. */
  settings: z.object({ autoOpenPlayerSearch: z.boolean() }).default({ autoOpenPlayerSearch: true }),
  /** The collector's arrow: the goal we attack right now. Absent means left → right. */
  attackDir: attackDirSchema.optional(),
  /** The half the collector is logging. Absent means the 1st half. */
  half: halfSchema.optional(),
  notes: z.string().optional(),
});

export type MatchStatus = z.infer<typeof matchStatusSchema>;
export type Match = z.infer<typeof matchSchema>;
