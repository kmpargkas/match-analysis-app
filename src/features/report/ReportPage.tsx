import { PrinterIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '@/app/paths';
import { findFormation } from '@/domain/catalog';
import { buildReport, type ReportData } from '@/domain/report';
import { t } from '@/i18n';
import { Button } from '@/ui/components/button';
import { Page } from '@/ui/components/page';
import { PassMap, ShotMap } from '@/ui/report/Maps';
import { PlayerDialog } from '@/ui/report/PlayerDialog';
import { TeamStats } from '@/ui/report/TeamStats';
import { FormationView } from './FormationView';
import { IncompleteBanner } from './IncompleteBanner';
import { PlayerTable } from './PlayerTable';
import { ReportHeader } from './ReportHeader';
import { useReportData } from './useReportData';

export function ReportPage() {
  const { matchId = '' } = useParams();
  const data = useReportData(matchId);

  if (data === undefined) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground" role="status">
        {t('common.loading')}
      </p>
    );
  }
  if (data === null) {
    return (
      <Page title={t('report.notFound')} subtitle={t('report.notFoundBody')}>
        <Button asChild variant="outline">
          <Link to={paths.home}>{t('app.backHome')}</Link>
        </Button>
      </Page>
    );
  }
  return <Report data={data} />;
}

function Report({ data }: { data: ReportData }) {
  const model = useMemo(() => buildReport(data), [data]);
  const { match } = data;
  const played = model.players.filter((p) => p.line.played);
  const [selected, setSelected] = useState<string | null>(null);
  const index = played.findIndex((p) => p.line.entryId === selected);
  const previous = played[index - 1];
  const next = played[index + 1];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6 print:max-w-none print:p-0">
      <style media="print">{pdfPageCss(data)}</style>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {match.status === 'in_progress' && <p className="text-sm text-muted-foreground">{t('report.inProgress')}</p>}
        <span className="flex-1" />
        <Button onClick={() => window.print()} title={t('report.exportPdfHint')}>
          <PrinterIcon />
          {t('report.exportPdf')}
        </Button>
      </div>
      <ReportHeader match={match} team={data.team} model={model} />
      <IncompleteBanner matchId={match.id} summary={model.incomplete} />

      <div className="flex flex-wrap items-start gap-5 print:block">
        <section aria-labelledby="report-team-stats" className="flex min-w-0 flex-[999_1_36rem] flex-col gap-3 print:break-after-page">
          <div className="flex items-baseline gap-2.5">
            <h2 id="report-team-stats" className="text-lg font-semibold">
              {t('report.teamStats')}
            </h2>
            <span className="text-sm text-muted-foreground">{t('report.teamStatsHint')}</span>
          </div>
          {model.hasEvents ? <TeamStats stats={model.team} /> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t('report.noEvents')}</p>}
        </section>
        <div className="min-w-0 flex-[1_1_30rem] xl:max-w-[38rem] print:mx-auto print:mb-5 print:max-w-[560px]">
          <FormationView formation={findFormation(match.formationId)} players={model.players} onSelect={setSelected} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] print:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ShotMap events={data.events} players={played} />
        <PassMap events={data.events} players={played} />
      </div>

      <PlayerTable players={played} onSelect={setSelected} />
      <PlayerDialog
        player={played[index]}
        events={data.events}
        previous={{ label: t('report.previousPlayer'), go: previous && (() => setSelected(previous.line.entryId)) }}
        next={{ label: t('report.nextPlayer'), go: next && (() => setSelected(next.line.entryId)) }}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

const pdfDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** A CSS string literal; `<` is escaped so the text can never close the <style> element. */
const cssString = (text: string) => JSON.stringify(text).replace(/</g, '\\3C ');

/** Footer on every PDF page (Chromium page-margin boxes): "Confidential · Lions U14 vs Atromitos · date" and "Page n of N". */
function pdfPageCss({ match, team }: ReportData): string {
  const title = `${team?.name ?? t('home.unknownTeam')} ${t('home.vs')} ${match.opponentName}`;
  const footer = t('report.pdfFooter', { match: title, date: pdfDate.format(new Date(`${match.date}T00:00:00Z`)) });
  const box = 'font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9pt; color: #555;';
  return `@page {
  @bottom-left { content: ${cssString(footer)}; ${box} }
  @bottom-right { content: ${cssString(`${t('report.pdfPage')} `)} counter(page) ${cssString(` ${t('report.pdfOf')} `)} counter(pages); ${box} }
}`;
}
