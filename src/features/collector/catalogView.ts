import { actionCatalog, type ActionType } from '@/domain/catalog';
import type { MatchEvent } from '@/domain/schemas';

export const typeById = new Map(actionCatalog.types.map((t) => [t.id, t]));

const { outcomes, attributes, options } = actionCatalog.labels;
export const outcomeLabel = (id: string) => outcomes[id]?.en ?? id;
export const attributeLabel = (key: string) => attributes[key]?.en ?? key;
export const optionLabel = (id: string) => options[id]?.en ?? id;

export { groupColour } from '@/ui/categoryColours';

/** "Pass ✓" when a panel button matches the event, otherwise "Shot · Woodwork". */
export function eventLabel(event: Pick<MatchEvent, 'typeId' | 'outcome'>, type: ActionType | undefined = typeById.get(event.typeId)): string {
  if (!type) return event.typeId;
  const button = type.buttons?.find((b) => b.outcome === event.outcome);
  if (button) return button.labels.en;
  return event.outcome ? `${type.labels.en} · ${outcomeLabel(event.outcome)}` : type.labels.en;
}
