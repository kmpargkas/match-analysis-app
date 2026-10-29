import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { positionCatalog } from '@/domain/catalog';
import type { ReportPlayer } from '@/domain/report';
import type { MatchEvent } from '@/domain/schemas';
import { t } from '@/i18n';
import { Avatar } from '@/ui/components/avatar';
import { Button } from '@/ui/components/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { playerLabel } from './format';
import { PassMap, ShotMap } from './Maps';
import { PlayerBadges } from './PlayerBadges';
import { TeamStats } from './TeamStats';

/** A previous/next button; no `go` disables it. */
export interface DialogStep {
  label: string;
  go?: () => void;
}

const positionLabel = (id: string | undefined) => positionCatalog.positions.find((p) => p.id === id)?.labels.en;

/** One player's match report: who, how long, badges, their non-zero stats and their own maps. Closed while `player` is undefined. */
export function PlayerDialog({ player: p, events, context, previous, next, onClose }: {
  player: ReportPlayer | undefined;
  /** The match's events; the dialog keeps the player's own. */
  events: readonly MatchEvent[];
  /** Shown first in the description, e.g. which match on the player's profile. */
  context?: string;
  previous: DialogStep;
  next: DialogStep;
  onClose: () => void;
}) {
  const own = p ? events.filter((e) => e.lineupEntryId === p.line.entryId) : [];

  return (
    <Dialog open={!!p} onOpenChange={(open) => !open && onClose()}>
      {p && (
        <DialogContent closeLabel={t('common.close')} className="max-w-4xl">
          <DialogHeader className="flex items-center gap-4 pr-14">
            <Avatar src={p.player.photo} face size="lg" />
            <div className="min-w-0 flex-1">
              <DialogTitle>{playerLabel(p)}</DialogTitle>
              <DialogDescription>
                {[context, positionLabel(p.position), t(p.line.role === 'starter' ? 'report.role.starter' : 'report.role.sub'), t('report.minutes', { count: p.line.minutes })].filter(Boolean).join(' · ')}
              </DialogDescription>
              <PlayerBadges badges={p.line.badges} className="mt-1.5 gap-1" />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label={previous.label} disabled={!previous.go} onClick={previous.go}>
                <ChevronLeftIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label={next.label} disabled={!next.go} onClick={next.go}>
                <ChevronRightIcon />
              </Button>
            </div>
          </DialogHeader>
          <DialogBody>
            {own.length > 0 ? <TeamStats stats={p.line.stats} hideZeroRows /> : <p className="text-sm text-muted-foreground">{t('report.playerNoEvents')}</p>}
            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <ShotMap events={own} />
              <PassMap events={own} />
            </div>
          </DialogBody>
        </DialogContent>
      )}
    </Dialog>
  );
}
