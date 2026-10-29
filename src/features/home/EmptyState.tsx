import { PlusIcon, UsersIcon } from 'lucide-react';
import { Link } from 'react-router';
import { paths } from '@/app/paths';
import { t } from '@/i18n';
import { Button } from '@/ui/components/button';

export function EmptyState({ hasTeams }: { hasTeams: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border bg-surface px-6 py-16 text-center">
      <PitchIllustration />
      <h2 className="mt-6 text-lg font-semibold">{t('home.empty.title')}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t('home.empty.body')}</p>
      <div className="mt-6 flex gap-2">
        {/* Without a team there is no squad to pick from, so the team comes first. */}
        <Button asChild variant={hasTeams ? 'outline' : 'primary'}>
          <Link to={paths.newTeam}>
            <UsersIcon />
            {t('home.empty.createTeam')}
          </Link>
        </Button>
        <Button asChild variant={hasTeams ? 'primary' : 'outline'}>
          <Link to={paths.newMatch}>
            <PlusIcon />
            {t('home.empty.newMatch')}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function PitchIllustration() {
  return (
    <svg viewBox="0 0 120 78" className="w-36 text-primary" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="1" y="1" width="118" height="76" rx="3" className="fill-primary-soft" />
      <line x1="60" y1="1" x2="60" y2="77" />
      <circle cx="60" cy="39" r="10" />
      <rect x="1" y="21" width="16" height="36" />
      <rect x="103" y="21" width="16" height="36" />
      <circle cx="60" cy="39" r="1.5" fill="currentColor" />
    </svg>
  );
}
