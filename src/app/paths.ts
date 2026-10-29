/**
 * URL contract shared by all features, so a feature can link to another page
 * without importing that feature's internals.
 */
export const paths = {
  home: '/',
  squads: '/squads',
  /** Teams list with the Create team dialog open. */
  newTeam: '/squads?new=team',
  team: (teamId = ':teamId') => `/squads/${teamId}`,
  player: (teamId = ':teamId', playerId = ':playerId') => `/squads/${teamId}/players/${playerId}`,
  newMatch: '/matches/new',
  collector: (matchId = ':matchId') => `/matches/${matchId}/collect`,
  report: (matchId = ':matchId') => `/matches/${matchId}/report`,
} as const;

/** Route `handle` options. `fill`: the page fills the window below the header, without the footer. */
export interface RouteHandle {
  layout?: 'fill';
}
