import { ArrowDownIcon, ArrowUpIcon, TriangleAlertIcon } from 'lucide-react';
import type { Badge } from '@/domain/stats';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';

const CARD_COLOUR = { yellow: 'bg-yellow-400', second_yellow: 'bg-yellow-400', red: 'bg-red-600' } as const;

/** Goal, assist, own goal, cards and sub minutes, each with an accessible label like "Goal 34'". */
export function PlayerBadges({ badges, className }: { badges: readonly Badge[]; className?: string }) {
  if (badges.length === 0) return null;
  return (
    <span className={cn('flex flex-wrap items-center gap-0.5', className)}>
      {badges.map((b, i) => (
        <BadgeIcon key={i} badge={b} />
      ))}
    </span>
  );
}

function BadgeIcon({ badge }: { badge: Badge }) {
  const label = t(`report.badge.${badge.kind}`, { minute: badge.minute });
  switch (badge.kind) {
    case 'goal':
    case 'own_goal':
      return (
        <svg role="img" aria-label={label} viewBox="0 0 16 16" className="size-4">
          <circle cx="8" cy="8" r="7" fill="white" stroke={badge.kind === 'own_goal' ? '#dc2626' : '#1d2b24'} strokeWidth="1.3" />
          <path d="M8 4.6l3 2.2-1.1 3.4H6.1L5 6.8z" fill={badge.kind === 'own_goal' ? '#dc2626' : '#1d2b24'} />
        </svg>
      );
    case 'assist':
      return (
        <span role="img" aria-label={label} className="flex size-4 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-neutral-900 ring-1 ring-neutral-900">
          A
        </span>
      );
    case 'yellow':
    case 'second_yellow':
    case 'red':
      return (
        <span role="img" aria-label={label} className="flex items-center">
          {badge.kind === 'second_yellow' && <span className="-mr-1 h-3.5 w-2.5 rounded-[2px] bg-yellow-400 ring-1 ring-white" />}
          <span className={cn('h-3.5 w-2.5 rounded-[2px] ring-1 ring-white', badge.kind === 'second_yellow' ? 'bg-red-600' : CARD_COLOUR[badge.kind])} />
        </span>
      );
    case 'sub_off':
    case 'sub_on': {
      const Icon = badge.kind === 'sub_off' ? ArrowDownIcon : ArrowUpIcon;
      return (
        <span role="img" aria-label={label} className={cn('inline-flex items-center rounded bg-white px-1 text-[11px] leading-4 font-bold', badge.kind === 'sub_off' ? 'text-orange-700' : 'text-green-700')}>
          <Icon className="size-2.5" strokeWidth={3} />
          {badge.minute}'
        </span>
      );
    }
  }
}

export function IncompleteMark() {
  return <TriangleAlertIcon role="img" aria-label={t('report.playerIncomplete')} className="size-4 fill-warning text-white" />;
}
