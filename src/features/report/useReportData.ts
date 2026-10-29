import type { ReportData } from '@/domain/report';
import { loadReportData, useRepoQuery, useRepositories } from '@/storage';

/** Live match data for the report; `undefined` while loading, `null` when the match doesn't exist. */
export function useReportData(matchId: string): ReportData | null | undefined {
  const repos = useRepositories();
  return useRepoQuery(() => loadReportData(repos, matchId), [repos, matchId]);
}
