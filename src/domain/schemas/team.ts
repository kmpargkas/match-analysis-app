import { z } from 'zod';
import { imageDataUrl, nonEmpty, recordBase } from './common';

export const teamSchema = recordBase.extend({
  name: nonEmpty,
  logo: imageDataUrl.optional(),
  coachName: z.string().trim().optional(),
  /** Youth teams can show players as initials everywhere, including the PDF. */
  nameDisplay: z.enum(['full', 'initials']).default('full'),
});

export type Team = z.infer<typeof teamSchema>;
