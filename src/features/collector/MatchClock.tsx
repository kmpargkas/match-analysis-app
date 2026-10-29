import { PauseIcon, PlayIcon } from 'lucide-react';
import { useState } from 'react';
import { clockAt } from '@/domain/clock';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { useCollectorContext } from './context';
import { useCollector } from './store';
import { useCollectorActions } from './useCollectorActions';

export function MatchClock() {
  const { data } = useCollectorContext();
  const actions = useCollectorActions();
  const timeS = useCollector((s) => s.timeS);
  const { clockS, running } = clockAt(timeS, data.anchors);
  const whole = Math.floor(clockS);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  const toggleLabel = running ? t('collector.clock.stop') : t('collector.clock.start');

  return (
    <div role="group" aria-label={t('collector.clock.label')} className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void actions.toggleClock()}
        aria-label={toggleLabel}
        title={`${toggleLabel} (K)`}
        className={cn(
          'flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
          running ? 'bg-muted text-foreground hover:bg-muted/70' : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {running ? <PauseIcon className="size-4 fill-current" /> : <PlayIcon className="size-4 translate-x-px fill-current" />}
      </button>
      <span className={cn('flex items-center font-mono text-2xl font-semibold tabular-nums', !running && 'text-muted-foreground')}>
        <ClockPart value={minutes} max={199} label={t('collector.clock.minutes')} onCommit={(m) => void actions.clock({ kind: 'set', clockS: m * 60 + seconds })} />
        <span className={cn('opacity-60', running && 'animate-pulse')}>:</span>
        <ClockPart value={seconds} max={59} label={t('collector.clock.seconds')} onCommit={(s) => void actions.clock({ kind: 'set', clockS: minutes * 60 + s })} />
      </span>
      <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground">{t(actions.half === 2 ? 'collector.half.2' : 'collector.half.1')}</span>
    </div>
  );
}

function ClockPart({ value, max, label, onCommit }: { value: number; max: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = String(value).padStart(2, '0');

  const commit = () => {
    const next = Number(draft);
    if (draft !== null && draft !== '' && Number.isInteger(next) && next <= max) onCommit(next);
    setDraft(null);
  };

  if (draft === null) {
    return (
      <button type="button" aria-label={label} onClick={() => setDraft('')} className="cursor-text rounded px-0.5 hover:bg-muted">
        {text}
      </button>
    );
  }
  return (
    <input
      aria-label={label}
      autoFocus
      inputMode="numeric"
      placeholder={text}
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className="w-[3ch] rounded bg-background text-center text-foreground ring-2 ring-ring outline-none placeholder:text-muted-foreground"
    />
  );
}
