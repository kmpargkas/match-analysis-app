import { useId } from 'react';
import type { Match } from '@/domain/schemas';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Field, Input } from '@/ui/components/form';
import type { MatchInfo } from './matchInfo';

const sides: Match['homeAway'][] = ['home', 'away', 'neutral'];
const sideLabel = { home: 'matchSetup.info.home', away: 'matchSetup.info.away', neutral: 'matchSetup.info.neutral' } as const;

export function MatchInfoSection({ info, coachName, onChange }: { info: MatchInfo; coachName: string; onChange: (changes: Partial<MatchInfo>) => void }) {
  const id = useId();
  const optional = { optional: true, optionalLabel: t('common.optional') };

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label={t('matchSetup.info.opponent')} htmlFor={`${id}-opponent`}>
          <Input
            id={`${id}-opponent`}
            value={info.opponentName}
            onChange={(e) => onChange({ opponentName: e.target.value })}
            placeholder={t('matchSetup.info.opponentPlaceholder')}
          />
        </Field>
        <Field label={t('matchSetup.info.date')} htmlFor={`${id}-date`}>
          <Input id={`${id}-date`} type="date" value={info.date} onChange={(e) => onChange({ date: e.target.value })} />
        </Field>
        <Field label={t('matchSetup.info.kickoff')} htmlFor={`${id}-kickoff`} {...optional}>
          <Input id={`${id}-kickoff`} type="time" value={info.kickoffTime} onChange={(e) => onChange({ kickoffTime: e.target.value })} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Field label={t('matchSetup.info.competition')} htmlFor={`${id}-competition`} {...optional}>
          <Input
            id={`${id}-competition`}
            value={info.competition}
            onChange={(e) => onChange({ competition: e.target.value })}
            placeholder={t('matchSetup.info.competitionPlaceholder')}
          />
        </Field>
        <Field label={t('matchSetup.info.venue')} htmlFor={`${id}-venue`} {...optional}>
          <Input id={`${id}-venue`} value={info.venue} onChange={(e) => onChange({ venue: e.target.value })} placeholder={t('matchSetup.info.venuePlaceholder')} />
        </Field>
        <div className="grid gap-1.5">
          <span id={`${id}-side`} className="text-sm font-medium">
            {t('matchSetup.info.side')}
          </span>
          <div role="radiogroup" aria-labelledby={`${id}-side`} className="inline-flex h-9 rounded-lg border bg-muted/50 p-0.5">
            {sides.map((side) => (
              <button
                key={side}
                type="button"
                role="radio"
                aria-checked={info.homeAway === side}
                onClick={() => onChange({ homeAway: side })}
                className={cn(
                  'cursor-pointer rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  info.homeAway === side ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(sideLabel[side])}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field label={t('matchSetup.info.coach')} htmlFor={`${id}-coach`} {...optional}>
          <Input id={`${id}-coach`} value={coachName} onChange={(e) => onChange({ coachName: e.target.value })} />
        </Field>
        <Field label={t('matchSetup.info.notes')} htmlFor={`${id}-notes`} {...optional}>
          <Input id={`${id}-notes`} value={info.notes} onChange={(e) => onChange({ notes: e.target.value })} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{t('matchSetup.info.halves')}</p>
    </div>
  );
}
