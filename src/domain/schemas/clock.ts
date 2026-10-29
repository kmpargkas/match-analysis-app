import { z } from 'zod';
import { recordBase } from './common';

/**
 * From `videoTimeS` (the collector timeline) on, the clock shows `clockS` and, when `running`,
 * advances with it. Start, stop and typed corrections each add one anchor.
 */
export const clockAnchorSchema = recordBase.extend({
  matchId: z.string().min(1),
  videoTimeS: z.number().nonnegative(),
  clockS: z.number().nonnegative(),
  running: z.boolean(),
});

export type ClockAnchor = z.infer<typeof clockAnchorSchema>;
