import { z } from 'zod';
import { validatePositions } from '../squads/positions';
import { imageDataUrl, nonEmpty, recordBase } from './common';

/**
 * A squad member. Shirt numbers are not stored here: they are set per match
 * in the lineup.
 */
export const playerSchema = recordBase.extend({
  teamId: z.string().min(1),
  name: nonEmpty,
  photo: imageDataUrl.optional(),
  /** 1–3 positions in order of preference (first = primary). GK is never combined. */
  positions: z.array(z.string()).superRefine((positions, ctx) => {
    const problem = validatePositions(positions);
    if (problem) ctx.addIssue({ code: 'custom', message: `positions: ${problem}` });
  }),
  /** Set when a removed player still appears in match data. Hidden from new lineups. */
  archived: z.boolean().default(false),
});

export type Player = z.infer<typeof playerSchema>;
