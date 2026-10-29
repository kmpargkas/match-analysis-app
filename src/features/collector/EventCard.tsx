import { MapPinIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { actionCatalog, type ActionAttribute } from '@/domain/catalog';
import { formatClock } from '@/domain/clock';
import { completeness } from '@/domain/events';
import type { MatchEvent } from '@/domain/schemas';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/ui/components/alert-dialog';
import { attributeLabel, eventLabel, groupColour, optionLabel, outcomeLabel, typeById } from './catalogView';
import { missingText } from './missingText';
import { PlayerSearch } from './PlayerSearch';
import { useCollector } from './store';
import { useCollectorActions } from './useCollectorActions';

export function EventCard({ event, active }: { event: MatchEvent; active: boolean }) {
  const actions = useCollectorActions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const type = typeById.get(event.typeId);
  const { missing } = completeness(event, actionCatalog);
  const label = eventLabel(event, type);
  const needsLocation = type && type.location !== 'none';

  function select(e: MouseEvent) {
    // Controls inside the card handle their own clicks.
    if ((e.target as HTMLElement).closest('button, select, input, [role="dialog"]')) return;
    useCollector.getState().activate(event.id);
  }

  return (
    <article
      data-event-id={event.id}
      aria-label={`${formatClock(event.clockS)} ${label}`}
      aria-current={active || undefined}
      onClick={select}
      className={cn(
        'flex w-full shrink-0 cursor-pointer flex-col gap-2 rounded-lg border bg-background p-2.5 transition-shadow',
        active ? 'border-primary shadow-md ring-2 ring-primary/40' : 'hover:border-foreground/20',
      )}
      style={{ borderLeftColor: groupColour(type?.category), borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-1.5">
        {event.half && <span className="pt-0.5 text-[11px] font-medium text-muted-foreground">{t(event.half === 2 ? 'collector.half.short.2' : 'collector.half.short.1')}</span>}
        <EventClock clockS={event.clockS} onChange={(clockS) => void actions.setEventClock(event.id, clockS)} />
        <p className="min-w-0 flex-1 truncate pt-0.5 text-sm font-semibold">{label}</p>
        {missing.length > 0 && (
          <span title={t('collector.log.missing', { fields: missingText(missing) })} aria-label={t('collector.log.missing', { fields: missingText(missing) })} className="pt-0.5">
            <TriangleAlertIcon className="size-4 text-warning" />
          </span>
        )}
        <button
          type="button"
          aria-label={t('collector.log.delete')}
          onClick={() => setConfirmDelete(true)}
          className="-mt-0.5 -mr-1 flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {type && type.outcomes.length > 0 && (
        <select
          aria-label={t('collector.log.outcome')}
          value={event.outcome ?? ''}
          onChange={(e) => void actions.setOutcome(event.id, e.target.value || undefined)}
          className="h-8 cursor-pointer rounded-md border bg-surface px-2 text-sm"
        >
          <option value="">—</option>
          {type.outcomes.map((o) => (
            <option key={o} value={o}>
              {outcomeLabel(o)}
            </option>
          ))}
        </select>
      )}

      {type?.needsPlayer && (
        <PlayerSearch event={event} field="player" label={type.needsRelatedPlayer ? t('collector.log.playerOff') : t('collector.log.player')} />
      )}
      {type?.needsRelatedPlayer && <PlayerSearch event={event} field="playerOn" label={t('collector.log.playerOn')} />}

      {type?.attributes.map((attr) => (
        <AttributeControl key={attr.key} attr={attr} value={event.attributes[attr.key]} onChange={(value) => void actions.setAttribute(event.id, attr.key, value)} />
      ))}

      {needsLocation && missing.includes('location') && (
        <button
          type="button"
          onClick={() => useCollector.getState().activate(event.id, true)}
          className="flex cursor-pointer items-center gap-1.5 self-start rounded-md px-1 text-xs font-medium text-warning-soft-foreground hover:bg-warning-soft"
        >
          <MapPinIcon className="size-3.5" />
          {t('collector.log.mapLocation')}
        </button>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('collector.log.delete.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('collector.log.delete.body', { event: label, clock: formatClock(event.clockS) })}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void actions.deleteEvent(event.id)}>{t('collector.log.delete.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

/** The event's match time; click to correct the minutes and seconds (the ":" stays fixed). */
function EventClock({ clockS, onChange }: { clockS: number; onChange: (clockS: number) => void }) {
  const [draft, setDraft] = useState<{ min: string; sec: string } | null>(null);
  const commit = () => {
    if (draft === null) return;
    const value = Number(draft.min || 0) * 60 + Math.min(59, Number(draft.sec || 0));
    if (value !== Math.floor(clockS)) onChange(value);
    setDraft(null);
  };

  if (draft === null) {
    return (
      <button
        type="button"
        aria-label={t('collector.log.editClock')}
        title={t('collector.log.editClock')}
        onClick={() => {
          const [min, sec] = formatClock(clockS).split(':') as [string, string];
          setDraft({ min, sec });
        }}
        className="cursor-text rounded px-1 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums hover:bg-muted hover:text-foreground"
      >
        {formatClock(clockS)}
      </button>
    );
  }

  const field = (part: 'min' | 'sec', label: string, maxLength: number, autoFocus = false) => (
    <input
      aria-label={label}
      autoFocus={autoFocus}
      inputMode="numeric"
      maxLength={maxLength}
      value={draft[part]}
      onChange={(e) => setDraft({ ...draft, [part]: e.target.value.replace(/\D/g, '').slice(0, maxLength) })}
      onFocus={(e) => e.target.select()}
      className="w-7 rounded border bg-surface px-0.5 text-center font-mono text-xs tabular-nums outline-none focus:ring-2 focus:ring-ring"
    />
  );

  return (
    <div
      role="group"
      aria-label={t('collector.log.clock')}
      className="flex items-center gap-0.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
    >
      {field('min', t('collector.log.clockMinutes'), 3, true)}
      <span className="font-mono text-xs text-muted-foreground">:</span>
      {field('sec', t('collector.log.clockSeconds'), 2)}
    </div>
  );
}

function AttributeControl({ attr, value, onChange }: { attr: ActionAttribute; value: string | boolean | undefined; onChange: (value: string | boolean | undefined) => void }) {
  const missing = attr.required && value === undefined;

  if (attr.options.length === 0) {
    return (
      <button
        type="button"
        aria-pressed={value === true}
        onClick={() => onChange(value === true ? undefined : true)}
        className={cn(
          'h-7 cursor-pointer self-start rounded-md border px-2 text-xs font-medium transition-colors',
          value === true ? 'border-primary bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground',
        )}
      >
        {attributeLabel(attr.key)}
      </button>
    );
  }

  return (
    <div role="group" aria-label={attributeLabel(attr.key)} className="grid gap-1">
      <p className={cn('text-[11px] font-medium', missing ? 'text-warning-soft-foreground' : 'text-muted-foreground')}>
        {attributeLabel(attr.key)}
        {attr.required && ' *'}
      </p>
      <div className="flex flex-wrap gap-1">
        {attr.options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(value === option && !attr.required ? undefined : option)}
            className={cn(
              'h-6 cursor-pointer rounded-md border px-1.5 text-xs transition-colors',
              value === option ? 'border-primary bg-primary text-primary-foreground' : 'bg-surface text-muted-foreground hover:text-foreground',
              missing && 'border-warning/60',
            )}
          >
            {optionLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
