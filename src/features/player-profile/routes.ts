import type { RouteObject } from 'react-router';
import { paths } from '@/app/paths';
import { PlayerProfilePage } from './PlayerProfilePage';

export const routes: RouteObject[] = [{ path: paths.player(), Component: PlayerProfilePage }];
