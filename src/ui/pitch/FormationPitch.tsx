import { useId, type KeyboardEvent } from 'react';
import type { Formation, FormationSlot } from '@/domain/catalog';
import { cn } from '../cn';
import { Pitch, toPitch } from './Pitch';

const RADIUS = 4.3;

export interface SlotOccupant {
  shirtNumber?: number;
  /** Short label under the disc (surname or initials). */
  label: string;
  /** Full name for the accessible label and tooltip. */
  fullName: string;
}

export function FormationPitch({ formation, occupants, selectedSlotId, onSlotClick, title, className }: {
  formation: Formation;
  occupants: Record<string, SlotOccupant | undefined>;
  selectedSlotId?: string;
  onSlotClick?: (slotId: string) => void;
  title: string;
  className?: string;
}) {
  const id = useId();
  const ids = { empty: `${id}-empty`, filled: `${id}-filled`, shadow: `${id}-shadow`, glow: `${id}-glow` };

  return (
    <div className={cn('overflow-hidden rounded-xl shadow-inner ring-1 ring-black/10', className)}>
      <Pitch title={title}>
        <defs>
          <radialGradient id={ids.filled} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#86efac" />
            <stop offset="0.55" stopColor="#22c55e" />
            <stop offset="1" stopColor="#15803d" />
          </radialGradient>
          <radialGradient id={ids.empty} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="var(--foreground)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--foreground)" stopOpacity="0.1" />
          </radialGradient>
          <filter id={ids.shadow} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" floodColor="#000" floodOpacity="0.4" />
          </filter>
          <filter id={ids.glow} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>

        {formation.slots.map((slot) => (
          <SlotDisc
            key={slot.id}
            slot={slot}
            occupant={occupants[slot.id]}
            selected={slot.id === selectedSlotId}
            ids={ids}
            onClick={onSlotClick ? () => onSlotClick(slot.id) : undefined}
          />
        ))}
      </Pitch>
    </div>
  );
}

function SlotDisc({ slot, occupant, selected, ids, onClick }: {
  slot: FormationSlot;
  occupant?: SlotOccupant;
  selected: boolean;
  ids: { empty: string; filled: string; shadow: string; glow: string };
  onClick?: () => void;
}) {
  const { x, y } = toPitch(slot.x, slot.y);
  const filled = occupant !== undefined;
  const name = filled ? `${slot.id}: ${occupant.shirtNumber !== undefined ? `#${occupant.shirtNumber} ` : ''}${occupant.fullName}` : slot.id;

  function onKeyDown(e: KeyboardEvent) {
    if (onClick && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <g transform={`translate(${x} ${y})`}>
      <g
        role={onClick ? 'button' : undefined}
        aria-label={name}
        aria-pressed={onClick ? selected : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(
          'origin-center outline-none [transform-box:fill-box]',
          'transition-transform duration-150 ease-out',
          onClick && 'cursor-pointer hover:scale-110 focus-visible:scale-110',
          selected && 'scale-115',
        )}
      >
        <title>{name}</title>
        {selected && <circle r={RADIUS + 2} fill="#fde047" opacity={0.75} filter={`url(#${ids.glow})`} />}
        <circle
          r={RADIUS}
          fill={`url(#${filled ? ids.filled : ids.empty})`}
          stroke={selected ? '#fde047' : filled ? 'white' : 'var(--foreground)'}
          strokeOpacity={filled || selected ? 0.95 : 0.75}
          strokeWidth={selected ? 0.6 : 0.4}
          strokeDasharray={filled ? undefined : '1.1 0.8'}
          filter={filled ? `url(#${ids.shadow})` : undefined}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={filled ? 3.4 : slot.id.length > 2 ? 2.2 : 2.6}
          fontWeight={800}
          fill={filled ? 'white' : 'var(--foreground)'}
          style={{ letterSpacing: '0.02em' }}
        >
          {filled ? (occupant.shirtNumber ?? '–') : slot.id}
        </text>
      </g>
      {filled && (
        <g transform={`translate(0 ${RADIUS + 3})`} pointerEvents="none">
          <text textAnchor="middle" dominantBaseline="central" fontSize={2.3} fontWeight={600} fill="white" stroke="#14532d" strokeWidth={0.7} paintOrder="stroke" strokeLinejoin="round">
            {occupant.label}
          </text>
        </g>
      )}
    </g>
  );
}
