import { TriangleAlertIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { paths } from '@/app/paths';
import { actionCatalog } from '@/domain/catalog';
import { formatClock } from '@/domain/clock';
import { completeness, sortForLog } from '@/domain/events';
import { t } from '@/i18n';
import { Button } from '@/ui/components/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { toast } from '@/ui/components/toaster';
import { eventLabel } from './catalogView';
import { useCollectorContext } from './context';
import { missingText } from './missingText';
import { useCollector } from './store';
import { useCollectorActions } from './useCollectorActions';

export function FinishMatchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data } = useCollectorContext();
  const actions = useCollectorActions();
  const navigate = useNavigate();
  const incomplete = sortForLog(data.events)
    .reverse()
    .map((event) => ({ event, missing: completeness(event, actionCatalog).missing }))
    .filter((x) => x.missing.length > 0);

  function jumpTo(eventId: string) {
    onOpenChange(false);
    useCollector.getState().activate(eventId);
  }

  async function finish() {
    await actions.finish();
    toast.success(t('collector.finish.done'));
    navigate(paths.home);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('collector.finish.title')}</DialogTitle>
          <DialogDescription>
            {incomplete.length === 0 ? t('collector.finish.allComplete', { count: data.events.length }) : t('collector.finish.incomplete', { count: incomplete.length })}
          </DialogDescription>
        </DialogHeader>
        {incomplete.length > 0 && (
          <DialogBody>
            <ul className="grid max-h-80 gap-1 overflow-y-auto" aria-label={t('collector.log.incomplete', { count: incomplete.length })}>
              {incomplete.map(({ event, missing }) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => jumpTo(event.id)}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <TriangleAlertIcon className="size-4 shrink-0 text-warning" />
                    <span className="w-12 font-mono text-xs text-muted-foreground tabular-nums">{formatClock(event.clockS)}</span>
                    <span className="font-medium">{eventLabel(event)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{missingText(missing)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={finish}>{t('collector.finish.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
