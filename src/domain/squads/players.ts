import { positionCatalog, type PositionCatalog } from '../catalog';
import type { Player, Team } from '../schemas';

/** "Giorgos Papadopoulos" → "G.P." */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toLocaleUpperCase()}.`)
    .join('');
}

/** The name to show anywhere in the app or PDF, respecting the team's initials setting. */
export function displayName(player: Pick<Player, 'name'>, team: Pick<Team, 'nameDisplay'>): string {
  return team.nameDisplay === 'initials' ? initials(player.name) : player.name;
}

/** A short label for crowded places such as a formation pitch: the surname, or initials when the team uses them. */
export function pitchName(player: Pick<Player, 'name'>, team: Pick<Team, 'nameDisplay'>): string {
  if (team.nameDisplay === 'initials') return initials(player.name);
  const parts = player.name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

/** Squad order: by primary position (catalog order, GK → ST), then by name. */
export function sortSquad<P extends Pick<Player, 'name' | 'positions'>>(players: readonly P[], catalog: PositionCatalog = positionCatalog): P[] {
  const rank = new Map(catalog.positions.map((p, i) => [p.id, i]));
  const primaryRank = (p: P) => rank.get(p.positions[0] ?? '') ?? Number.MAX_SAFE_INTEGER;
  return [...players].sort((a, b) => primaryRank(a) - primaryRank(b) || a.name.localeCompare(b.name));
}
