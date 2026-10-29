import { CheckIcon, CircleAlertIcon, DownloadIcon, FlagIcon, HomeIcon, LoaderIcon, MoreHorizontalIcon, SettingsIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { t } from '@/i18n';
import { exportMatchData, useRepositories } from '@/storage';
import { cn } from '@/ui/cn';
import { Badge } from '@/ui/components/badge';
import { Button } from '@/ui/components/button';
import { toast } from '@/ui/components/toaster';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { ScoreEditor } from '@/ui/components/score-editor';
import { useCollectorContext } from './context';
import { FinishMatchDialog } from './FinishMatchDialog';
import { MatchClock } from './MatchClock';
import { SettingsDialog } from './SettingsDialog';
import { useCollector } from './store';
import { useCollectorActions } from './useCollectorActions';

type Dialog = 'settings' | 'finish' | null;

export function CollectorHeader() {
  const { data } = useCollectorContext();
  const actions = useCollectorActions();
  const repos = useRepositories();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const { match, team } = data;

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 rounded-xl border bg-surface px-4">
      <div className="min-w-0">
        <h1 className="truncate font-semibold" title={`${team?.name ?? '—'} ${t('collector.vs')} ${match.opponentName}`}>
          {team?.name ?? '—'} <span className="font-normal text-muted-foreground">{t('collector.vs')}</span> {match.opponentName}
        </h1>
      </div>
      {match.status === 'finished' && <Badge>{t('collector.finishedBadge')}</Badge>}

      <ScoreEditor score={match.score} onChange={actions.setScore} />

      <div className="flex flex-1 justify-center">
        <MatchClock />
      </div>
      <SaveIndicator />

      <Button variant="outline" onClick={() => setDialog('finish')}>
        <FlagIcon />
        {t('collector.finish')}
      </Button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('collector.menu')}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t('collector.half.title')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={String(actions.half)} onValueChange={(value) => void actions.setHalf(value === '2' ? 2 : 1)}>
            <DropdownMenuRadioItem value="1">{t('collector.half.1')}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="2">{t('collector.half.2')}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void exportMatchData(repos, match.id).catch(() => toast.error(t('backup.exportFailed')))}>
            <DownloadIcon />
            {t('collector.menu.exportJson')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('settings')}>
            <SettingsIcon />
            {t('collector.menu.settings')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(paths.home)}>
            <HomeIcon />
            {t('collector.menu.home')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsDialog open={dialog === 'settings'} onOpenChange={(open) => setDialog(open ? 'settings' : null)} />
      <FinishMatchDialog open={dialog === 'finish'} onOpenChange={(open) => setDialog(open ? 'finish' : null)} />
    </header>
  );
}

function SaveIndicator() {
  const pending = useCollector((s) => s.pendingSaves);
  const failed = useCollector((s) => s.saveFailed);
  const [Icon, text, tone] = pending > 0 ? [LoaderIcon, t('collector.saving'), 'text-muted-foreground'] : failed ? [CircleAlertIcon, t('collector.saveFailed'), 'text-destructive'] : [CheckIcon, t('collector.saved'), 'text-success'];
  return (
    <span role="status" className={cn('inline-flex items-center gap-1.5 text-xs', tone)}>
      <Icon className={cn('size-3.5', pending > 0 && 'animate-spin')} />
      {text}
    </span>
  );
}
