import { z } from 'zod';
import { recordBase } from './common';

export const possessionTeamSchema = z.enum(['us', 'them']);

/** Who has the ball from `videoTimeS` (the collector timeline) until the next change. */
export const possessionChangeSchema = recordBase.extend({
  matchId: z.string().min(1),
  videoTimeS: z.number().nonnegative(),
  team: possessionTeamSchema,
});

export type PossessionTeam = z.infer<typeof possessionTeamSchema>;
export type PossessionChange = z.infer<typeof possessionChangeSchema>;
