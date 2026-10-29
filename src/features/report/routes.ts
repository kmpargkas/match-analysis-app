import type { RouteObject } from 'react-router';
import { paths } from '@/app/paths';
import { ReportPage } from './ReportPage';

export const routes: RouteObject[] = [{ path: paths.report(), Component: ReportPage }];
