import { createBrowserRouter, type RouteObject } from 'react-router';
import { routes as collectorRoutes } from '@/features/collector/routes';
import { routes as homeRoutes } from '@/features/home/routes';
import { routes as matchSetupRoutes } from '@/features/match-setup/routes';
import { routes as playerProfileRoutes } from '@/features/player-profile/routes';
import { routes as reportRoutes } from '@/features/report/routes';
import { routes as squadsRoutes } from '@/features/squads/routes';
import { AppShell } from './AppShell';
import { NotFound } from './NotFound';

/** Each feature registers its pages in its own routes.ts; add new ones here. */
export const appRoutes: RouteObject[] = [
  {
    Component: AppShell,
    children: [...homeRoutes, ...squadsRoutes, ...playerProfileRoutes, ...matchSetupRoutes, ...collectorRoutes, ...reportRoutes, { path: '*', Component: NotFound }],
  },
];

export const createAppRouter = () => createBrowserRouter(appRoutes);
