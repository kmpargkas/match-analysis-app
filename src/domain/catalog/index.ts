import actionsV1 from './actions.v1.json';
import formationsV1 from './formations.v1.json';
import positionsV1 from './positions.v1.json';
import { actionCatalogSchema, formationCatalogSchema, positionCatalogSchema, type Formation } from './schema';

export * from './schema';

export const actionCatalog = actionCatalogSchema.parse(actionsV1);
export const positionCatalog = positionCatalogSchema.parse(positionsV1);
export const formationCatalog = formationCatalogSchema.parse(formationsV1);

export function findFormation(id: string): Formation | undefined {
  return formationCatalog.formations.find((f) => f.id === id);
}
