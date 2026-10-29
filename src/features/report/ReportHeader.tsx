import type { ReportModel } from '@/domain/report';
import type { Match, Team } from '@/domain/schemas';
import { t } from '@/i18n';
import { Avatar } from '@/ui/components/avatar';
import { statPct, statText } from '@/ui/report/format';

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function ReportHeader({ match, team, model }: { match: Match; team: Team | null; model: ReportModel }) {
  const meta = [dateFormat.format(new Date(`${match.date}T00:00:00Z`)), match.competition, t(`home.venue.${match.homeAway}`), match.venue].filter(Boolean).join(' · ');
  const pctText = (pct: number | null) => (pct === null ? '—' : `${pct}%`);
  const chips = [
    { label: t('report.chip.shots'), value: statText(model.team.shots) },
    { label: t('report.chip.onTarget'), value: model.team.shots_on_target.kind === 'ratio' ? String(model.team.shots_on_target.made) : '' },
    { label: t('report.chip.passAccuracy'), value: pctText(statPct(model.team.passes)) },
    { label: t('report.chip.duelsWon'), value: pctText(statPct(model.team.duels)) },
  ];
  const us = model.possessionUs === null ? null : Math.round(model.possessionUs * 100);

  return (
    <section aria-label={t('report.match')} className="flex flex-col gap-4 rounded-xl border bg-surface px-6 py-5">
      <p className="text-center text-sm text-muted-foreground">{meta}</p>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
        <div className="flex min-w-0 items-center justify-end gap-3">
          <div className="min-w-0 text-right">
            <p className="truncate text-xl font-bold">{team?.name ?? t('home.unknownTeam')}</p>
            <p className="flex flex-wrap justify-end gap-x-2 text-sm text-muted-foreground">
              {model.scorers.map((s, i) => (
                <span key={i}>{`${s.name} ${s.minute}'`}</span>
              ))}
            </p>
          </div>
          <Avatar kind="team" src={team?.logo} size="lg" />
        </div>
        <div role="group" aria-label={t('score.label')} className="flex items-center gap-1 rounded-lg border bg-background px-3 py-0.5 text-lg font-bold tabular-nums">
          <span aria-label={t('score.us')} className="min-w-7 px-1 text-center">
            {match.score.us}
          </span>
          <span className="font-normal text-muted-foreground">–</span>
          <span aria-label={t('score.them')} className="min-w-7 px-1 text-center">
            {match.score.them}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar kind="team" size="lg" />
          <div className="min-w-0">
            <p className="truncate text-xl font-bold">{match.opponentName}</p>
            <p className="text-sm text-muted-foreground">{t('report.opponent')}</p>
          </div>
        </div>
      </div>

      {us === null ? (
        <p className="text-center text-sm text-muted-foreground">{t('report.possessionUnknown')}</p>
      ) : (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="font-semibold tabular-nums">{us}%</span>
            <span className="font-medium text-muted-foreground">{t('report.possession')}</span>
            <span className="font-semibold tabular-nums">{100 - us}%</span>
          </div>
          <div role="meter" aria-label={t('report.possession')} aria-valuenow={us} aria-valuemin={0} aria-valuemax={100} className="flex h-2.5 overflow-hidden rounded-full bg-muted-foreground/25">
            <div className="bg-primary" style={{ width: `${us}%` }} />
          </div>
        </div>
      )}

      {model.hasEvents && (
        <ul className="flex flex-wrap justify-center gap-2">
          {chips.map((chip) => (
            <li key={chip.label} className="flex items-baseline gap-1.5 rounded-full bg-muted px-3 py-1 text-sm">
              <span className="text-muted-foreground">{chip.label}</span>
              <strong className="tabular-nums">{chip.value}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
