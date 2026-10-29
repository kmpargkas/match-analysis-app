import { ArrowRightIcon, CheckIcon, SearchIcon, XIcon } from 'lucide-react';
import { useId, useState, type Dispatch } from 'react';
import { findFormation, formationCatalog, positionCatalog, type Formation, type FormationSlot } from '@/domain/catalog';
import { benchOf, rankCandidates, type DraftAction, type LineupDraft } from '@/domain/lineup';
import type { Player, Team } from '@/domain/schemas';
import { displayName, initials, pitchName } from '@/domain/squads/players';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Avatar } from '@/ui/components/avatar';
import { Button } from '@/ui/components/button';
import { Input, Label } from '@/ui/components/form';
import { FormationPitch, type SlotOccupant } from '@/ui/pitch/FormationPitch';
import { PositionChips } from '@/ui/PositionChips';

const positionLabel = new Map(positionCatalog.positions.map((p) => [p.id, p.labels.en]));
const formats = [...new Set(formationCatalog.formations.map((f) => f.format))];

interface Candidate extends Player {
  shirtNumber?: number;
}

export function LineupSection({ team, players, draft, dispatch }: {
  team: Team;
  players: Player[];
  draft: LineupDraft;
  dispatch: Dispatch<DraftAction>;
}) {
  const id = useId();
  const [selectedSlotId, setSelectedSlotId] = useState<string>();
  const formation = draft.formationId ? findFormation(draft.formationId) : undefined;
  const selectedSlot = formation?.slots.find((s) => s.id === selectedSlotId);

  const byId = new Map(players.map((p) => [p.id, p]));
  const numberOf = new Map(draft.squad.map((p) => [p.playerId, p.shirtNumber]));
  const asCandidate = (playerId: string): Candidate | undefined => {
    const player = byId.get(playerId);
    return player && { ...player, shirtNumber: numberOf.get(playerId) };
  };
  const bench = benchOf(draft)
    .flatMap((p) => asCandidate(p.playerId) ?? [])
    .sort((a, b) => (a.shirtNumber ?? Infinity) - (b.shirtNumber ?? Infinity));

  const occupants: Record<string, SlotOccupant | undefined> = {};
  for (const [slotId, playerId] of Object.entries(draft.slots)) {
    const player = byId.get(playerId);
    if (player) occupants[slotId] = { shirtNumber: numberOf.get(playerId), label: pitchName(player, team), fullName: displayName(player, team) };
  }
  const placed = formation ? formation.slots.filter((s) => draft.slots[s.id]).length : 0;

  function assign(playerId: string) {
    if (!formation || !selectedSlot) return;
    dispatch({ type: 'assign', slotId: selectedSlot.id, playerId });
    // Move on to the next empty position, so a lineup can be filled click after click.
    const order = formation.slots.map((s) => s.id);
    const start = order.indexOf(selectedSlot.id);
    const next = [...order.slice(start + 1), ...order.slice(0, start)].find((slotId) => !draft.slots[slotId]);
    setSelectedSlotId(next);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-formation`}>{t('matchSetup.lineup.formation')}</Label>
          <select
            id={`${id}-formation`}
            value={draft.formationId ?? ''}
            onChange={(e) => {
              dispatch({ type: 'setFormation', formationId: e.target.value });
              setSelectedSlotId(undefined);
            }}
            className="h-9 w-64 cursor-pointer rounded-lg border bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="" disabled>
              {t('matchSetup.lineup.formationPlaceholder')}
            </option>
            {formats.map((format) => (
              <optgroup key={format} label={format}>
                {formationCatalog.formations
                  .filter((f) => f.format === format)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.labels.en}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        {formation && (
          <p className="pb-2 text-sm text-muted-foreground tabular-nums">{t('matchSetup.lineup.placed', { count: placed, total: formation.slots.length })}</p>
        )}
        <p className="ml-auto inline-flex items-center gap-1 pb-2 text-xs text-muted-foreground">
          {t('positions.attacking')}
          <ArrowRightIcon className="size-3.5" />
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {formation ? (
          <FormationPitch
            formation={formation}
            occupants={occupants}
            selectedSlotId={selectedSlotId}
            onSlotClick={setSelectedSlotId}
            title={t('matchSetup.lineup.pitch')}
          />
        ) : (
          <div className="flex aspect-[111/74] items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {t('matchSetup.lineup.noFormation')}
          </div>
        )}

        <aside className="rounded-xl border bg-background p-4 lg:sticky lg:top-4">
          {formation && selectedSlot ? (
            <SlotPanel
              key={selectedSlot.id}
              team={team}
              formation={formation}
              slot={selectedSlot}
              current={draft.slots[selectedSlot.id] ? asCandidate(draft.slots[selectedSlot.id]!) : undefined}
              candidates={bench}
              onAssign={assign}
              onClear={() => dispatch({ type: 'unassign', slotId: selectedSlot.id })}
              onClose={() => setSelectedSlotId(undefined)}
            />
          ) : (
            <BenchPanel team={team} bench={bench} hint={formation ? t('matchSetup.lineup.pickSlot') : undefined} />
          )}
        </aside>
      </div>
    </div>
  );
}

/** The slot widget: natural fits for this position first, then the other unplaced players. */
function SlotPanel({ team, formation, slot, current, candidates, onAssign, onClear, onClose }: {
  team: Team;
  formation: Formation;
  slot: FormationSlot;
  current?: Candidate;
  candidates: Candidate[];
  onAssign: (playerId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const matching = candidates.filter((c) => matchesQuery(c, displayName(c, team), query));
  const { naturalFits, others } = rankCandidates(slot, matching);
  const title = t('matchSetup.lineup.slotTitle', { slot: slot.id, position: positionLabel.get(slot.position) ?? slot.position });

  return (
    <div className="grid gap-3" role="region" aria-label={title}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{formation.labels.en}</p>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <CheckIcon />
          {t('matchSetup.lineup.close')}
        </Button>
      </div>

      {current && (
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t('matchSetup.lineup.current')}</p>
          <div className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary-soft/50 px-2 py-1.5">
            <NumberBadge value={current.shirtNumber} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(current, team)}</span>
            <Button variant="ghost" size="icon" aria-label={t('matchSetup.lineup.clear')} title={t('matchSetup.lineup.clear')} onClick={onClear} className="size-7">
              <XIcon />
            </Button>
          </div>
        </div>
      )}

      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('matchSetup.lineup.noCandidates')}</p>
      ) : (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('matchSetup.lineup.search')} aria-label={t('matchSetup.lineup.search')} className="pl-8" autoFocus />
          </div>
          <div className="grid max-h-[26rem] gap-3 overflow-y-auto pr-1">
            {naturalFits.length + others.length === 0 && <p className="text-sm text-muted-foreground">{t('matchSetup.lineup.noMatches')}</p>}
            <CandidateGroup label={t('matchSetup.lineup.naturalFits')} team={team} players={naturalFits} onPick={onAssign} highlight />
            <CandidateGroup label={t('matchSetup.lineup.others')} team={team} players={others} onPick={onAssign} />
          </div>
        </>
      )}
    </div>
  );
}

function CandidateGroup({ label, team, players, onPick, highlight }: { label: string; team: Team; players: Candidate[]; onPick: (playerId: string) => void; highlight?: boolean }) {
  if (players.length === 0) return null;
  return (
    <div className="grid gap-1" role="group" aria-label={label}>
      <p className={cn('text-xs font-medium', highlight ? 'text-primary' : 'text-muted-foreground')}>{label}</p>
      <ul className="grid gap-1">
        {players.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              onClick={() => onPick(player.id)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors outline-none hover:border-primary hover:bg-primary-soft/40 focus-visible:ring-2 focus-visible:ring-ring',
                highlight ? 'border-primary/30' : 'border-transparent',
              )}
            >
              <NumberBadge value={player.shirtNumber} />
              <Avatar src={player.photo} fallback={initials(player.name)} size="sm" className="size-7 text-[10px]" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(player, team)}</span>
              <PositionChips positions={player.positions} className="flex-nowrap" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BenchPanel({ team, bench, hint }: { team: Team; bench: Candidate[]; hint?: string }) {
  return (
    <div className="grid gap-3">
      {hint && <p className="rounded-lg bg-primary-soft/60 px-3 py-2 text-sm text-primary-soft-foreground">{hint}</p>}
      <h3 className="font-semibold">
        {t('matchSetup.lineup.bench')} <span className="font-normal text-muted-foreground tabular-nums">({bench.length})</span>
      </h3>
      {bench.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('matchSetup.lineup.benchEmpty')}</p>
      ) : (
        <ul className="grid gap-1" aria-label={t('matchSetup.lineup.bench')}>
          {bench.map((player) => (
            <li key={player.id} className="flex items-center gap-2 px-1 py-0.5">
              <NumberBadge value={player.shirtNumber} />
              <span className="min-w-0 flex-1 truncate text-sm">{displayName(player, team)}</span>
              <PositionChips positions={player.positions.slice(0, 1)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NumberBadge({ value }: { value?: number }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1 text-sm font-bold tabular-nums',
        value === undefined ? 'border border-dashed text-muted-foreground' : 'bg-foreground text-background',
      )}
    >
      {value ?? '–'}
    </span>
  );
}

/** Digits match the start of the shirt number; anything else matches the name, ignoring case and accents. */
function matchesQuery(player: Candidate, name: string, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (/^\d+$/.test(q)) return String(player.shirtNumber ?? '').startsWith(q);
  const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
  return fold(name).includes(fold(q));
}
