import { cn } from '@/ui/cn';

/** Keep in sync with `public/favicon.svg`; drawn in `currentColor` so it follows the theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="6 6 36 36" aria-hidden className={cn('size-5 shrink-0', className)}>
      <g fill="none" stroke="currentColor" strokeWidth="3">
        <rect x="7.5" y="7.5" width="33" height="33" rx="7.5" />
        <line x1="24" y1="7.5" x2="24" y2="40.5" opacity="0.35" />
      </g>
      <circle cx="32" cy="17" r="4.5" fill="currentColor" />
    </svg>
  );
}
