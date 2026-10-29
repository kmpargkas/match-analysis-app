import { z } from 'zod';

const labelsSchema = z.object({ en: z.string().min(1), el: z.string().optional() });

export const actionAttributeSchema = z.object({
  key: z.string().min(1),
  required: z.boolean(),
  options: z.array(z.string()),
  default: z.string().optional(),
});

export const actionTypeSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  labels: z.object({ en: z.string().min(1), el: z.string().optional() }),
  outcomes: z.array(z.string()),
  attributes: z.array(actionAttributeSchema),
  location: z.enum(['none', 'point', 'line']),
  needsPlayer: z.boolean(),
  /** Substitution: the player coming on (relatedLineupEntryId). */
  needsRelatedPlayer: z.boolean().optional(),
  countsAsTouch: z.union([z.boolean(), z.object({ outcomes: z.array(z.string()) })]),
  /** Panel buttons; each can preset an outcome. None = one button with the type's label. */
  buttons: z.array(z.object({ outcome: z.string().optional(), labels: labelsSchema })).optional(),
});

export const actionGroupSchema = z.object({
  id: z.string().min(1),
  labels: labelsSchema,
  /** Listed under More ▾ instead of the main panel. */
  more: z.boolean().optional(),
});

export const actionCatalogSchema = z.object({
  version: z.int().positive(),
  groups: z.array(actionGroupSchema),
  /** Shared labels for outcome, attribute and option IDs used by the types. */
  labels: z.object({
    outcomes: z.record(z.string(), labelsSchema),
    attributes: z.record(z.string(), labelsSchema),
    options: z.record(z.string(), labelsSchema),
  }),
  types: z.array(actionTypeSchema),
});

export type ActionType = z.infer<typeof actionTypeSchema>;
export type ActionAttribute = z.infer<typeof actionAttributeSchema>;
export type ActionCatalog = z.infer<typeof actionCatalogSchema>;

/**
 * Playing positions. x/y place each one on a pitch with our team attacking
 * left → right (0–100); y = 0 is the top touchline, i.e. the players' left.
 */
export const positionSchema = z.object({
  id: z.string().min(1),
  line: z.enum(['goalkeeper', 'defence', 'midfield', 'attack']),
  labels: z.object({ en: z.string().min(1), el: z.string().optional() }),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const positionCatalogSchema = z.object({
  version: z.int().positive(),
  positions: z.array(positionSchema),
});

export type Position = z.infer<typeof positionSchema>;
export type PositionCatalog = z.infer<typeof positionCatalogSchema>;

/** Slot IDs are unique within a formation (RCB, LCB…); `position` is a positions-catalog ID used for natural fits. */
export const formationSlotSchema = z.object({
  id: z.string().min(1),
  position: z.string().min(1),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

export const formationSchema = z.object({
  id: z.string().min(1),
  format: z.enum(['11v11', '9v9', '7v7']),
  labels: z.object({ en: z.string().min(1), el: z.string().optional() }),
  slots: z.array(formationSlotSchema),
});

export const formationCatalogSchema = z.object({
  version: z.int().positive(),
  formations: z.array(formationSchema),
});

export type FormationSlot = z.infer<typeof formationSlotSchema>;
export type Formation = z.infer<typeof formationSchema>;
