import { positionCatalog, type PositionCatalog } from '../catalog';

export const MAX_POSITIONS = 3;
export const GOALKEEPER = 'GK';

export type PositionProblem = 'required' | 'tooMany' | 'goalkeeperAlone' | 'duplicate' | 'unknown';

/** Whether clicking `id` would change the selection. Selected positions can always be removed. */
export function isSelectable(selected: readonly string[], id: string, catalog: PositionCatalog = positionCatalog): boolean {
  if (selected.includes(id)) return true;
  if (!catalog.positions.some((p) => p.id === id)) return false;
  if (selected.length >= MAX_POSITIONS) return false;
  // A goalkeeper plays nowhere else, and an outfield player doesn't keep goal.
  if (selected.length > 0 && (id === GOALKEEPER || selected.includes(GOALKEEPER))) return false;
  return true;
}

/** Click on a position: remove it if selected, add it if allowed. Click order is kept (first = primary). */
export function togglePosition(selected: readonly string[], id: string, catalog: PositionCatalog = positionCatalog): string[] {
  if (selected.includes(id)) return selected.filter((p) => p !== id);
  return isSelectable(selected, id, catalog) ? [...selected, id] : [...selected];
}

export function validatePositions(positions: readonly string[], catalog: PositionCatalog = positionCatalog): PositionProblem | null {
  if (positions.length === 0) return 'required';
  if (positions.some((id) => !catalog.positions.some((p) => p.id === id))) return 'unknown';
  if (new Set(positions).size !== positions.length) return 'duplicate';
  if (positions.length > MAX_POSITIONS) return 'tooMany';
  if (positions.length > 1 && positions.includes(GOALKEEPER)) return 'goalkeeperAlone';
  return null;
}
