import { TriangleAlertIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { actionCatalog } from '@/domain/catalog';
import { completeness, sortForLog } from '@/domain/events';
import { t } from '@/i18n';
import { EventCard } from './EventCard';
import { useCollectorContext } from './context';
import { useCollector } from './store';

export function EventLog() {
  const { data } = useCollectorContext();
  const activeEventId = useCollector((s) => s.activeEventId);
  const events = sortForLog(data.events);
  const incomplete = events.filter((e) => !completeness(e, actionCatalog).complete).length;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeEventId) return;
    scroller.current?.querySelector(`[data-event-id="${activeEventId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeEventId]);

  return (
    <section aria-label={t('collector.log.title')} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-surface">
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <h2 className="font-semibold">{t('collector.log.title')}</h2>
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground tabular-nums">{events.length}</span>
        {incomplete > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-warning-soft-foreground">
            <TriangleAlertIcon className="size-3.5 text-warning" />
            {t('collector.log.incomplete', { count: incomplete })}
          </span>
        )}
      </div>
      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-x-hidden overflow-y-auto p-3">
        {events.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">{t('collector.log.empty')}</p>
        ) : (
          events.map((event) => <EventCard key={event.id} event={event} active={event.id === activeEventId} />)
        )}
      </div>
    </section>
  );
}
