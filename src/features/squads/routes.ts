import type { RouteObject } from 'react-router';
import { paths } from '@/app/paths';
import { TeamPage } from './TeamPage';
import { TeamsPage } from './TeamsPage';

export const routes: RouteObject[] = [
  { path: paths.squads, Component: TeamsPage },
  { path: paths.team(), Component: TeamPage },
];
