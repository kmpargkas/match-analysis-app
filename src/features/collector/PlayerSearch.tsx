import { ChevronDownIcon, XIcon } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { onPitchAt } from '@/domain/events';
import type { MatchEvent } from '@/domain/schemas';
import { displayName } from '@/domain/squads/players';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover';
import { useCollectorContext } from './context';
import { useCollector, type PlayerField } from './store';
import { useCollectorActions } from './useCollectorActions';
import type { LineupPlayer } from './useCollectorData';

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();

/** Digits match the start of the shirt number; anything else matches the name, ignoring case and accents. */
function matches(lp: LineupPlayer, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (/^\d+$/.test(q)) return String(lp.entry.shirtNumber).startsWith(q);
  return fold(lp.player.name).includes(fold(q));
}

export function PlayerSearch({ event, field, label }: { event: MatchEvent; field: PlayerField; label: string }) {
  const { data } = useCollectorContext();
  const actions = useCollectorActions();
  const open = useCollector((s) => s.playerSearch?.eventId === event.id && s.playerSearch.field === field);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const team = data.team ?? { nameDisplay: 'full' as const };

  const selectedId = field === 'player' ? event.lineupEntryId : event.relatedLineupEntryId;
  const selected = data.lineup.find((lp) => lp.entry.id === selectedId);

  // Players on the pitch just before this event, so a substitution's own change doesn't count.
  const others = data.events.filter((e) => e.id !== event.id);
  const onPitch = onPitchAt(event.videoTimeS, data.lineup.map((lp) => lp.entry), others);
  const byNumber = (a: LineupPlayer, b: LineupPlayer) => a.entry.shirtNumber - b.entry.shirtNumber;
  const offPitchFirst = field === 'playerOn';
  const groupA = data.lineup.filter((lp) => onPitch.has(lp.entry.id) !== offPitchFirst && matches(lp, query)).sort(byNumber);
  const groupB = data.lineup.filter((lp) => onPitch.has(lp.entry.id) === offPitchFirst && matches(lp, query)).sort(byNumber);
  const list = [...groupA, ...groupB];

  function setOpen(next: boolean) {
    const state = useCollector.getState();
    if (next) state.openPlayerSearch(event.id, field);
    else if (open) state.closePlayerSearch();
    setQuery('');
    setHighlight(0);
  }

  function choose(lp: LineupPlayer | undefined) {
    if (!lp) return;
    void actions.assignPlayer(event.id, field, lp.entry.id);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(list[highlight]);
    }
  }

  const row = (lp: LineupPlayer, index: number) => (
    <li key={lp.entry.id} role="option" aria-selected={index === highlight}>
      <button
        type="button"
        onClick={() => choose(lp)}
        onMouseEnter={() => setHighlight(index)}
        className={cn('flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm', index === highlight && 'bg-muted')}
      >
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-foreground px-1 text-xs font-bold text-background tabular-nums">{lp.entry.shirtNumber}</span>
        <span className="truncate">{displayName(lp.player, team)}</span>
      </button>
    </li>
  );

  return (
    <div className="grid gap-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={selected ? `${label}: #${selected.entry.shirtNumber} ${displayName(selected.player, team)}` : `${label}: ${t('collector.log.choosePlayer')}`}
              className={cn(
                'flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md border bg-surface px-2 text-left text-sm',
                !selected && 'border-warning/60 text-muted-foreground',
              )}
            >
              {selected ? (
                <>
                  <span className="font-bold tabular-nums">#{selected.entry.shirtNumber}</span>
                  <span className="truncate">{displayName(selected.player, team)}</span>
                </>
              ) : (
                t('collector.log.choosePlayer')
              )}
              <ChevronDownIcon className="ml-auto size-4 shrink-0 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-1.5" onOpenAutoFocus={(e) => e.preventDefault()}>
            <input
              autoFocus
              aria-label={t('collector.log.searchPlayer')}
              placeholder={t('collector.log.searchPlayer')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              className="mb-1 h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <ul role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
              {list.length === 0 && <li className="px-2 py-1.5 text-sm text-muted-foreground">{t('collector.log.noPlayers')}</li>}
              {groupA.length > 0 && <GroupLabel text={offPitchFirst ? t('collector.log.notOnPitch') : t('collector.log.onPitch')} />}
              {groupA.map((lp, i) => row(lp, i))}
              {groupB.length > 0 && <GroupLabel text={offPitchFirst ? t('collector.log.onPitch') : t('collector.log.notOnPitch')} />}
              {groupB.map((lp, i) => row(lp, groupA.length + i))}
            </ul>
          </PopoverContent>
        </Popover>
        {selected && (
          <button
            type="button"
            aria-label={`${label}: ${t('common.cancel')}`}
            onClick={() => void actions.assignPlayer(event.id, field, undefined)}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function GroupLabel({ text }: { text: string }) {
  return (
    <li role="presentation" className="px-2 pt-1.5 pb-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
      {text}
    </li>
  );
}
