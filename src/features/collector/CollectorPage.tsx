import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { resumeTimelineS } from '@/domain/clock';
import { t } from '@/i18n';
import { PlaceholderPage } from '@/ui/components/page';
import { ActionPanel } from './ActionPanel';
import { CollectorHeader } from './CollectorHeader';
import { CollectorContext } from './context';
import { EventLog } from './EventLog';
import { PitchPanel } from './PitchPanel';
import { useCollector } from './store';
import { useCollectorActions } from './useCollectorActions';
import { useCollectorData, type CollectorData } from './useCollectorData';
import { nowMs } from './wallClock';

const TIME_POLL_MS = 200;

export function CollectorPage() {
  const { matchId = '' } = useParams();
  const data = useCollectorData(matchId);

  useEffect(() => {
    useCollector.getState().reset();
    return () => useCollector.getState().reset();
  }, [matchId]);

  if (data === undefined) {
    return (
      <p className="py-24 text-center text-sm text-muted-foreground" role="status">
        {t('common.loading')}
      </p>
    );
  }
  if (data === null) return <PlaceholderPage title={t('collector.notFound')} />;
  return <Collector key={data.match.id} data={data} />;
}

function Collector({ data }: { data: CollectorData }) {
  const now = useTimeline(data);

  return (
    <CollectorContext value={{ data, now }}>
      <ClockKeeper />
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] gap-3 p-3">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <CollectorHeader />
          <PitchPanel />
          <ActionPanel />
        </div>
        <EventLog />
      </div>
    </CollectorContext>
  );
}

const MIN_STEP_S = 0.001;

/**
 * The collector's own timeline: it runs in real time while the collector is open and carries on
 * from the latest recorded time when the match is reopened, so it only ever moves forward.
 * Each call of the returned `now` is strictly later than the last, so two records never tie
 * (e.g. a clock start and stop in the same millisecond).
 */
function useTimeline(data: CollectorData): () => number {
  const [origin] = useState(() => ({ baseS: resumeTimelineS([...data.events, ...data.anchors, ...data.possession]), startMs: nowMs() }));
  const elapsed = useCallback(() => origin.baseS + Math.max(0, nowMs() - origin.startMs) / 1000, [origin]);
  const last = useRef(-Infinity);
  const now = useCallback(() => {
    last.current = Math.max(elapsed(), last.current + MIN_STEP_S);
    useCollector.getState().setTimeS(last.current);
    return last.current;
  }, [elapsed]);

  useEffect(() => {
    const { setTimeS } = useCollector.getState();
    const tick = () => setTimeS(Math.max(elapsed(), last.current));
    tick();
    const id = setInterval(tick, TIME_POLL_MS);
    return () => clearInterval(id);
  }, [elapsed]);
  return now;
}

/** Stops a running clock when the collector is left, and toggles it with K (ignored while typing). */
function ClockKeeper() {
  const actions = useCollectorActions();
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });

  useEffect(() => {
    const stop = () => void latest.current.clock({ kind: 'stop' }).catch(() => undefined);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'k' && e.key !== 'K') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      void latest.current.toggleClock();
    };
    window.addEventListener('pagehide', stop);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('keydown', onKeyDown);
      stop();
    };
  }, []);
  return null;
}
