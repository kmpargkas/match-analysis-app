import type { RouteObject } from 'react-router';
import { paths, type RouteHandle } from '@/app/paths';
import { CollectorPage } from './CollectorPage';

export const routes: RouteObject[] = [{ path: paths.collector(), Component: CollectorPage, handle: { layout: 'fill' } satisfies RouteHandle }];
