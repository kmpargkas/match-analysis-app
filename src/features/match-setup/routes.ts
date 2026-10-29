import type { RouteObject } from 'react-router';
import { paths } from '@/app/paths';
import { NewMatchPage } from './NewMatchPage';

export const routes: RouteObject[] = [{ path: paths.newMatch, Component: NewMatchPage }];
