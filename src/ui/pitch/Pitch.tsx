import type { ReactNode } from 'react';
import { cn } from '../cn';

/** Pitch drawn in metres on a 105 × 68 reference, our team attacking left → right. */
export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;

/** Normalized 0–100 coordinates → SVG units. */
export const toPitch = (x: number, y: number) => ({ x: (x / 100) * PITCH_LENGTH, y: (y / 100) * PITCH_WIDTH });

/** Children are drawn on top in pitch units (see `toPitch`). `half` shows only the half we attack. */
export function Pitch({ children, className, title, half = false }: { children?: ReactNode; className?: string; title?: string; half?: boolean }) {
  const pad = 3;

  return (
    <svg
      viewBox={half ? `${PITCH_LENGTH / 2 - pad} ${-pad} ${PITCH_LENGTH / 2 + pad * 2} ${PITCH_WIDTH + pad * 2}` : `${-pad} ${-pad} ${PITCH_LENGTH + pad * 2} ${PITCH_WIDTH + pad * 2}`}
      className={cn('block w-full select-none', className)}
      role={title ? 'group' : undefined}
      aria-label={title}
    >
      <rect x={-pad} y={-pad} width={PITCH_LENGTH + pad * 2} height={PITCH_WIDTH + pad * 2} fill="var(--pitch-fill)" />

      {/* vector-effect isn't inherited, so it is set on every line to keep them 1px at any size. */}
      <g fill="none" stroke="var(--pitch-line)" strokeWidth={1} className="[&>*]:[vector-effect:non-scaling-stroke]">
        <rect x={0} y={0} width={PITCH_LENGTH} height={PITCH_WIDTH} />
        <line x1={PITCH_LENGTH / 2} y1={0} x2={PITCH_LENGTH / 2} y2={PITCH_WIDTH} />
        <circle cx={PITCH_LENGTH / 2} cy={PITCH_WIDTH / 2} r={9.15} />
        <rect x={0} y={13.84} width={16.5} height={40.32} />
        <rect x={PITCH_LENGTH - 16.5} y={13.84} width={16.5} height={40.32} />
        <rect x={0} y={24.84} width={5.5} height={18.32} />
        <rect x={PITCH_LENGTH - 5.5} y={24.84} width={5.5} height={18.32} />
        <path d={`M 16.5 26.7 A 9.15 9.15 0 0 1 16.5 41.3`} />
        <path d={`M ${PITCH_LENGTH - 16.5} 26.7 A 9.15 9.15 0 0 0 ${PITCH_LENGTH - 16.5} 41.3`} />
        <rect x={-1.6} y={30.34} width={1.6} height={7.32} />
        <rect x={PITCH_LENGTH} y={30.34} width={1.6} height={7.32} />
      </g>
      <g fill="var(--pitch-line)">
        <circle cx={PITCH_LENGTH / 2} cy={PITCH_WIDTH / 2} r={0.45} />
        <circle cx={11} cy={PITCH_WIDTH / 2} r={0.35} />
        <circle cx={PITCH_LENGTH - 11} cy={PITCH_WIDTH / 2} r={0.35} />
      </g>

      {children}
    </svg>
  );
}
