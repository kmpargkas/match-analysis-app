import { ArrowRightIcon } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import { positionCatalog, type Position } from '@/domain/catalog';
import { isSelectable, MAX_POSITIONS, togglePosition } from '@/domain/squads/positions';
import { t } from '@/i18n';
import { cn } from '@/ui/cn';
import { Pitch, toPitch } from '@/ui/pitch/Pitch';

const RADIUS = 4.3;

/**
 * Choose up to three positions by clicking them on a pitch. Click order is
 * kept: the first position is the player's main one.
 */
export function PositionPicker({ value, onChange, invalid }: { value: string[]; onChange: (positions: string[]) => void; invalid?: boolean }) {
  const id = useId();
  const byId = new Map(positionCatalog.positions.map((p) => [p.id, p]));

  return (
    <div className="grid gap-3">
      <div className={cn('overflow-hidden rounded-xl shadow-inner ring-1 ring-black/10', invalid && 'ring-2 ring-destructive')}>
        <Pitch title={t('positions.picker')}>
          <defs>
            <radialGradient id={`${id}-off`} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#f8fafc" />
              <stop offset="1" stopColor="#b8c2cf" />
            </radialGradient>
            <radialGradient id={`${id}-on`} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#86efac" />
              <stop offset="0.55" stopColor="#22c55e" />
              <stop offset="1" stopColor="#15803d" />
            </radialGradient>
            <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodColor="#000" floodOpacity="0.4" />
            </filter>
            <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
          </defs>

          {positionCatalog.positions.map((position) => (
            <PositionDisc
              key={position.id}
              position={position}
              order={value.indexOf(position.id)}
              selectable={isSelectable(value, position.id)}
              ids={{ off: `${id}-off`, on: `${id}-on`, shadow: `${id}-shadow`, glow: `${id}-glow` }}
              onToggle={() => onChange(togglePosition(value, position.id))}
            />
          ))}
        </Pitch>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5" aria-live="polite">
          {value.length === 0 ? (
            <span className="text-muted-foreground">{t('positions.none')}</span>
          ) : (
            value.map((pid, i) => (
              <span
                key={pid}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1 font-medium',
                  i === 0 ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary-soft-foreground',
                )}
              >
                <span className={cn('inline-flex size-4 items-center justify-center rounded-full text-[10px]', i === 0 ? 'bg-white/25' : 'bg-primary/15')}>{i + 1}</span>
                {byId.get(pid)?.labels.en ?? pid}
                {i === 0 && <span className="font-normal opacity-80">· {t('positions.primary')}</span>}
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="tabular-nums">{t('positions.selected', { count: value.length, max: MAX_POSITIONS })}</span>
          <span className="inline-flex items-center gap-1">
            {t('positions.attacking')}
            <ArrowRightIcon className="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function PositionDisc({ position, order, selectable, ids, onToggle }: {
  position: Position;
  /** Index in the selection, -1 when not selected. */
  order: number;
  selectable: boolean;
  ids: { off: string; on: string; shadow: string; glow: string };
  onToggle: () => void;
}) {
  const selected = order >= 0;
  const { x, y } = toPitch(position.x, position.y);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (selectable) onToggle();
    }
  }

  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        role="checkbox"
        aria-checked={selected}
        aria-disabled={!selectable}
        aria-label={`${position.labels.en} (${position.id})`}
        tabIndex={selectable ? 0 : -1}
        onClick={selectable ? onToggle : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          'origin-center outline-none [transform-box:fill-box]',
          'transition-[transform,opacity] duration-150 ease-out',
          selectable ? 'cursor-pointer hover:scale-115 focus-visible:scale-115' : 'cursor-not-allowed opacity-35',
          selected && 'scale-110',
        )}
      >
        <title>{position.labels.en}</title>
        {selected && <circle r={RADIUS + 1.6} fill="#4ade80" opacity={0.55} filter={`url(#${ids.glow})`} />}
        <circle
          r={RADIUS}
          fill={`url(#${selected ? ids.on : ids.off})`}
          stroke="white"
          strokeOpacity={selected ? 0.95 : 0.6}
          strokeWidth={selected ? 0.55 : 0.35}
          filter={`url(#${ids.shadow})`}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={position.id.length > 2 ? 2.3 : 2.7}
          fontWeight={700}
          fill={selected ? 'white' : '#334155'}
          style={{ letterSpacing: '0.02em' }}
        >
          {position.id}
        </text>
        {selected && (
          <g transform={`translate(${RADIUS * 0.78} ${-RADIUS * 0.78})`}>
            <circle r={1.75} fill="white" stroke="#15803d" strokeWidth={0.3} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={2.1} fontWeight={800} fill="#15803d">
              {order + 1}
            </text>
          </g>
        )}
      </g>
    </g>
  );
}
