import { z } from 'zod';
import { recordBase } from './common';

export const MIN_SHIRT_NUMBER = 1;
export const MAX_SHIRT_NUMBER = 99;

export const shirtNumber = z.int().min(MIN_SHIRT_NUMBER).max(MAX_SHIRT_NUMBER);

/**
 * One player in a match's matchday squad. The shirt number lives here, not on
 * the player, because it changes from match to match. Starters sit in a slot
 * of the match's formation; subs have no slot.
 */
export const lineupEntrySchema = recordBase
  .extend({
    matchId: z.string().min(1),
    playerId: z.string().min(1),
    shirtNumber,
    role: z.enum(['starter', 'sub']),
    positionSlotId: z.string().min(1).optional(),
  })
  .refine((e) => (e.role === 'starter') === (e.positionSlotId !== undefined), {
    message: 'Starters need a formation slot; subs have none',
    path: ['positionSlotId'],
  });

export type LineupEntry = z.infer<typeof lineupEntrySchema>;
export type LineupRole = LineupEntry['role'];
