import { useId, useState, type ReactNode } from 'react';
import type { ReportPlayer } from '@/domain/report';
import type { Point } from '@/domain/schemas';
import { mapPasses, mapShots, PASS_FILTERS, type MapEvent, type PassFilter, type ShotMarkerKind } from '@/domain/stats';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Pitch, toPitch } from '@/ui/pitch/Pitch';

type PlayerEvent = MapEvent & { lineupEntryId?: string };

const ACCURATE = 'var(--success)';
const INACCURATE = 'var(--fail)';
const SHOT_R = 1.4;

const at = (p: Point) => toPitch(p.x, p.y);

/** Shots in the half we attack. All markers are one size until xG exists. */
export function ShotMap({ events, players }: { events: readonly PlayerEvent[]; players?: readonly ReportPlayer[] }) {
  const [entryId, setEntryId] = useState('');
  const { markers, withoutLocation } = mapShots(events.filter((e) => !entryId || e.lineupEntryId === entryId));
  const count = (kind: ShotMarkerKind) => markers.filter((m) => m.kind === kind).length;
  const summary = t('report.shotMap.summary', { onTarget: count('on_target'), offTarget: count('off_target'), blocked: count('blocked') });

  return (
    <MapCard title={t('report.shotMap')} hint={t('report.attacking')} players={players} entryId={entryId} onPlayer={setEntryId}>
      <div role="img" aria-label={summary} className="overflow-hidden rounded-lg">
        <Pitch half>
          {markers.map((m, i) => (
            <ShotMarker key={i} kind={m.kind} at={m.at} />
          ))}
        </Pitch>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/80">
        {(['on_target', 'off_target', 'blocked'] as const).map((kind) => (
          <li key={kind} className="inline-flex items-center gap-1.5">
            <svg aria-hidden viewBox="-2 -2 4 4" className="size-3.5 rounded-sm bg-pitch-fill">
              <ShotMarker kind={kind} at={null} />
            </svg>
            {t(`report.shot.${kind}`)} {count(kind)}
          </li>
        ))}
        {withoutLocation > 0 && <li className="text-muted-foreground">{t('report.shotsWithoutLocation', { count: withoutLocation })}</li>}
      </ul>
    </MapCard>
  );
}

/** On target: filled circle · off target: hollow circle · blocked: hollow diamond. `at: null` draws it at 0,0 (legend). */
function ShotMarker({ kind, at: point }: { kind: ShotMarkerKind; at: Point | null }) {
  const { x, y } = point ? at(point) : { x: 0, y: 0 };
  if (kind === 'blocked') {
    const r = SHOT_R * 1.15;
    return <path d={`M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`} fill="none" stroke="var(--foreground)" strokeWidth={0.4} />;
  }
  return <circle cx={x} cy={y} r={SHOT_R} fill={kind === 'on_target' ? 'var(--foreground)' : 'none'} stroke="var(--foreground)" strokeWidth={0.4} />;
}

/** Passes and crosses: green accurate, red inaccurate, whatever the type. */
export function PassMap({ events, players }: { events: readonly PlayerEvent[]; players?: readonly ReportPlayer[] }) {
  const arrowId = useId();
  const [entryId, setEntryId] = useState('');
  const [filter, setFilter] = useState<PassFilter>('all');
  const { lines, withoutLocation } = mapPasses(
    events.filter((e) => !entryId || e.lineupEntryId === entryId),
    filter,
  );
  const accurate = lines.filter((l) => l.accurate).length;
  const summary = t('report.passMap.summary', { accurate, inaccurate: lines.length - accurate });

  return (
    <MapCard title={t('report.passMap')} hint={`${t('report.passMap.hint')} · ${t('report.attacking')}`} players={players} entryId={entryId} onPlayer={setEntryId}>
      <div role="group" aria-label={t('report.passFilters')} className="flex flex-wrap gap-1.5 print:hidden">
        {PASS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'h-8 cursor-pointer rounded-full border px-3 text-sm transition-colors',
              filter === f ? 'border-primary bg-primary font-semibold text-primary-foreground' : 'bg-surface hover:border-foreground/30',
            )}
          >
            {t(`report.passFilter.${f}`)}
          </button>
        ))}
      </div>
      <div role="img" aria-label={summary} className="overflow-hidden rounded-lg">
        <Pitch>
          <defs>
            {[ACCURATE, INACCURATE].map((colour, i) => (
              <marker key={colour} id={`${arrowId}-${i}`} viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="2.4" markerHeight="2.4" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill={colour} />
              </marker>
            ))}
          </defs>
          {lines.map((l, i) => {
            const from = at(l.start);
            const to = at(l.end);
            return (
              <g key={i} className="opacity-55 transition-opacity hover:opacity-100">
                <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={2} />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={l.accurate ? ACCURATE : INACCURATE}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  markerEnd={`url(#${arrowId}-${l.accurate ? 0 : 1})`}
                />
              </g>
            );
          })}
        </Pitch>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/80">
        {[
          { colour: ACCURATE, label: t('report.pass.accurate'), n: accurate },
          { colour: INACCURATE, label: t('report.pass.inaccurate'), n: lines.length - accurate },
        ].map((item) => (
          <li key={item.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-1 w-5 rounded-full" style={{ backgroundColor: item.colour }} />
            {item.label} {item.n}
          </li>
        ))}
        {withoutLocation > 0 && <li className="text-muted-foreground">{t('report.passesWithoutLocation', { count: withoutLocation })}</li>}
      </ul>
    </MapCard>
  );
}

function MapCard({ title, hint, players, entryId, onPlayer, children }: {
  title: string;
  hint: string;
  /** Players to filter by; none hides the filter (e.g. inside one player's popup). */
  players?: readonly ReportPlayer[];
  entryId: string;
  onPlayer: (entryId: string) => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const selectId = useId();
  return (
    <section aria-labelledby={titleId} className="flex min-w-0 break-inside-avoid flex-col gap-3 rounded-xl border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <span className="text-sm text-muted-foreground">{hint}</span>
        {players && (
          <>
            <span className="flex-1" />
            <label htmlFor={selectId} className="sr-only">
              {t('report.playerFilter')}
            </label>
            <select id={selectId} value={entryId} onChange={(e) => onPlayer(e.target.value)} className="h-8 cursor-pointer rounded-md border bg-surface px-2 text-sm print:hidden">
              <option value="">{t('report.allPlayers')}</option>
              {players.map((p) => (
                <option key={p.line.entryId} value={p.line.entryId}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {children}
    </section>
  );
}
