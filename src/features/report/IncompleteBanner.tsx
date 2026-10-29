import { TriangleAlertIcon } from 'lucide-react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import type { IncompleteSummary } from '@/domain/stats';
import { t } from '@/i18n';

export function IncompleteBanner({ matchId, summary }: { matchId: string; summary: IncompleteSummary }) {
  if (summary.total === 0) return null;
  const other = summary.total - summary.withoutPlayer - summary.withoutLocation;
  const parts = [
    summary.withoutPlayer > 0 && t('report.incomplete.noPlayer', { count: summary.withoutPlayer }),
    summary.withoutLocation > 0 && t('report.incomplete.noLocation', { count: summary.withoutLocation }),
    other > 0 && t('report.incomplete.other', { count: other }),
  ].filter(Boolean);

  return (
    <div role="status" aria-label={t('report.incomplete.label')} className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/50 bg-warning-soft px-4 py-3 text-sm text-warning-soft-foreground">
      <TriangleAlertIcon className="size-4.5 shrink-0 text-warning" />
      <p className="min-w-0 flex-[1_1_28rem]">
        <strong>{t('report.incomplete.title', { count: summary.total })}</strong> {t('report.incomplete.body')} {parts.join(' · ')}
      </p>
      <Link to={paths.collector(matchId)} className="inline-flex h-9 items-center rounded-lg print:hidden border border-warning/60 bg-surface px-3.5 font-semibold hover:bg-background">
        {t('report.incomplete.fix')}
      </Link>
    </div>
  );
}
